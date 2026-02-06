// File: src/ui/documentStats.js
import { calculate_document_stats } from '../wasm/initWasm.js';

// Debounce delay in milliseconds - prevents excessive WASM calls during rapid typing
const STATS_DEBOUNCE_MS = 300;

/**
 * Sets up live document statistics that update as user types.
 * Uses debouncing to prevent excessive WASM calls on every keystroke.
 *
 * @param {DocHandle} handle - The Automerge document handle
 * @param {EditorView} view - The CodeMirror editor view
 */
export function setupDocumentStats(handle, view) {
  const wordCountEl = document.querySelector('#word-count');
  const charCountEl = document.querySelector('#char-count');
  const readingTimeEl = document.querySelector('#reading-time');

  if (!wordCountEl || !charCountEl || !readingTimeEl) {
    console.warn('Document stats elements not found');
    return;
  }

  // Timeout handle for debouncing - kept local to avoid global state
  let debounceTimeout = null;

  /**
   * Calculate and display document statistics.
   * Calls WASM function to compute word count, character count, and reading time.
   */
  async function updateStats() {
    try {
      const text = view.state.doc.toString();
      const statsJson = await calculate_document_stats(text);
      const stats = JSON.parse(statsJson);

      wordCountEl.textContent = `${stats.words} words`;
      charCountEl.textContent = `${stats.chars_without_spaces} chars`;
      readingTimeEl.textContent = `${stats.reading_time} min read`;
    } catch (error) {
      console.error('Failed to update document stats:', error);
    }
  }

  /**
   * Debounced wrapper for updateStats.
   * Delays execution until typing pauses, reducing WASM call frequency.
   */
  function debouncedUpdateStats() {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    debounceTimeout = setTimeout(updateStats, STATS_DEBOUNCE_MS);
  }

  // Update stats on Automerge document changes (remote edits)
  handle.on('change', debouncedUpdateStats);

  // Update stats on local edits
  view.dom.addEventListener('input', debouncedUpdateStats);

  // Initial stats calculation (no debounce needed)
  updateStats();
}
