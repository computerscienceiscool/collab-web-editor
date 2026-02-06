// Menu system functionality
class MenuSystem {
  constructor() {
    this.activeMenu = null;
    // Store bound handlers for cleanup
    this._boundHandlers = {
      clickOutside: null,
      menuActions: null,
      keyboardShortcuts: null
    };
    this.init();
  }

  init() {
    this.setupMenuToggling();
    this.setupMenuActions();
    this.setupKeyboardShortcuts();
    this.setupClickOutside();
  }

  destroy() {
    // Remove document-level event listeners
    if (this._boundHandlers.clickOutside) {
      document.removeEventListener('click', this._boundHandlers.clickOutside);
    }
    if (this._boundHandlers.menuActions) {
      document.removeEventListener('click', this._boundHandlers.menuActions);
    }
    if (this._boundHandlers.keyboardShortcuts) {
      document.removeEventListener('keydown', this._boundHandlers.keyboardShortcuts);
    }
    this._boundHandlers = { clickOutside: null, menuActions: null, keyboardShortcuts: null };
  }

  setupMenuToggling() {
    const menuButtons = document.querySelectorAll('[data-menu]');
    
    menuButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const menuName = button.dataset.menu;
        this.toggleMenu(menuName, button);
      });
    });
  }

  toggleMenu(menuName, button) {
    const menu = document.getElementById(`${menuName}-menu`);
    const isCurrentlyActive = this.activeMenu === menuName;

    // Close any open menu
    this.closeAllMenus();

    if (!isCurrentlyActive) {
      // Open the clicked menu
      menu.classList.add('show');
      button.classList.add('active');
      this.activeMenu = menuName;
    }
  }

  closeAllMenus() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
      menu.classList.remove('show');
    });
    document.querySelectorAll('.menu-button').forEach(button => {
      button.classList.remove('active');
    });
    this.activeMenu = null;
  }

  setupClickOutside() {
    this._boundHandlers.clickOutside = (e) => {
      if (!e.target.closest('.menu-item')) {
        this.closeAllMenus();
      }
    };
    document.addEventListener('click', this._boundHandlers.clickOutside);
  }

  setupMenuActions() {
    this._boundHandlers.menuActions = (e) => {
      const action = e.target.dataset.action;
      if (action) {
        e.preventDefault();
        this.closeAllMenus();
        this.handleAction(action);
      }
    };
    document.addEventListener('click', this._boundHandlers.menuActions);
  }

  handleAction(action) {
    // Map menu actions to existing button clicks or custom functions
    switch (action) {
      // File menu
      case 'new':
        this.newDocument();
        break;
      case 'save-txt':
        this.triggerSave('txt');
        break;
      case 'save-json':
        this.triggerSave('json');
        break;
      case 'save-cbor':
        this.triggerSave('cbor');
        break;
      case 'save-promisegrid':
        this.triggerSave('promisegrid');
        break;
      case 'save-automerge':
        this.triggerSave('automerge');
        break;
      case 'share':
        this.shareDocument();
        break;
      case 'copy-url':
        this.copyDocumentURL();
        break;

      // Edit menu
      case 'undo':
        document.getElementById('undo-button')?.click();
        break;
      case 'redo':
        document.getElementById('redo-button')?.click();
        break;
      case 'find':
        document.getElementById('search-input')?.focus();
        break;

      // Format menu
      case 'format-document':
        document.getElementById('format-button')?.click();
        break;
      case 'bold':
        document.getElementById('bold-button')?.click();
        break;
      case 'italic':
        document.getElementById('italic-button')?.click();
        break;
      case 'underline':
        document.getElementById('underline-button')?.click();
        break;
      case 'strikethrough':
        document.getElementById('strike-button')?.click();
        break;
      case 'heading1':
        document.getElementById('heading1-button')?.click();
        break;
      case 'heading2':
        document.getElementById('heading2-button')?.click();
        break;
      case 'heading3':
        document.getElementById('heading3-button')?.click();
        break;
      case 'bullet-list':
        document.getElementById('bullet-button')?.click();
        break;
      case 'numbered-list':
        document.getElementById('numbered-button')?.click();
        break;
      case 'link':
        document.getElementById('link-button')?.click();
        break;

      // Tools menu
      case 'word-count':
        this.showWordCount();
        break;
      case 'document-stats':
        this.showDocumentStats();
        break;
      case 'compress':
        this.compressDocument();
        break;
      case 'promisegrid-test':
        this.testPromiseGrid();
        break;

      // View menu
      case 'toggle-log':
        this.toggleActivityLog();
        break;
      case 'toggle-toolbar':
        this.toggleToolbar();
        break;
      case 'fullscreen':
        this.toggleFullscreen();
        break;

      // Help menu
      case 'keyboard-shortcuts':
        this.showKeyboardShortcuts();
        break;
      case 'about':
        this.showAbout();
        break;
      case 'documentation':
        this.showDocumentation();
        break;
      case 'promisegrid-info':
        this.showPromiseGridInfo();
        break;

      default:
        console.log('Unknown action:', action);
    }
  }

  // File menu methods
  newDocument() {
    if (confirm('Create a new document? This will generate a new document URL.')) {
      window.location.href = window.location.origin + window.location.pathname;
    }
  }

  triggerSave(format) {
    const saveFormat = document.getElementById('save-format');
    const saveButton = document.getElementById('save-button');
    if (saveFormat && saveButton) {
      saveFormat.value = format;
      saveButton.click();
    }
  }

  shareDocument() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: 'Collaborative Document',
        text: 'Join me in this collaborative document',
        url: url
      });
    } else {
      this.copyDocumentURL();
    }
  }

  copyDocumentURL() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      alert('Document URL copied to clipboard!');
    });
  }

  // Tools menu methods
  showWordCount() {
    const stats = document.getElementById('document-stats').textContent;
    alert(`Document Statistics:\n${stats}`);
  }

  showDocumentStats() {
    const wordCount = document.getElementById('word-count').textContent;
    const charCount = document.getElementById('char-count').textContent;
    const readingTime = document.getElementById('reading-time').textContent;
    alert(`Document Statistics:\n• ${wordCount}\n• ${charCount}\n• ${readingTime}`);
  }

  compressDocument() {
    if (window.wasmExports?.compress_document) {
      // This would integrate with your WASM compression
      console.log('Compress document functionality - integrate with WASM');
      alert('Document compression feature - check console for details');
    } else {
      alert('WASM compression not available. Make sure to run "make wasm" first.');
    }
  }

  testPromiseGrid() {
    if (window.createPromiseGridMessage) {
      try {
        const message = window.createPromiseGridMessage(
          "test-doc", 
          "menu-test", 
          0, 
          "Test message from menu", 
          "user"
        );
        console.log('PromiseGrid test message created:', message);
        alert('PromiseGrid test message created! Check console for details.');
      } catch (error) {
        alert('PromiseGrid test failed: ' + error.message);
      }
    } else {
      alert('PromiseGrid functionality not available. Make sure WASM is loaded.');
    }
  }

  // View menu methods
  toggleActivityLog() {
    const logPanel = document.getElementById('user-log');
    const toggleText = document.getElementById('log-toggle-text');
    const isVisible = logPanel.classList.contains('show');
    
    if (isVisible) {
      logPanel.classList.remove('show');
      toggleText.textContent = 'Show Activity Log';
    } else {
      logPanel.classList.add('show');
      toggleText.textContent = 'Hide Activity Log';
    }

    if (window.syncActivityLogTheme) {
      window.syncActivityLogTheme();
    }

    // Also trigger the old toggle log button for compatibility
    const oldToggleButton = document.getElementById('toggle-log');
    if (oldToggleButton) {
      oldToggleButton.click();
    }
  }

  toggleToolbar() {
    const toolbar = document.getElementById('toolbar');
    const toggleText = document.getElementById('toolbar-toggle-text');
    const isVisible = !toolbar.classList.contains('hidden');
    
    if (isVisible) {
      toolbar.classList.add('hidden');
      toggleText.textContent = 'Show Toolbar';
    } else {
      toolbar.classList.remove('hidden');
      toggleText.textContent = 'Hide Toolbar';
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // Help menu methods
  showKeyboardShortcuts() {
    const shortcuts = `Keyboard Shortcuts:

File:
• Ctrl+N - New Document
• Ctrl+O - Open

Edit:
• Ctrl+Z - Undo
• Ctrl+Y - Redo
• Ctrl+F - Find
• Ctrl+H - Find and Replace
• Ctrl+A - Select All

Format:
• Ctrl+B - Bold
• Ctrl+I - Italic
• Ctrl+U - Underline

WASM Features:
• Format button - Clean document formatting
• Search - Fast client-side search
• Export - Multiple format options including PromiseGrid CBOR`;
    alert(shortcuts);
  }

  showAbout() {
    alert(`Collaborative Text Editor

Features:
• Real-time collaboration with Automerge CRDTs
• WASM-powered text processing (Rust)
• PromiseGrid protocol integration
• Offline support with automatic sync
• Advanced formatting and export options
• Client-side search and compression

Built with Rust, WebAssembly, and JavaScript

Make sure to run "make wasm" for full functionality!`);
  }

  showDocumentation() {
    alert('Documentation: Check the docs/ folder in your project for comprehensive guides including user-guide.md, promisegrid-integration.md, and more.');
  }

  showPromiseGridInfo() {
    alert(`PromiseGrid Integration

This editor includes real PromiseGrid protocol support:
• Live CBOR message generation
• Protocol-compliant message structure  
• Official 'grid' tag (0x67726964)
• Export to PromiseGrid CBOR format

Check the browser console to see PromiseGrid messages being generated in real-time!

To test: Use any formatting button and watch the console.`);
  }

  setupKeyboardShortcuts() {
    this._boundHandlers.keyboardShortcuts = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            this.newDocument();
            break;
          case 'f':
            e.preventDefault();
            document.getElementById('search-input')?.focus();
            break;
          case 'b':
            if (!e.target.matches('input, textarea, [contenteditable]')) {
              e.preventDefault();
              document.getElementById('bold-button')?.click();
            }
            break;
          case 'i':
            if (!e.target.matches('input, textarea, [contenteditable]')) {
              e.preventDefault();
              document.getElementById('italic-button')?.click();
            }
            break;
          case 'u':
            if (!e.target.matches('input, textarea, [contenteditable]')) {
              e.preventDefault();
              document.getElementById('underline-button')?.click();
            }
            break;
        }
      }

      // ESC key closes menus
      if (e.key === 'Escape') {
        this.closeAllMenus();
      }
    };
    document.addEventListener('keydown', this._boundHandlers.keyboardShortcuts);
  }
}

// Initialize menu system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.menuSystemInstance = new MenuSystem();
});

// Export for compatibility
window.MenuSystem = MenuSystem;
