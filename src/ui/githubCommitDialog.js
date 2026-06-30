// File: src/ui/githubCommitDialog.js
/**
 * GitHub commit dialog
 * Handles the process of committing a document to GitHub
 */
import { githubService } from '../github/githubService.js';
import { showErrorBanner } from './errors.js';

export class GitHubCommitDialog {
  constructor() {
    this.isOpen = false;
    this.isLoading = false;
    this.documentContent = '';
    this.handle = null;  // Automerge handle (replaces ytext)
    this.awareness = null;
    this.handleEscape = null;
    this.grokkerGenerating = false; //  Track if grokker is generating a message
    this.executingCommand = false; //  Track if a command is being executed
    this.previousVersion = null;    // Store previous version for diff generation
  }

  getPreviousVersion() {
    // Simple: use 80% of current content as "previous version" for demo
    if (this.documentContent) {
      const lines = this.documentContent.split('\n');
      const keepLines = Math.floor(lines.length * 0.8);
      this.previousVersion = lines.slice(0, keepLines).join('\n');
    }
  }

  /**
   * Show GitHub commit dialog
   * @param {string} content - Document content to commit
   * @param {Object} handle - Automerge document handle (replaces ytext)
   * @param {Object} awareness - Awareness instance for co-authors
   */
  show(content, handle, awareness) {
    if (this.isOpen) return;
    
    this.isOpen = true;
    document.body.style.overflow = 'hidden';
    
    this.documentContent = content;
    this.getPreviousVersion(); // Capture previous version for diff generation
    this.handle = handle;  // Store Automerge handle
    this.awareness = awareness;
    
    // Create and show modal
    const modal = this.createModalHTML();
    document.body.appendChild(modal);
    
    // Populate with current settings
    this.populateSettings();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Populate co-authors
    this.populateCoAuthors();
    
    console.log('GitHub commit dialog opened');
  }

  /**
   * Hide GitHub commit dialog
   */
  hide() {
    if (!this.isOpen) return;
    
    this.isOpen = false;
    document.body.style.overflow = 'auto';
    
    // Remove escape key listener
    if (this.handleEscape) {
      document.removeEventListener('keydown', this.handleEscape);
      this.handleEscape = null;
    }
    
    const modal = document.getElementById('github-commit-modal');
    if (modal) {
      modal.remove();
    }
    
    // Reset state
    this.documentContent = '';
    this.handle = null;
    this.awareness = null;
    this.grokkerGenerating = false;
    this.executingCommand = false;
    
    console.log('GitHub commit dialog closed');
  }

  /**
   * Create the modal HTML structure
   */
  createModalHTML() {
    const modal = document.createElement('div');
    modal.id = 'github-commit-modal';
    modal.className = 'modal-overlay show';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'commit-title');
    
    modal.innerHTML = `
      <div class="modal-dialog github-commit-dialog">
        <div class="modal-header">
          <h2 id="commit-title" class="modal-title">Commit to GitHub</h2>
          <button class="modal-close" type="button" id="commit-close">&times;</button>
        </div>
        <div class="modal-content">
          <div class="settings-section">
            <h3>Repository Information</h3>
            <div class="input-group">
              <label for="commit-repo">Repository:</label>
              <select id="commit-repo" class="settings-input">
                <option value="">-- Select a repository --</option>
              </select>
            </div>
            <div class="input-group">
              <label for="commit-path">File Path:</label>
              <input 
                type="text" 
                id="commit-path" 
                class="settings-input" 
                placeholder="path/to/file.md"
              />
            </div>
          </div>
          
          <div class="settings-section">
            <h3>Commit Details</h3>
            <div class="input-group">
              <label for="commit-message">Commit Message:</label>
              <textarea 
                id="commit-message" 
                class="settings-input commit-textarea" 
                placeholder="Describe your changes..."
                rows="5"
                style="resize: vertical; min-height: 100px; max-height: 300px;"
              ></textarea>
            </div>
            <div class="checkbox-group">
              <input type="checkbox" id="use-ai-message" class="settings-checkbox" />
              <label for="use-ai-message">Create commit message using AI (via Grokker)</label>
            </div>
            <div id="ai-status" class="status-message" style="margin-top: 8px;"></div>
          </div>
          
          <div class="settings-section">
            <h3>Co-Authors</h3>
            <p class="settings-help">The following collaborators will be included as co-authors:</p>
            <div id="co-authors-list" class="co-authors-list">
              <div class="co-author-placeholder">No other collaborators detected</div>
            </div>
          </div>
          
          <div class="status-section">
            <div id="commit-status" class="status-message"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="configure-github" class="secondary-button">Configure GitHub</button>
          <button id="execute-commit" class="primary-button">Commit to GitHub</button>
          <button id="cancel-commit" class="modal-button">Cancel</button>
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
    
    const repoSelect = document.getElementById('commit-repo');
    const pathInput = document.getElementById('commit-path');
    const messageInput = document.getElementById('commit-message');
    const aiCheckbox = document.getElementById('use-ai-message');
    
    if (!settings.enabled || !settings.token) {
      this.setStatus('warning', 'GitHub integration not configured. Please configure first.');
    }
    
    //  Disable AI checkbox if Grokker API key is not configured
    if (!settings.grokkerApiKey) {
      if (aiCheckbox) {
        aiCheckbox.disabled = true;
        const aiStatusEl = document.getElementById('ai-status');
        if (aiStatusEl) {
          aiStatusEl.className = 'status-message status-warning';
          aiStatusEl.textContent = 'Grokker API key not configured. Please configure in GitHub Settings.';
        }
      }
    }
    
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
      }
    }
    
    // Set document title as filename if path not specified
    const titleInput = document.getElementById('document-title');
    let defaultFilename = 'document.md';
    if (titleInput && titleInput.value) {
      defaultFilename = `${titleInput.value.trim().replace(/\s+/g, '-').toLowerCase()}.md`;
    }
    
    if (pathInput) {
      pathInput.value = settings.defaultPath || defaultFilename;
    }
    
    if (messageInput) {
      messageInput.value = settings.commitMessage || 'Update from collaborative editor';
    }
    
    // Set AI checkbox state from settings
    if (aiCheckbox.checked && settings.grokkerApiKey) {
      // Add a small delay to ensure documentContent is available
      setTimeout(() => {
        if (this.documentContent) {
          this.generateCommitMessage();
        } else {
          console.warn("Document content not available yet, skipping auto-generation");
          const aiStatusEl = document.getElementById('ai-status');
          if (aiStatusEl) {
            aiStatusEl.className = 'status-message status-warning';
            aiStatusEl.textContent = 'Check the box again to generate a commit message';
          }
        }
      }, 500);
     }
    }

  /**
   * Setup event listeners for the dialog
   */
  setupEventListeners() {
    const modal = document.getElementById('github-commit-modal');
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
    const closeButton = document.getElementById('commit-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hide());
    }
    
    // Cancel button
    const cancelButton = document.getElementById('cancel-commit');
    if (cancelButton) {
      cancelButton.addEventListener('click', () => this.hide());
    }
    
    // Configure GitHub button
    const configButton = document.getElementById('configure-github');
    if (configButton) {
      configButton.addEventListener('click', () => {
        this.hide();
        if (window.githubDialog) {
          window.githubDialog.show();
        }
      });
    }
    
    // Commit button
    const commitButton = document.getElementById('execute-commit');
    if (commitButton) {
      commitButton.addEventListener('click', () => this.executeCommit());
    }
    
    // AI commit message checkbox
    const aiCheckbox = document.getElementById('use-ai-message');
    if (aiCheckbox) {
      aiCheckbox.addEventListener('change', () => this.handleAIMessageCheckbox());
    }
  }

  /**
   * Handle the AI message checkbox change
   */
  handleAIMessageCheckbox() {
    const checkbox = document.getElementById('use-ai-message');
    if (!checkbox) return;
    
    // Save preference in settings
    githubService.settings.useAICommitMessage = checkbox.checked;
    githubService.saveSettings();
    
    // Generate message if checked
    if (checkbox.checked) {
      // Check if Grokker API key is configured
      if (!githubService.settings.grokkerApiKey) {
        const aiStatusEl = document.getElementById('ai-status');
        if (aiStatusEl) {
          aiStatusEl.className = 'status-message status-error';
          aiStatusEl.textContent = 'Grokker API key not configured. Please configure in GitHub Settings.';
        }
        return;
      }
      
      this.generateCommitMessage();
    }
  }
   /**
   * Generate a commit message using Grokker
   */
    async generateCommitMessage() {
      if (this.grokkerGenerating) return; // Prevent multiple simultaneous generations
     // Add near the top of generateCommitMessage():
      if (!this.documentContent) {
        console.error("Cannot generate commit message: document content is empty");
        if (aiStatusEl) {
          aiStatusEl.className = 'status-message status-error';
          aiStatusEl.textContent = 'Cannot generate commit message: document content is empty';
        }
        this.grokkerGenerating = false;
        this.setLoading(false);
        return;
      } 
      console.log("Document content for analysis:", this.documentContent.substring(0, 100) + "...");


        
      const messageInput = document.getElementById('commit-message');
      const pathInput = document.getElementById('commit-path');
      const aiStatusEl = document.getElementById('ai-status');
      
      if (!messageInput || !pathInput) return;
      
      // Check if Grokker API key is configured
      if (!githubService.settings.grokkerApiKey) {
        if (aiStatusEl) {
          aiStatusEl.className = 'status-message status-error';
          aiStatusEl.textContent = 'Grokker API key not configured. Please configure in GitHub Settings.';
        }
        return;
      }
      
      this.grokkerGenerating = true;
      
      if (aiStatusEl) {
        aiStatusEl.className = 'status-message status-loading';
        aiStatusEl.textContent = 'Generating commit message with Grokker...';
      }
      
      // Disable UI while generating
      this.setLoading(true);
      
      try {
        // Get file path for context
        const filePath = pathInput.value.trim() || 'document.md';
        
        console.log("GROKKER INTEGRATION DEBUG:");
        console.log("API Key configured:", !!githubService.settings.grokkerApiKey);
        console.log("Document content length:", this.documentContent.length);
        console.log("File path:", filePath);
        console.log("WASM function available:", typeof window.generateCommitMessage);
        
        // Try to use WASM first if available
        if (typeof window.generateCommitMessage === 'function') {
          try {
            console.log("Using WASM commit message generator");
              

            console.log("WASM function exists:", typeof window.generateCommitMessage);
            console.log("Document content length:", this.documentContent?.length);
            console.log("Document content preview:", this.documentContent?.substring(0, 100));
            console.log("API key configured:", !!githubService.settings.grokkerApiKey);
            console.log("Model:", "gpt-3.5-turbo");

            let analysisContent = this.documentContent;

            // Generate diff if we have previous version
            if (this.previousVersion && typeof window.generateUnifiedDiff === 'function') {
              try {
                const diff = window.generateUnifiedDiff(this.previousVersion, this.documentContent);
                analysisContent = `File: ${filePath}\n\nChanges:\n${diff}`;
                console.log('Generated diff for AI analysis');
              } catch (e) {
                console.warn('Diff generation failed:', e);
              }
            }

            const result = await window.generateCommitMessage({
              content: analysisContent,
              apiKey: githubService.settings.grokkerApiKey,
              model: "grokker"
            });
              
            console.log("WASM generation result:", result);
            
            // Update message input with the generated message
            messageInput.value = result.fullMessage;
            
            if (aiStatusEl) {
              aiStatusEl.className = 'status-message status-success';
              aiStatusEl.textContent = 'Commit message generated successfully with Grokker WASM!';
            }
            return;
          } catch (wasmError) {
            console.error("WASM commit generation failed:", wasmError);
            // Continue with fallback methods
          }
        } else {
          console.warn("WASM generateCommitMessage function not available - check if grokker.wasm is loaded properly");
        }
        
        // Fallback: Try to make an API call directly
        try {
          console.log("Attempting to call Grokker API directly");
          
          // Create a simple API endpoint URL
          const apiUrl = 'https://api.example.com/grokker/commit'; // Replace with actual endpoint
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${githubService.settings.grokkerApiKey}`
            },
            body: JSON.stringify({
              content: this.documentContent,
              filePath: filePath
            })
          });
          
          if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
          }
          
          const data = await response.json();
          const commitMessage = data.commitMessage;
          
          // Update the message input with the generated message
          messageInput.value = commitMessage;
          
          if (aiStatusEl) {
            aiStatusEl.className = 'status-message status-success';
            aiStatusEl.textContent = 'Commit message generated successfully via API!';
          }
          
          console.log("API generation successful");
          return;
          
        } catch (apiError) {
          console.error("API generation failed:", apiError);
          // Fall through to final fallback
        }
        
        // Final fallback - use a more generic approach instead of hardcoded messages
        console.log("All Grokker methods failed, using generic commit message generator");
        
        const fileExt = filePath.split('.').pop().toLowerCase();
        const fileName = filePath.split('/').pop();
        
        // Create a simple commit message based on filename and content analysis
        let title = '';
        let body = '';
        
        // Try to determine commit type from file extension
        let commitType = 'update';
        
        switch (fileExt) {
          case 'md':
          case 'markdown':
          case 'txt':
            commitType = 'docs';
            break;
          case 'js':
          case 'jsx':
          case 'ts':
          case 'tsx':
            commitType = 'feat';
            break;
          case 'css':
          case 'scss':
          case 'less':
            commitType = 'style';
            break;
          case 'test.js':
          case 'spec.js':
          case 'test.ts':
          case 'spec.ts':
            commitType = 'test';
            break;
        }
        
        // Simple analysis of content to detect common patterns
        const contentPreview = this.documentContent.substring(0, 500).toLowerCase();
        if (contentPreview.includes('fix') || contentPreview.includes('bug') || contentPreview.includes('issue')) {
          commitType = 'fix';
        } else if (contentPreview.includes('test')) {
          commitType = 'test';
        }
        
        // Generate title based on file
        title = `${commitType}: update ${fileName}`;
        
        // Generate generic bullet points
        body = `- Updated content in ${fileName}\n- Improved formatting\n- Added new information`;
        
        // Combine into commit message
        const commitMessage = `${title}\n\n${body}`;
        messageInput.value = commitMessage;
        
        // Update status
        if (aiStatusEl) {
          aiStatusEl.className = 'status-message status-warning';
          aiStatusEl.textContent = 'Grokker integration failed - generated a fallback commit message.';
        }
        
      } catch (error) {
        console.error('Failed to generate commit message:', error);
        
        if (aiStatusEl) {
          aiStatusEl.className = 'status-message status-error';
          aiStatusEl.textContent = `Failed to generate commit message: ${error.message}`;
        }
      } finally {
        this.grokkerGenerating = false;
        this.setLoading(false);
      }
    } 
  
   /*
   * Execute grok command to generate commit message
   */
  async executeGrokCommand() {
    if (this.executingCommand) {
      throw new Error('Command already executing');
    }
    
    this.executingCommand = true;
    
    try {
      const aiStatusEl = document.getElementById('ai-status');
      
      if (aiStatusEl) {
        aiStatusEl.textContent = 'Executing grok command...';
      }
      
      // Simulate the execution of the grok command
      // In a real environment, this would be a server-side endpoint that executes the command
      
      // For now, we'll simulate a delay and a response
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Extract the file extension from the file path
      const filePath = document.getElementById('commit-path').value.trim() || 'document.md';
      const fileExt = filePath.split('.').pop().toLowerCase();
      
      // Generate a different commit message based on file type
      let message;
      
      switch (fileExt) {
        case 'md':
        case 'markdown':
          message = 'docs: update documentation\n\nUpdated documentation with latest changes and examples.\nImproved readability and fixed formatting issues.';
          break;
        case 'js':
        case 'jsx':
          message = 'feat(ui): enhance GitHub integration\n\nImplemented AI-generated commit messages using grokker.\n- Added API key configuration\n- Enhanced commit dialog UI\n- Added error handling for missing keys';
          break;
        case 'css':
          message = 'style: improve UI appearance\n\nEnhanced visual design for better usability.\n- Updated color scheme\n- Improved spacing and alignment\n- Fixed responsive layout issues';
          break;
        case 'html':
          message = 'feat(ui): update HTML structure\n\nImproved document structure for better accessibility.\n- Added ARIA attributes\n- Improved semantic HTML elements\n- Enhanced form controls';
          break;
        default:
          message = `feat: update ${filePath.split('/').pop()}\n\nMade several improvements to the document:\n- Enhanced content structure\n- Added new sections\n- Fixed formatting issues\n- Improved overall readability`;
      }
      
      return message;
    } catch (error) {
      console.error('Error executing grok command:', error);
      throw new Error(`Grok command failed: ${error.message}`);
    } finally {
      this.executingCommand = false;
    }
  }

  /**
   * Populate co-authors from awareness
   */
  populateCoAuthors() {
    const coAuthorsList = document.getElementById('co-authors-list');
    if (!coAuthorsList) return;
    
    // Clear existing list
    coAuthorsList.innerHTML = '';
    
    // Check if awareness is available
    if (!this.awareness) {
      console.warn('Awareness not available for co-author detection');
      coAuthorsList.innerHTML = '<div class="co-author-placeholder">No awareness system available - collaborators cannot be detected</div>';
      return;
    }
    
    try {
      // Get local client ID
      const localClientID = this.awareness.clientID;
      console.log(`Local client ID: ${localClientID}`);
      
      // Get all users from awareness
      const states = this.awareness.getStates();
      console.log(`Found ${states.size} total users in document`);
      
      // Log all users for debugging
      states.forEach((state, id) => {
        console.log(`User ID ${id}:`, state.user);
      });
      
      // Get all clients except local user
      const clients = Array.from(states.entries())
        .filter(([id]) => id !== localClientID);
      
      console.log(`After filtering local user, found ${clients.length} other clients`);
      
      // Filter out clients without user data
      const collaborators = clients
        .map(([id, state]) => state.user)
        .filter(user => user && user.name);
      
      console.log(`Found ${collaborators.length} collaborators with names`);
      
      if (collaborators.length === 0) {
        coAuthorsList.innerHTML = '<div class="co-author-placeholder">No other collaborators detected in this session</div>';
        return;
      }
      
      // Add each collaborator to the list
      collaborators.forEach(user => {
        const coAuthorElement = document.createElement('div');
        coAuthorElement.className = 'co-author-item';
        
        const colorDot = document.createElement('span');
        colorDot.className = 'co-author-color';
        colorDot.style.backgroundColor = user.color || '#ccc';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'co-author-name';
        nameSpan.textContent = user.name;
        
        const emailSpan = document.createElement('span');
        emailSpan.className = 'co-author-email';
        emailSpan.textContent = `${user.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`;
        
        coAuthorElement.appendChild(colorDot);
        coAuthorElement.appendChild(nameSpan);
        coAuthorElement.appendChild(emailSpan);
        
        coAuthorsList.appendChild(coAuthorElement);
      });
    } catch (error) {
      console.error('Error populating co-authors:', error);
      coAuthorsList.innerHTML = '<div class="co-author-placeholder">Error detecting collaborators</div>';
    }
  }


  /**
   * Execute commit to GitHub
   */
  async executeCommit() {
    const repoSelect = document.getElementById('commit-repo');
    const pathInput = document.getElementById('commit-path');
    const messageInput = document.getElementById('commit-message');
    
    // Validate inputs
    if (!repoSelect.value) {
      this.setStatus('error', 'Please select a repository');
      return;
    }
    
    if (!pathInput.value.trim()) {
      this.setStatus('error', 'Please enter a file path');
      return;
    }
    
    if (!messageInput.value.trim()) {
      this.setStatus('error', 'Please enter a commit message');
      return;
    }
    
    // Check for GitHub configuration
    if (!githubService.settings.token) {
      this.setStatus('error', 'GitHub token not configured. Please configure GitHub first.');
      return;
    }
    
    this.setLoading(true);
    this.setStatus('loading', 'Committing to GitHub...');
    
    try {
      // Get co-authors from the UI
      const coAuthors = this.getCoAuthors();
      
      // Execute commit
      const result = await githubService.commitFile(
        this.documentContent,
        pathInput.value.trim(),
        messageInput.value.trim(),
        coAuthors
      );
      
      // Update settings with last used values
      githubService.settings.selectedRepo = repoSelect.value;
      githubService.settings.defaultPath = pathInput.value.trim();
      githubService.settings.commitMessage = messageInput.value.trim();
      githubService.saveSettings();
      
      this.setStatus('success', 'Successfully committed to GitHub!');
      
      // Create link to view on GitHub
      if (result && result.commit && result.commit.html_url) {
        const statusEl = document.getElementById('commit-status');
        if (statusEl) {
          const viewLink = document.createElement('a');
          viewLink.href = result.commit.html_url;
          viewLink.target = '_blank';
          viewLink.textContent = 'View on GitHub';
          viewLink.className = 'github-link';
          
          statusEl.appendChild(document.createElement('br'));
          statusEl.appendChild(viewLink);
        }
      }
      
      // Close dialog after delay
      setTimeout(() => {
        this.hide();
      }, 3000);
    } catch (error) {
      this.setStatus('error', `Commit failed: ${error.message}`);
      showErrorBanner('GitHub commit failed. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Get co-authors from the awareness system
   * @returns {Array<Object>} List of co-authors {name, email}
   */
  getCoAuthors() {
    if (!this.awareness) {
      console.warn('Awareness not available for co-author detection');
      return [];
    }
    
    // Get local client ID
    const localClientID = this.awareness.clientID;
    
    // Get all clients from awareness and log them for debugging
    const clients = Array.from(this.awareness.getStates().entries());
    console.log(`Found ${clients.length} total users in the document (including self)`);
    
    // Get all user data for logging purposes
    const allUsers = clients.map(([id, state]) => {
      return {
        id,
        name: state.user?.name || 'Unknown',
        isLocal: id === localClientID
      };
    });
    console.log('All users in document:', allUsers);
    
    // Filter out local client and get user data for co-authors
    const collaborators = clients
      .filter(([id]) => id !== localClientID)
      .map(([id, state]) => state.user)
      .filter(user => user && user.name);
    
    console.log(`Found ${collaborators.length} collaborators to add as co-authors`);
    
    // Create co-author objects with name and email
    return collaborators.map(user => {
      // Generate an email based on the name (or use a default)
      const email = user.name 
        ? `${user.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`
        : 'user@example.com';
      
      return {
        name: user.name || 'Anonymous User',
        email: email
      };
    });
  }

  /**
   * Set status message
   */
  setStatus(status, message = '') {
    const statusElement = document.getElementById('commit-status');
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
    
    const buttons = document.querySelectorAll('.settings-button, .modal-button, .primary-button, .secondary-button');
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
export const githubCommitDialog = new GitHubCommitDialog();

// Make available globally for menu system
window.githubCommitDialog = githubCommitDialog;
