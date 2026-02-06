// File: src/github/githubMenuIntegration.js
/**
 * GitHub menu integration 
 * Adds GitHub-related menu items to the application
 */
import { githubService } from './githubService.js';
import { githubDialog } from '../ui/githubDialog.js';
import { githubCommitDialog } from '../ui/githubCommitDialog.js';

/**
 * Initialize GitHub menu items
 */
export function setupGitHubMenuItems() {
  // Add GitHub items to the File menu
  addFileMenuItems();
  
  // Add GitHub settings to the Tools menu
  addToolsMenuItem();
  
  // Register keyboard shortcuts
  registerShortcuts();
  
  console.log('GitHub menu integration initialized');
}

/**
 * Add GitHub-related items to File menu
 */
function addFileMenuItems() {
  const fileMenu = document.getElementById('file-menu');
  if (!fileMenu) return;
  
  // First check if GitHub items already exist to avoid duplicates
  const existingCommitItem = fileMenu.querySelector('[data-action="github-commit"]');
  if (existingCommitItem) {
    console.log('GitHub menu items already exist in File menu');
    return;
  }
  
  // Find position to insert GitHub items (before Email or Print)
  let insertBefore = null;
  for (const item of fileMenu.children) {
    if (item.dataset.action === 'email' || item.dataset.action === 'print') {
      insertBefore = item;
      break;
    }
  }
  
  // Create a section for GitHub actions
  const section = document.createElement('div');
  section.className = 'menu-section';
  
  // Commit to GitHub menu item
  const commitItem = document.createElement('div');
  commitItem.className = 'dropdown-item';
  commitItem.dataset.action = 'github-commit';
  commitItem.innerHTML = 'Commit to GitHub <span class="keyboard-shortcut">Ctrl+Alt+G</span>';
  
  // GitHub Pull menu item
  const pullItem = document.createElement('div');
  pullItem.className = 'dropdown-item';
  pullItem.dataset.action = 'github-pull';
  pullItem.innerHTML = 'Pull from GitHub';
  
  // Add items to the section
  section.appendChild(commitItem);
  section.appendChild(pullItem);
  
  // Insert section into the File menu
  if (insertBefore) {
    fileMenu.insertBefore(section, insertBefore);
  } else {
    fileMenu.appendChild(section);
  }
  
  // Update menu handlers
  updateMenuHandlers();
}
/**
 * Add GitHub settings to Tools menu
 */
function addToolsMenuItem() {
  const toolsMenu = document.getElementById('tools-menu');
  if (!toolsMenu) return;
  
  // First check if GitHub Settings already exists to avoid duplicates
  const existingGithubItem = toolsMenu.querySelector('[data-action="github-settings"]');
  if (existingGithubItem) {
    // Item already exists, no need to add it again
    console.log('GitHub Settings menu item already exists');
    return;
  }
  
  // Find settings section in Tools menu
  let settingsSection = null;
  for (const item of toolsMenu.children) {
    if (item.className === 'menu-section' && 
        item.querySelector('[data-action="preferences"]')) {
      settingsSection = item;
      break;
    }
  }
  
  if (!settingsSection) return;
  
  // Create GitHub settings menu item
  const githubSettingsItem = document.createElement('div');
  githubSettingsItem.className = 'dropdown-item';
  githubSettingsItem.dataset.action = 'github-settings';
  githubSettingsItem.textContent = 'GitHub Settings';
  
  // Add item to the settings section
  settingsSection.appendChild(githubSettingsItem);
  
  // Update menu handlers
  updateMenuHandlers();
}

/**
 * Register GitHub keyboard shortcuts
 */
function registerShortcuts() {
  if (window.shortcutManager) {
    // Add GitHub shortcuts to shortcut manager
    const shortcuts = {
      'github-commit': { key: 'Ctrl+Alt+G', category: 'GitHub', description: 'Commit to GitHub' },
      'github-settings': { key: 'Ctrl+Alt+Shift+G', category: 'GitHub', description: 'GitHub Settings' }
    };
    
    // Register shortcuts with shortcut manager
    Object.entries(shortcuts).forEach(([action, config]) => {
      if (!window.shortcutManager.getShortcut(action)) {
        window.shortcutManager.shortcuts.set(action, config);
        window.shortcutManager.keyToAction.set(config.key, action);
      }
    });
    
    // Save shortcuts to localStorage
    window.shortcutManager.saveCustomizations();
  }
  
  // Add document-level keyboard handler
  document.addEventListener('keydown', handleGitHubShortcuts);
}

/**
 * Handle GitHub keyboard shortcuts
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleGitHubShortcuts(event) {
  // Don't handle if a modal is already open
  if (document.querySelector('.modal-overlay.show')) {
    return;
  }
  
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? event.metaKey : event.ctrlKey;
  
  // Ctrl+Alt+G: Commit to GitHub
  if (mod && event.altKey && !event.shiftKey && 
      (event.key === 'g' || event.key === 'G')) {
    event.preventDefault();
    handleGitHubCommit();
  }
  
  // Ctrl+Alt+Shift+G: GitHub Settings
  if (mod && event.altKey && event.shiftKey && 
      (event.key === 'g' || event.key === 'G')) {
    event.preventDefault();
    handleGitHubSettings();
  }
}

/**
 * Update menu action handlers to include GitHub actions
 */
function updateMenuHandlers() {
  // If MenuSystem class is accessible, extend its handleAction method
  if (window.menuSystem && window.menuSystem.prototype) {
    const originalHandleAction = window.menuSystem.prototype.handleAction;
    
    window.menuSystem.prototype.handleAction = function(action) {
      switch (action) {
        case 'github-commit':
          handleGitHubCommit();
          break;
        case 'github-pull':
          handleGitHubPull();
          break;
        case 'github-settings':
          handleGitHubSettings();
          break;
        default:
          // Call the original method for all other actions
          originalHandleAction.call(this, action);
      }
    };
  }
  
  // Add click handlers directly to the new menu items
  const commitItem = document.querySelector('[data-action="github-commit"]');
  if (commitItem) {
    commitItem.addEventListener('click', () => {
      // Close menu
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
      });
      
      handleGitHubCommit();
    });
  }
  
  const pullItem = document.querySelector('[data-action="github-pull"]');
  if (pullItem) {
    pullItem.addEventListener('click', () => {
      // Close menu
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
      });
      
      handleGitHubPull();
    });
  }
  
  const settingsItem = document.querySelector('[data-action="github-settings"]');
  if (settingsItem) {
    settingsItem.addEventListener('click', () => {
      // Close menu
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
      });
      
      handleGitHubSettings();
    });
  }
}

/**
 * Handle GitHub commit action
 */
function handleGitHubCommit() {
  // Check if GitHub integration is configured
  if (!githubService.settings.token) {
    if (confirm('GitHub integration not configured. Would you like to configure it now?')) {
      githubDialog.show();
    }
    return;
  }
  
  // Get the editor view and document content
  const view = window.editorView;
  if (!view) {
    alert('Editor not available. Please try again.');
    return;
  }
  
  // Get the Automerge handle and awareness instances
  const handle = window.automergeHandle || null;
  let awareness = null;
  
  // Try different ways to access awareness (based on your app structure)
  if (window.awareness) {
    awareness = window.awareness;
  }
  
  // Debug log the awareness object
  console.log("Awareness object for commit:", awareness);
  if (awareness) {
    console.log("Current users in document:", Array.from(awareness.getStates().entries()));
  }
  
  // Get document content
  const content = view.state.doc.toString();
  
  // Show commit dialog with awareness explicitly passed
  // Note: handle replaces ytext - the dialog may need updating to use handle
  githubCommitDialog.show(content, handle, awareness);
}

/**
 * Handle GitHub pull action
 */
function handleGitHubPull() {
  // Check if GitHub integration is configured
  if (!githubService.settings.token) {
    if (confirm('GitHub integration not configured. Would you like to configure it now?')) {
      githubDialog.show();
    }
    return;
  }
  
  // Get the editor view and document content
  const view = window.editorView;
  if (!view) {
    alert('Editor not available. Please try again.');
    return;
  }
  
  // Get the Automerge handle instance
  const handle = window.automergeHandle || null;
  
  // Show pull dialog
  if (window.githubPullDialog) {
    // Note: handle replaces ytext - the dialog uses this to update document content
    window.githubPullDialog.show(handle, view);
  } else {
    console.error('GitHub pull dialog not available');
    alert('GitHub pull functionality not available. Please check the console for errors.');
  }
}

/**
 * Handle GitHub settings action
 */
function handleGitHubSettings() {
  githubDialog.show();
}

// Check if we should initialize immediately
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit to make sure other systems are initialized
  setTimeout(setupGitHubMenuItems, 1000);
});

// Export for manual initialization
export default {
  setup: setupGitHubMenuItems
};
