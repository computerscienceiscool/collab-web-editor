// File: src/automerge-sync.js
/**
 * AutomergeSync - Manages Automerge CRDT synchronization
 *
 * Single responsibility: Handle Automerge repository, document lifecycle,
 * and network synchronization.
 */

import { Repo } from '@automerge/automerge-repo';
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';
import { next as Automerge } from '@automerge/automerge';
import { config } from './config.js';
import { showErrorBanner } from './ui/errors.js';

/**
 * Simple event emitter for AutomergeSync events
 */
class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  emit(event, data) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`[AutomergeSync] Error in ${event} listener:`, e);
        }
      });
    }
  }
}

/**
 * AutomergeSync manages the Automerge repository and document synchronization.
 *
 * Events:
 * - 'connected' - WebSocket connected to sync server
 * - 'disconnected' - WebSocket disconnected
 * - 'document-ready' - Document is loaded and ready ({ doc, handle, isNew })
 * - 'document-closed' - Document was closed
 * - 'remote-change' - Remote change received ({ doc, patches })
 * - 'error' - Error occurred ({ error, context })
 */
export class AutomergeSync extends EventEmitter {
  constructor(syncUrl = null) {
    super();
    this.syncUrl = syncUrl || config.urls.automergeSync;
    this.repo = null;
    this.handle = null;
    this._documentId = null;
    this._isConnected = false;
  }

  /**
   * Connect to the Automerge sync server
   */
  connect() {
    if (this.repo) {
      console.warn('[AutomergeSync] Already connected');
      return;
    }

    console.log('[AutomergeSync] Connecting to', this.syncUrl);

    this.repo = new Repo({
      network: [new BrowserWebSocketClientAdapter(this.syncUrl)],
      storage: new IndexedDBStorageAdapter(),
    });

    this._isConnected = true;
    this.emit('connected');
    console.log('[AutomergeSync] Connected');
  }

  /**
   * Disconnect from the sync server
   */
  disconnect() {
    if (this.handle) {
      this.closeDocument();
    }

    // Note: Automerge Repo doesn't have an explicit close method
    // The WebSocket will be closed when the adapter is garbage collected
    this.repo = null;
    this._isConnected = false;
    this.emit('disconnected');
    console.log('[AutomergeSync] Disconnected');
  }

  /**
   * Create a new document
   * @returns {string} The new document ID
   */
  createDocument() {
    if (!this.repo) {
      throw new Error('Not connected. Call connect() first.');
    }

    this.handle = this.repo.create();

    // Initialize document structure (must match vimbeam structure)
    this.handle.change(d => {
      d.content = "";
      d.metadata = {
        created: Date.now(),
        version: 1
      };
    });

    this._documentId = this.handle.documentId;
    this._setupChangeHandler();

    // Update URL with new document ID
    const newUrl = `${window.location.pathname}?doc=${this._documentId}`;
    window.history.replaceState(null, '', newUrl);

    console.log('[AutomergeSync] Created new document:', this._documentId);

    this.emit('document-ready', {
      doc: this.handle.doc(),
      handle: this.handle,
      isNew: true
    });

    return this._documentId;
  }

  /**
   * Open an existing document
   * @param {string} documentId - The document ID to open
   */
  async openDocument(documentId) {
    if (!this.repo) {
      throw new Error('Not connected. Call connect() first.');
    }

    if (this.handle) {
      this.closeDocument();
    }

    console.log('[AutomergeSync] Opening document:', documentId);

    try {
      // Prepend automerge: if not present
      const fullDocId = documentId.startsWith('automerge:')
        ? documentId
        : `automerge:${documentId}`;

      this.handle = await this.repo.find(fullDocId);
      await this.handle.whenReady();

      const doc = this.handle.doc();
      if (!doc) {
        throw new Error('Document loaded but has no content');
      }

      this._documentId = this.handle.documentId;
      this._setupChangeHandler();

      const contentLength = typeof doc.content === 'string' ? doc.content.length : 0;
      console.log('[AutomergeSync] Document loaded, content:', contentLength, 'chars');

      this.emit('document-ready', {
        doc,
        handle: this.handle,
        isNew: false
      });

    } catch (err) {
      console.error('[AutomergeSync] Failed to load document:', err);
      showErrorBanner('Failed to load document. It may not exist or the network may be unavailable.', 10000);
      this.emit('error', { error: err, context: 'openDocument' });
      throw err;
    }
  }

  /**
   * Close the current document
   */
  closeDocument() {
    if (!this.handle) {
      return;
    }

    // Remove change handler
    if (this._changeHandler) {
      this.handle.off('change', this._changeHandler);
      this._changeHandler = null;
    }

    this.handle = null;
    this._documentId = null;
    this.emit('document-closed');
    console.log('[AutomergeSync] Document closed');
  }

  /**
   * Apply a local edit using Automerge.splice() for character-level precision.
   * This gives Automerge exact user intent for optimal concurrent edit merging.
   *
   * @param {number} position - Start position in the text
   * @param {number} deleteCount - Number of characters to delete
   * @param {string} insertText - Text to insert
   */
  applyLocalEdit(position, deleteCount, insertText) {
    if (!this.handle) {
      throw new Error('No document open');
    }

    this.handle.change(d => {
      Automerge.splice(d, ['content'], position, deleteCount, insertText);
    });
  }

  /**
   * Get the current document content
   * @returns {string} The document content
   */
  getContent() {
    if (!this.handle) {
      return '';
    }

    const doc = this.handle.doc();
    if (!doc || doc.content === undefined) {
      return '';
    }

    return typeof doc.content === 'string' ? doc.content : doc.content.toString();
  }

  /**
   * Get the current document ID
   * @returns {string|null} The document ID or null if no document is open
   */
  getDocumentId() {
    return this._documentId;
  }

  /**
   * Get the document handle for advanced operations
   * @returns {DocHandle|null}
   */
  getHandle() {
    return this.handle;
  }

  /**
   * Check if connected to sync server
   * @returns {boolean}
   */
  isConnected() {
    return this._isConnected;
  }

  /**
   * Setup change handler for remote changes
   * @private
   */
  _setupChangeHandler() {
    this._changeHandler = ({ doc, patches }) => {
      this.emit('remote-change', { doc, patches });
    };
    this.handle.on('change', this._changeHandler);
  }
}

/**
 * Wait for a document handle to be ready (legacy helper)
 * @param {DocHandle} handle - The document handle
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Document>}
 */
export async function waitForDocumentReady(handle, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for document to be ready'));
    }, timeoutMs);

    const onReady = ({ doc }) => {
      if (doc !== undefined) {
        clearTimeout(timeout);
        handle.off('change', onReady);
        resolve(doc);
      }
    };

    handle.on('change', onReady);

    // Check if already ready
    try {
      const doc = handle.doc();
      if (doc !== undefined) {
        clearTimeout(timeout);
        handle.off('change', onReady);
        resolve(doc);
      }
    } catch (e) {
      // Not ready yet, will wait for change event
    }
  });
}
