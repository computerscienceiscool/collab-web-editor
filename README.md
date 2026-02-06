# collab-web-editor

Browser-based collaborative text editor built on [Automerge CRDTs](https://automerge.org/) and [CodeMirror 6](https://codemirror.net/).

Real-time multi-user editing with automatic conflict resolution, cursor synchronization, and offline support.

## Quick Start

```bash
# 1. Install
npm install

# 2. Start servers (in separate terminals)
make ws                    # Automerge sync server (port 1234)
cd ../collab-awareness && npm start  # Awareness server (port 1235)

# 3. Run editor
npm run dev               # Opens http://localhost:8080
```

Share the URL to collaborate. Works alongside [Vimbeam](https://github.com/computerscienceiscool/vimbeam) for Neovim users.

## Features

| Category | Features |
|----------|----------|
| **Collaboration** | Real-time sync, remote cursors, typing indicators, user presence |
| **Editing** | Markdown syntax, 51 keyboard shortcuts, undo/redo history |
| **Export** | txt, md, json, cbor, html, automerge formats |
| **GitHub** | Direct commits, pull files, AI commit messages |
| **Offline** | IndexedDB persistence, automatic reconnection |
| **Preview** | Side-by-side markdown preview with scroll sync |

## Architecture

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  CodeMirror │◄──►│ AutomergeBinding │◄──►│  AutomergeSync  │──► WebSocket :1234
│   Editor    │    │                  │    │                 │
└─────────────┘    └──────────────────┘    └─────────────────┘
       ▲
       │
┌──────┴──────┐
│  Awareness  │────────────────────────────────────────────────► WebSocket :1235
│   Client    │
└─────────────┘
```

Three single-responsibility components:

- **AutomergeSync** - CRDT document sync via WebSocket
- **AutomergeBinding** - Bridges editor ↔ Automerge using `splice()` for character-level edits
- **createEditor** - CodeMirror instance with collaborative extensions

See [docs/architecture.md](docs/architecture.md) for data flow diagrams and integration details.

## Usage

### Programmatic

```javascript
import { AutomergeSync } from 'collab-web-editor/sync';
import { setupEditorWithBinding } from 'collab-web-editor/editor';
import { AwarenessClient } from '@collab-editor/awareness';

// Connect to sync server
const sync = new AutomergeSync('ws://localhost:1234');
sync.connect();
await sync.openDocument('automerge:abc123...');

// Connect to awareness server
const awareness = new AwarenessClient('ws://localhost:1235', {
  documentId: sync.getDocumentId(),
  name: 'Alice',
  color: '#4ECDC4'
});
awareness.connect();

// Create editor with binding
const { view, binding, destroy } = setupEditorWithBinding(
  document.getElementById('editor'),
  sync.getHandle(),
  awareness
);

// Listen for changes
sync.on('remote-change', ({ doc }) => console.log('Content:', doc.content));
awareness.on('change', (states) => console.log('Users:', states.size));
```

See [docs/usage.md](docs/usage.md) for keyboard shortcuts, menu features, and GitHub integration.

## Protocol Compatibility

Works with any client using the same protocols:

| Component | Protocol | Port | Clients |
|-----------|----------|------|---------|
| Document sync | Automerge WebSocket | 1234 | Browser, Vimbeam |
| Presence | Awareness JSON | 1235 | Browser, Vimbeam |

**Document structure** (must match across clients):
```javascript
{ content: "", metadata: { created: timestamp, version: 1 } }
```

## WASM Modules

| Module | Source | Purpose | Required |
|--------|--------|---------|----------|
| Rust WASM | `rust-wasm/` | Compression, formatting, search, PromiseGrid | Yes |
| Go Diff | `dist/diff.wasm` | Side-by-side diff viewer | No |
| Go Grokker | `dist/grokker.wasm` | AI commit message generation | No |

Go WASM modules are optional -- the editor loads and runs without them. If the `.wasm` files are missing, those features are simply unavailable (no errors).

Build:
```bash
make wasm         # Rust
make diff-wasm    # Go diff (optional)
make grokker-wasm # Go grokker (optional)
```

## Scripts

```bash
npm run dev      # Development server with hot reload
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Documentation

- [Architecture](docs/architecture.md) - Components, data flow, integration guides
- [Usage Guide](docs/usage.md) - Features, shortcuts, GitHub, troubleshooting

## Related Projects

- [@collab-editor/awareness](https://github.com/computerscienceiscool/collab-awareness) - Cursor/presence synchronization
- [Vimbeam](https://github.com/computerscienceiscool/vimbeam) - Neovim collaborative editing plugin
- [collab-editor](https://github.com/computerscienceiscool/collab-editor) - Original monorepo (this package was extracted from `packages/editor/`)

## License

MIT
