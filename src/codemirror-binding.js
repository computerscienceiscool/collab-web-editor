// File: src/codemirror-binding.js
/**
 * AutomergeBinding - Bridges CodeMirror and Automerge
 *
 * Single responsibility: Synchronize editor state with Automerge document.
 * Uses transaction annotations to prevent race conditions and echo loops.
 */

import { Annotation } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { next as Automerge } from '@automerge/automerge';

/**
 * Annotation to mark transactions as originating from remote changes.
 * Using annotations instead of a mutable flag prevents race conditions
 * when concurrent updates occur.
 */
export const isRemoteChange = Annotation.define();

/**
 * AutomergeBinding synchronizes a CodeMirror EditorView with an Automerge document.
 *
 * Uses Automerge.splice() for character-level precision, giving the CRDT
 * exact user intent for optimal concurrent edit merging.
 */
export class AutomergeBinding {
  /**
   * @param {EditorView} view - The CodeMirror editor view
   * @param {DocHandle} handle - The Automerge document handle
   */
  constructor(view, handle) {
    this.view = view;
    this.handle = handle;
    this._isSyncingLocalChange = false;
    this._changeHandler = null;
    this._attached = false;
  }

  /**
   * Attach the binding - start synchronizing
   */
  attach() {
    if (this._attached) {
      console.warn('[AutomergeBinding] Already attached');
      return;
    }

    // Setup handler for remote changes
    this._changeHandler = ({ doc, patches }) => {
      this._handleRemoteChange(doc, patches);
    };
    this.handle.on('change', this._changeHandler);

    this._attached = true;
    console.log('[AutomergeBinding] Attached');
  }

  /**
   * Detach the binding - stop synchronizing
   */
  detach() {
    if (!this._attached) {
      return;
    }

    if (this._changeHandler) {
      this.handle.off('change', this._changeHandler);
      this._changeHandler = null;
    }

    this._attached = false;
    console.log('[AutomergeBinding] Detached');
  }

  /**
   * Apply a local editor change to Automerge.
   * Call this from the editor's updateListener.
   *
   * @param {ViewUpdate} update - The CodeMirror update
   * @returns {boolean} True if changes were applied
   */
  applyLocalChange(update) {
    // Check if any transaction is marked as a remote change
    const hasRemoteChange = update.transactions.some(
      tr => tr.annotation(isRemoteChange)
    );
    if (hasRemoteChange) {
      return false;
    }

    if (!update.docChanged) {
      return false;
    }

    // Set flag to prevent handle.on('change') from re-applying our changes
    this._isSyncingLocalChange = true;

    try {
      // Apply each change to Automerge with exact position info
      update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        const deleteCount = toA - fromA;
        const insertText = inserted.toString();

        this.handle.change(d => {
          Automerge.splice(d, ['content'], fromA, deleteCount, insertText);
        });

        console.log('[AutomergeBinding] Splice to Automerge: pos=%d, del=%d, ins=%d chars',
          fromA, deleteCount, insertText.length);
      });

      return true;
    } finally {
      // Clear the flag after sync is complete
      this._isSyncingLocalChange = false;
    }
  }

  /**
   * Handle remote changes from Automerge
   * @private
   */
  _handleRemoteChange(doc, patches) {
    // Skip if this is our own local change being echoed back
    if (this._isSyncingLocalChange) {
      console.log('[AutomergeBinding] Skipping local change echo');
      return;
    }

    if (!doc || doc.content === undefined) {
      console.warn('[AutomergeBinding] Document or content is undefined');
      return;
    }

    // Try to apply patches for precise, efficient updates
    if (patches && patches.length > 0) {
      const changes = [];

      for (const patch of patches) {
        // Only handle content changes
        if (patch.path[0] !== 'content') continue;

        if (patch.action === 'splice') {
          // patch.path[1] is the start index for text splices
          const index = typeof patch.path[1] === 'number' ? patch.path[1] : 0;
          const deleteCount = patch.length || 0;
          const insertText = patch.value || '';

          changes.push({
            from: index,
            to: index + deleteCount,
            insert: insertText
          });

          console.log('[AutomergeBinding] Remote splice: pos=%d, del=%d, ins=%d chars',
            index, deleteCount, insertText.length);
        }
      }

      if (changes.length > 0) {
        this.view.dispatch({
          changes,
          annotations: isRemoteChange.of(true)
        });
        return;
      }
    }

    // Fallback: full document replacement if no usable patches
    this._applyFullSync(doc);
  }

  /**
   * Apply full document sync (fallback when patches aren't available)
   * @private
   */
  _applyFullSync(doc) {
    const newText = typeof doc.content === 'string' ? doc.content : doc.content.toString();
    const oldText = this.view.state.doc.toString();

    if (newText !== oldText) {
      // Save cursor position and clamp to valid range
      const selection = this.view.state.selection.main;
      const newAnchor = Math.min(selection.anchor, newText.length);
      const newHead = Math.min(selection.head, newText.length);

      this.view.dispatch({
        changes: {
          from: 0,
          to: oldText.length,
          insert: newText
        },
        selection: { anchor: newAnchor, head: newHead },
        annotations: isRemoteChange.of(true)
      });

      console.log('[AutomergeBinding] Remote full sync: %d chars', newText.length);
    }
  }

  /**
   * Load initial content into the editor
   * @param {string} content - Initial content to load
   */
  loadInitialContent(content) {
    if (!content || content.length === 0) {
      return;
    }

    this.view.dispatch({
      changes: {
        from: 0,
        to: 0,
        insert: content
      },
      annotations: isRemoteChange.of(true)
    });

    console.log('[AutomergeBinding] Loaded initial content:', content.length, 'chars');
  }
}

/**
 * Create an update listener for CodeMirror that syncs to the binding.
 * Use this when setting up the editor extensions.
 *
 * @param {AutomergeBinding} binding - The binding instance
 * @returns {Extension} CodeMirror extension
 */
export function createUpdateListener(binding) {
  return EditorView.updateListener.of((update) => {
    binding.applyLocalChange(update);
  });
}
