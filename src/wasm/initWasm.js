import init, {
  // Your existing functions
  export_to_markdown,
  compress_document,
  decompress_document,
  format_text,
  toggle_bold,
  toggle_italic,
  toggle_underline,
  toggle_strikethrough,
  toggle_heading,
  toggle_list,
  toggle_numbered_list,
  calculate_document_stats,
  convert_url_to_markdown,

  // NEW: PromiseGrid functions
  create_promisegrid_edit_message,
  create_promisegrid_stats_message,
  parse_promisegrid_message,
  log_promisegrid_message,
  export_document_as_promisegrid,
  search_document
} from '../../rust-wasm/pkg/rust_wasm.js';

import { showErrorBanner } from '../ui/errors.js';

// Track WASM initialization state
let wasmReady = false;

export function isWasmReady() {
  return wasmReady;
}

export async function initWasm() {
  try {
    await init();
    wasmReady = true;

    // Test the existing function
    const output = export_to_markdown("**Hello world**");
    console.log("WASM Markdown Output:", output);

    // Test WASM compression
    const testData = "This is a long document that should compress well. ".repeat(100);
    console.log("RUST WASM COMPRESSION TEST:");
    console.log(" Original size:", testData.length, "bytes");

    const compressed = compress_document(testData);
    console.log(" WASM compressed size:", compressed.length, "bytes");
    console.log(" WASM compression ratio:", ((testData.length - compressed.length) / testData.length * 100).toFixed(1) + "%");

    const decompressed = decompress_document(compressed);
    console.log(" WASM decompression successful:", decompressed === testData);

    // Test PromiseGrid CBOR functionality
    console.log("PROMISEGRID CBOR TEST:");
    try {
      const testMessage = create_promisegrid_edit_message(
        "test-doc",
        "insert",
        0,
        "Hello PromiseGrid!",
        "test-user"
      );
      console.log(" PromiseGrid CBOR message created:", testMessage.length, "bytes");
      log_promisegrid_message(testMessage);
    } catch (pgError) {
      console.log(" PromiseGrid test failed:", pgError);
    }

    console.log("WASM SEARCH TEST:");
    const testText = "The quick brown fox jumps over the lazy dog. The fox is quick.";
    const searchResults = search_document(testText, "fox", false);
    console.log(" Search results for 'fox':", searchResults);

    console.log("WASM initialization complete");
  } catch (error) {
    wasmReady = false;
    console.error("Failed to initialize Rust WASM:", error);
    showErrorBanner("Text formatting features unavailable. Try running 'make wasm' and refresh.", 10000);
    throw error; // Re-throw so app.js knows init failed
  }
}


// Export the format function for use in other modules
// TEMP: expose for console testing
window.toggle_heading = toggle_heading;
window.toggle_list = toggle_list;
window.toggle_numbered_list = toggle_numbered_list;
window.toggle_bold = toggle_bold;
window.toggle_italic = toggle_italic;
window.toggle_underline = toggle_underline;
window.toggle_strikethrough = toggle_strikethrough;
window.convert_url_to_markdown = convert_url_to_markdown;

// NEW: Expose PromiseGrid functions for console testing
window.createPromiseGridMessage = create_promisegrid_edit_message;
window.parsePromiseGridMessage = parse_promisegrid_message;
window.logPromiseGridMessage = log_promisegrid_message;
window.searchDocument = search_document;

export {
  format_text,
  toggle_bold,
  toggle_italic,
  toggle_underline,
  toggle_strikethrough,
  toggle_heading,
  toggle_list,
  toggle_numbered_list,
  calculate_document_stats,
  convert_url_to_markdown,
  search_document
};

// Export PromiseGrid functions
export const promiseGrid = {
    createEditMessage: create_promisegrid_edit_message,
    createStatsMessage: create_promisegrid_stats_message,
    parseMessage: parse_promisegrid_message,
    logMessage: log_promisegrid_message,
    exportDocument: export_document_as_promisegrid,
};

// Helper function to get current user/document info for PromiseGrid messages
export function getCurrentSessionInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        documentId: urlParams.get('doc') || 'default-document',
        userId: localStorage.getItem('username') || 'anonymous-user'
    };
}
