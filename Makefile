# collab-web-editor Makefile
#
# Usage:
#   make start DOC=2DtwLMmuBznXxUmr7XpuebJnMwoe
#   make stop
#   make dev DOC=2DtwLMmuBznXxUmr7XpuebJnMwoe
#
# Individual servers:
#   make sync        # Automerge sync server (port 1234)
#   make awareness   # Awareness server (port 1235)
#   make web         # Vite dev server (port 8080)

DOC ?=
SYNC_PORT ?= 1234
AWARENESS_PORT ?= 1235
VITE_PORT ?= 8080

PIDDIR = .pids
AWARENESS_DIR = ../collab-awareness

# Start all servers in background
start: $(PIDDIR) sync awareness web
	@echo ""
	@echo "All servers running."
	@echo "  Sync server:      port $(SYNC_PORT)"
	@echo "  Awareness server: port $(AWARENESS_PORT)"
	@echo "  Web editor:       port $(VITE_PORT)"
ifdef DOC
	@echo ""
	@echo "  Open: http://localhost:$(VITE_PORT)/?doc=$(DOC)"
else
	@echo ""
	@echo "  Open: http://localhost:$(VITE_PORT)/"
	@echo "  (no DOC specified -- will create a new document)"
endif
	@echo ""
	@echo "  Stop all: make stop"

# Start all and open browser
dev: start
ifdef DOC
	@xdg-open "http://localhost:$(VITE_PORT)/?doc=$(DOC)" 2>/dev/null || \
	 open "http://localhost:$(VITE_PORT)/?doc=$(DOC)" 2>/dev/null || \
	 echo "Open http://localhost:$(VITE_PORT)/?doc=$(DOC)"
else
	@xdg-open "http://localhost:$(VITE_PORT)/" 2>/dev/null || \
	 open "http://localhost:$(VITE_PORT)/" 2>/dev/null || \
	 echo "Open http://localhost:$(VITE_PORT)/"
endif

# Automerge sync server
sync: $(PIDDIR)
	@if [ -f $(PIDDIR)/sync.pid ] && kill -0 $$(cat $(PIDDIR)/sync.pid) 2>/dev/null; then \
		echo "Sync server already running (pid $$(cat $(PIDDIR)/sync.pid))"; \
	else \
		PORT=$(SYNC_PORT) npx @automerge/automerge-repo-sync-server & \
		echo $$! > $(PIDDIR)/sync.pid; \
		echo "Sync server started on port $(SYNC_PORT) (pid $$!)"; \
	fi

# Awareness server
awareness: $(PIDDIR)
	@if [ -f $(PIDDIR)/awareness.pid ] && kill -0 $$(cat $(PIDDIR)/awareness.pid) 2>/dev/null; then \
		echo "Awareness server already running (pid $$(cat $(PIDDIR)/awareness.pid))"; \
	else \
		cd $(AWARENESS_DIR) && AWARENESS_PORT=$(AWARENESS_PORT) node server/index.js & \
		echo $$! > $(PIDDIR)/awareness.pid; \
		echo "Awareness server started on port $(AWARENESS_PORT) (pid $$!)"; \
	fi

# Vite dev server
web: $(PIDDIR)
	@if [ -f $(PIDDIR)/web.pid ] && kill -0 $$(cat $(PIDDIR)/web.pid) 2>/dev/null; then \
		echo "Web dev server already running (pid $$(cat $(PIDDIR)/web.pid))"; \
	else \
		npx vite --port $(VITE_PORT) & \
		echo $$! > $(PIDDIR)/web.pid; \
		echo "Web dev server started on port $(VITE_PORT) (pid $$!)"; \
	fi

# Stop all servers
stop:
	@for svc in sync awareness web; do \
		if [ -f $(PIDDIR)/$$svc.pid ]; then \
			pid=$$(cat $(PIDDIR)/$$svc.pid); \
			if kill -0 $$pid 2>/dev/null; then \
				kill $$pid; \
				echo "Stopped $$svc (pid $$pid)"; \
			else \
				echo "$$svc not running (stale pid)"; \
			fi; \
			rm -f $(PIDDIR)/$$svc.pid; \
		else \
			echo "$$svc not running"; \
		fi; \
	done

# Show status
status:
	@for svc in sync awareness web; do \
		if [ -f $(PIDDIR)/$$svc.pid ] && kill -0 $$(cat $(PIDDIR)/$$svc.pid) 2>/dev/null; then \
			echo "$$svc: running (pid $$(cat $(PIDDIR)/$$svc.pid))"; \
		else \
			echo "$$svc: stopped"; \
		fi; \
	done

$(PIDDIR):
	@mkdir -p $(PIDDIR)

# Build Rust WASM
wasm:
	cd rust-wasm && wasm-pack build --target web

.PHONY: start dev sync awareness web stop status wasm
