---
phase: 23-containerization
plan: 01
subsystem: infra
tags: [django, gunicorn, gevent, whitenoise, sse, docker, fastmcp]

# Dependency graph
requires:
  - phase: 22-renderer-interaction-seams
    provides: stable codebase baseline for containerization
provides:
  - Production-ready Django settings with env-driven config and WhiteNoise static serving
  - gunicorn.conf.py with gevent workers=1, timeout=0, post_fork monkey-patch
  - DataLoader reads DATA_DIR from settings (enables container /app/data volume mount)
  - announce_generic SSE method on MessageAnnouncer for arbitrary named events
  - requirements.txt with all 6 production dependencies declared with pinned versions
affects: [23-02-dockerfile, 23-03-docker-compose, 23-04-mcp-server, 23-05-github-actions]

# Tech tracking
tech-stack:
  added: [gunicorn==26.0.0, gevent==26.4.0, whitenoise==6.12.0, fastmcp==3.3.1, uvicorn>=0.30.0, httpx>=0.27.0]
  patterns: [env-driven Django settings, WhiteNoise static serving, gevent SSE workers, post_fork monkey-patch]

key-files:
  created: [gunicorn.conf.py]
  modified: [config/settings.py, requirements.txt, core/data_loader.py, core/sse_broadcaster.py]

key-decisions:
  - "CompressedStaticFilesStorage (not Manifest) — templates reference bundles by fixed name without hashes"
  - "workers=1 gevent — SSE broadcaster is per-process singleton; multi-worker splits clients across processes"
  - "LocMemCache replaces FileBasedCache — fcntl file locking conflicts with gevent monkey-patching"
  - "timeout=0 — gevent master process cannot distinguish sleeping SSE greenlet from hung worker"
  - "post_fork hook for monkey-patch — must apply before Django ORM initializes DB connections"
  - "Lazy import of django.conf.settings inside get_loader() — avoids circular import at module load time"

patterns-established:
  - "Pattern: post_fork gevent monkey-patch in gunicorn.conf.py (not at module top) — prevents SQLite thread errors"
  - "Pattern: DATA_DIR env var overrides base data path — container sets DATA_DIR=/app/data"
  - "Pattern: announce_generic(event, data) for any named SSE event beyond activeview/shipstatus"

requirements-completed: [D-01, D-02, D-05, D-10, D-11]

# Metrics
duration: 12min
completed: 2026-05-17
---

# Phase 23 Plan 01: Application Prep for Containerization Summary

**Env-driven Django settings with WhiteNoise, gevent Gunicorn config, DATA_DIR-aware DataLoader, and generic SSE broadcast method — all prerequisites for the Dockerfile build**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-17T00:00:00Z
- **Completed:** 2026-05-17T00:12:00Z
- **Tasks:** 3
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments
- Django settings are now production-ready: env-driven SECRET_KEY/DEBUG/ALLOWED_HOSTS, WhiteNoise at MIDDLEWARE index 1, STATIC_ROOT set for collectstatic, DATA_DIR configurable via env var
- gunicorn.conf.py established the gevent SSE-safe worker pattern: workers=1, timeout=0, post_fork monkey-patch before ORM init
- DataLoader singleton reads settings.DATA_DIR so the container's /app/data volume mount is used automatically on first call to get_loader()
- announce_generic method added to MessageAnnouncer for Plans 02+ YAML write SSE broadcast (D-10 requirement)
- All 6 production dependencies declared with pinned/minimum versions in requirements.txt

## Task Commits

Each task was committed atomically:

1. **Task 1: Update config/settings.py for production deployment** - `a51fcba` (feat)
2. **Task 2: Add production dependencies to requirements.txt and fix DataLoader DATA_DIR** - `7a69c84` (feat)
3. **Task 3: Create gunicorn.conf.py and add announce_generic to SSE broadcaster** - `c08eda7` (feat)

**Plan metadata:** (docs commit follows this SUMMARY)

## Files Created/Modified
- `config/settings.py` - Env-driven config, WhiteNoise middleware, STATIC_ROOT, DATA_DIR, LocMemCache
- `requirements.txt` - Added 6 production deps: gunicorn, gevent, whitenoise, fastmcp, uvicorn, httpx
- `core/data_loader.py` - get_loader() reads settings.DATA_DIR via lazy import to avoid circular imports
- `gunicorn.conf.py` - New file: gevent workers=1, timeout=0, post_fork monkey-patch
- `core/sse_broadcaster.py` - announce_generic(event, data) method added to MessageAnnouncer

## Decisions Made
- Used `CompressedStaticFilesStorage` not `CompressedManifestStaticFilesStorage` — templates reference Vite bundles by fixed name (shared-console.bundle.js, gm-console.bundle.js) without content hashes; manifest storage would break those references
- Switched from `FileBasedCache` to `LocMemCache` — gevent monkey-patches `os`, which can conflict with fcntl file locking used by FileBasedCache; with workers=1 all requests share the same process so in-memory cache is safe
- `workers=1` not 3 — `broadcaster` is a per-process singleton; multiple workers would cause SSE events to miss clients connected to a different worker
- `timeout=0` — gunicorn's master process sends SIGKILL to workers exceeding timeout; gevent greenlets sleeping in queue.get() (SSE listeners) are indistinguishable from hung workers; timeout=0 disables this kill
- Lazy import of `django.conf.settings` inside `get_loader()` body — importing at module top would cause circular import since data_loader.py is imported before Django's app registry is ready in some test contexts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Django's settings proxy normalizes `STATIC_URL = 'static/'` to `'/static/'` at runtime — the plan's verification assertion `settings.STATIC_URL == 'static/'` would fail against the proxy. Verified the actual file value is correct (`'static/'`) and all other assertions pass. Not a code issue.

## User Setup Required
None - no external service configuration required. Dependencies listed in requirements.txt must be installed via `pip install -r requirements.txt` before running in production.

## Next Phase Readiness
- Plan 02 (YAML write API + Docker entrypoint) can proceed — settings, DataLoader, and announce_generic are all in place
- Plan 03 (Dockerfile) can proceed — STATIC_ROOT is configured for collectstatic, whitenoise is in MIDDLEWARE, gunicorn.conf.py exists
- No blockers

## Threat Surface Scan
gunicorn.conf.py introduces `bind = '0.0.0.0:8000'` — this is covered by threat model T-23-01-03 in the plan (timeout=0 mitigates DoS from SSE connection kill). The bind address is standard for container deployment and is expected; Docker/docker-compose controls external exposure via port mapping.

---
*Phase: 23-containerization*
*Completed: 2026-05-17*
