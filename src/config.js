// File: src/config.js

/**
 * Configuration for the collaborative editor
 * Ports are centralized here to avoid hardcoding throughout the codebase
 */

// Default ports (should match Makefile)
const DEFAULT_PORTS = {
  VITE_DEV_SERVER: 8080,
  AUTOMERGE_SYNC: 1234,
  AWARENESS: 1235,
  BACKEND: 3000
};

// Detect GitHub Codespaces: the browser URL contains .app.github.dev
function isCodespace() {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.app.github.dev');
}

// Build the correct URL for a given port
// In Codespaces: https://codespace-name-PORT.app.github.dev (wss for WebSocket)
// Locally: ws://localhost:PORT
function buildUrl(port, protocol = 'ws') {
  if (isCodespace()) {
    // Codespace hostname format: CODESPACE_NAME-CURRENT_PORT.app.github.dev
    // Replace the current port with the target port
    const hostname = window.location.hostname;
    const newHostname = hostname.replace(/-\d+\.app\.github\.dev$/, `-${port}.app.github.dev`);
    return protocol === 'ws' ? `wss://${newHostname}` : `https://${newHostname}`;
  }
  return `${protocol}://localhost:${port}`;
}

// Use environment variables if available, otherwise use defaults
export const config = {
  ports: {
    // Vite dev server
    vite: import.meta.env.VITE_PORT || DEFAULT_PORTS.VITE_DEV_SERVER,

    // Automerge sync server (CBOR binary protocol)
    automergeSync: import.meta.env.VITE_WS_PORT || DEFAULT_PORTS.AUTOMERGE_SYNC,

    // Awareness server (JSON text protocol)
    awareness: import.meta.env.VITE_AWARENESS_PORT || DEFAULT_PORTS.AWARENESS,

    // Backend server
    backend: import.meta.env.VITE_BACKEND_PORT || DEFAULT_PORTS.BACKEND
  },

  // WebSocket URLs (auto-detects Codespaces vs localhost)
  urls: {
    automergeSync: buildUrl(import.meta.env.VITE_WS_PORT || DEFAULT_PORTS.AUTOMERGE_SYNC, 'ws'),
    awareness: buildUrl(import.meta.env.VITE_AWARENESS_PORT || DEFAULT_PORTS.AWARENESS, 'ws'),
    backend: buildUrl(import.meta.env.VITE_BACKEND_PORT || DEFAULT_PORTS.BACKEND, 'http')
  }
};

// Log configuration in development
if (import.meta.env.DEV) {
  console.log('[Config] Loaded configuration:', config);
}
