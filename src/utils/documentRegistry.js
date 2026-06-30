// File: src/utils/documentRegistry.js
// Manages recent documents in localStorage for multi-document navigation

const STORAGE_KEY = 'recentDocuments';
const MAX_DOCUMENTS = 20;

/**
 * Get the current list of recent documents
 * @returns {Array} Array of document objects {id, title, lastOpened}
 */
export function getRecentDocuments(limit = MAX_DOCUMENTS) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const docs = JSON.parse(stored);
    // Sort by lastOpened descending and limit
    return docs
      .sort((a, b) => b.lastOpened - a.lastOpened)
      .slice(0, limit);
  } catch (error) {
    console.error('[DocumentRegistry] Failed to get recent documents:', error);
    return [];
  }
}

/**
 * Add or update a document in the registry
 * @param {string} docId - The Automerge document ID
 * @param {string} title - The document title
 */
export function addDocument(docId, title) {
  if (!docId) return;

  try {
    const docs = getRecentDocuments(MAX_DOCUMENTS);

    // Check if document already exists
    const existingIndex = docs.findIndex(d => d.id === docId);

    const docEntry = {
      id: docId,
      title: title || 'Untitled Document',
      lastOpened: Date.now()
    };

    if (existingIndex >= 0) {
      // Update existing entry
      docs[existingIndex] = docEntry;
    } else {
      // Add new entry at the beginning
      docs.unshift(docEntry);
    }

    // Limit the number of stored documents
    const trimmed = docs.slice(0, MAX_DOCUMENTS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    console.log('[DocumentRegistry] Document registered:', docId);
  } catch (error) {
    console.error('[DocumentRegistry] Failed to add document:', error);
  }
}

/**
 * Remove a document from the registry
 * @param {string} docId - The Automerge document ID
 */
export function removeDocument(docId) {
  if (!docId) return;

  try {
    const docs = getRecentDocuments(MAX_DOCUMENTS);
    const filtered = docs.filter(d => d.id !== docId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    console.log('[DocumentRegistry] Document removed:', docId);
  } catch (error) {
    console.error('[DocumentRegistry] Failed to remove document:', error);
  }
}

/**
 * Update the title of a document in the registry
 * @param {string} docId - The Automerge document ID
 * @param {string} newTitle - The new document title
 */
export function updateTitle(docId, newTitle) {
  if (!docId) return;

  try {
    const docs = getRecentDocuments(MAX_DOCUMENTS);
    const doc = docs.find(d => d.id === docId);

    if (doc) {
      doc.title = newTitle || 'Untitled Document';
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    }
  } catch (error) {
    console.error('[DocumentRegistry] Failed to update title:', error);
  }
}

/**
 * Get a document's stored title from localStorage
 * @param {string} docId - The Automerge document ID
 * @returns {string} The document title or 'Untitled Document'
 */
export function getDocTitle(docId) {
  if (!docId) return 'Untitled Document';

  // First check the existing title storage key used by app.js
  const titleKey = `docTitle:${docId}`;
  const savedTitle = localStorage.getItem(titleKey);
  if (savedTitle) return savedTitle;

  // Fall back to checking the registry
  try {
    const docs = getRecentDocuments(MAX_DOCUMENTS);
    const doc = docs.find(d => d.id === docId);
    return doc?.title || 'Untitled Document';
  } catch {
    return 'Untitled Document';
  }
}

/**
 * Format a document ID for display (short version)
 * @param {string} docId - The full Automerge document ID
 * @returns {string} A shortened ID for display
 */
export function formatShortId(docId) {
  if (!docId) return '?';
  return docId.replace('automerge:', '').slice(0, 8);
}

/**
 * Format a timestamp as relative time
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Relative time string like "2 hours ago"
 */
export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return days === 1 ? 'Yesterday' : `${days} days ago`;
  if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (minutes > 0) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  return 'Just now';
}
