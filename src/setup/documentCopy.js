// File: src/setup/documentCopy.js
import { next as Automerge } from '@automerge/automerge';

/**
 * Handles document copying functionality for the "Make a Copy" feature
 * This module manages transferring document content and formatting between windows
 */

/**
 * Checks if this is a copied document and restores content
 * Should be called after the editor is initialized
 * 
 * CRITICAL: Uses Automerge.splice() to restore content
 * 
 * @param {EditorView} view - The CodeMirror editor view
 * @param {DocHandle} handle - The Automerge document handle
 */
export function handleDocumentCopy(view, handle) {
  // Check if we have copy data in sessionStorage
  const copyDataStr = sessionStorage.getItem('documentCopyData');
  if (!copyDataStr) {
    return; // Not a copied document
  }

  try {
    const copyData = JSON.parse(copyDataStr);
    
    // Verify the data is recent (within last 5 minutes)
    const age = Date.now() - copyData.timestamp;
    if (age > 5 * 60 * 1000) { // 5 minutes
      console.log('Copy data expired, removing...');
      sessionStorage.removeItem('documentCopyData');
      return; // Data too old, ignore
    }

    console.log('Restoring copied document:', copyData.title);
    console.log('Content preview:', copyData.content.substring(0, 100) + '...');

    // Wait a moment for the editor to be fully ready
    setTimeout(() => {
      if (copyData.content && view && handle) {
        // CRITICAL: Use Automerge.splice() to restore content
        // This is the ONLY valid way to modify text in Automerge 2.x
        handle.change(d => {
          // Get current content length
          const oldLength = typeof d.content === 'string' ? d.content.length : 0;
          
          // Replace entire content using splice
          // Automerge.splice(doc, path, index, deleteCount, ...insertItems)
          Automerge.splice(d, ['content'], 0, oldLength, ...copyData.content);
        });
        
        // Update document title if available
        if (copyData.title) {
          const titleInput = document.getElementById('document-title');
          if (titleInput) {
            titleInput.value = copyData.title;
          }
        }
        
        // Position cursor at the beginning
        view.dispatch({
          selection: { anchor: 0, head: 0 }
        });
        
        console.log('SUCCESS: Document copy restored successfully');
        console.log('Title:', copyData.title);
        console.log('Content length:', copyData.content.length, 'characters');
        console.log('Line count:', (copyData.content.match(/\n/g) || []).length + 1);
      } else {
        console.error('ERROR: Failed to restore copy - missing editor or content');
      }
      
      // Clean up the sessionStorage
      sessionStorage.removeItem('documentCopyData');
    }, 1000); // Wait 1 second for everything to initialize
    
  } catch (error) {
    console.error('ERROR: Failed to restore copied document:', error);
    sessionStorage.removeItem('documentCopyData');
  }
}

/**
 * Prepares document data for copying to a new window
 * This is called by the makeCopy() method in the menu system
 * @param {EditorView} view - The CodeMirror editor view
 * @param {string} currentTitle - Current document title
 * @returns {Object} Copy data object
 */
export function prepareCopyData(view, currentTitle) {
  if (!view) {
    throw new Error('Editor not available');
  }

  // Get the complete document text (preserves line breaks and formatting)
  const currentContent = view.state.doc.toString();
  
  // Create copy title
  const copyTitle = (currentTitle || 'Untitled Document') + ' (Copy)';
  
  // Create copy data object
  const copyData = {
    content: currentContent,
    title: copyTitle,
    timestamp: Date.now(),
    originalLength: currentContent.length,
    lineCount: (currentContent.match(/\n/g) || []).length + 1
  };
  
  console.log('Preparing document copy:');
  console.log('Original title:', currentTitle);
  console.log('Copy title:', copyTitle);
  console.log('Content length:', copyData.originalLength, 'characters');
  console.log('Line count:', copyData.lineCount);
  
  return copyData;
}

/**
 * Generates a UUID for new document IDs
 * @returns {string} UUID string
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
