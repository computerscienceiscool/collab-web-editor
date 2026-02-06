# @collab-editor/editor Usage Guide

## Quick Start

### 1. Install Dependencies

```bash
cd packages/editor
npm install
```

### 2. Start Servers

You need two servers running:

```bash
# Terminal 1: Automerge sync server (port 1234)
make ws

# Terminal 2: Awareness server (port 1235)
cd ../collab-awareness && npm start
```

### 3. Start Editor

```bash
# Terminal 3: Development server
npm run dev
```

Open http://localhost:8080

## Creating Documents

### New Document

Visit http://localhost:8080 without parameters. A new document is created and the URL updates:

```
http://localhost:8080/?doc=automerge:4xkP2nRw...
```

### Opening Existing Document

Share the full URL. Anyone with the URL can edit the same document.

### From Neovim (Vimbeam)

```vim
:VimbeamConnect ws://localhost:1234
:VimbeamOpen automerge:4xkP2nRw...
```

## Collaboration Features

### User Identity

Set your name and color in the toolbar. These persist in localStorage.

### Seeing Other Users

- **User list**: Shows colored dots for each connected user
- **User count**: Number next to the list
- **Remote cursors**: Colored carets in the editor
- **Typing indicator**: "User is typing..." message

### Activity Log

Click "Log" button to see join/leave events and actions.

## Keyboard Shortcuts

### Always Enabled
| Shortcut | Action |
|----------|--------|
| Ctrl+C | Copy |
| Ctrl+V | Paste |
| Ctrl+X | Cut |
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |

### Optional (Enable in Preferences)
| Shortcut | Action |
|----------|--------|
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+U | Underline |
| Ctrl+S | Save |
| Ctrl+N | New document |
| Ctrl+F | Find |
| Ctrl+M | Toggle markdown preview |
| Ctrl+P | Print |
| Ctrl+Alt+G | GitHub settings |

Access keyboard preferences via Help → Keyboard Shortcuts.

## Menu System

### File Menu
- **New Document**: Create blank document
- **Open Recent**: Previously opened documents
- **Make a copy**: Duplicate current document
- **Download as**: Export to txt, md, json, cbor, html, automerge
- **Share/Email**: Share document link
- **Copy Document URL**: Copy link to clipboard
- **Print**: Print document
- **Rename**: Change document title
- **Version history**: View saved versions

### Edit Menu
- Undo/Redo
- Cut/Copy/Paste
- Select All
- Delete
- Find

### Format Menu
- **Format Document**: Clean up whitespace
- Bold, Italic, Underline, Strikethrough
- Headings (H1, H2, H3)
- Bullet List, Numbered List
- Insert Link

### Tools Menu
- **Word count**: Document statistics
- **Compare versions**: Diff viewer
- **GitHub Settings**: Configure GitHub integration
- **Commit to GitHub**: Push to repository
- **Pull from GitHub**: Import file

### View Menu
- **Toggle line numbers**
- **Toggle markdown preview**: Side-by-side preview
- **Toggle activity log**
- **Dark/Light mode**

### Help Menu
- Keyboard shortcuts
- About

## GitHub Integration

### Setup

1. Go to Tools → GitHub Settings
2. Enter your GitHub Personal Access Token
3. Select default repository and branch

### Creating a Token

1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Select scopes: `repo` (full control)
4. Copy token to settings

### Committing

1. Tools → Commit to GitHub
2. Enter commit message (or use AI-generated)
3. Select file path
4. Click Commit

### Pulling Files

1. Tools → Pull from GitHub
2. Browse repositories and files
3. Preview content
4. Click Pull to load into editor

## Markdown Preview

Toggle with Ctrl+M or View → Toggle Markdown Preview.

Features:
- Side-by-side view
- Real-time updates as you type
- Scroll synchronization
- Supports: headings, lists, code blocks, tables, links, images

## Export Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| Plain Text | .txt | Raw text content |
| Markdown | .md | With frontmatter metadata |
| CodeMirror State | .json | Editor state for debugging |
| CBOR | .cbor | Binary encoding |
| PromiseGrid CBOR | .cbor | Protocol-compliant message |
| Automerge | .automerge | Full CRDT document |
| HTML | .html | Rendered markdown |

## Offline Support

The editor works offline:

1. Documents are cached in IndexedDB
2. Edits are saved locally
3. When reconnected, changes sync automatically

The status indicator shows:
- **Online**: Connected to servers
- **Offline**: Working locally
- **Reconnecting**: Attempting to reconnect

## Theming

Click the moon/sun icon to toggle dark/light mode. Preference is saved in localStorage.

## Programmatic Usage

### Embedding the Editor

```javascript
import { createEditor, setupEditorWithBinding } from '@collab-editor/editor/editor';
import { AutomergeSync } from '@collab-editor/editor/sync';
import { AwarenessClient } from '@collab-editor/awareness';

// Setup sync
const sync = new AutomergeSync('ws://localhost:1234');
sync.connect();
await sync.openDocument('automerge:...');

// Setup awareness
const awareness = new AwarenessClient('ws://localhost:1235', {
  documentId: sync.getDocumentId()
});
awareness.connect();

// Create editor
const { view, binding, destroy } = setupEditorWithBinding(
  document.getElementById('editor'),
  sync.getHandle(),
  awareness
);

// Cleanup on unmount
destroy();
awareness.disconnect();
sync.disconnect();
```

### Listening to Changes

```javascript
// Document content changes
sync.on('remote-change', ({ doc }) => {
  console.log('Content:', doc.content);
});

// User presence changes
awareness.on('change', (states) => {
  for (const [userId, state] of states) {
    console.log(`${state.user.name} at position ${state.selection?.anchor}`);
  }
});
```

### Programmatic Edits

```javascript
// Get current content
const content = sync.getContent();

// Apply edit (position, deleteCount, insertText)
sync.applyLocalEdit(0, 0, 'Hello '); // Insert at start

// Or through the editor
view.dispatch({
  changes: { from: 0, to: 0, insert: 'Hello ' }
});
```

## Troubleshooting

### "Failed to load Rust WASM"

```bash
cd packages/editor/rust-wasm
wasm-pack build --target web --out-dir pkg
```

### "Failed to load Grokker WASM"

```bash
make grokker-wasm
```

### "Could not load document"

1. Check sync server is running on port 1234
2. Check document ID is valid
3. Check network connectivity

### Users from other documents appearing

Update @collab-editor/awareness to latest version with documentId filtering fix.

### Cursors not showing

1. Check awareness server is running on port 1235
2. Check browser console for WebSocket errors
3. Verify documentId matches between clients
