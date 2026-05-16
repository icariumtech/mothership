# Phase 23: Containerization - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Package the Mothership GM Terminal as a portable Docker image published to GitHub Container Registry (GHCR). Campaign data lives outside the container on an external mounted volume. A remote AI game-master agent connects via MCP (Model Context Protocol) to read and write YAML data files during live play. The homelab server runs `docker compose up` to pull and start both services — no local build required.

This phase builds:
1. `Dockerfile` — multi-stage build: Vite production build + Django app in a single image
2. `docker-compose.yml` — homelab deployment: two services (`app` on port 8000, `mcp` on port 8001), shared data volume mounts, env vars
3. GitHub Actions CI workflow — builds and pushes to GHCR on push to main
4. Django REST API for AI agent data access (file-level read/write + session snapshot) — called internally by the MCP server
5. FastMCP server — Python MCP server exposing named tools to the campaign AI over HTTP transport
6. Entrypoint script for first-run initialization

Out of scope: semantic game operation endpoints (future phase), authentication/auth tokens, media/portraits volume (portraits live in `data/`).

</domain>

<decisions>
## Implementation Decisions

### Container Architecture
- **D-01:** Single container — Django app + Vite static build baked in at CI time. No Node.js runtime at play time. Django serves static files (WhiteNoise or collectstatic).
- **D-02:** Gunicorn with gevent workers as the WSGI server. Gevent enables SSE long-lived connections across multiple concurrent clients without blocking workers.
- **D-03:** Publish to GitHub Container Registry (`ghcr.io`). GitHub Actions CI builds and pushes on push to main. Homelab server pulls via `docker compose pull`.

### Data Volumes
- **D-04:** Two external mounts: `./data:/app/data` (campaign YAML) and `./db.sqlite3:/app/db.sqlite3` (Messages database). NPC portraits are already inside `data/` — no separate media volume.
- **D-05:** Django config (SECRET_KEY, DEBUG, ALLOWED_HOSTS) via `environment:` in `docker-compose.yml`. Never baked into the image.
- **D-06:** Entrypoint script auto-initializes on first run: detects missing `db.sqlite3`, runs `migrate` and `createsuperuser --no-input` with env-var-sourced credentials. Zero manual steps on homelab.

### AI Agent Data API
- **D-07:** File-level REST API (freeform). Three endpoints: `GET /api/gm/data/?dir={path}` (list files), `GET /api/gm/data/{path}` (read raw YAML), `PUT /api/gm/data/{path}` (write YAML + invalidate + broadcast SSE). Semantic game operation endpoints (move-token, reveal-room, etc.) are a future phase.
- **D-08:** Session context snapshot at `GET /api/gm/session-context` — returns current game state (active encounter, tokens, room visibility, ship status, NPC list) for AI agent initialization at session start. Avoids the AI having to query every file individually.
- **D-09:** No authentication on the data API. Trust-the-network model — the container is self-hosted on a homelab, not internet-exposed. API is accessible on the local network.
- **D-10:** After every successful `PUT` write, the server broadcasts an SSE event so player terminals update immediately without GM intervention.

### Cache / Hot-Reload
- **D-11:** No in-memory cache for DataLoader — it already reads from disk on every request. AI writes a file → visible on the very next API call. No TTL cache, no invalidation logic needed.
- **D-12:** Django's `django.core.cache` is used only for JANUS AI conversation state (not campaign data). No changes to JANUS caching behavior.

### MCP Server (Campaign AI Client Interface)
- **D-13:** FastMCP (Python MCP SDK) server as a separate docker-compose service (`mcp`), using the same Docker image as `app` but a different command. Exposes MCP tools over HTTP transport on port 8001.
- **D-14:** Campaign AI runs on a remote machine. It connects to the MCP server at `http://homelab-ip:8001` and uses the MCP protocol to interact with game data. HTTP transport (not stdio) because the AI is remote, not co-located.
- **D-15:** MCP server communicates with Django internally via the REST API at `http://app:8000` (Docker internal network). Clean separation — MCP service calls the same endpoints the AI would otherwise call directly.
- **D-16:** Four MCP tools exposed to the campaign AI:
  - `get_session_context()` — current game state snapshot (encounter, tokens, room visibility, ship status, NPC list)
  - `list_files(dir)` — list files in a data directory
  - `read_file(path)` — read raw YAML content of a campaign file
  - `write_file(path, content)` — write YAML content; triggers SSE broadcast to player terminals
- **D-17:** Both `app` and `mcp` services mount the same `data/` and `db.sqlite3` volumes. Both use the same image tag pulled from GHCR.

### Claude's Discretion
- Specific Gunicorn worker count and concurrency settings (tune based on typical player count of ~5)
- WhiteNoise vs. `collectstatic` approach for serving Vite static files
- Dockerfile base image choice (python:3.12-slim recommended)
- Exact GitHub Actions workflow triggers (push to main, manual dispatch)
- SUPERUSER_USERNAME / SUPERUSER_PASSWORD env var names for first-run entrypoint
- FastMCP server port (8001 recommended) and whether it needs its own entrypoint command

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Server Setup
- `setup.sh` — current local setup script; understand what the Dockerfile replaces
- `start_server.sh` — current start script; understand what the entrypoint replaces
- `core/data_loader.py` — DataLoader reads YAML from disk on every request; no caching to invalidate
- `core/janus_session.py` — the only Django cache user (conversation state); leave untouched
- `mothership/settings.py` — Django settings; needs ALLOWED_HOSTS, STATIC_ROOT, WhiteNoise config for production

### SSE Architecture
- `core/views.py` — SSE broadcaster endpoint; must remain compatible with gevent workers
- `.planning/codebase/ARCHITECTURE.md` — SSE named events (`activeview`, `shipstatus`, `bridge`); AI write endpoint must trigger the appropriate event

### Project Constraints
- `CLAUDE.md` — project guidelines; file-based data constraint, Django + React/TS stack is locked
- `.planning/PROJECT.md` — Key Decisions table; file-based data over DB is a locked decision
- `requirements.txt` — Python dependencies; `gunicorn`, `gevent`, and `mcp` (FastMCP) must be added

### MCP Protocol
- FastMCP docs: https://github.com/jlowin/fastmcp — Python MCP server framework; use for tool definitions and HTTP transport setup
- MCP spec HTTP transport uses SSE for server→client streaming; FastMCP handles this automatically

### Future Phase Reference
- Semantic game operation endpoints (move-token, reveal-room, update-npc-status) are deferred — do NOT implement in this phase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `core/data_loader.py` — DataLoader class handles all YAML loading; the write API can use its directory-navigation patterns to validate and locate files
- `core/views.py` SSE broadcaster — existing `text/event-stream` endpoint; the write API calls the same broadcast mechanism after a successful write
- `setup.sh` / `start_server.sh` — document the current setup flow that the Dockerfile and entrypoint must replicate

### Established Patterns
- **File-based data is king** — Django never writes to campaign files today; the new write API is the first code path that does. Must validate YAML before writing to avoid corrupting files mid-session.
- **SSE named events** — broadcaster sends named events (`activeview`, `shipstatus`, `bridge`, `encounter`); write API should broadcast a generic `data-changed` event or map writes to the appropriate named event based on path.
- **No Django auth on public endpoints** — `@csrf_exempt` pattern already exists for terminal/messages endpoints; write API follows same pattern.
- **ActiveView is in-memory** — persists within a gunicorn worker's lifetime; SSE broadcast handles cross-client update. No session state to migrate.

### Integration Points
- `mothership/settings.py` — add `STATIC_ROOT`, `WHITENOISE_ROOT`, `ALLOWED_HOSTS = ['*']` (or env-driven), `DEBUG = False` for production build
- `requirements.txt` — add `gunicorn`, `gevent`, `whitenoise`, `mcp` (FastMCP)
- New `docker-entrypoint.sh` — runs migrations, optional superuser creation, then `exec gunicorn ...`
- New `Dockerfile` — two stages: Node (npm ci + npm run build) then Python (copy static output, pip install, copy app)
- New `docker-compose.yml` — two services: `app` (Gunicorn, port 8000) and `mcp` (FastMCP, port 8001); both use same image from GHCR; both mount `data/` and `db.sqlite3`
- New `mcp_server.py` — FastMCP server defining four tools; calls Django REST API at `http://app:8000` for all operations

</code_context>

<specifics>
## Specific Ideas

- The homelab server workflow should be as simple as: `git clone` the docker-compose.yml, create a `data/` directory, set env vars in compose file, `docker compose up -d`.
- The MCP server is the primary interface for the campaign AI. The REST API is the internal implementation that the MCP server calls. The campaign AI should never need to call the REST API directly.
- Campaign AI connects to MCP at `http://homelab-ip:8001` — add this port to docker-compose.yml `ports:` on the `mcp` service.
- The file-level API should have a companion `GET /api/gm/data-schema` endpoint that returns the DATA_DIRECTORY_GUIDE summary — giving the AI a map of what files exist and what they mean. Expose this as a `get_data_schema()` MCP tool too.
- Gevent workers: `gunicorn --worker-class gevent --workers 3 --bind 0.0.0.0:8000 mothership.wsgi:application`

</specifics>

<deferred>
## Deferred Ideas

- **Semantic game operation endpoints** (move-token, reveal-room, update-npc-status, etc.) — future phase after freeform API is working and usage patterns emerge
- **API authentication** (API key, JWT) — explicitly deferred; trust-network model is sufficient for homelab
- **Health check endpoint** (`/health/`) — useful for docker-compose `healthcheck:` config; deferred to keep scope tight; add if time allows
- **HTTPS / TLS termination** — out of scope; homelab users can front with Caddy/nginx reverse proxy if needed

None — UI-related todos (CHARON overlay, NPC portraits on standby) are unrelated to containerization.

</deferred>

---

*Phase: 23-containerization*
*Context gathered: 2026-05-16*
