// File: src/main.js
// Main entry point for @collab-editor/editor

import { initWasm } from './wasm/initWasm.js';
import { initDiffWasm } from './wasm/diffWasm.js';
import { setupDocumentStats } from './ui/documentStats.js';
import { setupEditorWithBinding } from './editor.js';
import { AutomergeSync } from './automerge-sync.js';
import { setupExportHandlers, cleanupAllListeners } from './export/handlers.js';
import { setupUserControls } from './setup/userSetup.js';
import { setupUserLogging } from './ui/logging.js';
import { AwarenessClient, createTypingIndicator, createUserList } from '@collab-editor/awareness';
import { getClientID } from './utils/clientId.js';
import { handleDocumentCopy } from './setup/documentCopy.js';
import { githubService } from './github/githubService.js';
import { showErrorBanner } from './ui/errors.js';
import { addDocument, getDocTitle, updateTitle } from './utils/documentRegistry.js';
import { config } from './config.js';

/**
 * Sanitize HTML to prevent XSS attacks.
 */
function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = html;

  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button'];
  const dangerousAttrs = ['onclick', 'onerror', 'onload', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'];

  const walk = (node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();

      // Allow disabled checkbox inputs for task lists
      const isAllowedInput = tagName === 'input' &&
        node.getAttribute('type') === 'checkbox' &&
        node.hasAttribute('disabled');

      if (dangerousTags.includes(tagName) && !isAllowedInput) {
        node.remove();
        return;
      }

      for (const attr of dangerousAttrs) {
        node.removeAttribute(attr);
      }

      for (const attr of ['href', 'src', 'action']) {
        const value = node.getAttribute(attr);
        if (value && value.trim().toLowerCase().startsWith('javascript:')) {
          node.removeAttribute(attr);
        }
      }

      const style = node.getAttribute('style');
      if (style && /expression|javascript|behavior/i.test(style)) {
        node.removeAttribute('style');
      }
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  };

  walk(template.content);
  return template.innerHTML;
}

// Version storage functions
async function saveVersionToIndexedDB(content, timestamp, docId) {
  try {
    const dbName = `versions-${docId}`;
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('versions')) {
        const store = db.createObjectStore('versions', { keyPath: 'timestamp' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const transaction = db.transaction(['versions'], 'readwrite');
      const store = transaction.objectStore('versions');
      store.add({ timestamp, content, length: content.length });
    };
  } catch (error) {
    console.error('Failed to save version:', error);
  }
}

async function getLatestVersionFromIndexedDB(docId) {
  return new Promise((resolve) => {
    const dbName = `versions-${docId}`;
    const request = indexedDB.open(dbName, 1);

    request.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('versions')) {
        resolve('');
        return;
      }

      const transaction = db.transaction(['versions'], 'readonly');
      const store = transaction.objectStore('versions');
      const index = store.index('timestamp');

      const getAllRequest = index.getAll();
      getAllRequest.onsuccess = () => {
        const versions = getAllRequest.result;
        if (versions.length >= 2) {
          versions.sort((a, b) => b.timestamp - a.timestamp);
          resolve(versions[1].content);
        } else {
          resolve('');
        }
      };
    };

    request.onerror = () => resolve('');
  });
}

// Initialize Grokker WASM
async function initGrokkerWasm() {
  if (typeof Go === 'undefined') {
    console.error("Go WASM runtime not loaded. Make sure wasm_exec.js is loaded first.");
    throw new Error('Go WASM runtime not loaded');
  }

  const go = new Go();
  try {
    console.log("Attempting to load Grokker WASM from dist/grokker.wasm");
    const result = await WebAssembly.instantiateStreaming(
      fetch('dist/grokker.wasm'),
      go.importObject
    );
    go.run(result.instance);
    console.log("Grokker WASM initialized successfully");
  } catch (error) {
    console.error("Failed to load Grokker WASM:", error);
    throw error;
  }
}

// Last saved state tracking
let lastSavedTimestamp = Date.now();
let lastSavedInterval = null;

function formatLastSaved(ts) {
  const diff = Date.now() - ts;
  if (diff < 15000) return 'Saved just now';
  if (diff < 60000) return `Saved ${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `Saved ${Math.round(diff / 60000)}m ago`;
  const d = new Date(ts);
  return `Saved at ${d.toLocaleTimeString()}`;
}

function updateLastSaved(ts = Date.now()) {
  lastSavedTimestamp = ts;
  const el = document.getElementById('last-saved');
  if (el) {
    el.textContent = formatLastSaved(lastSavedTimestamp);
  }
}

function startLastSavedTicker() {
  if (lastSavedInterval) return;
  updateLastSaved(lastSavedTimestamp);
  lastSavedInterval = setInterval(() => updateLastSaved(lastSavedTimestamp), 15000);
}

// Typing timeout
let typingTimeout = null;

// Main initialization
async function initApp() {
  try {
    await initAppInternal();
  } catch (err) {
    console.error('[App] Fatal initialization error:', err);
    showErrorBanner('Application failed to start. Please refresh the page.');
  }
}

async function initAppInternal() {
  // Initialize WASM modules
  console.log("Initializing Rust WASM...");
  try {
    await initWasm();
    console.log("Rust WASM ready!");
  } catch (err) {
    console.error("Failed to initialize Rust WASM:", err);
    showErrorBanner("Failed to load Rust WASM. Try `make wasm` and reload.");
    return;
  }

  console.log("Initializing Grokker WASM...");
  try {
    await initGrokkerWasm();
  } catch (err) {
    console.error("Failed to initialize Grokker WASM:", err);
    showErrorBanner("Failed to load Grokker WASM. Try `make grokker-wasm` and reload.");
  }

  console.log("Initializing Diff WASM...");
  try {
    await initDiffWasm();
  } catch (err) {
    console.error("Failed to initialize Diff WASM:", err);
    showErrorBanner("Failed to load diff engine. Run `make diff-wasm` and reload.");
  }

  console.log("All WASM modules ready");

  // Parse document ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const docParam = urlParams.get('doc');

  // Create and connect AutomergeSync
  const sync = new AutomergeSync();
  sync.connect();

  // Open or create document
  let documentId;
  let isNew = false;

  try {
    if (docParam) {
      await sync.openDocument(docParam);
      documentId = sync.getDocumentId();
    } else {
      documentId = sync.createDocument();
      isNew = true;
    }
  } catch (err) {
    console.error("Could not set up Automerge document:", err);
    showErrorBanner("Could not load document. Check your connection and refresh.");
    return;
  }

  const handle = sync.getHandle();
  startLastSavedTicker();

  // Register document in registry
  addDocument(documentId, getDocTitle(documentId));

  if (isNew) {
    console.log('[App] New document created. Share this URL:', window.location.href);
  }

  // Listen for changes and save versions
  handle.on('change', ({ doc }) => {
    if (doc && doc.content !== undefined) {
      const content = typeof doc.content === 'string' ? doc.content : '';
      const timestamp = Date.now();
      saveVersionToIndexedDB(content, timestamp, documentId);
      updateLastSaved(timestamp);
    }
  });

  // Setup document name display
  const docNameEl = document.querySelector('#document-name');
  if (docNameEl) {
    const shortId = documentId.replace('automerge:', '').slice(0, 8);
    docNameEl.textContent = shortId;
    docNameEl.title = `Click to copy: ${window.location.href}`;
    docNameEl.style.cursor = 'pointer';

    docNameEl.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        const original = docNameEl.textContent;
        docNameEl.textContent = 'Copied!';
        setTimeout(() => { docNameEl.textContent = original; }, 1500);
      });
    });
  }

  // Persist document title
  const titleInput = document.getElementById('document-title');
  if (titleInput) {
    const titleKey = `docTitle:${documentId}`;
    const savedTitle = localStorage.getItem(titleKey);
    if (savedTitle) {
      titleInput.value = savedTitle;
    }
    titleInput.addEventListener('input', () => {
      localStorage.setItem(titleKey, titleInput.value);
      updateTitle(documentId, titleInput.value);
    });
  }

  // Create AwarenessClient from package (not custom implementation)
  const awareness = new AwarenessClient(config.urls.awareness, {
    documentId: documentId,
    heartbeatInterval: 30000
  });
  awareness.connect();

  // Set up the editor with binding
  const editorElement = document.querySelector('#editor');
  if (!editorElement) {
    throw new Error('Editor element #editor not found');
  }

  const { view, binding, destroy: destroyEditor } = setupEditorWithBinding(
    editorElement,
    handle,
    awareness
  );

  // Connection status indicator
  const connectionStatus = document.getElementById('connection-status');
  const setConnectionStatus = (state, label) => {
    if (!connectionStatus) return;
    connectionStatus.className = `status-pill ${state}`;
    connectionStatus.textContent = label;
  };

  // Hook up UI elements
  setupUserControls(awareness);
  setupExportHandlers(handle, view);
  setupUserLogging(awareness);

  // Create typing indicator
  createTypingIndicator(awareness, {
    element: document.getElementById('typing-indicator'),
    localId: getClientID()
  });

  // Create user list
  createUserList(awareness, {
    listElement: document.getElementById('user-list'),
    countElement: document.getElementById('user-count')
  });

  // Theme toggle
  const root = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const activityLog = document.getElementById('user-log');

  const setLogThemeVars = (mode) => {
    const isDark = mode === 'dark';
    const bg = isDark ? '#0b1224' : '#ffffff';
    const border = isDark ? '#1f2937' : '#dadce0';
    const text = isDark ? '#e5e7eb' : '#333333';
    const handleBg = isDark ? '#0f172a' : '#f8f9fa';
    const handleBorder = border;
    const handleText = isDark ? '#e5e7eb' : '#3c4043';
    const handleHover = isDark ? '#111827' : '#e8eaed';

    root.style.setProperty('--user-log-bg', bg);
    root.style.setProperty('--user-log-border', border);
    root.style.setProperty('--user-log-text', text);
    root.style.setProperty('--user-log-handle-bg', handleBg);
    root.style.setProperty('--user-log-handle-border', handleBorder);
    root.style.setProperty('--user-log-handle-text', handleText);
    root.style.setProperty('--user-log-handle-hover', handleHover);

    return { bg, border, text, handleBg, handleBorder, handleText, handleHover };
  };

  const applyLogTheme = (mode) => {
    const { bg, border, text, handleBg, handleBorder, handleText, handleHover } = setLogThemeVars(mode);

    if (activityLog) {
      activityLog.style.setProperty('background-color', bg, 'important');
      activityLog.style.setProperty('border-color', border, 'important');
      activityLog.style.setProperty('color', text, 'important');
    }

    const logEntries = document.getElementById('log-entries');
    if (logEntries) {
      logEntries.style.setProperty('background-color', bg, 'important');
      logEntries.style.setProperty('color', text, 'important');
    }

    const logHandle = document.getElementById('log-drag-handle');
    if (logHandle) {
      logHandle.style.setProperty('background-color', handleBg, 'important');
      logHandle.style.setProperty('border-color', handleBorder, 'important');
      logHandle.style.setProperty('color', handleText, 'important');
      logHandle.dataset.hoverColor = handleHover;
    }
  };

  const applyTheme = (mode) => {
    if (mode === 'dark') {
      root.classList.add('theme-dark');
      if (activityLog) activityLog.classList.add('theme-dark');
      if (themeToggle) themeToggle.textContent = '\u2600\uFE0F';
    } else {
      root.classList.remove('theme-dark');
      if (activityLog) activityLog.classList.remove('theme-dark');
      if (themeToggle) themeToggle.textContent = '\uD83C\uDF19';
    }
    applyLogTheme(mode);
    localStorage.setItem('theme', mode);
  };

  const storedTheme = localStorage.getItem('theme');
  applyTheme(storedTheme === 'dark' ? 'dark' : 'light');

  const syncActivityLogTheme = () => {
    const mode = root.classList.contains('theme-dark') ? 'dark' : 'light';
    applyLogTheme(mode);
  };
  window.syncActivityLogTheme = syncActivityLogTheme;

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = root.classList.contains('theme-dark') ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  // Connection status
  window.addEventListener('online', () => setConnectionStatus('online', 'Online'));
  window.addEventListener('offline', () => setConnectionStatus('offline', 'Offline'));
  setConnectionStatus(navigator.onLine ? 'online' : 'offline', navigator.onLine ? 'Online' : 'Offline');

  // Setup document stats
  setupDocumentStats(handle, view);

  // Setup markdown preview (reusing the existing implementation)
  setupMarkdownPreviewUpdates(view, handle, sanitizeHtml);

  setTimeout(() => {
    handleDocumentCopy(view, handle);
  }, 1500);

  // Detect typing and broadcast to awareness
  view.dom.addEventListener('keydown', (e) => {
    if (window.shortcutManager && !window.shortcutManager.isEnabled() &&
        (e.ctrlKey || e.metaKey)) {
      return;
    }

    awareness.setLocalStateField('typing', true);

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      awareness.setLocalStateField('typing', false);
    }, 1500);
  });

  // Track cursor position
  view.dom.addEventListener("selectionchange", () => {
    const selection = view.state.selection.main;
    awareness.setLocalStateField("selection", { anchor: selection.anchor });
  });

  view.dom.addEventListener("mouseup", () => {
    const selection = view.state.selection.main;
    awareness.setLocalStateField("selection", { anchor: selection.anchor });
  });

  view.dom.addEventListener("keyup", () => {
    const selection = view.state.selection.main;
    awareness.setLocalStateField("selection", { anchor: selection.anchor });
  });

  // Log toggle
  const toggleLogBtn = document.getElementById('toggle-log');
  const logPanel = document.getElementById('user-log');

  if (toggleLogBtn && logPanel) {
    toggleLogBtn.addEventListener('click', () => {
      const visible = logPanel.style.display !== 'none';
      logPanel.style.display = visible ? 'none' : 'block';
      if (typeof window.syncActivityLogTheme === 'function') {
        window.syncActivityLogTheme();
      }
    });
  }

  // Make components globally available
  window.automergeHandle = handle;
  window.automergeSync = sync;
  window.awareness = awareness;
  window.getLatestVersionFromIndexedDB = getLatestVersionFromIndexedDB;

  // GitHub integration
  if (githubService.settings.token) {
    console.log("GitHub integration available");
  }
}

/**
 * Setup real-time markdown preview updates
 */
function setupMarkdownPreviewUpdates(view, handle, sanitizeHtml) {
  const convertMarkdownToHtml = (markdown) => {
    let menuSystemInstance = null;

    if (typeof window.menuSystem === 'function') {
      menuSystemInstance = new window.menuSystem();
    }

    if (menuSystemInstance && typeof menuSystemInstance.markdownToHtml === 'function') {
      return menuSystemInstance.markdownToHtml(markdown);
    } else if (window.menuSystem &&
               typeof window.menuSystem.prototype === 'object' &&
               typeof window.menuSystem.prototype.markdownToHtml === 'function') {
      return window.menuSystem.prototype.markdownToHtml(markdown);
    } else {
      // Fallback markdown converter
      const escapeMap = [];
      let result = markdown.replace(/\\([\\`*_{}[\]()#+\-.!>|])/g, (match, char) => {
        const placeholder = `\x00ESC${escapeMap.length}\x00`;
        escapeMap.push(char);
        return placeholder;
      });

      // Fenced code blocks
      result = result.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
        const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code class="language-${lang || 'plaintext'}">${escaped}</code></pre>`;
      });

      // Tables
      result = result.replace(/^[ \t]*(\|.+\|)[ \t]*\n[ \t]*(\|[-:| ]+\|)[ \t]*\n((?:[ \t]*\|.+\|[ \t]*\n?)+)/gm, (match, header, separator, body) => {
        const headerCells = header.split('|').slice(1, -1).map(cell => `<th>${cell.trim()}</th>`).join('');
        const bodyRows = body.trim().split('\n').map(row => {
          const cells = row.split('|').slice(1, -1).map(cell => `<td>${cell.trim()}</td>`).join('');
          return `<tr>${cells}</tr>`;
        }).join('');
        return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
      });

      // Blockquotes
      result = result.replace(/^\s*> (.*$)/gim, '<blockquote>$1</blockquote>');
      result = result.replace(/<\/blockquote>\n<blockquote>/g, '\n');

      // Horizontal rules
      result = result.replace(/^\s*(?:[-*_]){3,}\s*$/gm, '<hr>');

      // Headings
      result = result
        .replace(/^\s*###### (.*$)/gim, '<h6>$1</h6>')
        .replace(/^\s*##### (.*$)/gim, '<h5>$1</h5>')
        .replace(/^\s*#### (.*$)/gim, '<h4>$1</h4>')
        .replace(/^\s*### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^\s*## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^\s*# (.*$)/gim, '<h1>$1</h1>');

      // Task lists
      result = result
        .replace(/^\s*[-*+] \[x\] (.*$)/gim, '<li class="task task-done"><input type="checkbox" checked disabled> $1</li>')
        .replace(/^\s*[-*+] \[ \] (.*$)/gim, '<li class="task"><input type="checkbox" disabled> $1</li>');
      result = result.replace(/((?:^<li class="task[^"]*">.*<\/li>\n?)+)/gm, '<ul class="task-list">$1</ul>');

      // Bold, italic, strikethrough
      result = result
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>');

      // Inline code
      result = result.replace(/`(.*?)`/g, '<code>$1</code>');

      // Bullet lists
      result = result.replace(/^\s*[-*+] (.*$)/gim, '<li class="bullet">$1</li>');
      result = result.replace(/((?:^<li class="bullet">.*<\/li>\n?)+)/gm, '<ul>$1</ul>');

      // Numbered lists
      result = result.replace(/^\s*\d+\. (.*$)/gim, '<li class="numbered">$1</li>');
      result = result.replace(/((?:^<li class="numbered">.*<\/li>\n?)+)/gm, '<ol>$1</ol>');

      // Images
      result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%">');

      // Links
      result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

      // Autolinked URLs
      result = result.replace(/(?<!href="|src="|">)(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');

      // Restore escaped characters
      escapeMap.forEach((char, i) => {
        result = result.replace(`\x00ESC${i}\x00`, char);
      });

      // Line breaks
      result = result.replace(/\n/g, '<br>');

      return result;
    }
  };

  const updatePreview = () => {
    const editorContainer = document.querySelector('.editor-container');
    const previewElement = document.getElementById('markdown-preview');

    if (!previewElement) return;

    if (editorContainer && editorContainer.classList.contains('split-view')) {
      editorContainer.classList.add('loading');
      previewElement.classList.add('loading');

      setTimeout(() => {
        const content = view.state.doc.toString();
        const html = convertMarkdownToHtml(content);
        previewElement.innerHTML = sanitizeHtml(html);
        editorContainer.classList.remove('loading');
        previewElement.classList.remove('loading');
      }, 10);
    }
  };

  const debouncedUpdate = () => {
    if (window.markdownUpdateTimeout) {
      clearTimeout(window.markdownUpdateTimeout);
    }

    window.markdownUpdateTimeout = setTimeout(() => {
      updatePreview();
    }, 300);
  };

  window.updateMarkdownPreview = debouncedUpdate;

  view.dom.addEventListener('keyup', debouncedUpdate);
  view.dom.addEventListener('paste', debouncedUpdate);
  handle.on('change', debouncedUpdate);

  // Setup scroll sync
  const setupScrollSync = () => {
    const editorContainer = document.querySelector('#editor');
    const previewPane = document.getElementById('markdown-preview');

    if (!editorContainer || !previewPane) return;

    let isEditorScrolling = false;
    let isPreviewScrolling = false;

    editorContainer.addEventListener('scroll', () => {
      if (isPreviewScrolling) return;
      isEditorScrolling = true;
      const ratio = editorContainer.scrollTop / (editorContainer.scrollHeight - editorContainer.clientHeight || 1);
      previewPane.scrollTop = ratio * (previewPane.scrollHeight - previewPane.clientHeight || 1);
      setTimeout(() => { isEditorScrolling = false; }, 50);
    });

    previewPane.addEventListener('scroll', () => {
      if (isEditorScrolling) return;
      isPreviewScrolling = true;
      const ratio = previewPane.scrollTop / (previewPane.scrollHeight - previewPane.clientHeight || 1);
      editorContainer.scrollTop = ratio * (editorContainer.scrollHeight - editorContainer.clientHeight || 1);
      setTimeout(() => { isPreviewScrolling = false; }, 50);
    });
  };

  // Restore preview state
  const loadPreviewState = () => {
    try {
      return localStorage.getItem('markdown-preview-visible') === 'true';
    } catch {
      return false;
    }
  };

  if (loadPreviewState()) {
    const container = document.querySelector('.editor-container');
    if (container && !container.classList.contains('split-view')) {
      container.classList.add('split-view');
      setTimeout(() => {
        updatePreview();
        setupScrollSync();
      }, 100);
    }
  }

  window.updateMarkdownPreview = updatePreview;
}

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('[App] Unhandled error:', event.error);
  showErrorBanner('An unexpected error occurred. Some features may not work correctly.');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[App] Unhandled promise rejection:', event.reason);
  showErrorBanner('An unexpected error occurred. Some features may not work correctly.');
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  cleanupAllListeners();
  if (window.menuSystem?.destroy) window.menuSystem.destroy();
  if (window.preferencesDialog?.destroy) window.preferencesDialog.destroy();
  if (window.awareness?.disconnect) window.awareness.disconnect();
  if (window.automergeSync?.disconnect) window.automergeSync.disconnect();
});

// Run initialization
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
