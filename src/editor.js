// File: src/editor.js
/**
 * Editor creation module
 *
 * Single responsibility: Create and configure the CodeMirror editor instance.
 */

import { EditorView, minimalSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { keymap, lineNumbers } from '@codemirror/view';
import { history, undo, redo } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { remoteCursorPlugin } from '@collab-editor/awareness';
import * as cmView from '@codemirror/view';
import * as cmState from '@codemirror/state';
import { isRemoteChange, AutomergeBinding } from './codemirror-binding.js';
import { getClientID } from './utils/clientId.js';

/**
 * Create a CodeMirror editor instance with collaborative editing support.
 *
 * @param {HTMLElement} parentElement - The container element for the editor
 * @param {Object} options - Configuration options
 * @param {string} [options.initialContent=''] - Initial content to load
 * @param {AwarenessClient} [options.awareness=null] - Awareness client for cursors
 * @param {string} [options.localUserId=null] - Local user ID (defaults to clientID)
 * @param {Function} [options.onUpdate=null] - Callback for editor updates
 * @returns {{ view: EditorView, lineNumberCompartment: Compartment, destroy: Function }}
 */
export function createEditor(parentElement, options = {}) {
  const {
    initialContent = '',
    awareness = null,
    localUserId = null,
    onUpdate = null
  } = options;

  // Create compartment for line numbers (allows dynamic reconfiguration)
  const lineNumberCompartment = new Compartment();

  // Check if line numbers should be enabled (default: true)
  const lineNumbersEnabled = localStorage.getItem('line-numbers-enabled') !== 'false';

  // Create line numbers extension
  const lineNumbersExtension = lineNumbers({
    domEventHandlers: {
      mousedown: (view, line, event) => {
        console.log('Line number clicked:', line.from);
        return false;
      }
    }
  });

  // Build extensions array
  const extensions = [
    minimalSetup,
    markdown(),
    history(),
    keymap.of([
      {
        key: "Ctrl-z",
        run: (view) => {
          if (window.shortcutManager && !window.shortcutManager.isEnabled()) return false;
          return undo(view);
        }
      },
      {
        key: "Ctrl-y",
        run: (view) => {
          if (window.shortcutManager && !window.shortcutManager.isEnabled()) return false;
          return redo(view);
        }
      },
      {
        key: "Ctrl-Shift-z",
        run: (view) => {
          if (window.shortcutManager && !window.shortcutManager.isEnabled()) return false;
          return redo(view);
        }
      }
    ]),
    lineNumberCompartment.of(lineNumbersEnabled ? lineNumbersExtension : [])
  ];

  // Add awareness/cursor plugin if awareness is provided
  if (awareness) {
    const userId = localUserId || getClientID();
    extensions.push(...remoteCursorPlugin(cmView, cmState, awareness, userId));
  }

  // Add update listener if callback provided
  if (onUpdate) {
    extensions.push(EditorView.updateListener.of(onUpdate));
  }

  // Create editor state
  const state = EditorState.create({
    doc: initialContent,
    extensions
  });

  // Create editor view
  const view = new EditorView({
    state,
    parent: parentElement
  });

  console.log('[Editor] CodeMirror initialized');
  console.log('[Editor] Line numbers initially:', lineNumbersEnabled ? 'enabled' : 'disabled');

  // Create destroy function
  const destroy = () => {
    view.destroy();
    console.log('[Editor] Destroyed');
  };

  // Expose globals for menu system compatibility
  window.editorLineNumberCompartment = lineNumberCompartment;
  window.lineNumbersExtension = lineNumbersExtension;
  window.editorView = view;

  // Add toggle function
  window.toggleLineNumbers = function() {
    const currentlyEnabled = localStorage.getItem('line-numbers-enabled') !== 'false';
    const newState = !currentlyEnabled;

    view.dispatch({
      effects: lineNumberCompartment.reconfigure(
        newState ? lineNumbersExtension : []
      )
    });
    localStorage.setItem('line-numbers-enabled', newState.toString());

    console.log('[Editor] Line numbers toggled to:', newState ? 'enabled' : 'disabled');
    return newState;
  };

  return {
    view,
    lineNumberCompartment,
    lineNumbersExtension,
    destroy
  };
}

/**
 * Setup editor with Automerge binding.
 * This is a convenience function that creates both the editor and binding.
 *
 * @param {HTMLElement} parentElement - The container element
 * @param {DocHandle} handle - Automerge document handle
 * @param {AwarenessClient} awareness - Awareness client for cursors
 * @returns {{ view: EditorView, binding: AutomergeBinding, destroy: Function }}
 */
export function setupEditorWithBinding(parentElement, handle, awareness) {
  // Create binding first (we need it for the update listener)
  let binding = null;

  const { view, lineNumberCompartment, lineNumbersExtension, destroy: destroyEditor } = createEditor(parentElement, {
    awareness,
    onUpdate: (update) => {
      if (binding) {
        binding.applyLocalChange(update);
      }
    }
  });

  // Create and attach binding
  binding = new AutomergeBinding(view, handle);
  binding.attach();

  // Load initial content
  try {
    const doc = handle.doc();
    if (doc && doc.content !== undefined) {
      const initialText = typeof doc.content === 'string' ? doc.content : doc.content.toString();
      if (initialText.length > 0) {
        binding.loadInitialContent(initialText);
      }
    }
  } catch (err) {
    console.error('[Editor] Failed to load initial content:', err);
  }

  // Expose handle for menu system
  window.automergeHandle = handle;

  // Helper function to get current document content
  window.getAutomergeContent = function() {
    const doc = handle.doc();
    const content = doc?.content;
    return typeof content === 'string' ? content : (content?.toString() || '');
  };

  const destroy = () => {
    binding.detach();
    destroyEditor();
  };

  return {
    view,
    binding,
    lineNumberCompartment,
    lineNumbersExtension,
    destroy
  };
}
