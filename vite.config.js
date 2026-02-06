import { defineConfig } from 'vite';
import { resolve } from 'path';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [
    wasm(),
    topLevelAwait()
  ],
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
    outDir: 'dist',
    emptyOutDir: false,  // Preserve WASM files in dist/
  },
  server: {
    port: 8080,
    open: true,
  },
  optimizeDeps: {
    exclude: ['@automerge/automerge']
  }
});
