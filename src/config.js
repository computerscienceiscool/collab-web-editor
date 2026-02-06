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
  
  // WebSocket URLs (constructed from ports)
  urls: {
    automergeSync: `ws://localhost:${import.meta.env.VITE_WS_PORT || DEFAULT_PORTS.AUTOMERGE_SYNC}`,
    awareness: `ws://localhost:${import.meta.env.VITE_AWARENESS_PORT || DEFAULT_PORTS.AWARENESS}`,
    backend: `http://localhost:${import.meta.env.VITE_BACKEND_PORT || DEFAULT_PORTS.BACKEND}`
  }
};

// Log configuration in development
if (import.meta.env.DEV) {
  console.log('[Config] Loaded configuration:', config);
}
