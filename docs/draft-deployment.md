# Production Deployment Guide (DRAFT)

Deploy collab-web-editor with its two backing servers (Automerge sync, awareness) behind a reverse proxy.

## Components

| Service | Default Port | Protocol | Purpose |
|---------|-------------|----------|---------|
| Automerge sync server | 1234 | WebSocket | CRDT document synchronization |
| Awareness server | 1235 | WebSocket | Cursor/presence/typing indicators |
| Web frontend | 8080 | HTTP | Static Vite build served to browsers |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SYNC_URL` | `ws://localhost:1234` | Automerge sync server WebSocket URL |
| `VITE_AWARENESS_URL` | `ws://localhost:1235` | Awareness server WebSocket URL |
| `PORT` | `8080` | Web frontend port (Vite preview) |

Set `VITE_*` variables **at build time** -- Vite inlines them during `npm run build`.

## Docker Compose

```yaml
version: "3.8"

services:
  sync:
    image: node:20-slim
    working_dir: /app
    command: npx @automerge/automerge-repo-sync-server
    ports:
      - "1234:3030"
    restart: unless-stopped

  awareness:
    image: node:20-slim
    working_dir: /app
    volumes:
      - ./node_modules/@collab-editor/awareness:/app
    command: node server/index.js
    ports:
      - "1235:1235"
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        VITE_SYNC_URL: "wss://edit.example.com/sync"
        VITE_AWARENESS_URL: "wss://edit.example.com/awareness"
    ports:
      - "8080:8080"
    depends_on:
      - sync
      - awareness
    restart: unless-stopped
```

### Dockerfile (web frontend)

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_SYNC_URL
ARG VITE_AWARENESS_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
```

## nginx Reverse Proxy

Terminate TLS and route WebSocket upgrades to the correct backend.

```nginx
upstream sync_backend {
    server 127.0.0.1:1234;
}

upstream awareness_backend {
    server 127.0.0.1:1235;
}

server {
    listen 443 ssl http2;
    server_name edit.example.com;

    ssl_certificate     /etc/letsencrypt/live/edit.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/edit.example.com/privkey.pem;

    # Static frontend
    location / {
        root /var/www/collab-web-editor/dist;
        try_files $uri $uri/ /index.html;
    }

    # Automerge sync WebSocket
    location /sync {
        proxy_pass http://sync_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Awareness WebSocket
    location /awareness {
        proxy_pass http://awareness_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}

server {
    listen 80;
    server_name edit.example.com;
    return 301 https://$host$request_uri;
}
```

When using path-based routing (`/sync`, `/awareness`), update the build-time env vars to match:

```
VITE_SYNC_URL=wss://edit.example.com/sync
VITE_AWARENESS_URL=wss://edit.example.com/awareness
```

## systemd Service Units

### collab-sync.service

```ini
[Unit]
Description=Automerge Sync Server
After=network.target

[Service]
Type=simple
User=collab
WorkingDirectory=/opt/collab-web-editor
ExecStart=/usr/bin/npx @automerge/automerge-repo-sync-server
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### collab-awareness.service

```ini
[Unit]
Description=Awareness Server (cursor/presence)
After=network.target

[Service]
Type=simple
User=collab
WorkingDirectory=/opt/collab-awareness
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=1235

[Install]
WantedBy=multi-user.target
```

### Enable and start

```bash
sudo cp collab-sync.service collab-awareness.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now collab-sync collab-awareness
```

## Persistence

| Data | Storage | Location |
|------|---------|----------|
| Documents | IndexedDB (browser) | Per-user, per-origin |
| Documents | Automerge sync server | In-memory by default |
| User settings | localStorage (browser) | Name, color, preferences |

The default `@automerge/automerge-repo-sync-server` keeps documents **in memory only**. For durable server-side persistence, you would need to configure a storage adapter (e.g., filesystem or S3). Check Automerge docs for available storage backends.

## Health Checks

```bash
# Sync server -- attempt WebSocket handshake
curl -s -o /dev/null -w "%{http_code}" \
  --header "Connection: Upgrade" \
  --header "Upgrade: websocket" \
  http://localhost:1234

# Awareness server
curl -s -o /dev/null -w "%{http_code}" \
  --header "Connection: Upgrade" \
  --header "Upgrade: websocket" \
  http://localhost:1235

# Web frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080
```

## Checklist

- [ ] Build frontend with production `VITE_*` URLs
- [ ] Configure TLS (Let's Encrypt or similar)
- [ ] Set WebSocket `proxy_read_timeout` high enough for long sessions
- [ ] Decide on server-side document persistence strategy
- [ ] Set up log rotation for systemd journals
- [ ] Test cross-origin WebSocket connections if frontend and servers are on different domains
