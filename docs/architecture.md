# @collab-editor/editor Architecture

## Overview

`@collab-editor/editor` is a browser-based collaborative text editor built on Automerge CRDTs and CodeMirror 6. It provides real-time multi-user editing with automatic conflict resolution, cursor synchronization, and offline support.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser Client                                │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐    │
│  │  CodeMirror │◄──►│ AutomergeBinding │◄──►│  AutomergeSync  │    │
│  │   Editor    │    │                  │    │                 │    │
│  └─────────────┘    └──────────────────┘    └────────┬────────┘    │
│         ▲                                            │              │
│         │                                            │              │
│  ┌──────┴──────┐                              ┌──────▼──────┐      │
│  │  Awareness  │◄────────────────────────────►│  WebSocket  │      │
│  │   Client    │                              │  (port 1234)│      │
│  └──────┬──────┘                              └─────────────┘      │
│         │                                                           │
└─────────┼───────────────────────────────────────────────────────────┘
          │
          ▼ WebSocket (port 1235)
┌─────────────────────┐         ┌─────────────────────┐
│  Awareness Server   │         │  Automerge Sync     │
│  (cursor/presence)  │         │  Server (CRDT)      │
└─────────────────────┘         └─────────────────────┘
```

## Core Components

### 1. AutomergeSync (`src/automerge-sync.js`)

**Responsibility:** Manage Automerge repository and document synchronization.

```javascript
import { AutomergeSync } from '@collab-editor/editor/sync';

const sync = new AutomergeSync('ws://localhost:1234');
sync.connect();

// Create new document
const docId = sync.createDocument();

// Or open existing
await sync.openDocument('automerge:abc123...');

// Apply edits using splice for character-level precision
sync.applyLocalEdit(position, deleteCount, insertText);

// Listen for remote changes
sync.on('remote-change', ({ doc, patches }) => {
  console.log('Remote edit received');
});
```

**Key Features:**
- EventEmitter pattern for lifecycle events
- IndexedDB persistence via Automerge storage adapter
- Automatic URL updates when creating documents
- Document structure: `{ content: "", metadata: { created, version } }`

**Events:**
| Event | Data | Description |
|-------|------|-------------|
| `connected` | - | WebSocket connected |
| `disconnected` | - | WebSocket disconnected |
| `document-ready` | `{ doc, handle, isNew }` | Document loaded |
| `document-closed` | - | Document closed |
| `remote-change` | `{ doc, patches }` | Remote edit received |
| `error` | `{ error, context }` | Error occurred |

### 2. AutomergeBinding (`src/codemirror-binding.js`)

**Responsibility:** Synchronize CodeMirror state with Automerge document.

```javascript
import { AutomergeBinding, isRemoteChange } from '@collab-editor/editor/binding';

const binding = new AutomergeBinding(editorView, automergeHandle);
binding.attach();

// In editor update listener:
binding.applyLocalChange(update);

// Cleanup
binding.detach();
```

**Key Features:**
- Uses `Automerge.splice()` for character-level edits
- Transaction annotations prevent echo loops
- Patch-based updates for efficiency
- Falls back to full sync when patches unavailable

**Why splice() matters:**
```javascript
// splice() gives Automerge exact intent
Automerge.splice(doc, ['content'], position, deleteCount, insertText);

// This enables optimal CRDT merging when users type concurrently
// User A types "hello" at position 0
// User B types "world" at position 0
// Result: "helloworld" or "worldhello" (deterministic, no conflicts)
```

### 3. createEditor (`src/editor.js`)

**Responsibility:** Create configured CodeMirror instance.

```javascript
import { createEditor, setupEditorWithBinding } from '@collab-editor/editor/editor';

// Basic editor
const { view, destroy } = createEditor(element, {
  initialContent: '',
  awareness: awarenessClient,
  onUpdate: (update) => { /* handle changes */ }
});

// Editor with Automerge binding (convenience function)
const { view, binding, destroy } = setupEditorWithBinding(
  element,
  automergeHandle,
  awarenessClient
);
```

**Included Extensions:**
- `minimalSetup` - Basic CodeMirror functionality
- `markdown()` - Markdown syntax highlighting
- `history()` - Undo/redo support
- `lineNumbers` - Toggleable line numbers
- `remoteCursorPlugin` - Remote cursor display

## Data Flow

### Local Edit Flow

```
User types "x"
      │
      ▼
┌─────────────────┐
│ CodeMirror      │ Creates transaction with change
│ updateListener  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AutomergeBinding│ Calls Automerge.splice(doc, ['content'], pos, 0, 'x')
│ applyLocalChange│ Sets isSyncingLocalChange = true
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Automerge       │ Updates CRDT, broadcasts to network
│ handle.change() │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ handle.on       │ Receives own change back
│ ('change')      │ Skipped because isSyncingLocalChange = true
└─────────────────┘
```

### Remote Edit Flow

```
WebSocket receives Automerge sync message
      │
      ▼
┌─────────────────┐
│ Automerge Repo  │ Merges remote changes into local doc
│ network adapter │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ handle.on       │ Fires with { doc, patches }
│ ('change')      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AutomergeBinding│ Checks isSyncingLocalChange (false for remote)
│ _handleRemote   │ Converts patches to CodeMirror changes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ view.dispatch() │ Applies changes with isRemoteChange annotation
│                 │ Editor updates without triggering local sync
└─────────────────┘
```

## Integration with @collab-editor/awareness

The awareness system handles cursor positions and user presence separately from document content.

```
┌─────────────────────────────────────────────────────┐
│                 Document Sync (port 1234)           │
│  Automerge CRDT ──► Content changes only            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                Awareness Sync (port 1235)           │
│  AwarenessClient ──► Cursors, names, colors,        │
│                      typing indicators              │
└─────────────────────────────────────────────────────┘
```

### AwarenessClient Usage

```javascript
import { AwarenessClient } from '@collab-editor/awareness';

const awareness = new AwarenessClient('ws://localhost:1235', {
  documentId: 'automerge:abc123',  // Scopes users to this document
  name: 'Alice',
  color: '#4ECDC4',
  heartbeatInterval: 30000
});

awareness.connect();

// Update cursor position
awareness.setLocalStateField('selection', { anchor: 42 });

// Show typing indicator
awareness.setLocalStateField('typing', true);

// Listen for remote users
awareness.on('change', (states) => {
  // states is Map<userId, { user, typing, selection }>
});
```

### Document Scoping

Each document has its own awareness "room". Users in document A don't see users in document B:

```javascript
// This filter in AwarenessClient._handleMessage ensures isolation:
if (data.documentId === this.documentId) {
  // Only process messages for our document
}
```

### Remote Cursor Plugin

The `remoteCursorPlugin` from awareness displays other users' cursors:

```javascript
import { remoteCursorPlugin } from '@collab-editor/awareness';

// In editor extensions:
extensions.push(...remoteCursorPlugin(cmView, cmState, awareness, localUserId));
```

## Integration with Vimbeam

[Vimbeam](https://github.com/computerscienceiscool/vimbeam) is a Neovim plugin that connects to the same collaboration infrastructure.

### Protocol Compatibility

Both browser and Neovim clients use identical protocols:

| Component | Protocol | Port |
|-----------|----------|------|
| Document sync | Automerge WebSocket | 1234 |
| Cursor/presence | Awareness JSON | 1235 |

### Document Structure

Both clients expect the same Automerge document structure:

```javascript
{
  content: "",           // The text content (Automerge.Text)
  metadata: {
    created: 1234567890, // Unix timestamp
    version: 1           // Schema version
  }
}
```

### Edit Operations

Both clients use `Automerge.splice()` for edits:

```javascript
// Browser (JavaScript)
Automerge.splice(doc, ['content'], position, deleteCount, insertText);

// Neovim (Lua, via automerge-lua)
automerge.splice(doc, {'content'}, position, delete_count, insert_text)
```

### Cursor Awareness

Both clients send the same awareness message format:

```json
{
  "type": "awareness",
  "clientID": "user-123",
  "documentId": "automerge:abc...",
  "state": {
    "user": { "name": "Alice", "color": "#4ECDC4" },
    "typing": false,
    "selection": { "anchor": 42 }
  }
}
```

### Cross-Platform Editing

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Browser    │     │   Servers   │     │    Neovim    │
│   Editor     │     │             │     │   (Vimbeam)  │
├──────────────┤     ├─────────────┤     ├──────────────┤
│ CodeMirror   │◄───►│ Automerge   │◄───►│ Neovim buffer│
│              │     │ Sync :1234  │     │              │
├──────────────┤     ├─────────────┤     ├──────────────┤
│ Awareness    │◄───►│ Awareness   │◄───►│ Awareness    │
│ Client       │     │ Server :1235│     │ Client       │
└──────────────┘     └─────────────┘     └──────────────┘

Users see each other's cursors regardless of which client they use.
```

## File Structure

```
packages/editor/
├── src/
│   ├── main.js              # Application entry point
│   ├── automerge-sync.js    # AutomergeSync class
│   ├── codemirror-binding.js# AutomergeBinding class
│   ├── editor.js            # createEditor function
│   ├── config.js            # Server URLs configuration
│   ├── menu-system.js       # Menu bar functionality
│   ├── ui/                  # UI components
│   │   ├── documentStats.js # Word count, etc.
│   │   ├── errors.js        # Error banner display
│   │   ├── logging.js       # Activity log
│   │   ├── shortcutManager.js
│   │   ├── preferencesDialog.js
│   │   ├── githubDialog.js
│   │   ├── githubCommitDialog.js
│   │   └── githubPullDialog.js
│   ├── github/              # GitHub integration
│   │   ├── githubService.js # API client
│   │   └── githubMenuIntegration.js
│   ├── export/              # Export handlers
│   │   └── handlers.js      # txt, md, json, cbor, html
│   ├── wasm/                # WASM integration
│   │   ├── initWasm.js      # Rust WASM loader
│   │   └── diffWasm.js      # Go diff WASM loader
│   ├── setup/               # Initialization
│   │   ├── userSetup.js     # User name/color controls
│   │   └── documentCopy.js  # Document duplication
│   └── utils/               # Utilities
│       ├── clientId.js      # Unique client ID
│       ├── documentRegistry.js
│       ├── timeUtils.js
│       ├── sanitizeFilename.js
│       └── logger.js
├── public/
│   ├── service-worker.js    # Offline support
│   └── wasm/                # Rust WASM artifacts
├── dist/                    # Go WASM runtime
│   ├── wasm_exec.js         # Go runtime
│   └── grokker-loader.js    # AI commit message loader
├── rust-wasm/               # Rust WASM source
│   └── src/
│       ├── lib.rs           # Main WASM exports
│       └── promisegrid.rs   # PromiseGrid CBOR
├── index.html               # Main HTML
├── style.css                # Styles
├── package.json
└── vite.config.js
```

## Configuration

### Server URLs (`src/config.js`)

```javascript
export const config = {
  urls: {
    automergeSync: 'ws://localhost:1234',  // Document sync
    awareness: 'ws://localhost:1235'        // Cursor/presence
  }
};
```

### For Production

Update config.js or use environment variables:

```javascript
export const config = {
  urls: {
    automergeSync: import.meta.env.VITE_SYNC_URL || 'ws://localhost:1234',
    awareness: import.meta.env.VITE_AWARENESS_URL || 'ws://localhost:1235'
  }
};
```

## WASM Modules

### Rust WASM (rust-wasm/)

Built with `wasm-pack`. Provides:
- Text compression/decompression
- Markdown formatting (bold, italic, lists, headings)
- Document search
- PromiseGrid CBOR message creation

```bash
cd rust-wasm && wasm-pack build --target web --out-dir pkg
```

### Go WASM (dist/)

**Grokker** - AI-powered commit message generation:
```bash
make grokker-wasm
```

**Diff** - Side-by-side diff viewer:
```bash
make diff-wasm
```

## Security Considerations

1. **XSS Prevention**: All rendered HTML is sanitized via `sanitizeHtml()`
2. **Token Storage**: GitHub tokens are obfuscated in localStorage (not plain text)
3. **Input Validation**: URLs checked for `javascript:` protocol
4. **Content Security**: No `eval()` or inline script execution

## Performance Notes

1. **Patch-based sync**: Remote changes use Automerge patches when available, avoiding full document replacement
2. **Debounced preview**: Markdown preview updates are debounced (300ms)
3. **Lazy WASM loading**: Go WASM modules load with 2-second delay to not block editor
4. **IndexedDB caching**: Documents persist locally for offline access
