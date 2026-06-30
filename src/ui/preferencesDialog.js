// File: src/ui/preferencesDialog.js

import { createFocusTrap } from './focusTrap.js';

/**
 * Keyboard shortcut preferences dialog
 * Provides UI for viewing and editing keyboard shortcuts
 */
export class PreferencesDialog {
  constructor() {
    this.isOpen = false;
    this.editingAction = null;
    this.editingElement = null;
    this.keydownHandler = null;
    this.focusTrap = null;
  }

  /**
   * Show the preferences dialog
   */
  show() {
    if (this.isOpen) return;

    this.isOpen = true;
    document.body.style.overflow = 'hidden';

    // Create and show modal
    const modal = this.createModalHTML();
    document.body.appendChild(modal);

    // Populate with current shortcuts
    this.populateShortcuts();

    // Setup event listeners
    this.setupEventListeners();

    // Activate focus trap for accessibility
    const dialogContent = modal.querySelector('.modal-dialog');
    if (dialogContent) {
      this.focusTrap = createFocusTrap(dialogContent);
      this.focusTrap.activate();
    }

    console.log('Preferences dialog opened');
  }

  /**
   * Hide the preferences dialog
   */
  hide() {
    if (!this.isOpen) return;

    this.isOpen = false;
    document.body.style.overflow = 'auto';

    // Deactivate focus trap before removing modal
    if (this.focusTrap) {
      this.focusTrap.deactivate();
      this.focusTrap = null;
    }

    const modal = document.getElementById('preferences-modal');
    if (modal) {
      // Clean up event listeners
      if (this.keydownHandler) {
        document.removeEventListener('keydown', this.keydownHandler);
        this.keydownHandler = null;
      }
      modal.remove();
    }

    this.editingAction = null;
    this.editingElement = null;
    console.log('Preferences dialog closed');
  }

  /**
   * Complete cleanup for page unload
   * Ensures no listeners remain attached to document
   */
  destroy() {
    this.hide();
    // Additional cleanup if needed in future
  }

  /**
   * Create the modal HTML structure
   */
  createModalHTML() {
    const modal = document.createElement('div');
    modal.id = 'preferences-modal';
    modal.className = 'modal-overlay show';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'preferences-title');
    
    modal.innerHTML = `
      <div class="modal-dialog preferences-dialog" role="document">
        <div class="modal-header">
          <h2 id="preferences-title" class="modal-title">Keyboard Shortcuts</h2>
          <button class="modal-close" type="button" aria-label="Close dialog">&times;</button>
        </div>
        <div class="modal-content">
          <div class="preferences-actions">
            <div class="enable-shortcuts-toggle">
            <label for="enable-shortcuts" class="toggle-label">
              <input type="checkbox" id="enable-shortcuts" ${window.shortcutManager.isEnabled() ? 'checked' : ''}>
              <span>Enable keyboard shortcuts</span>
            </label>
          </div>
            <button id="reset-shortcuts" class="preferences-button" type="button">Reset to Defaults</button>
            <div class="preferences-info">
              Click any shortcut to edit it. Press Escape to cancel editing.
            </div>
          </div>
          
          <div class="shortcuts-container" id="shortcuts-container">
            <!-- Shortcuts will be populated here -->
          </div>
        </div>
        <div class="modal-footer">
          <button class="modal-button" type="button">Close</button>
        </div>
      </div>
    `;
    
    return modal;
  }

  /**
   * Populate shortcuts in the dialog organized by category
   */
  populateShortcuts() {
    const container = document.getElementById('shortcuts-container');
    if (!container || !window.shortcutManager) return;
    
    const shortcuts = window.shortcutManager.getShortcutsByCategory();
    container.innerHTML = '';
    
    // Sort categories in logical order
    const categoryOrder = ['File', 'Edit', 'Format', 'Tools', 'View', 'Help', 'Search', 'System'];
    const sortedCategories = categoryOrder.filter(cat => shortcuts[cat]);
    
    sortedCategories.forEach(category => {
      const items = shortcuts[category];
      
      const categoryDiv = document.createElement('div');
      categoryDiv.className = 'shortcut-category';
      
      const categoryTitle = document.createElement('h3');
      categoryTitle.className = 'category-title';
      categoryTitle.textContent = category;
      categoryDiv.appendChild(categoryTitle);
      
      const itemsDiv = document.createElement('div');
      itemsDiv.className = 'shortcut-items';
      
      items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'shortcut-item';
        
        const descDiv = document.createElement('div');
        descDiv.className = 'shortcut-description';
        descDiv.textContent = item.description;
        
        const keyContainer = document.createElement('div');
        keyContainer.className = 'shortcut-key-container';
        
        const keySpan = document.createElement('span');
        keySpan.className = 'shortcut-key';
        keySpan.setAttribute('data-action', item.action);
        keySpan.textContent = item.key;
        
        keyContainer.appendChild(keySpan);
        itemDiv.appendChild(descDiv);
        itemDiv.appendChild(keyContainer);
        itemsDiv.appendChild(itemDiv);
      });
      
      categoryDiv.appendChild(itemsDiv);
      container.appendChild(categoryDiv);
    });
  }

  /**
   * Setup event listeners for the dialog
   */
  setupEventListeners() {
    const modal = document.getElementById('preferences-modal');
    if (!modal) return;
    
    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hide();
      }
    });
    
    // Close button in header
    const headerCloseButton = modal.querySelector('.modal-close');
    if (headerCloseButton) {
      headerCloseButton.addEventListener('click', () => {
        this.hide();
      });
    }
    
    // Close button in footer
    const footerCloseButton = modal.querySelector('.modal-footer .modal-button');
    if (footerCloseButton) {
      footerCloseButton.addEventListener('click', () => {
        this.hide();
      });
    }
    
    // Escape key to close or cancel editing
    this.keydownHandler = this.handleKeyDown.bind(this);
    document.addEventListener('keydown', this.keydownHandler);

    // Click on shortcut keys to edit them
    modal.addEventListener('click', (e) => {
      if (e.target.matches('.shortcut-key')) {
        e.preventDefault();
        e.stopPropagation();
        const action = e.target.dataset.action;
        this.startEditing(action, e.target);
      }
    });
    
    // Reset button
    const resetButton = document.getElementById('reset-shortcuts');
    if (resetButton) {
      resetButton.addEventListener('click', this.resetToDefaults.bind(this));
    }
    // toggle event handler
    const shortcutsToggle = document.getElementById('enable-shortcuts');
    if (shortcutsToggle) {
      shortcutsToggle.addEventListener('change', () => {
        if (window.shortcutManager) {
          window.shortcutManager.setEnabled(shortcutsToggle.checked);
          this.showTemporaryMessage(`Keyboard shortcuts ${shortcutsToggle.checked ? 'enabled' : 'disabled'}`);
        }
      });
    }
  }

  /**
   * Handle keydown events during editing
   */
  handleKeyDown(event) {
    if (!this.isOpen) return;
    
    if (event.key === 'Escape') {
      if (this.editingAction) {
        this.cancelEditing();
      } else {
        this.hide();
      }
      return;
    }
    
    if (this.editingAction) {
      event.preventDefault();
      const keyString = this.parseKeyEvent(event);
      if (keyString) {
        this.handleShortcutInput(keyString);
      }
    }
  }

  /**
   * Parse keyboard event to shortcut string
   */
    parseKeyEvent(event) {
      const parts = [];
      
      if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
      if (event.altKey) parts.push('Alt');
      if (event.shiftKey) parts.push('Shift');
      
      let key = event.key;
      
      // Skip modifier keys themselves
      if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') {
        return '';
      }
      
      // Handle special keys
      if (key === ' ') key = 'Space';
      else if (key === 'Escape') key = 'Escape';
      else if (key === 'Enter') key = 'Enter';
      else if (key === 'Delete') key = 'Delete';
      else if (key === ',') key = 'Comma';
      else if (key.startsWith('F') && key.length <= 3) key = key; // F1, F2, etc.
      else if (key.length === 1) key = key.toUpperCase();
      
      // Debug log to see what we're getting
      console.log('Key event:', { key: event.key, parts, finalKey: key });
      
      // Only add the key if we have modifiers OR it's a special key
      if (parts.length === 0 && !/^(F\d+|Escape|Enter|Delete|Space)$/.test(key)) {
        return '';
      }
      
      parts.push(key);
      return parts.join('+');
    }
  /**
   * Start editing a shortcut
   */
  startEditing(action, element) {
    // Cancel any existing editing
    this.cancelEditing();
    
    this.editingAction = action;
    this.editingElement = element;
    
    element.classList.add('editing');
    element.textContent = 'Press keys...';
    
    console.log(`Editing shortcut for: ${action}`);
  }

  /**
   * Cancel editing and restore original shortcut
   */
  cancelEditing() {
    if (this.editingAction && this.editingElement) {
      this.editingElement.classList.remove('editing');
      const shortcut = window.shortcutManager.getShortcut(this.editingAction);
      if (shortcut) {
        this.editingElement.textContent = shortcut.key;
      }
    }
    
    this.editingAction = null;
    this.editingElement = null;
  }

  /**
   * Handle new shortcut input during editing
   */
  handleShortcutInput(keyString) {
    if (!this.editingAction || !this.editingElement) return;
    
    // Skip empty key strings
    if (!keyString || keyString.trim() === '') return;
    
    // Basic validation
    if (!this.isValidShortcut(keyString)) {
      this.showTemporaryMessage('Invalid shortcut. Use Ctrl, Alt, or Shift + another key.');
      return;
    }
    
    // Check for conflicts
    const existingAction = window.shortcutManager.getAction(keyString);
    if (existingAction && existingAction !== this.editingAction) {
      const existingShortcut = window.shortcutManager.getShortcut(existingAction);
      this.showTemporaryMessage(`"${keyString}" is already used by "${existingShortcut.description}"`);
      return;
    }
    
    // Update the shortcut
    const success = this.updateShortcut(this.editingAction, keyString);
    if (success) {
      this.editingElement.textContent = keyString;
      this.editingElement.classList.remove('editing');
      this.showTemporaryMessage(`Updated to "${keyString}"`);
      this.editingAction = null;
      this.editingElement = null;
    }
  }

  /**
   * Update a shortcut
   */
  updateShortcut(action, newKey) {
    try {
      // Update shortcut manager
      const shortcut = window.shortcutManager.getShortcut(action);
      if (!shortcut) return false;
      
      const oldKey = shortcut.key;
      
      // Remove old mapping
      window.shortcutManager.keyToAction.delete(oldKey);
      
      // Add new mapping
      shortcut.key = newKey;
      window.shortcutManager.keyToAction.set(newKey, action);
      
      // Save to localStorage
      window.shortcutManager.saveCustomizations();
      
      console.log(`Updated ${action}: ${oldKey} → ${newKey}`);
      return true;
    } catch (error) {
      console.error('Failed to update shortcut:', error);
      return false;
    }
  }

  /**
   * Check if shortcut is valid
   */
  isValidShortcut(keyString) {
    // Must have at least one modifier (except function keys and escape)
    if (!/^(F\d+|Escape)$/.test(keyString) && !/^(Ctrl|Alt|Shift)/.test(keyString)) {
      return false;
    }
    return true;
  }

  /**
   * Reset all shortcuts to defaults
   */
  resetToDefaults() {
    const confirmed = confirm('Reset all keyboard shortcuts to defaults? This cannot be undone.');
    
    if (confirmed) {
      // Clear localStorage
      localStorage.removeItem('keyboard-shortcuts');
      
      // Reload shortcut manager
      window.shortcutManager.loadDefaults();
      window.shortcutManager.loadUserCustomizations();
      
      // Refresh the display
      this.populateShortcuts();
      
      this.showTemporaryMessage('Reset to defaults');
      console.log('Shortcuts reset to defaults');
    }
  }

  /**
   * Show a temporary message
   */
  showTemporaryMessage(message) {
    // Remove any existing messages
    const existing = document.querySelector('.preferences-message');
    if (existing) existing.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'preferences-message';
    messageDiv.textContent = message;
    
    const modal = document.querySelector('.preferences-dialog');
    if (modal) {
      modal.appendChild(messageDiv);
      
      setTimeout(() => {
        if (messageDiv.parentNode) {
          messageDiv.remove();
        }
      }, 2000);
    }
  }
}

// Create global instance
export const preferencesDialog = new PreferencesDialog();

// Make available globally for modal buttons and menu system
window.preferencesDialog = preferencesDialog;
