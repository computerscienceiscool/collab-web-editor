// File: src/github/githubService.js
/**
 * GitHub integration service for the collaborative editor
 * Handles GitHub API communications and settings management
 */

// Obfuscation for sensitive data in localStorage
const OBFUSCATION_KEY = 'collab-editor-v1';

/**
 * Obfuscate a string to prevent plain-text storage
 * @param {string} str - String to obfuscate
 * @returns {string} Obfuscated string
 */
function obfuscate(str) {
  if (!str) return str;
  // XOR with key, then base64
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length));
  }
  return btoa(result);
}

/**
 * Deobfuscate a string
 * @param {string} str - Obfuscated string
 * @returns {string} Original string
 */
function deobfuscate(str) {
  if (!str) return str;
  try {
    const decoded = atob(str);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length));
    }
    return result;
  } catch (e) {
    // If deobfuscation fails, return original (for migration from old format)
    return str;
  }
}

// Fields that contain sensitive data and should be obfuscated
const SENSITIVE_FIELDS = ['token', 'grokkerApiKey'];

// Valid GitHub token prefixes (https://github.blog/2021-04-05-behind-githubs-new-authentication-token-formats/)
const GITHUB_TOKEN_PREFIXES = ['ghp_', 'github_pat_', 'gho_', 'ghu_', 'ghs_', 'ghr_'];
const MIN_TOKEN_LENGTH = 40;
const FETCH_TIMEOUT_MS = 30000;

/**
 * Fetch with timeout using AbortController.
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default 30s)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate GitHub token format before making API calls.
 * This catches obvious errors early without wasting network requests.
 *
 * @param {string} token - Token to validate
 * @returns {{valid: boolean, error: string|null}} Validation result
 */
function validateTokenFormat(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token cannot be empty' };
  }

  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Token cannot be empty or whitespace' };
  }

  if (trimmed.length < MIN_TOKEN_LENGTH) {
    return { valid: false, error: `Token appears too short (minimum ${MIN_TOKEN_LENGTH} characters, got ${trimmed.length})` };
  }

  const hasValidPrefix = GITHUB_TOKEN_PREFIXES.some(prefix => trimmed.startsWith(prefix));
  if (!hasValidPrefix) {
    return {
      valid: false,
      error: `Token must start with a valid prefix (${GITHUB_TOKEN_PREFIXES.slice(0, 2).join(', ')}, etc.)`
    };
  }

  return { valid: true, error: null };
}

/**
 * Validate Grokker API key format.
 * Basic validation to catch empty or obviously invalid keys.
 *
 * @param {string} apiKey - API key to validate
 * @returns {{valid: boolean, error: string|null}} Validation result
 */
function validateGrokkerKeyFormat(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { valid: false, error: 'Grokker API key cannot be empty' };
  }

  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Grokker API key cannot be empty or whitespace' };
  }

  if (trimmed.length < 10) {
    return { valid: false, error: 'Grokker API key appears too short' };
  }

  return { valid: true, error: null };
}

export class GitHubService {
  constructor() {
    this.settings = this.loadSettings();
  }

  /**
   * Load GitHub settings from localStorage
   * Deobfuscates sensitive fields (token, API keys)
   * @returns {Object} GitHub settings
   */
  loadSettings() {
    try {
      const savedSettings = localStorage.getItem('github-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        // Deobfuscate sensitive fields
        SENSITIVE_FIELDS.forEach(field => {
          if (settings[field]) {
            settings[field] = deobfuscate(settings[field]);
          }
        });
        return settings;
      }
    } catch (error) {
      console.error('Failed to load GitHub settings:', error);
    }

    // Default settings if none found
    return {
      token: '',
      username: '',
      repos: [],
      selectedRepo: '',
      defaultPath: '',
      commitMessage: 'Update from collaborative editor',
      enabled: false,
      lastCommit: null,
      useAICommitMessage: false,
      grokkerApiKey: ''
    };
  }

  /**
   * Save GitHub settings to localStorage
   * Obfuscates sensitive fields (token, API keys) before saving
   * @param {Object} settings - Settings to save
   */
  saveSettings(settings = this.settings) {
    try {
      // Create copy with obfuscated sensitive fields for storage
      const settingsToStore = { ...settings };
      SENSITIVE_FIELDS.forEach(field => {
        if (settingsToStore[field]) {
          settingsToStore[field] = obfuscate(settingsToStore[field]);
        }
      });
      localStorage.setItem('github-settings', JSON.stringify(settingsToStore));
      // Keep original (unobfuscated) in memory
      this.settings = settings;
    } catch (error) {
      console.error('Failed to save GitHub settings:', error);
      throw new Error('Failed to save settings: ' + error.message);
    }
  }

  /**
   * Validate GitHub personal access token
   * @param {string} token - Personal access token to validate
   * @returns {Promise<Object>} User information if valid
   * @throws {Error} If token is invalid
   */
  async validateToken(token) {
    // Validate format first to catch obvious errors without network call
    const formatCheck = validateTokenFormat(token);
    if (!formatCheck.valid) {
      throw new Error(formatCheck.error);
    }

    try {
      const response = await fetchWithTimeout('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Token is invalid or has been revoked');
        } else if (response.status === 403) {
          throw new Error('Token lacks required permissions or rate limit exceeded');
        }
        throw new Error(`GitHub API error (${response.status})`);
      }

      const userData = await response.json();
      return userData;
    } catch (error) {
      console.error('Token validation failed:', error);
      throw new Error(error.message.startsWith('Token') ? error.message : 'GitHub token validation failed: ' + error.message);
    }
  }

  /**
   * Generate commit message using Grokker
   * @param {string} content - Document content to analyze
   * @returns {Promise<string>} Generated commit message
   */
  async generateCommitMessage(content) {
    // Validate API key format first
    const keyCheck = validateGrokkerKeyFormat(this.settings.grokkerApiKey);
    if (!keyCheck.valid) {
      throw new Error(keyCheck.error);
    }

    try {
      // Check if WASM function is available
      if (typeof window.generateCommitMessage !== 'function') {
        console.warn('Grokker WASM not available, falling back to simulation');
        return this.executeGrokCommand(content);
      }

      // Call the WASM implementation
      const result = await window.generateCommitMessage({
        content: content,
        apiKey: this.settings.grokkerApiKey,
        model: "grokker"
      });

      return result.fullMessage || result.title + "\n\n" + result.body;
    } catch (error) {
      console.error('Failed to generate commit message:', error);
      throw new Error('Failed to generate commit message: ' + error.message);
    }
  }

  /**
   * Fetch user repositories
   * @returns {Promise<Array>} List of repositories
   */
  async fetchRepositories() {
    const formatCheck = validateTokenFormat(this.settings.token);
    if (!formatCheck.valid) {
      throw new Error(formatCheck.error);
    }

    try {
      const response = await fetchWithTimeout('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          'Authorization': `token ${this.settings.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const repos = await response.json();
      
      // Update settings with fetched repos
      this.settings.repos = repos.map(repo => ({
        name: repo.name,
        fullName: repo.full_name,
        defaultBranch: repo.default_branch
      }));
      
      this.saveSettings();
      
      return this.settings.repos;
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      throw new Error('Failed to fetch GitHub repositories: ' + error.message);
    }
  }

  /**
   * Commit file to GitHub repository
   * @param {string} content - Document content
   * @param {string} filePath - File path in repository
   * @param {string} commitMessage - Commit message
   * @param {Array<Object>} coAuthors - List of co-authors {name, email}
   * @returns {Promise<Object>} Commit result
   */
  async commitFile(content, filePath, commitMessage, coAuthors = []) {
    const formatCheck = validateTokenFormat(this.settings.token);
    if (!formatCheck.valid) {
      throw new Error(formatCheck.error);
    }

    if (!this.settings.selectedRepo) {
      throw new Error('No repository selected');
    }

    const selectedRepo = this.settings.repos.find(r => r.fullName === this.settings.selectedRepo);
    if (!selectedRepo) {
      throw new Error('Selected repository not found');
    }

    console.log(`Starting commit to ${this.settings.selectedRepo}, path: ${filePath}`);
    console.log(`With ${coAuthors.length} co-authors`);
    
    try {
      // First, check if file exists to get SHA if it does
      let fileSha = null;
      let existingFile = false;
      
      try {
        console.log(`Checking if file exists: ${filePath}`);
        const fileResponse = await fetchWithTimeout(`https://api.github.com/repos/${this.settings.selectedRepo}/contents/${filePath}`, {
          headers: {
            'Authorization': `token ${this.settings.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          fileSha = fileData.sha;
          existingFile = true;
          console.log(`File exists with SHA: ${fileSha}`);
        }
      } catch (error) {
        // File likely doesn't exist yet, which is fine
        console.log('File does not exist yet, will create new file');
        existingFile = false;
      }

      // Build commit message with co-authors
      let fullCommitMessage = commitMessage.trim();
      
      if (coAuthors && coAuthors.length > 0) {
        // Add a blank line between commit message and co-authors
        fullCommitMessage += '\n\n';
        
        // Log co-authors for debugging
        console.log('Adding co-authors to commit:');
        
        // Add each co-author in the correct format
        coAuthors.forEach(author => {
          // Make sure name and email are properly formatted and sanitized
          const sanitizedName = author.name.replace(/[<>]/g, '').trim();
          let sanitizedEmail = author.email;
          
          // If email is missing, generate one from the name
          if (!sanitizedEmail) {
            sanitizedEmail = `${sanitizedName.toLowerCase().replace(/[^a-z0-9]/g, '')}@example.com`;
          }
          
          sanitizedEmail = sanitizedEmail.replace(/[<>]/g, '').trim();
          
          // Add co-author line in the correct format
          fullCommitMessage += `Co-authored-by: ${sanitizedName} <${sanitizedEmail}>\n`;
          console.log(`- ${sanitizedName} <${sanitizedEmail}>`);
        });
      }

      console.log('Preparing commit payload');
      
      // Create or update file
      const payload = {
        message: fullCommitMessage,
        content: btoa(unescape(encodeURIComponent(content))), // Base64 encode the content
        branch: selectedRepo.defaultBranch
      };

      // Add SHA if file exists (update instead of create)
      if (existingFile && fileSha) {
        payload.sha = fileSha;
        console.log(`Updating existing file with SHA: ${fileSha}`);
      } else {
        console.log('Creating new file');
      }

      console.log('Sending commit request to GitHub API');
      
      // Make the commit API request
      const commitResponse = await fetchWithTimeout(`https://api.github.com/repos/${this.settings.selectedRepo}/contents/${filePath}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${this.settings.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!commitResponse.ok) {
        const errorData = await commitResponse.json();
        console.error('GitHub API error:', errorData);
        throw new Error(`GitHub API error: ${errorData.message || 'Unknown error'}`);
      }

      const result = await commitResponse.json();
      console.log('Commit successful:', result.commit.html_url);
      
      // Save last commit info
      this.settings.lastCommit = {
        sha: result.commit.sha,
        url: result.commit.html_url,
        date: new Date().toISOString(),
        path: filePath,
        repository: this.settings.selectedRepo
      };
      this.saveSettings();
      
      return result;
    } catch (error) {
      console.error('Failed to commit file:', error);
      throw new Error('Failed to commit to GitHub: ' + error.message);
    }
  }

  /**
   * Execute grok command directly (fallback for local development)
   * @param {string} content - Content to analyze
   * @returns {Promise<string>} Generated commit message
   */
  async executeGrokCommand(content) {
    const keyCheck = validateGrokkerKeyFormat(this.settings.grokkerApiKey);
    if (!keyCheck.valid) {
      throw new Error(keyCheck.error);
    }

    try {
      // This is a client-side implementation for executing grok
      // In a real environment, this would be handled server-side
      const tempFile = `temp-${Date.now()}.md`;
      
      // Create a blob with the content
      const blob = new Blob([content], { type: 'text/plain' });
      const fileUrl = URL.createObjectURL(blob);
      
      console.log(`Executing grok command on content of length ${content.length}`);
      
      // This is where we would typically execute a command like:
      // const result = await execCommand(`grok commit`);
      
      // Since we can't execute commands directly from the browser,
      // we'd need a server endpoint or to use a desktop framework like Electron
      
      // For now, simulate a response for development purposes
      const simulatedResponse = `feat(editor): implement collaborative editing

Added real-time collaboration features using Automerge CRDTs.
- Added user presence indicators
- Implemented conflict resolution
- Added offline support with IndexedDB`;
      
      // Clean up
      URL.revokeObjectURL(fileUrl);
      
      return simulatedResponse;
    } catch (error) {
      console.error('Failed to execute grok command:', error);
      throw new Error(`Grok command failed: ${error.message}`);
    }
  }

  /**
   * Get file content from GitHub
   * @param {string} repo - Repository full name
   * @param {string} path - File path
   * @returns {Promise<string>} File content
   */
  async getFileContent(repo, path) {
    const formatCheck = validateTokenFormat(this.settings.token);
    if (!formatCheck.valid) {
      throw new Error(formatCheck.error);
    }

    try {
      const response = await fetchWithTimeout(`https://api.github.com/repos/${repo}/contents/${path}`, {
        headers: {
          'Authorization': `token ${this.settings.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch file content');
      }

      const data = await response.json();
      // Base64 decode content
      return decodeURIComponent(escape(atob(data.content)));
    } catch (error) {
      console.error('Failed to get file content:', error);
      throw new Error('Failed to get file from GitHub: ' + error.message);
    }
  }

  /**
   * Clear all GitHub settings
   */
  clearSettings() {
    localStorage.removeItem('github-settings');
    this.settings = this.loadSettings();
  }
}

// Create global instance
export const githubService = new GitHubService();

// Make available globally for UI access
window.githubService = githubService;
