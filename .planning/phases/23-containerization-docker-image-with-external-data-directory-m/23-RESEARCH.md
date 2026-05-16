# Phase 23: Containerization — Research

**Researched:** 2026-05-16
**Domain:** Docker multi-stage build, Gunicorn/gevent, WhiteNoise, FastMCP HTTP transport, GitHub Actions GHCR
**Confidence:** HIGH (core stack verified via PyPI, official docs, source inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single container — Django app + Vite static build baked in at CI time. No Node.js runtime at play time. Django serves static files (WhiteNoise or collectstatic).
- **D-02:** Gunicorn with gevent workers. Gevent enables SSE long-lived connections across concurrent clients.
- **D-03:** Publish to GHCR (`ghcr.io`). GitHub Actions CI builds and pushes on push to main.
- **D-04:** Two external mounts: `./data:/app/data` and `./db.sqlite3:/app/db.sqlite3`.
- **D-05:** Django config via `environment:` in `docker-compose.yml`. Never baked into the image.
- **D-06:** Entrypoint script auto-initializes on first run: detect missing `db.sqlite3`, run `migrate` + `createsuperuser --noinput`.
- **D-07:** File-level REST API: `GET /api/gm/data/?dir={path}`, `GET /api/gm/data/{path}`, `PUT /api/gm/data/{path}`.
- **D-08:** Session context snapshot at `GET /api/gm/session-context`.
- **D-09:** No authentication on the data API. Trust-the-network model.
- **D-10:** After PUT write, broadcast SSE event so player terminals update immediately.
- **D-11:** No in-memory cache for DataLoader — reads from disk on every request.
- **D-12:** Django cache used only for JANUS AI conversation state. No changes to JANUS caching.
- **D-13:** FastMCP server as a separate docker-compose service (`mcp`), same image, different command. Port 8001.
- **D-14:** Campaign AI connects at `http://homelab-ip:8001`. HTTP transport (not stdio).
- **D-15:** MCP server calls Django REST API at `http://app:8000` (Docker internal network).
- **D-16:** Four MCP tools: `get_session_context()`, `list_files(dir)`, `read_file(path)`, `write_file(path, content)`.
- **D-17:** Both `app` and `mcp` services mount the same `data/` and `db.sqlite3` volumes.

### Claude's Discretion
- Specific Gunicorn worker count and concurrency settings (tune for ~5 concurrent players)
- WhiteNoise vs. `collectstatic` approach for serving Vite static files
- Dockerfile base image choice (python:3.12-slim recommended)
- Exact GitHub Actions workflow triggers (push to main, manual dispatch)
- SUPERUSER_USERNAME / SUPERUSER_PASSWORD env var names for first-run entrypoint
- FastMCP server port (8001 recommended) and entrypoint command

### Deferred Ideas (OUT OF SCOPE)
- Semantic game operation endpoints (move-token, reveal-room, update-npc-status)
- API authentication (API key, JWT)
- Health check endpoint (`/health/`)
- HTTPS / TLS termination
</user_constraints>

---

## Summary

Phase 23 packages the Mothership GM Terminal into a portable Docker image. The architecture is two containers from the same image: `app` (Gunicorn + Django, port 8000) and `mcp` (FastMCP HTTP server, port 8001). Both share external volume mounts for `data/` (campaign YAML) and `db.sqlite3`.

The build is a two-stage Dockerfile: a Node.js stage runs `pnpm run build` to produce the Vite bundle into `core/static/js/`, then a Python stage installs dependencies and runs `collectstatic` to copy those assets into a `staticfiles/` directory that WhiteNoise serves in production. The final image has no Node.js runtime.

The critical correctness concern in this phase is **Gunicorn + gevent + SQLite**: gevent monkey-patches threading, which can cause `DatabaseWrapper objects created in a thread can only be used in that same thread` errors with SQLite if patching happens too late. The fix is a `post_fork` hook in `gunicorn.conf.py` that applies monkey-patching before Django's connection pool is created. The SSE broadcaster uses `queue.Queue` with a 30-second timeout, which is compatible with gevent's cooperative scheduler — gevent patches `queue` so `get(timeout=30)` yields control to other greenlets during the wait.

**Primary recommendation:** Follow the two-stage Dockerfile pattern (Node stage → Python stage), run `collectstatic` inside the Dockerfile build (not at runtime), and use a `gunicorn.conf.py` file for the gevent post-fork hook rather than CLI flags.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Static file serving | Backend (WhiteNoise middleware) | — | WhiteNoise intercepts requests before Django view layer |
| WSGI/HTTP server | Gunicorn (container entry) | — | Replaces Django dev server |
| SSE long-poll connections | Gunicorn gevent worker | — | Gevent greenlets keep connection alive without blocking |
| Campaign YAML reads | Django API views | DataLoader | Reads from mounted `/app/data` volume |
| Campaign YAML writes | Django API view (new) | SSE broadcaster | First code path to write campaign files |
| Session context snapshot | Django API view (new) | active_view_store, DataLoader | Reads in-memory state + disk data |
| MCP tool interface | FastMCP service (port 8001) | — | Protocol adapter; delegates all logic to Django REST API |
| CI build + publish | GitHub Actions | GHCR | Builds image on push to main, no local build needed |
| First-run DB init | docker-entrypoint.sh | — | Detects missing db.sqlite3, runs migrate + createsuperuser |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| gunicorn | 26.0.0 | WSGI server replacing Django dev server | Industry standard Python WSGI server [VERIFIED: PyPI] |
| gevent | 26.4.0 | Async greenlet workers for gunicorn | Enables SSE long-lived connections without blocking workers [VERIFIED: PyPI] |
| whitenoise | 6.12.0 | Serve Vite static files from Django | Zero-dependency static serving, works with hashed filenames [VERIFIED: PyPI] |
| fastmcp | 3.3.1 | MCP server with HTTP transport | Official Python MCP server framework [VERIFIED: PyPI] |
| uvicorn | latest | ASGI server backing FastMCP HTTP transport | Required dependency when FastMCP uses HTTP transport [CITED: gofastmcp.com/deployment/http] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx | latest | Async HTTP client in MCP tool handlers | MCP server calls Django REST API over Docker network |
| python-dotenv | already in requirements.txt | .env loading | Already present; settings.py uses it |

### Python Packages to Add to requirements.txt
```
gunicorn==26.0.0
gevent==26.4.0
whitenoise==6.12.0
fastmcp==3.3.1
httpx>=0.27.0
uvicorn>=0.30.0
```

**Version verification:** All versions confirmed against PyPI JSON API on 2026-05-16. [VERIFIED: PyPI registry]

---

## Architecture Patterns

### System Architecture Diagram

```
                  ┌─────────────────────────────────────────────┐
                  │  homelab server                             │
                  │                                             │
   Player         │  ┌──────────────────────┐                  │
   browser  ──────┼─▶│  app (port 8000)     │                  │
                  │  │  Gunicorn/gevent      │                  │
   GM             │  │  Django 5.2.7         │◀──┐             │
   browser  ──────┼─▶│  WhiteNoise static    │   │             │
                  │  └──────────┬────────────┘   │ REST API    │
                  │             │ read/write      │ calls       │
   Campaign AI    │  ┌──────────▼────────────┐   │             │
   (remote) ──────┼─▶│  mcp (port 8001)     │───┘             │
                  │  │  FastMCP HTTP server  │                  │
                  │  └──────────────────────┘                  │
                  │                                             │
                  │  ┌──────────────────────┐                  │
                  │  │  ./data/     (volume) │ ←── YAML files  │
                  │  │  ./db.sqlite3 (bind)  │ ←── Messages DB │
                  │  └──────────────────────┘                  │
                  └─────────────────────────────────────────────┘

CI/CD:
  git push main → GitHub Actions → docker build (Node stage → Python stage)
                               → docker push ghcr.io/user/mothership:latest
```

### Recommended Project Structure (new files this phase)

```
/                              # repo root
├── Dockerfile                 # multi-stage: node builder + python final
├── docker-compose.yml         # two services: app + mcp
├── docker-entrypoint.sh       # first-run init + exec gunicorn
├── gunicorn.conf.py           # gevent worker config with post_fork hook
├── mcp_server.py              # FastMCP server defining four tools
├── .github/
│   └── workflows/
│       └── docker-publish.yml # CI build + GHCR push
└── config/
    └── settings.py            # add STATIC_ROOT, WhiteNoise, env-driven config
```

### Pattern 1: Multi-Stage Dockerfile (Node → Python)

**What:** Build Vite assets in a Node stage; copy the output into the Python stage. Final image has no Node.js.

**Key insight about this project's Vite setup:** Vite is configured with `build.outDir: 'core/static/js'` and `base: '/static/'`. The bundles are written directly into the app directory (not a separate `dist/` folder). The Dockerfile copies the entire `src/` and config, runs `pnpm run build`, and the output lands at `core/static/js/`.

```dockerfile
# Source: adapted from Docker multi-stage build docs + project vite.config.ts inspection
# Stage 1: Build Vite frontend
FROM node:22-slim AS frontend-builder
WORKDIR /build

# Install pnpm (project uses pnpm — see package.json)
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY src/ src/
COPY vite.config.ts tsconfig.json ./
RUN pnpm run build
# Output lands in core/static/js/ per vite.config.ts build.outDir

# Stage 2: Python production image
FROM python:3.12-slim AS app
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=config.settings

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Django application code
COPY . .

# Copy Vite build output from frontend stage
# (overwrites the empty core/static/js/ directory)
COPY --from=frontend-builder /build/core/static/js/ core/static/js/

# Collect static files into /app/staticfiles/ for WhiteNoise
RUN python manage.py collectstatic --noinput

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/docker-entrypoint.sh"]
```

**Critical detail:** The Dockerfile runs `pnpm install` from a COPY of `pnpm-lock.yaml` before copying `src/` — this ensures the dependency layer is cached separately from source changes.

### Pattern 2: WhiteNoise Configuration

**What:** WhiteNoise middleware intercepts static file requests at the WSGI level before Django view routing. Works with Vite's non-hashed bundle names (this project uses fixed names like `shared-console.bundle.js` — see `vite.config.ts` `entryFileNames`).

**Settings changes required in `config/settings.py`:**

```python
# Source: whitenoise.readthedocs.io/en/stable/django.html [CITED]
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'insecure-dev-only')
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # MUST be second — right after Security
    # ... existing middleware ...
]

STATIC_URL = '/static/'
# collectstatic destination — WhiteNoise serves from here
STATIC_ROOT = BASE_DIR / 'staticfiles'
# Source directories for collectstatic to scan
STATICFILES_DIRS = [
    BASE_DIR / 'core' / 'static',
]

STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

# Data directory — always /app/data in container, configurable for local dev
DATA_DIR = os.environ.get('DATA_DIR', str(BASE_DIR / 'data'))
```

**Why `CompressedStaticFilesStorage` not `CompressedManifestStaticFilesStorage`:** Manifest storage rewrites file references in CSS/JS using a hash-versioned manifest. This project's templates reference bundles by fixed name via `{% static 'js/shared-console.bundle.js' %}`. The manifest backend would rename those, breaking the template references. `CompressedStaticFilesStorage` just gzips files without renaming — correct for this setup. [ASSUMED — based on inspection of templates and vite.config.ts, not tested in container]

### Pattern 3: Gunicorn + Gevent Configuration

**What:** `gunicorn.conf.py` with gevent workers. The `post_fork` hook applies gevent monkey-patching before Django initializes any DB connections.

**The gevent + SQLite problem:** Gevent monkey-patches `threading`, making `threading.local` greenlet-local. Django stores database connections in thread-locals. If monkey-patching happens after Django ORM is imported, connections created in one greenlet cannot be used in another, causing `DatabaseWrapper objects created in a thread can only be used in that same thread` errors. [CITED: code.djangoproject.com/ticket/25714]

**Fix:** Apply monkey-patching in the `post_fork` hook (which runs in each worker process before any Django code executes):

```python
# Source: gunicorn.conf.py [ASSUMED — based on gunicorn docs and gevent issue #166]
import multiprocessing

# For ~5 concurrent players: each SSE stream holds a worker greenlet.
# Gevent multiplexes many greenlets per worker.
# 3 workers × 100 greenlets/worker = 300 concurrent greenlets headroom.
workers = 3
worker_class = 'gevent'
worker_connections = 100
bind = '0.0.0.0:8000'

# SSE connections hold for 30s keepalive intervals.
# timeout=0 disables worker timeout — gevent workers self-manage via greenlets.
timeout = 0

# Recycle workers periodically to avoid memory accumulation
max_requests = 1000
max_requests_jitter = 100

accesslog = '-'
errorlog = '-'
loglevel = 'info'


def post_fork(server, worker):
    """Apply gevent monkey-patching in the worker process, before Django imports."""
    from gevent import monkey
    monkey.patch_all()
```

**timeout = 0 rationale:** With gevent workers, the normal timeout mechanism does not reliably fire because the master process can't distinguish a sleeping greenlet from a hung one. The standard practice for SSE + gevent is to set `timeout = 0` (disabled) and rely on gevent's own keepalive mechanism and the 30-second `queue.get(timeout=30)` that yields a keepalive comment. [CITED: gunicorn.org issues #2695, #2585]

**Alternative — workers = 1:** For a homelab serving 5 players, a single gevent worker with `worker_connections = 500` would also work and eliminates the cross-worker SSE broadcast gap (see Pitfall 1). Recommend starting with `workers = 1` for simplicity. [ASSUMED]

### Pattern 4: FastMCP HTTP Server

**What:** FastMCP 3.x with `transport="http"`. Exposes MCP tools at `/mcp/` on port 8001. Campaign AI connects to `http://homelab-ip:8001/mcp/`.

**Package name:** `fastmcp` (pip install fastmcp). The import is `from fastmcp import FastMCP`. [VERIFIED: PyPI, gofastmcp.com]

```python
# Source: gofastmcp.com/servers/tools [CITED]
import httpx
from fastmcp import FastMCP

DJANGO_BASE_URL = "http://app:8000"  # Docker internal network

mcp = FastMCP("MothershipGM")


@mcp.tool
async def get_session_context() -> dict:
    """Return current game state snapshot: active encounter, tokens, room visibility, ship status, NPC list."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/session-context")
        r.raise_for_status()
        return r.json()


@mcp.tool
async def list_files(dir: str) -> list:
    """List files in a data directory. dir is relative to data/ (e.g. 'campaign/crew')."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/data/", params={"dir": dir})
        r.raise_for_status()
        return r.json()


@mcp.tool
async def read_file(path: str) -> str:
    """Read raw YAML content of a campaign file. path is relative to data/ ."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/data/{path}")
        r.raise_for_status()
        return r.text


@mcp.tool
async def write_file(path: str, content: str) -> dict:
    """Write YAML content to a campaign file. Triggers SSE broadcast to player terminals."""
    async with httpx.AsyncClient() as client:
        r = await client.put(
            f"{DJANGO_BASE_URL}/api/gm/data/{path}",
            content=content,
            headers={"Content-Type": "application/x-yaml"},
        )
        r.raise_for_status()
        return r.json()


@mcp.tool
async def get_data_schema() -> str:
    """Return the DATA_DIRECTORY_GUIDE summary so the AI understands the campaign file structure."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/data-schema")
        r.raise_for_status()
        return r.text


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=8001)
```

**Client connection URL:** `http://homelab-ip:8001/mcp/` — FastMCP serves the MCP endpoint at `/mcp/` by default. [CITED: gofastmcp.com/deployment/http]

**uvicorn dependency:** FastMCP's HTTP transport requires uvicorn as the underlying ASGI server. Must be in requirements.txt. [CITED: gofastmcp.com/deployment/running-server]

### Pattern 5: Docker Entrypoint Script

**What:** Shell script that detects first-run (missing `db.sqlite3`), runs migrations and optionally creates a superuser, then execs gunicorn.

**Django's built-in env vars for `--noinput`:**
- `DJANGO_SUPERUSER_USERNAME` — superuser username
- `DJANGO_SUPERUSER_PASSWORD` — superuser password
- `DJANGO_SUPERUSER_EMAIL` — superuser email (optional, defaults to blank)

These are read automatically when `--noinput` flag is passed. [CITED: code.djangoproject.com/ticket/27801]

```bash
#!/bin/bash
# Source: adapted from Django docs + common Docker entrypoint patterns [ASSUMED pattern]
set -e

echo "=== MOTHERSHIP ENTRYPOINT ==="

# Apply gevent monkey-patching before any DB operations
# (migrate runs in a subprocess, so it doesn't inherit gunicorn's post_fork hook)
export PYTHONSTARTUP=""

# Run Django migrations (idempotent — safe on every startup)
python manage.py migrate --noinput

# Create superuser on first run (only if env vars set and user doesn't exist)
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    python manage.py createsuperuser \
        --noinput \
        --username "$DJANGO_SUPERUSER_USERNAME" \
        --email "${DJANGO_SUPERUSER_EMAIL:-admin@localhost}" \
        2>/dev/null || echo "Superuser already exists, skipping."
fi

echo "=== Starting Gunicorn ==="
exec gunicorn \
    --config gunicorn.conf.py \
    config.wsgi:application
```

**Why not check for db.sqlite3 file existence:** The entrypoint mounts `./db.sqlite3:/app/db.sqlite3` — but on first run the host file doesn't exist, so Docker creates it as an empty file (not a directory). `migrate --noinput` is safe to run on an already-migrated database (it's a no-op). Checking `db.sqlite3` existence is therefore unnecessary; always run migrate. [ASSUMED — based on Docker bind mount semantics]

### Pattern 6: GitHub Actions GHCR Workflow

**What:** CI pipeline that builds the Docker image on push to main and pushes to `ghcr.io`. Uses `GITHUB_TOKEN` — no additional secrets needed.

```yaml
# Source: docs.github.com/en/actions/publishing-packages/publishing-docker-images [CITED]
name: Build and publish Docker image

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=sha,prefix=sha-

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

**Permissions note:** `packages: write` is required. `GITHUB_TOKEN` is auto-provided — no PAT needed. [CITED: docs.github.com/en/packages]

### Pattern 7: docker-compose.yml (Homelab Deployment)

```yaml
# Source: CONTEXT.md D-04, D-05, D-13, D-17 [locked decisions]
services:
  app:
    image: ghcr.io/icariumtech/mothership:latest
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
      - ./db.sqlite3:/app/db.sqlite3
    environment:
      SECRET_KEY: "${SECRET_KEY}"
      DEBUG: "False"
      ALLOWED_HOSTS: "${ALLOWED_HOSTS:-*}"
      ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY:-}"
      DJANGO_SUPERUSER_USERNAME: "${DJANGO_SUPERUSER_USERNAME:-admin}"
      DJANGO_SUPERUSER_PASSWORD: "${DJANGO_SUPERUSER_PASSWORD}"
      DATA_DIR: "/app/data"
    restart: unless-stopped

  mcp:
    image: ghcr.io/icariumtech/mothership:latest
    command: ["python", "mcp_server.py"]
    ports:
      - "8001:8001"
    volumes:
      - ./data:/app/data
      - ./db.sqlite3:/app/db.sqlite3
    environment:
      SECRET_KEY: "${SECRET_KEY}"
      DEBUG: "False"
      DATA_DIR: "/app/data"
    depends_on:
      - app
    restart: unless-stopped
```

**Note on `mcp` command:** The `mcp` service overrides the entrypoint `CMD` by specifying `command:`. This bypasses `docker-entrypoint.sh` — the `app` service handles migration on startup. The MCP service starts `mcp_server.py` directly. [ASSUMED — verify that entrypoint allows CMD override]

### Pattern 8: Django REST API for AI Data Access

**New URL patterns to add to `core/urls.py`:**

```python
# New GM data API endpoints (D-07, D-08)
path('api/gm/data/', views.api_gm_data_list, name='gm_data_list'),        # GET ?dir=path
path('api/gm/data/<path:filepath>', views.api_gm_data_file, name='gm_data_file'),  # GET / PUT
path('api/gm/session-context', views.api_gm_session_context, name='gm_session_context'),
path('api/gm/data-schema', views.api_gm_data_schema, name='gm_data_schema'),
```

**`<path:filepath>` converter** is required (not `<str:filepath>`) because file paths contain slashes. [VERIFIED: Django docs URL routing]

**YAML write safety (D-10, YAML validation before write):**

```python
# Source: PyYAML docs — yaml.safe_load validates syntax [VERIFIED: PyYAML]
import yaml, tempfile, os
from pathlib import Path

def safe_write_yaml(file_path: Path, content: str) -> None:
    """Validate YAML then write atomically via temp file + rename."""
    # 1. Validate YAML parses without error
    yaml.safe_load(content)  # raises yaml.YAMLError if invalid

    # 2. Atomic write: write to temp file in same directory, then rename
    dir_path = file_path.parent
    with tempfile.NamedTemporaryFile(
        mode='w', dir=dir_path, suffix='.tmp', delete=False
    ) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    os.replace(tmp_path, file_path)  # atomic on POSIX
```

**Why atomic write:** A crash during write would corrupt the YAML file and break all DataLoader reads. `os.replace` is atomic on Linux (POSIX rename syscall). [CITED: sahmanish20.medium.com — atomic file writes]

**Security boundary for file paths:** The PUT endpoint must validate that the resolved path stays within `/app/data/` to prevent path traversal. Pattern:

```python
data_root = Path(settings.DATA_DIR).resolve()
target = (data_root / filepath).resolve()
if not str(target).startswith(str(data_root)):
    return HttpResponse(status=400)
```

### Pattern 9: SSE Event After YAML Write (D-10)

After a successful PUT write, the view must broadcast a `data-changed` SSE event. Existing `broadcaster` singleton from `core/sse_broadcaster.py` handles this:

```python
from core.sse_broadcaster import broadcaster, format_sse
import json

# In the PUT view, after safe_write_yaml() succeeds:
broadcaster.announce_generic('data-changed', {
    'path': filepath,
    'action': 'write',
})
```

**Current `MessageAnnouncer` only has `announce()` and `announce_ship_status()`**. A new `announce_generic(event, data)` method is needed in `sse_broadcaster.py`, or the write view can call `format_sse` directly and push to listener queues. Recommend adding `announce_generic` to `MessageAnnouncer` to keep the pattern consistent.

**Frontend impact:** The player terminal listens on `/api/active-view/stream/` for named SSE events. A `data-changed` event is a new event name — the frontend will ignore it unless handlers are added. For this phase, the SSE broadcast requirement (D-10) is about broadcasting the event so that a future frontend subscription can pick it up. The immediate re-render behavior requires frontend work in a subsequent phase. [ASSUMED — frontend ignores unknown event names gracefully]

### Anti-Patterns to Avoid

- **Calling `collectstatic` at container startup** (runtime) rather than build time. This re-runs every restart and adds latency. Run it in the Dockerfile RUN step.
- **Setting `timeout` to a finite value with gevent workers** — the master's heartbeat check sees sleeping greenlets (SSE waiters) as hung workers and kills them. Use `timeout = 0`.
- **Using `gevent.monkey.patch_all()` in `settings.py` or `wsgi.py`** — these are imported in the master process before forking. Patch only in `post_fork`. [CITED: gevent GitHub issue #166]
- **Using `<str:filepath>` URL converter for file paths** — `str` stops at `/`. Use `<path:filepath>` for file path segments.
- **Writing the full YAML file with `yaml.dump()` round-trip** — `yaml.dump` re-serializes data and will change formatting, comments, and key order. The PUT endpoint writes the raw content string as-is (only validate parse, don't re-serialize).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Static file serving in production | Custom Django view for `/static/` | WhiteNoise middleware | WhiteNoise handles compression, caching headers, and correct MIME types automatically |
| Atomic file writes | Manual rename logic | `tempfile` + `os.replace` | stdlib handles temp file naming, directory atomicity |
| YAML syntax validation | Custom parser | `yaml.safe_load()` raises on invalid YAML | PyYAML is already a dependency |
| MCP tool protocol | Custom WebSocket/HTTP protocol | FastMCP | MCP wire format, session management, streaming handled automatically |
| GHCR push workflow | Custom `docker build` + `docker push` shell | `docker/build-push-action` | Layer caching, multi-platform, attestation via GitHub Actions marketplace |
| CI Docker layer caching | No caching | `cache-from: type=gha` / `cache-to: type=gha,mode=max` | GitHub Actions cache backend cuts build time on unchanged layers |

**Key insight:** The value of this phase is plumbing (containerization, protocol adapters), not custom protocol logic. Every piece of non-application logic should use a maintained library.

---

## Common Pitfalls

### Pitfall 1: SSE Broadcast Works in One Worker, Not Across Workers
**What goes wrong:** `broadcaster` is a module-level singleton. With `workers = 3`, each Gunicorn worker has its own `broadcaster` instance with its own listener list. A player connected to worker A gets SSE from worker A's broadcaster. A write that lands on worker B broadcasts only to worker B's listeners — player A never sees it.
**Why it happens:** Python processes don't share memory. The `broadcaster.listeners` list is per-process.
**How to avoid:** Use `workers = 1` for the homelab use case (~5 players). Single worker + gevent greenlets handles the concurrency. If multi-worker is needed later, replace broadcaster with Redis pub/sub.
**Warning signs:** SSE updates sometimes arrive, sometimes don't, depending on which worker handles the write vs. which handled the SSE subscribe.

### Pitfall 2: Gevent Monkey-Patch Timing
**What goes wrong:** `DatabaseWrapper objects created in a thread can only be used in that same thread` error from SQLite when a DB query runs in a new greenlet.
**Why it happens:** Django creates thread-local DB connections. If gevent patches threading *after* Django initializes its connection pool, the greenlet-local connections are not properly isolated.
**How to avoid:** Apply `monkey.patch_all()` in `gunicorn.conf.py`'s `post_fork` hook — runs before any Django code in the worker.
**Warning signs:** Error appears intermittently, usually on the second or third DB-hitting request to a worker.

### Pitfall 3: collectstatic Finds No Files (STATICFILES_DIRS Not Set)
**What goes wrong:** `collectstatic --noinput` runs but copies nothing, so `staticfiles/` is empty. WhiteNoise serves 404 for all JS/CSS.
**Why it happens:** `config/settings.py` currently has no `STATIC_ROOT` or `STATICFILES_DIRS`. Without `STATICFILES_DIRS`, collectstatic only scans `<app>/static/` directories under `INSTALLED_APPS`.
**How to avoid:** Add `STATICFILES_DIRS = [BASE_DIR / 'core' / 'static']` to settings. Also set `STATIC_ROOT = BASE_DIR / 'staticfiles'`.
**Warning signs:** `collectstatic` outputs "0 files copied."

### Pitfall 4: Vite `base: '/static/'` vs. Django STATIC_URL Mismatch
**What goes wrong:** Chunk files (lazy-loaded) and asset files are requested at `/static/chunks/...` and `/static/assets/...`. If Django's `STATIC_URL` is not `/static/` (or if WhiteNoise root mapping differs), chunk loads return 404.
**Why it happens:** Vite's `base: '/static/'` bakes `/static/` into all dynamic import URLs and asset references in the bundle.
**How to avoid:** Keep `STATIC_URL = '/static/'` in settings. WhiteNoise serves from `STATIC_ROOT` at the `STATIC_URL` prefix.
**Warning signs:** Console errors: `Failed to load module script: expected...` for chunk files.

### Pitfall 5: Docker Bind Mount Creates db.sqlite3 as a Directory
**What goes wrong:** If `./db.sqlite3` doesn't exist on the host when `docker compose up` runs, Docker creates it as a **directory**, not a file. Django then fails with `sqlite3.OperationalError: unable to open database file`.
**Why it happens:** Docker creates missing bind-mount targets as directories by convention.
**How to avoid:** The homelab setup instructions must tell the user to `touch db.sqlite3` before the first `docker compose up`, or the entrypoint can detect a directory and error with a clear message. Document this explicitly in the README.
**Warning signs:** `unable to open database file` on first run.

### Pitfall 6: FastMCP Service Runs Django Entrypoint (migrate + createsuperuser)
**What goes wrong:** If the `mcp` service also runs `docker-entrypoint.sh`, it will race `app` on migrations and potentially create a duplicate superuser.
**Why it happens:** Both services use the same image; if `ENTRYPOINT` is baked in, both run it.
**How to avoid:** The `mcp` service uses `command: ["python", "mcp_server.py"]` which overrides the entrypoint's `CMD`. The entrypoint must use `exec "$@"` at the end when a command is passed, and `exec gunicorn ...` as the default. Structure:
```bash
# docker-entrypoint.sh
# ... migrations ...
if [ "$#" -gt 0 ]; then
    exec "$@"  # override: run the given command directly
fi
exec gunicorn --config gunicorn.conf.py config.wsgi:application
```

### Pitfall 7: Path Traversal in the YAML Write Endpoint
**What goes wrong:** `PUT /api/gm/data/../../config/settings.py` overwrites Django settings.
**Why it happens:** Python `Path.__truediv__` does not resolve `..` — but `Path.resolve()` does.
**How to avoid:** Always resolve both the data root and the target path, then check `target.is_relative_to(data_root)` (Python 3.9+) or `str(target).startswith(str(data_root) + '/')`.

---

## Code Examples

### Session Context Snapshot — What Data Is Available

The `GET /api/gm/session-context` endpoint composes data from two sources:

**In-memory state** (from `core/active_view_store.get_state()`):
```python
{
    'view_type': 'ENCOUNTER',           # current display mode
    'location_slug': 'patrol_gunboat',  # active location
    'encounter_level': 1,               # active deck
    'encounter_deck_id': 'main_deck',
    'encounter_room_visibility': {...},  # dict of room_id → bool
    'encounter_door_status': {...},      # dict of door_id → status string
    'encounter_tokens_by_location': {   # dict of location_slug → token list
        'patrol_gunboat': [...]
    },
    'encounter_active_portraits': [...],
    'janus_mode': 'DISPLAY',
    # ... other view state fields
}
```

**Disk-loaded data** (from DataLoader — reads fresh on every call):
- `data_loader.load_npcs()` — NPC list
- `data_loader.load_crew()` — Crew list
- `data_loader.load_ship_status()` — Ship YAML from `campaign/ship/ship.yaml`

All three can be composed into a single JSON response without any DB queries.

### Vite Output Structure (Verified by Inspection)

The Vite build produces these files under `core/static/js/`:
```
core/static/js/
├── shared-console.bundle.js        # fixed name (no hash)
├── gm-console.bundle.js            # fixed name
├── player-console.bundle.js        # fixed name
├── chunks/                         # [name]-[hash].js (hashed)
│   └── ...
└── assets/
    └── style.css                   # no hash
```

Templates reference bundles by fixed name: `{% static 'js/shared-console.bundle.js' %}`. WhiteNoise serves these at `/static/js/shared-console.bundle.js`. Chunks are loaded dynamically by the bundle at `/static/js/chunks/...`. No manifest rewriting needed. [VERIFIED: vite.config.ts inspection + core/static/js/ directory listing]

### DATA_DIRECTORY_GUIDE.md Exists

`DATA_DIRECTORY_GUIDE.md` exists at the project root. [VERIFIED: filesystem inspection]

The `GET /api/gm/data-schema` endpoint can simply read and return this file's content. This gives the AI a complete data structure map. The endpoint should return `Content-Type: text/markdown`.

---

## Runtime State Inventory

This phase does not rename or refactor existing identifiers.

**Stored data:** None affected. The new YAML write API adds a write path; it does not rename any existing data keys.
**Live service config:** None. No external services are reconfigured in this phase.
**OS-registered state:** None. No Task Scheduler, pm2, or systemd registrations exist for this project.
**Secrets/env vars:** New env vars added to docker-compose.yml: `SECRET_KEY`, `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_PASSWORD`. These are new (not renames).
**Build artifacts:** `staticfiles/` directory is new — created by `collectstatic` in Dockerfile, not committed to git. No stale artifacts.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Container build/run | [ASSUMED present — homelab] | — | Must install |
| pnpm | Dockerfile Node stage | Not in container (CI uses it) | lockfile present | Use `npm ci` if pnpm unavailable in CI |
| gunicorn | Production server | Not installed (add to requirements.txt) | 26.0.0 | None — must add |
| gevent | Gunicorn gevent worker | Not installed (add to requirements.txt) | 26.4.0 | gthread workers (no SSE concurrency) |
| whitenoise | Static file serving | Not installed (add to requirements.txt) | 6.12.0 | None — must add |
| fastmcp | MCP server | Not installed (add to requirements.txt) | 3.3.1 | None — must add |
| uvicorn | FastMCP HTTP backend | Not installed (add to requirements.txt) | latest | None — must add |
| httpx | MCP → Django HTTP calls | Not installed (add to requirements.txt) | ≥0.27.0 | requests (sync only) |

**Missing dependencies with no fallback:**
- gunicorn, gevent, whitenoise, fastmcp, uvicorn — all must be added to requirements.txt before the Dockerfile can build.

**pnpm in CI:** The Dockerfile Node stage runs `pnpm install`. GitHub Actions runners have Node.js but not pnpm by default. The workflow must add `- run: corepack enable` before `docker/build-push-action`, or the Dockerfile itself must install pnpm via `RUN npm install -g pnpm` / `RUN corepack enable`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Django dev server (`runserver`) | Gunicorn + gevent | This phase | Production-grade, handles SSE concurrency |
| No static file serving config | WhiteNoise middleware | This phase | Self-contained; no nginx needed for homelab |
| SSE via `BackgroundScheduler` (uWSGI) | `queue.Queue` + StreamingHttpResponse | Already in codebase | Correct for Gunicorn |
| MCP stdio (local-only) | FastMCP HTTP transport | This phase | Remote AI agents can connect over network |
| SSE (deprecated MCP transport) | Streamable HTTP (MCP 2025-03-26 spec) | March 2025 | FastMCP 3.x defaults to streamable-http |

**Deprecated/outdated:**
- MCP SSE transport: Deprecated in the March 2025 MCP specification update. FastMCP still supports it but recommends streamable HTTP for new deployments. The `transport="http"` parameter in FastMCP 3.x uses streamable HTTP. [CITED: gofastmcp.com]
- `pnpm` as a `dependencies` entry in package.json: `pnpm` appears in `dependencies` (not `devDependencies`) — an unusual placement. The Dockerfile Node stage should install pnpm via `corepack enable` rather than relying on npm to install it.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `CompressedStaticFilesStorage` is correct (not Manifest) because templates use fixed bundle names | Pattern 2 (WhiteNoise) | If Manifest storage is used, templates must be updated to use hashed names |
| A2 | `timeout = 0` is correct for gevent + SSE; finite timeout kills SSE workers | Pattern 3 (Gunicorn) | If wrong, set `timeout = 120` and add `keepalive = 2` |
| A3 | `workers = 1` is sufficient for ~5 concurrent players + SSE streams | Pattern 3 (Gunicorn) | If SSE streams starve other requests, increase to 2-3 workers and move to Redis broadcaster |
| A4 | The `mcp` service `command:` override bypasses `docker-entrypoint.sh` | Pattern 6, Pitfall 6 | If Docker ENTRYPOINT is not shell form, CMD override may not work as expected |
| A5 | Django's `DatabaseWrapper` + gevent + SQLite works correctly with `post_fork` monkey-patch | Pattern 3 (Gunicorn) | May need `DATABASE_OPTIONS: {'check_same_thread': False}` in settings |
| A6 | `touch db.sqlite3` on the host before first run avoids the bind-mount-as-directory problem | Pitfall 5 | If Docker behavior differs, db.sqlite3 may be created as a directory |
| A7 | Frontend `SharedConsole.tsx` ignores unknown SSE event names gracefully | Pattern 9 (SSE after write) | If it throws on unknown events, frontend patch needed before D-10 can work |
| A8 | `DATA_DIR` environment variable in settings allows overriding `DataLoader`'s base path | Pattern 2, 8 | DataLoader constructor currently hardcodes `"data"` — must update constructor to read from settings |

---

## Open Questions

1. **DataLoader `DATA_DIR` path in settings**
   - What we know: `DataLoader.__init__` takes `data_dir: str = "data"`. In the container, data lives at `/app/data`.
   - What's unclear: Is `DataLoader()` always instantiated with default `"data"`, or does something pass the path explicitly?
   - Recommendation: Add `DATA_DIR = os.environ.get('DATA_DIR', 'data')` to settings and update `get_loader()` in `data_loader.py` to use `settings.DATA_DIR`.

2. **Cache backend compatibility with gevent**
   - What we know: JANUS session uses `django.core.cache` with `FileBasedCache` at `/tmp/django_cache`. Gevent monkey-patches `os`.
   - What's unclear: Whether `FileBasedCache`'s file locking (via `fcntl`) is gevent-compatible.
   - Recommendation: Test JANUS session under gevent. If file locking deadlocks, switch to `LocMemCache` (per-process, fine for single-worker deployment).

3. **pnpm in Dockerfile Node stage**
   - What we know: Project uses pnpm (lock file present, pnpm in package.json `dependencies`).
   - What's unclear: Whether `node:22-slim` includes corepack by default.
   - Recommendation: Add `RUN corepack enable && corepack prepare pnpm@latest --activate` to the Dockerfile Node stage.

4. **The `announce_generic` broadcaster method**
   - What we know: Current `MessageAnnouncer` has `announce()` and `announce_ship_status()` for named events.
   - What's unclear: Should a new `announce_generic(event, data)` method be added, or should the write view call `format_sse` directly?
   - Recommendation: Add `announce_generic` to keep SSE event dispatch consistent.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (frontend), manual smoke testing (Docker) |
| Quick run command | `pnpm test` (frontend unit tests only) |
| Full suite command | `pnpm test && docker compose up --wait && ./smoke-test.sh` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command | Notes |
|-----|----------|-----------|-------------------|-------|
| D-01 | Docker image builds successfully (single image) | Build smoke | `docker build -t mothership-test .` | Run in CI |
| D-01 | Static files present in image | Container exec | `docker run --rm mothership-test ls staticfiles/` | |
| D-02 | Gunicorn starts with gevent workers | Process check | `docker run --rm -e SECRET_KEY=x mothership-test gunicorn --check-config gunicorn.conf.py` | |
| D-03 | Image pushes to GHCR on main push | CI check | GitHub Actions workflow passes | |
| D-04 | Data volume is mounted and writable | Integration | `docker compose run app python -c "open('/app/data/.test','w').close()"` | |
| D-06 | First-run creates superuser from env | Integration | `docker compose up`, check admin login | Manual |
| D-07 | GET /api/gm/data/?dir=campaign lists files | API smoke | `curl http://localhost:8000/api/gm/data/?dir=campaign` | |
| D-07 | GET /api/gm/data/campaign/ship/ship.yaml returns YAML | API smoke | `curl http://localhost:8000/api/gm/data/campaign/ship/ship.yaml` | |
| D-07 | PUT /api/gm/data/{path} writes and validates YAML | API smoke | `curl -X PUT -d "test: value" http://localhost:8000/api/gm/data/test.yaml` | |
| D-07 | PUT with invalid YAML returns 400 | API unit | `curl -X PUT -d "invalid: [" ...` → expect 400 | |
| D-07 | PUT path traversal blocked | Security | `curl -X PUT .../api/gm/data/../../config/settings.py` → expect 400 | |
| D-08 | GET /api/gm/session-context returns JSON | API smoke | `curl http://localhost:8000/api/gm/session-context` | |
| D-10 | PUT write triggers SSE event | Integration | Subscribe to SSE, then PUT a file; observe `data-changed` event | Manual |
| D-13 | MCP service starts on port 8001 | Container | `docker compose up mcp`, `curl http://localhost:8001/mcp/` | |
| D-16 | All four MCP tools callable via HTTP | MCP client | Use `fastmcp` Python client or Claude Desktop config | Manual |
| D-17 | Both services read same data volume | Integration | Write file via `app` API, read via `mcp` tool | Manual |

### Wave 0 Gaps (test infrastructure needed before implementation)

- [ ] `smoke-test.sh` — basic curl checks for all REST endpoints (D-07, D-08)
- [ ] `gunicorn.conf.py` — must exist before Dockerfile can reference it
- [ ] `.env.example` update — add new env var names (`SECRET_KEY`, `DJANGO_SUPERUSER_PASSWORD`, etc.)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Trust-network model (D-09 locked) |
| V3 Session Management | No | No session-based auth on new endpoints |
| V4 Access Control | Partial | Path traversal check on write endpoint required |
| V5 Input Validation | Yes | yaml.safe_load() validates YAML syntax before write; path resolver prevents traversal |
| V6 Cryptography | No | No cryptographic operations added in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal (e.g. `../../etc/passwd`) | Tampering | `Path.resolve()` + `is_relative_to(data_root)` check on write endpoint |
| YAML injection / arbitrary Python execution | Tampering | `yaml.safe_load()` — never `yaml.load()` without Loader |
| Accidental data root escape | Tampering | Constrain write endpoint to files with `.yaml` extension only |
| SSE keep-alive flooding | DoS | `queue.Queue(maxsize=5)` in `MessageAnnouncer.listen()` — already implemented |

**Note on D-09 (no authentication):** This is a locked decision (trust-network homelab). The plan should add a comment to the write endpoint noting that authentication is deferred and documenting the assumption that the container is not internet-exposed.

---

## Sources

### Primary (HIGH confidence)
- PyPI JSON API (pypi.org/pypi/*/json) — gunicorn 26.0.0, gevent 26.4.0, whitenoise 6.12.0, fastmcp 3.3.1 — verified 2026-05-16
- `vite.config.ts` — project Vite configuration, output paths, base URL — direct inspection
- `config/settings.py` — current Django settings — direct inspection
- `core/sse_broadcaster.py` — SSE broadcaster implementation — direct inspection
- `core/active_view_store.py` — in-memory state store — direct inspection
- `core/data_loader.py` — DataLoader disk-read-on-every-request pattern — direct inspection
- whitenoise.readthedocs.io/en/stable/django.html — WhiteNoise middleware placement, storage backends
- gofastmcp.com/deployment/http — FastMCP HTTP transport, endpoint path `/mcp/`
- gofastmcp.com/servers/tools — FastMCP tool definition syntax
- docs.github.com/en/actions/publishing-packages/publishing-docker-images — GHCR workflow pattern
- code.djangoproject.com/ticket/27801 — Django `DJANGO_SUPERUSER_PASSWORD` env var

### Secondary (MEDIUM confidence)
- gunicorn GitHub issue #2695 — gevent timeout = 0 for SSE
- gunicorn GitHub issue #2585 — gevent persistent connections behavior
- code.djangoproject.com/ticket/25714 — DatabaseWrapper thread issue with gevent
- gunicorn GitHub issue #166 — gevent monkey-patching timing

### Tertiary (LOW confidence — see Assumptions Log)
- General community patterns for `post_fork` gevent patching (multiple sources agree but not official gunicorn docs)
- Docker bind-mount behavior creating directories vs. files for missing targets

---

## Metadata

**Confidence breakdown:**
- Container build (Dockerfile, CI): HIGH — verified against official Docker and GitHub docs
- WhiteNoise settings: HIGH — official docs; storage backend choice MEDIUM (see A1)
- Gunicorn/gevent: MEDIUM — known issues from GitHub issues; timeout = 0 pattern is community-documented
- FastMCP HTTP transport: HIGH — verified against official FastMCP docs; version 3.3.1 confirmed
- Django REST API patterns: HIGH — all patterns use existing project conventions
- YAML write safety: HIGH — stdlib `yaml.safe_load` + `os.replace` is well-established

**Research date:** 2026-05-16
**Valid until:** 2026-06-15 (FastMCP is fast-moving; verify before implementing)
