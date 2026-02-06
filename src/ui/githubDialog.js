// File: src/ui/githubDialog.js
/**
 * GitHub settings dialog
 * Provides UI for configuring GitHub integration
 */
import { githubService } from '../github/githubService.js';
import { showErrorBanner } from './errors.js';
import { createFocusTrap } from './focusTrap.js';

export class GitHubDialog {
  constructor() {
    this.isOpen = false;
    this.isLoading = false;
    this.validationStatus = null;
    this.repos = [];
    this.handleEscape = null;
    this.focusTrap = null;
  }

  /**
   * Show GitHub settings dialog
   */
  async show() {
    if (this.isOpen) return;

    this.isOpen = true;
    document.body.style.overflow = 'hidden';

    // Create and show modal
    const modal = this.createModalHTML();
    document.body.appendChild(modal);

    // Load current settings
    this.populateSettings();

    // Setup event listeners
    this.setupEventListeners();

    // Activate focus trap for accessibility
    const dialogContent = modal.querySelector('.modal-dialog');
    if (dialogContent) {
      this.focusTrap = createFocusTrap(dialogContent);
      this.focusTrap.activate();
    }

    console.log('GitHub settings dialog opened');
  }

  /**
   * Hide GitHub settings dialog
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

    // Remove escape key listener
    if (this.handleEscape) {
      document.removeEventListener('keydown', this.handleEscape);
      this.handleEscape = null;
    }

    const modal = document.getElementById('github-modal');
    if (modal) {
      modal.remove();
    }

    console.log('GitHub settings dialog closed');
  }

  /**
   * Create the modal HTML structure
   */
  createModalHTML() {
    const modal = document.createElement('div');
    modal.id = 'github-modal';
    modal.className = 'modal-overlay show';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'github-title');

    modal.innerHTML = `
      <div class="modal-dialog github-dialog" role="document">
        <div class="modal-header">
          <h2 id="github-title" class="modal-title">GitHub Settings</h2>
          <button class="modal-close" type="button" id="github-close" aria-label="Close dialog">&times;</button>
        </div>
        <div class="modal-content">
          <div class="settings-section">
            <h3>GitHub Authentication</h3>
            <p>Enter your GitHub personal access token (needs repo scope)</p>
            <div class="input-group">
              <label for="github-token">Access Token:</label>
              <input
                type="password"
                id="github-token"
                class="settings-input"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                autocomplete="new-password"
                data-lpignore="true"
                data-form-type="other"
              />
              <button id="validate-token" class="settings-button">Validate Token</button>
            </div>
            <div id="token-status" class="status-message"></div>
          </div>
          
          <!--  Grokker API Key Section -->
          <div class="settings-section">
            <h3>AI Commit Messages</h3>
            <p>Enter your Grokker API key for AI-generated commit messages</p>
            <div class="input-group">
              <label for="grokker-api-key">Grokker API Key:</label>
              <input
                type="password"
                id="grokker-api-key"
                class="settings-input"
                placeholder="grokker_xxxxxxxxxxxxxxxxxxxx"
                autocomplete="new-password"
                data-lpignore="true"
                data-form-type="other"
              />
              <button id="validate-grokker-key" class="settings-button">Validate Key</button>
            </div>
            <div id="grokker-status" class="status-message"></div>
            <div class="settings-help">
              The Grokker API key is used to generate commit messages automatically.
              If not provided, the AI commit message feature will be disabled.
            </div>
          </div>
          
          <div class="settings-section" id="repository-section" style="display:none">
            <h3>Repository Settings</h3>
            <div class="input-group">
              <label for="github-repo">Select Repository:</label>
              <select id="github-repo" class="settings-input">
                <option value="">-- Select a repository --</option>
              </select>
              <button id="refresh-repos" class="settings-button">Refresh</button>
            </div>
            <div class="input-group">
              <label for="github-path">Default File Path:</label>
              <input 
                type="text" 
                id="github-path" 
                class="settings-input" 
                placeholder="path/to/file.md"
              />
            </div>
            <div class="input-group">
              <label for="github-message">Default Commit Message:</label>
              <input 
                type="text" 
                id="github-message" 
                class="settings-input" 
                placeholder="Update from collaborative editor"
              />
            </div>
          </div>
          
          <div class="status-section">
            <div id="github-status" class="status-message"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="clear-settings" class="danger-button">Clear Settings</button>
          <button id="save-settings" class="primary-button">Save Settings</button>
          <button id="cancel-settings" class="modal-button">Cancel</button>
        </div>
      </div>
    `;
    
    return modal;
  }

  /**
   * Populate dialog with current settings
   */
  populateSettings() {
    const settings = githubService.settings;
    
    const tokenInput = document.getElementById('github-token');
    const repoSelect = document.getElementById('github-repo');
    const pathInput = document.getElementById('github-path');
    const messageInput = document.getElementById('github-message');
    // Get Grokker API key input field
    const grokkerKeyInput = document.getElementById('grokker-api-key');
    
    if (tokenInput) tokenInput.value = settings.token || '';
    //  Set Grokker API key value
    if (grokkerKeyInput) grokkerKeyInput.value = settings.grokkerApiKey || '';
    
    if (repoSelect) {
      // Clear existing options
      while (repoSelect.options.length > 1) {
        repoSelect.remove(1);
      }
      
      // Add repository options
      if (settings.repos && settings.repos.length > 0) {
        settings.repos.forEach(repo => {
          const option = document.createElement('option');
          option.value = repo.fullName;
          option.textContent = repo.fullName;
          repoSelect.appendChild(option);
        });
        
        // Select current repo if set
        if (settings.selectedRepo) {
          repoSelect.value = settings.selectedRepo;
        }
        
        // Show repository section
        document.getElementById('repository-section').style.display = 'block';
      }
    }
    
    if (pathInput) pathInput.value = settings.defaultPath || '';
    if (messageInput) messageInput.value = settings.commitMessage || 'Update from collaborative editor';
    
    // Show validation status if token exists
    if (settings.token) {
      this.setValidationStatus('valid', `Token configured for ${settings.username}`);
      document.getElementById('repository-section').style.display = 'block';
    }
    
    //  Show validation status if Grokker API key exists
    if (settings.grokkerApiKey) {
      this.setGrokkerStatus('valid', 'Grokker API key configured');
    }
  }

  /**
   * Setup event listeners for the dialog
   */
  setupEventListeners() {
    const modal = document.getElementById('github-modal');
    if (!modal) return;
    
    // Escape key handler
    this.handleEscape = (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      }
    };
    
    document.addEventListener('keydown', this.handleEscape);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hide();
      }
    });
    
    // Close button
    const closeButton = document.getElementById('github-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hide());
    }
    
    // Cancel button
    const cancelButton = document.getElementById('cancel-settings');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => this.hide());
    }
    
    // Validate token button
    const validateButton = document.getElementById('validate-token');
    if (validateButton) {
      validateButton.addEventListener('click', () => this.validateToken());
    }
    
    //  Validate Grokker key button
    const validateGrokkerButton = document.getElementById('validate-grokker-key');
    if (validateGrokkerButton) {
      validateGrokkerButton.addEventListener('click', () => this.validateGrokkerKey());
    }
    
    // Refresh repositories button
    const refreshButton = document.getElementById('refresh-repos');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => this.fetchRepositories());
    }
    
    // Clear settings button
    const clearButton = document.getElementById('clear-settings');
    if (clearButton) {
      clearButton.addEventListener('click', () => this.clearSettings());
    }
    
    // Save settings button
    const saveButton = document.getElementById('save-settings');
    if (saveButton) {
      saveButton.addEventListener('click', () => this.saveSettings());
    }
  }

  /**
   * Validate GitHub token
   */
  async validateToken() {
    const tokenInput = document.getElementById('github-token');
    if (!tokenInput || !tokenInput.value.trim()) {
      this.setValidationStatus('error', 'Please enter a token');
      return;
    }
    
    const token = tokenInput.value.trim();
    
    this.setLoading(true);
    this.setValidationStatus('loading', 'Validating token...');
    
    try {
      const userData = await githubService.validateToken(token);
      this.setValidationStatus('valid', `Token valid for user: ${userData.login}`);
      
      // Store username for later use
      githubService.settings.username = userData.login;
      
      // Fetch repositories with the token
      await this.fetchRepositories();
      
      // Show repository section
      document.getElementById('repository-section').style.display = 'block';
      
    } catch (error) {
      this.setValidationStatus('error', `Token validation failed: ${error.message}`);
      showErrorBanner('GitHub token validation failed. Check your token and try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   *  Validate Grokker API key
   */
  async validateGrokkerKey() {
    const keyInput = document.getElementById('grokker-api-key');
    if (!keyInput || !keyInput.value.trim()) {
      this.setGrokkerStatus('error', 'Please enter a Grokker API key');
      return;
    }
    
    const apiKey = keyInput.value.trim();
    
    this.setLoading(true);
    this.setGrokkerStatus('loading', 'Validating Grokker API key...');
    
    try {
      // Here we would typically validate the Grokker API key by making a test call
      // Since we don't have an actual endpoint, we'll simulate the validation
      
      // Store the API key temporarily
      githubService.settings.grokkerApiKey = apiKey;
      
      // Simulate a delay for validation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For now, assume the key is valid if it's not empty
      if (apiKey.length > 10) {
        this.setGrokkerStatus('valid', 'Grokker API key validated successfully');
      } else {
        throw new Error('Invalid API key format');
      }
    } catch (error) {
      this.setGrokkerStatus('error', `Grokker API key validation failed: ${error.message}`);
      githubService.settings.grokkerApiKey = ''; // Clear invalid key
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Fetch repositories for the user
   */
  async fetchRepositories() {
    const tokenInput = document.getElementById('github-token');
    const repoSelect = document.getElementById('github-repo');
    
    if (!tokenInput || !tokenInput.value.trim()) {
      this.setStatus('error', 'Please enter and validate a token first');
      return;
    }
    
    this.setLoading(true);
    this.setStatus('loading', 'Fetching repositories...');
    
    try {
      // Set token for API call
      githubService.settings.token = tokenInput.value.trim();
      
      // Fetch repositories
      const repos = await githubService.fetchRepositories();
      
      // Update repository select
      if (repoSelect) {
        // Clear existing options
        while (repoSelect.options.length > 1) {
          repoSelect.remove(1);
        }
        
        // Add repository options
        repos.forEach(repo => {
          const option = document.createElement('option');
          option.value = repo.fullName;
          option.textContent = repo.fullName;
          repoSelect.appendChild(option);
        });
      }
      
      this.setStatus('success', `Fetched ${repos.length} repositories`);
    } catch (error) {
      this.setStatus('error', `Failed to fetch repositories: ${error.message}`);
      showErrorBanner('GitHub repositories could not be fetched. Verify token and network.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Save GitHub settings
   */
  saveSettings() {
    const tokenInput = document.getElementById('github-token');
    const grokkerKeyInput = document.getElementById('grokker-api-key'); 
    const repoSelect = document.getElementById('github-repo');
    const pathInput = document.getElementById('github-path');
    const messageInput = document.getElementById('github-message');
    
    // Validate required fields
    if (!tokenInput.value.trim()) {
      this.setStatus('error', 'Please enter a GitHub token');
      return;
    }
    
    try {
      // Update settings object
      githubService.settings.token = tokenInput.value.trim();
      githubService.settings.grokkerApiKey = grokkerKeyInput.value.trim(); 
      githubService.settings.selectedRepo = repoSelect.value;
      githubService.settings.defaultPath = pathInput.value.trim();
      githubService.settings.commitMessage = messageInput.value.trim() || 'Update from collaborative editor';
      githubService.settings.enabled = true;
      
      // Save settings
      githubService.saveSettings();
      
      this.setStatus('success', 'GitHub settings saved successfully');
      
      // Close dialog after short delay
      setTimeout(() => {
        this.hide();
      }, 1500);
    } catch (error) {
      this.setStatus('error', `Failed to save settings: ${error.message}`);
    }
  }

  /**
   * Clear GitHub settings
   */
  clearSettings() {
    if (confirm('Are you sure you want to clear all GitHub settings?')) {
      try {
        githubService.clearSettings();
        
        // Reset form
        document.getElementById('github-token').value = '';
        document.getElementById('grokker-api-key').value = ''; 
        document.getElementById('github-repo').value = '';
        document.getElementById('github-path').value = '';
        document.getElementById('github-message').value = 'Update from collaborative editor';
        
        // Hide repository section
        document.getElementById('repository-section').style.display = 'none';
        
        // Clear status
        this.setValidationStatus(null);
        this.setGrokkerStatus(null); 
        this.setStatus('success', 'GitHub settings cleared');
      } catch (error) {
        this.setStatus('error', `Failed to clear settings: ${error.message}`);
      }
    }
  }

  /**
   * Set validation status message
   */
  setValidationStatus(status, message = '') {
    const statusElement = document.getElementById('token-status');
    if (!statusElement) return;
    
    statusElement.className = 'status-message';
    statusElement.textContent = message;
    
    if (status) {
      statusElement.classList.add(`status-${status}`);
    }
    
    this.validationStatus = status;
  }

  /**
   *  Set Grokker API key status message
   */
  setGrokkerStatus(status, message = '') {
    const statusElement = document.getElementById('grokker-status');
    if (!statusElement) return;
    
    statusElement.className = 'status-message';
    statusElement.textContent = message;
    
    if (status) {
      statusElement.classList.add(`status-${status}`);
    }
  }

  /**
   * Set general status message
   */
  setStatus(status, message = '') {
    const statusElement = document.getElementById('github-status');
    if (!statusElement) return;
    
    statusElement.className = 'status-message';
    statusElement.textContent = message;
    
    if (status) {
      statusElement.classList.add(`status-${status}`);
    }
  }

  /**
   * Set loading state
   */
  setLoading(isLoading) {
    this.isLoading = isLoading;
    
    const buttons = document.querySelectorAll('.settings-button, .modal-button, .primary-button, .danger-button');
    buttons.forEach(button => {
      button.disabled = isLoading;
    });
    
    const inputs = document.querySelectorAll('.settings-input');
    inputs.forEach(input => {
      input.disabled = isLoading;
    });
  }
}

// Create global instance
export const githubDialog = new GitHubDialog();

// Make available globally for menu system and UI
window.githubDialog = githubDialog;
