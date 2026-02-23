# collab-web-editor

Browser-based collaborative text editor built on [Automerge CRDTs](https://automerge.org/) and [CodeMirror 6](https://codemirror.net/).

Real-time multi-user editing with automatic conflict resolution, cursor synchronization, and offline support.

## Quick Start

```bash
# 1. Install
npm install

# 2. Build Rust WASM (required)
make wasm

# 3. Start everything
make start                # Sync server (1234) + Awareness server (1235) + Web (8080)
```

Open `http://localhost:8080` and share the URL to collaborate. Works alongside [Viduct](https://github.com/computerscienceiscool/viduct) for Neovim users.

Stop with `make stop`. Check status with `make status`.

## Setup Levels

### Basic (collaborative editing)

All you need for real-time multi-user editing with cursors and presence:

```bash
npm install
make wasm                 # Rust WASM (required — editor won't load without it)
make start                # Starts sync, awareness, and web servers
```

**What works:** Real-time sync, remote cursors, selections, typing indicators, user presence, markdown editing, 51 keyboard shortcuts, undo/redo, offline persistence, export (txt/md/json/cbor/html/automerge).

### Full (all features)

Add optional Go WASM modules for extra features:

```bash
make diff-wasm            # Side-by-side diff viewer
make grokker-wasm         # AI commit message generation
```

**Extra features:** GitHub integration (direct commits, pull files), AI-generated commit messages, side-by-side diff viewer. These modules are optional — the editor loads and runs without them, and those features simply won't appear.

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
| Document sync | Automerge WebSocket | 1234 | Browser, Viduct |
| Presence | Awareness JSON | 1235 | Browser, Viduct |

**Document structure** (must match across clients):
```javascript
{ content: "", metadata: { created: timestamp, version: 1 } }
```

## WASM Modules

| Module | Source | Purpose | Required |
|--------|--------|---------|----------|
| Rust WASM | `rust-wasm/` | Compression, formatting, search | **Yes** — editor won't load without it |
| Go Diff | `dist/diff.wasm` | Side-by-side diff viewer | No |
| Go Grokker | `dist/grokker.wasm` | AI commit message generation | No |

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
- [Viduct](https://github.com/computerscienceiscool/viduct) - Neovim collaborative editing plugin
- [collab-editor](https://github.com/computerscienceiscool/collab-editor) - Original monorepo (this package was extracted from `packages/editor/`)

## License

GPL-3.0-or-later — see [LICENSE](LICENSE)
