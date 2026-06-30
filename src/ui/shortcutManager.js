// File: src/ui/shortcutManager.js

/**
 * Central keyboard shortcut management system
 * Handles registration, storage, and conflict detection for all editor shortcuts
 */
export class ShortcutManager {
// Modified constructor
constructor() {
  this.shortcuts = new Map(); // action -> {key, category, description}
  this.keyToAction = new Map(); // key -> action
  this.loadDefaults();
  
  //Check if shortcuts are enabled
  this.enabled = this.loadShortcutEnabledSetting();
  
  this.loadUserCustomizations();
  
  // If it's the first visit, show a notification about shortcuts being disabled
  if (this.isFirstVisit()) {
    this.showFirstVisitNotification();
  }
}

// Modified getAction method
getAction(key) {
  // If shortcuts are disabled, always return null
  if (!this.enabled) {
    return null;
  }
  return this.keyToAction.get(key) || null;
}

//Methods to add to the class
/**
 * Check if keyboard shortcuts are enabled
 * @returns {boolean} True if shortcuts are enabled
 */
isEnabled() {
  return this.enabled;
}

/**
 *  Load the setting for whether shortcuts are enabled
 * @returns {boolean} True if shortcuts are enabled, false otherwise
 */
loadShortcutEnabledSetting() {
  try {
    // If the setting doesn't exist yet, shortcuts are disabled by default
    const setting = localStorage.getItem('keyboard-shortcuts-enabled');
    if (setting === null) {
      // First time - set to disabled by default
      localStorage.setItem('keyboard-shortcuts-enabled', 'false');
      return false;
    }
    return setting === 'true';
  } catch (error) {
    console.error('ShortcutManager: Failed to load shortcuts enabled setting:', error);
    return false; // Default to disabled on error
  }
}

/**
 * Enable or disable keyboard shortcuts
 * @param {boolean} enabled - True to enable shortcuts, false to disable
 */
setEnabled(enabled) {
  this.enabled = enabled;
  localStorage.setItem('keyboard-shortcuts-enabled', enabled.toString());
  console.log(`ShortcutManager: Keyboard shortcuts ${enabled ? 'enabled' : 'disabled'}`);
  
  // Dispatch event for other components to listen to
  window.dispatchEvent(new CustomEvent('shortcuts-toggle', { detail: { enabled } }));
}

/**
 * Check if this is the first visit
 * @returns {boolean} True if this is the first visit
 */
isFirstVisit() {
  return localStorage.getItem('keyboard-shortcuts-first-visit') === null;
}

/**
 * Show notification for first visit
 */
showFirstVisitNotification() {
  // Mark as visited
  localStorage.setItem('keyboard-shortcuts-first-visit', 'true');
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => this.createNotification());
  } else {
    this.createNotification();
  }
}

/**
 * Create the first visit notification
 */
createNotification() {
  // Create and show notification
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.innerHTML = `
    <strong>Keyboard shortcuts are disabled by default</strong>
    <p>Enable them in Tools → Preferences → Keyboard Shortcuts</p>
    <button id="enable-shortcuts-now" class="notification-button">Enable Now</button>
    <button id="close-notification" class="notification-close">×</button>
  `;
  
  document.body.appendChild(notification);
  
  // Add event listeners
  notification.querySelector('#enable-shortcuts-now').addEventListener('click', () => {
    this.setEnabled(true);
    notification.remove();
  });
  
  notification.querySelector('#close-notification').addEventListener('click', () => {
    notification.remove();
  });
  
  // Auto remove after 15 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 15000);
}



  /**
   * Load all default shortcuts from current codebase
   */
  loadDefaults() {
    const defaults = {
      // File Menu Actions
      'new': { key: 'Ctrl+N', category: 'File', description: 'New Document' },
      'open': { key: 'Ctrl+O', category: 'File', description: 'Open' },
      'make-copy': { key: 'Ctrl+Shift+S', category: 'File', description: 'Make a Copy' },
      'save-txt': { key: 'Ctrl+S', category: 'File', description: 'Save as Text' },
      'save-json': { key: 'Ctrl+Shift+J', category: 'File', description: 'Save as JSON' },
      'save-cbor': { key: 'Ctrl+Shift+B', category: 'File', description: 'Save as CBOR' },
      'save-promisegrid': { key: 'Ctrl+Shift+P', category: 'File', description: 'Save as PromiseGrid' },
      'save-automerge': { key: 'Ctrl+Shift+Y', category: 'File', description: 'Save as Automerge' },
      'share': { key: 'Ctrl+Shift+H', category: 'File', description: 'Share Document' },
      'email': { key: 'Ctrl+Shift+E', category: 'File', description: 'Email Document' },
      'copy-url': { key: 'Ctrl+Shift+U', category: 'File', description: 'Copy Room URL' },
      'print': { key: 'Ctrl+P', category: 'File', description: 'Print' },
      'rename': { key: 'F2', category: 'File', description: 'Rename Document' },
      'version-history': { key: 'Ctrl+Alt+H', category: 'File', description: 'Version History' },

      // Edit Menu Actions
      'undo': { key: 'Ctrl+Z', category: 'Edit', description: 'Undo' },
      'redo': { key: 'Ctrl+Y', category: 'Edit', description: 'Redo' },
      'redo-alt': { key: 'Ctrl+Shift+Z', category: 'Edit', description: 'Redo (Alternative)' },
      'cut': { key: 'Ctrl+X', category: 'Edit', description: 'Cut' },
      'copy': { key: 'Ctrl+C', category: 'Edit', description: 'Copy' },
      'paste': { key: 'Ctrl+V', category: 'Edit', description: 'Paste' },
      'select-all': { key: 'Ctrl+A', category: 'Edit', description: 'Select All' },
      'delete': { key: 'Delete', category: 'Edit', description: 'Delete' },
      'find': { key: 'Ctrl+F', category: 'Edit', description: 'Find' },

      // Format Menu Actions
      'format-document': { key: 'Ctrl+Shift+F', category: 'Format', description: 'Format Document' },
      'bold': { key: 'Ctrl+B', category: 'Format', description: 'Bold' },
      'italic': { key: 'Ctrl+I', category: 'Format', description: 'Italic' },
      'underline': { key: 'Ctrl+U', category: 'Format', description: 'Underline' },
      'strikethrough': { key: 'Ctrl+Shift+X', category: 'Format', description: 'Strikethrough' },
      'heading1': { key: 'Ctrl+Alt+1', category: 'Format', description: 'Heading 1' },
      'heading2': { key: 'Ctrl+Alt+2', category: 'Format', description: 'Heading 2' },
      'heading3': { key: 'Ctrl+Alt+3', category: 'Format', description: 'Heading 3' },
      'bullet-list': { key: 'Ctrl+Shift+8', category: 'Format', description: 'Bullet List' },
      'numbered-list': { key: 'Ctrl+Shift+7', category: 'Format', description: 'Numbered List' },
      'link': { key: 'Ctrl+K', category: 'Format', description: 'Insert Link' },

      // Tools Menu Actions
      'word-count': { key: 'Ctrl+Shift+C', category: 'Tools', description: 'Word Count' },
      'line-numbers': { key: 'Ctrl+Shift+L', category: 'Tools', description: 'Toggle Line Numbers' },
      'document-stats': { key: 'Ctrl+Alt+S', category: 'Tools', description: 'Document Statistics' },
      'promisegrid-test': { key: 'Ctrl+Alt+P', category: 'Tools', description: 'Test PromiseGrid Message' },
      'notification-settings': { key: 'Ctrl+Alt+N', category: 'Tools', description: 'Notification Settings' },
      'preferences': { key: 'Ctrl+Comma', category: 'Tools', description: 'Preferences' },
      'accessibility': { key: 'Ctrl+Alt+A', category: 'Tools', description: 'Accessibility' },

      // View Menu Actions
      'toggle-log': { key: 'Ctrl+Alt+L', category: 'View', description: 'Toggle Activity Log' },
      'toggle-toolbar': { key: 'Ctrl+Alt+Y', category: 'View', description: 'Toggle Toolbar' },
      'toggle-markdown-preview': { key: 'Ctrl+M', category: 'View', description: 'Toggle Markdown Preview' },
      'update-markdown-preview': { key: 'Ctrl+R', category: 'View', description: 'Update Markdown Preview' },

      // Help Menu Actions
      'about': { key: 'F1', category: 'Help', description: 'About' },
      'promisegrid-info': { key: 'Ctrl+F1', category: 'Help', description: 'PromiseGrid Integration Info' },

      // System Actions
      'close-menu': { key: 'Escape', category: 'System', description: 'Close Menus' },

      // Search Actions (from toolbar)
      'search-button': { key: 'Ctrl+Enter', category: 'Search', description: 'Execute Search' },
      'clear-search': { key: 'Ctrl+Shift+Escape', category: 'Search', description: 'Clear Search' }
    };

    // Load defaults into maps
    for (const [action, config] of Object.entries(defaults)) {
      this.shortcuts.set(action, config);
      this.keyToAction.set(config.key, action);
    }

    console.log(`ShortcutManager: Loaded ${this.shortcuts.size} default shortcuts`);
  }

  /**
   * Load user customizations from localStorage
   */
  loadUserCustomizations() {
    try {
      const stored = localStorage.getItem('keyboard-shortcuts');
      if (stored) {
        const customizations = JSON.parse(stored);
        
        // Clear existing key mappings before applying customizations
        this.keyToAction.clear();
        
        // Apply customizations
        for (const [action, customKey] of Object.entries(customizations)) {
          if (this.shortcuts.has(action)) {
            const config = this.shortcuts.get(action);
            config.key = customKey; // Update the key
            this.shortcuts.set(action, config);
            this.keyToAction.set(customKey, action);
          }
        }
        
        // Rebuild key mappings for any non-customized shortcuts
        this.shortcuts.forEach((config, action) => {
          if (!this.keyToAction.has(config.key)) {
            this.keyToAction.set(config.key, action);
          }
        });
        
        console.log(`ShortcutManager: Applied ${Object.keys(customizations).length} user customizations`);
      }
    } catch (error) {
      console.error('ShortcutManager: Failed to load customizations:', error);
    }
  }

  /**
   * Save user customizations to localStorage
   */
  saveCustomizations() {
    try {
      const customizations = {};
      
      // Only save shortcuts that differ from defaults
      this.shortcuts.forEach((config, action) => {
        customizations[action] = config.key;
      });
      
      localStorage.setItem('keyboard-shortcuts', JSON.stringify(customizations));
      console.log('ShortcutManager: Saved customizations to localStorage');
    } catch (error) {
      console.error('ShortcutManager: Failed to save customizations:', error);
    }
  }

  /**
   * Get shortcut configuration for an action
   * @param {string} action - The action name
   * @returns {Object|null} - Shortcut config or null if not found
   */
  getShortcut(action) {
    return this.shortcuts.get(action) || null;
  }


  /**
   * Get all shortcuts grouped by category
   * @returns {Object} - Categories with their shortcuts
   */
  getShortcutsByCategory() {
    const categories = {};
    
    this.shortcuts.forEach((config, action) => {
      if (!categories[config.category]) {
        categories[config.category] = [];
      }
      categories[config.category].push({ action, ...config });
    });

    return categories;
  }

  /**
   * Parse a keyboard event into a shortcut string
   * @param {KeyboardEvent} event - The keyboard event
   * @returns {string} - Shortcut string (e.g., "Ctrl+B")
   */
  parseKeyEvent(event) {
    const parts = [];
    
    if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    
    let key = event.key;
    
    // Handle special keys
    if (key === ' ') key = 'Space';
    else if (key === 'Escape') key = 'Escape';
    else if (key === 'Enter') key = 'Enter';
    else if (key === 'Delete') key = 'Delete';
    else if (key === 'Backspace') key = 'Backspace';
    else if (key === 'Tab') key = 'Tab';
    else if (key.startsWith('F') && key.length <= 3) key = key; // F1, F2, etc.
    else if (key === ',') key = 'Comma';
    else if (key.length === 1) key = key.toUpperCase();
    
    parts.push(key);
    
    return parts.join('+');
  }

  /**
   * Check if shortcut is currently available
   * @param {string} action - The action to check
   * @returns {boolean} - True if shortcut exists and is available
   */
  isShortcutAvailable(action) {
    return this.shortcuts.has(action);
  }

  /**
   * Get total number of shortcuts
   * @returns {number} - Number of registered shortcuts
   */
  getShortcutCount() {
    return this.shortcuts.size;
  }

  /**
   * List all current key combinations
   * @returns {Array} - Array of key combinations
   */
  getAllKeys() {
    return Array.from(this.keyToAction.keys());
  }

  /**
   * Check if a key combination is already in use
   * @param {string} key - Key combination to check
   * @returns {boolean} - True if key is already assigned
   */
  isKeyInUse(key) {
    return this.keyToAction.has(key);
  }
}

// Create and export global instance
export const shortcutManager = new ShortcutManager();

// Make available globally for the preferences dialog
window.shortcutManager = shortcutManager;
