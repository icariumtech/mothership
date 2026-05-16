# Phase 23: Containerization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 23-containerization
**Areas discussed:** AI mutation interface, Container architecture, Data scope — what gets mounted, Cache invalidation / hot-reload

---

## AI mutation interface

| Option | Description | Selected |
|--------|-------------|----------|
| API endpoint (freeform) | AI calls Django REST endpoints to list, read, write YAML files | ✓ (start here) |
| Structured game operations only | Pre-built endpoints for specific actions (move-token, reveal-room, etc.) | future phase |
| Hybrid — filesystem + reload signal | AI writes files directly, calls reload endpoint after | |

**User's choice:** Freeform file-level REST API first; structured semantic operations in a future phase once usage patterns emerge.

**Notes:** User asked for clarification on how the API would work — explained Pattern A (file-level REST) vs Pattern B (semantic ops) with concrete endpoint examples. User wanted to understand how the AI tracks current data state. Recommended session-start snapshot + on-demand reads. User accepted the recommendation.

| Option | Description | Selected |
|--------|-------------|----------|
| Reads via API | AI uses GET endpoints to list/read files | ✓ (combined with snapshot) |
| Schema + data snapshot at session start | Structured summary given to AI at session start | ✓ (combined) |
| Direct filesystem access | AI reads files natively from mounted volume | |

**User's choice:** Both: session-start snapshot (GET /api/gm/session-context) + on-demand list/read endpoints for details.

| Option | Description | Selected |
|--------|-------------|----------|
| API key in request header | Long-lived key, simple, easy to rotate | |
| Django session cookie | Reuses existing auth, more complex | |
| No auth — trust the network | Self-hosted homelab, network-trust model | ✓ |

**User's choice:** No authentication. Self-hosted homelab tool, never internet-exposed.

| Option | Description | Selected |
|--------|-------------|----------|
| Always broadcast SSE on write | Player terminals update immediately after AI writes | ✓ |
| GM triggers display manually | AI writes, GM pushes separately | |
| Configurable per write (broadcast flag) | AI controls whether to broadcast | |

**User's choice:** Always broadcast SSE on write so player terminals update in real time.

---

## Container architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Single container | Django + Vite static build, one image | ✓ |
| Two containers (Django + Nginx) | More production-hardened | |
| Three containers (+Vite dev server) | For active frontend dev inside Docker | |

**User's choice:** Single container.

| Option | Description | Selected |
|--------|-------------|----------|
| docker-compose is primary UX | Dockerfile exists as impl detail | |
| Both as first-class | Documented Dockerfile + docker-compose.yml | |
| Publish to registry | Build in CI, push to GHCR, homelab pulls | ✓ |

**User's choice:** Publish to GitHub Container Registry. Homelab server never builds locally — just pulls and runs via docker-compose.yml. GitHub Actions builds on push to main.

| Option | Description | Selected |
|--------|-------------|----------|
| Baked-in production build | Vite builds at CI time, static files in image | ✓ |
| Dev server inside container | Live-reloading Vite inside the container | |

**User's choice:** Vite production build baked into image at CI time.

---

## Data scope — what gets mounted

| Option | Description | Selected |
|--------|-------------|----------|
| data/ (campaign YAML) | All campaign data, portraits already inside | ✓ |
| db.sqlite3 (Messages) | Persistent broadcast messages | ✓ |
| media/ or portraits/ | Separate media volume | — (portraits in data/) |

**User's choice:** Two external mounts: `data/` and `db.sqlite3`. No separate media volume.

| Option | Description | Selected |
|--------|-------------|----------|
| Environment variables in docker-compose.yml | SECRET_KEY, DEBUG, ALLOWED_HOSTS | ✓ |
| .env file mounted | Separate file | |
| Baked into image | Insecure for shared images | |

**User's choice:** Environment variables in docker-compose.yml.

| Option | Description | Selected |
|--------|-------------|----------|
| Entrypoint script auto-initializes | detect missing db.sqlite3, run migrate + createsuperuser | ✓ |
| Manual first-run steps in README | User runs docker compose run ... manually | |
| Ship default data/ in image | Example data as fallback | |

**User's choice:** Entrypoint script auto-initializes on first run.

---

## Cache invalidation / hot-reload

**Finding:** DataLoader has no in-memory cache — it reads from disk on every request. Cache invalidation is a non-problem for campaign YAML data. Only Django cache usage is JANUS conversation state (unrelated to campaign files).

| Option | Description | Selected |
|--------|-------------|----------|
| Gunicorn (gevent workers) | Production WSGI, SSE-compatible with gevent | ✓ |
| Django dev server | Simple, single-threaded, current approach | |
| Uvicorn (ASGI) | Async, excellent for SSE, more complex | |

**User's choice:** Gunicorn with gevent workers.

| Option | Description | Selected |
|--------|-------------|----------|
| No cache — always read from disk | Current behavior, AI writes visible immediately | ✓ |
| Short TTL cache (e.g., 5s) | Small performance improvement, small write delay | |

**User's choice:** No cache. Read from disk always — perfect for live AI writes.

| Option | Description | Selected |
|--------|-------------|----------|
| Gunicorn with gevent workers | Gevent patches sync → async; SSE works correctly | ✓ |
| Multiple sync workers | Ties up one worker per SSE connection | |
| Separate uvicorn for SSE only | Complex routing, two servers | |

**User's choice:** Gunicorn with gevent workers.

---

## Claude's Discretion

- Gunicorn worker count and concurrency settings
- WhiteNoise vs. collectstatic approach for static files
- Dockerfile base image (python:3.12-slim expected)
- Exact GitHub Actions workflow triggers
- Env var names for first-run superuser credentials

## Deferred Ideas

- Semantic game operation endpoints (move-token, reveal-room, update-npc-status) — future phase
- API authentication (API key, JWT) — explicitly out of scope for homelab trust model
- Health check endpoint for docker-compose healthcheck config
- HTTPS/TLS termination — homelab users can front with Caddy/nginx
