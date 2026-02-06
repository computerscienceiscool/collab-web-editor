// File: src/wasm/diffWasm.js
/**
 * Initialize the Go diff WASM module
 * This handles loading the diff.wasm file and setting up the diff functions
 */

import { showErrorBanner } from '../ui/errors.js';

let diffWasmReady = false;

export async function initDiffWasm() {
  // Check if Go runtime is available
  if (typeof Go === 'undefined') {
    console.error("Go WASM runtime not loaded. Make sure wasm_exec.js is loaded first.");
    throw new Error('Go WASM runtime not loaded for diff');
  }
  
  try {
    console.log("Attempting to load diff WASM from dist/diff.wasm");
    
    const go = new Go();
    const result = await WebAssembly.instantiateStreaming(
      fetch('dist/diff.wasm'),
      go.importObject
    );
    
    // Run the Go program
    go.run(result.instance);
    
    // Verify the functions are available
    const functionsReady = (
      typeof window.generateSideBySideDiff === 'function' &&
      typeof window.generateUnifiedDiff === 'function' &&
      typeof window.generateDiffStats === 'function'
    );
    
    if (functionsReady) {
      console.log("Diff WASM initialized successfully");
      console.log("Available functions:", {
        generateSideBySideDiff: typeof window.generateSideBySideDiff,
        generateUnifiedDiff: typeof window.generateUnifiedDiff,
        generateDiffStats: typeof window.generateDiffStats
      });
      diffWasmReady = true;
      return true;
    } else {
      console.error("Diff WASM loaded but functions not available");
      throw new Error('Diff WASM functions missing after load');
    }
    
  } catch (error) {
    diffWasmReady = false;
    console.error("Failed to load diff WASM:", error);
    console.log("Make sure to run: make diff-wasm");
    showErrorBanner("Diff viewer unavailable. Run 'make diff-wasm' to enable.", 8000);
    return false;
  }
}

/**
 * Check if diff WASM is ready
 */
export function isDiffWasmReady() {
  return diffWasmReady && typeof window.generateSideBySideDiff === 'function';
}

/**
 * Test diff functionality
 */
export function testDiffWasm() {
  if (!isDiffWasmReady()) {
    console.log("Diff WASM not ready");
    return false;
  }
  
  try {
    const oldText = "Hello world\nThis is line 2\nThis is line 3";
    const newText = "Hello universe\nThis is line 2\nThis is line 3\nNew line 4";
    
    const diff = window.generateSideBySideDiff(oldText, newText, "Old Version", "New Version");
    const stats = window.generateDiffStats(oldText, newText);
    
    console.log("Diff test successful:");
    console.log("Stats:", stats);
    console.log("Diff HTML length:", diff.length);
    
    return true;
  } catch (error) {
    console.error("Diff test failed:", error);
    return false;
  }
}

// Auto-initialize when this module is imported
// Gracefully handle failures without crashing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      initDiffWasm().catch(() => {
        console.warn("Diff WASM auto-init failed (non-fatal)");
      });
    }, 2000);
  });
} else {
  setTimeout(() => {
    initDiffWasm().catch(() => {
      console.warn("Diff WASM auto-init failed (non-fatal)");
    });
  }, 2000);
}
