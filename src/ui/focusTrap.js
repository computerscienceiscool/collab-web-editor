// File: src/ui/focusTrap.js
/**
 * Focus trap utility for modal dialogs
 * Ensures Tab navigation cycles within the dialog for accessibility
 */

/**
 * Get all focusable elements within a container
 * @param {HTMLElement} container - The container element
 * @returns {HTMLElement[]} Array of focusable elements
 */
function getFocusableElements(container) {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors))
    .filter(el => el.offsetParent !== null); // Filter out hidden elements
}

/**
 * Create a focus trap for a modal dialog
 * @param {HTMLElement} dialog - The dialog element to trap focus within
 * @returns {Object} Object with activate() and deactivate() methods
 */
export function createFocusTrap(dialog) {
  let previouslyFocused = null;
  let trapHandler = null;

  function handleKeyDown(e) {
    if (e.key !== 'Tab') return;

    const focusable = getFocusableElements(dialog);
    if (focusable.length === 0) return;

    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: if on first element, wrap to last
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab: if on last element, wrap to first
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  }

  return {
    /**
     * Activate the focus trap
     * Saves current focus and moves focus into the dialog
     */
    activate() {
      // Save currently focused element
      previouslyFocused = document.activeElement;

      // Add keydown handler for Tab trapping
      trapHandler = handleKeyDown;
      document.addEventListener('keydown', trapHandler);

      // Focus the first focusable element or the dialog itself
      const focusable = getFocusableElements(dialog);
      if (focusable.length > 0) {
        // Small delay to ensure dialog is fully rendered
        setTimeout(() => focusable[0].focus(), 10);
      } else {
        dialog.focus();
      }
    },

    /**
     * Deactivate the focus trap
     * Restores focus to the previously focused element
     */
    deactivate() {
      // Remove keydown handler
      if (trapHandler) {
        document.removeEventListener('keydown', trapHandler);
        trapHandler = null;
      }

      // Restore focus to previously focused element
      if (previouslyFocused && previouslyFocused.focus) {
        previouslyFocused.focus();
      }
    }
  };
}
