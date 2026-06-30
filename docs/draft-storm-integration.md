# Storm Integration Guide (DRAFT)

Three patterns for integrating Storm with collab-web-editor, ordered from simplest to deepest coupling.

## Pattern 1: Link-only (iframe embed)

Zero integration effort. Embed the editor in an iframe and communicate via URL parameters.

### Setup

```html
<!-- In Storm's UI -->
<iframe
  id="editor"
  src="http://localhost:8080/?doc=automerge:abc123"
  style="width: 100%; height: 600px; border: none;"
></iframe>
```

### Opening a specific document

```javascript
// Storm controls which document the editor shows
function openDocument(docId) {
  document.getElementById('editor').src =
    `http://localhost:8080/?doc=${encodeURIComponent(docId)}`;
}
```

### Trade-offs

| Pros | Cons |
|------|------|
| Zero code changes to either project | No shared state between Storm and editor |
| Editor updates independently | Limited to URL-based communication |
| Full isolation (security, styles) | No cursor/presence awareness in Storm's UI |
| Works today with no integration code | User manages two separate interfaces |

### When to use

- Prototyping and early integration
- When Storm just needs "a link to the editor"
- When isolation between Storm and the editor is desirable

---

## Pattern 2: Awareness bridge

Import `@collab-editor/awareness` into Storm so both applications share presence information. Storm sees who is editing, their cursor positions, and typing status -- without touching document content.

### Setup

```bash
# In Storm's project
npm install @collab-editor/awareness
```

### Code example

```javascript
import { AwarenessClient } from '@collab-editor/awareness';

// Storm connects to the same awareness server the editor uses
const awareness = new AwarenessClient('ws://localhost:1235', {
  documentId: 'automerge:abc123',  // Must match the editor's document ID
  name: 'Storm Agent',
  color: '#FF6B6B'
});

awareness.connect();

// See all connected users (browser editors + Neovim + Storm)
awareness.on('change', (states) => {
  for (const [userId, state] of states) {
    console.log(`${state.user.name} is at position ${state.selection?.anchor}`);
    console.log(`  typing: ${state.typing}`);
    console.log(`  color: ${state.user.color}`);
  }
});

// Storm can broadcast its own presence
awareness.setLocalStateField('selection', { anchor: 0 });
awareness.setLocalStateField('typing', false);

// Custom fields for Storm-specific state
awareness.setLocalStateField('stormRole', 'reviewer');
```

### Showing editor users in Storm's UI

```javascript
function renderUserList(states) {
  const users = [];
  for (const [userId, state] of states) {
    users.push({
      name: state.user?.name || 'Anonymous',
      color: state.user?.color || '#888',
      typing: state.typing || false,
      position: state.selection?.anchor
    });
  }
  // Render users in Storm's sidebar, status bar, etc.
  return users;
}

awareness.on('change', (states) => {
  const users = renderUserList(states);
  stormUI.updateCollaborators(users);
});
```

### Trade-offs

| Pros | Cons |
|------|------|
| Shared presence across all clients | Storm doesn't see document content |
| Lightweight -- awareness messages are small | Requires awareness server to be running |
| Storm can display collaborator info in its own UI | Two WebSocket connections per Storm client |
| Custom fields allow Storm-specific metadata | |

### When to use

- Storm needs to know who is editing and where
- Storm wants to show collaborator presence in its own UI
- Document content stays in the editor; Storm doesn't need to read/write it

---

## Pattern 3: Deep (shared Automerge document)

Storm connects directly to the Automerge sync server and shares the same CRDT document as the editor. Full read/write access to document content.

### Setup

```bash
# In Storm's project (Node.js)
npm install @automerge/automerge @automerge/automerge-repo @automerge/automerge-repo-network-websocket
npm install @collab-editor/awareness  # Optional, for presence too
```

### Code example

```javascript
import { Repo } from '@automerge/automerge-repo';
import { BrowserWebSocketClientAdapter } from '@automerge/automerge-repo-network-websocket';
import { AwarenessClient } from '@collab-editor/awareness';

// Connect to the same sync server the editor uses
const repo = new Repo({
  network: [new BrowserWebSocketClientAdapter('ws://localhost:1234')]
});

// Open a shared document
const handle = repo.find('automerge:abc123');

// Wait for document to be ready
await handle.whenReady();
const doc = handle.docSync();
console.log('Current content:', doc.content);

// Read document content
function getContent() {
  return handle.docSync().content;
}

// Write to the document -- appears in all connected editors in real-time
function insertText(position, text) {
  handle.change((doc) => {
    Automerge.splice(doc, ['content'], position, 0, text);
  });
}

function replaceContent(newContent) {
  handle.change((doc) => {
    Automerge.splice(doc, ['content'], 0, doc.content.length, newContent);
  });
}

// Listen for changes from other clients
handle.on('change', ({ doc, patches }) => {
  console.log('Document updated:', doc.content);
  // patches contains granular change info if available
});

// Optionally add awareness for presence
const awareness = new AwarenessClient('ws://localhost:1235', {
  documentId: 'automerge:abc123',
  name: 'Storm',
  color: '#FF6B6B'
});
awareness.connect();
```

### Document structure

Both Storm and the editor must use the same document schema:

```javascript
{
  content: "",           // Text content (use Automerge.splice for edits)
  metadata: {
    created: 1234567890, // Unix timestamp
    version: 1           // Schema version
  }
}
```

### Creating a new document from Storm

```javascript
const handle = repo.create();

handle.change((doc) => {
  doc.content = "";
  doc.metadata = {
    created: Date.now(),
    version: 1
  };
});

const docId = handle.url;  // "automerge:abc123..."
// Share this URL with browser users: http://localhost:8080/?doc=automerge:abc123
```

### Trade-offs

| Pros | Cons |
|------|------|
| Full read/write access to document content | Tighter coupling -- must match document schema |
| Real-time sync in both directions | Heavier dependency (Automerge, automerge-repo) |
| Storm can create, modify, and read documents | Must use `splice()` for text edits (not plain assignment) |
| Combine with awareness for full collaboration | Schema changes require coordination |

### When to use

- Storm needs to read or write document content
- Storm creates documents for users to edit
- Storm processes or analyzes document content in real-time
- Full bidirectional collaboration between Storm and the editor

---

## Comparison

| | Link-only | Awareness bridge | Deep |
|---|---|---|---|
| **Integration effort** | None | Low | Medium |
| **Shared presence** | No | Yes | Yes (with awareness) |
| **Read document content** | No | No | Yes |
| **Write document content** | No | No | Yes |
| **Dependencies added to Storm** | None | `@collab-editor/awareness` | `automerge`, `automerge-repo`, network adapter |
| **Schema coupling** | None | None | Must match document structure |

## Recommendation

Start with **Pattern 2 (awareness bridge)** unless Storm specifically needs document content access. It provides useful collaboration features (seeing who's editing, cursor positions) with minimal coupling. Move to Pattern 3 if Storm needs to read/write document content.

## Common Pitfalls

1. **Document ID format**: Always use the full `automerge:...` prefix when referencing documents. The awareness server uses this to scope presence to the correct document room.

2. **splice() vs assignment**: When modifying `content` in Pattern 3, always use `Automerge.splice()`. Direct assignment (`doc.content = "new text"`) replaces the entire CRDT text object and destroys concurrent edit history.

3. **Awareness heartbeats**: The awareness client sends heartbeats (default 30s). If Storm's process goes idle, other users will see Storm as disconnected. Call `awareness.disconnect()` explicitly when Storm is done.

4. **Port conflicts**: If Storm runs its own servers, make sure they don't conflict with the editor's ports (1234, 1235, 8080).

5. **CORS**: If Storm's frontend is on a different origin than the editor servers, configure the sync and awareness servers to accept cross-origin WebSocket connections.

6. **Multiple documents**: Each awareness client instance is scoped to one document. If Storm needs presence across multiple documents, create one `AwarenessClient` per document.
