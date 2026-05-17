# Phase 23: Containerization - Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 9 new/modified files
**Analogs found:** 5 / 9 (4 new infra files have no project analog; RESEARCH.md patterns are authoritative for those)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `Dockerfile` | config | build-transform | `setup.sh` (partial — replaces steps 1-5) | infra (no analog) |
| `docker-compose.yml` | config | config | none | no analog |
| `.github/workflows/docker-publish.yml` | config | event-driven | none | no analog |
| `docker-entrypoint.sh` | utility | request-response | `start_server.sh` (replaces startup flow) | infra (no analog) |
| `gunicorn.conf.py` | config | config | none | no analog |
| `mcp_server.py` | service | request-response | `core/views/active_view.py` (SSE/API delegation pattern) | partial |
| `config/settings.py` (modify) | config | config | `config/settings.py` (self) | exact |
| `requirements.txt` (modify) | config | config | `requirements.txt` (self) | exact |
| `core/views/gm_data.py` (new view module) | service | CRUD + file-I/O | `core/views/ship.py` + `core/views/campaign.py` | role-match |
| `core/urls.py` (modify) | config | request-response | `core/urls.py` (self) | exact |
| `core/data_loader.py` (modify) | service | file-I/O | `core/data_loader.py` (self) | exact |

---

## Pattern Assignments

### `core/views/gm_data.py` (new — GM data API + session context)

**Analog:** `core/views/ship.py` (file read + SSE broadcast after write), `core/views/campaign.py` (no-auth public endpoints reading from disk via `get_loader()`)

**Imports pattern** — copy from `core/views/ship.py` lines 1-6 and `core/views/campaign.py` lines 1-11:
```python
from django.http import JsonResponse, HttpResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import json
import yaml
import os
import tempfile
from pathlib import Path
from core.data_loader import get_loader
from core.sse_broadcaster import broadcaster, format_sse
```

**No-auth public endpoint pattern** — copy from `core/views/campaign.py` lines 61-74 (`api_corporation`). This is the closest analog to a no-auth, no-login-required view that reads raw YAML from disk:
```python
def api_corporation(request):
    """
    Public endpoint — returns corporation branding data from data/campaign/corporation.yaml.
    GET: /api/corporation/
    """
    loader = get_loader()
    corp_file = loader.data_dir / 'campaign' / 'corporation.yaml'
    if not corp_file.exists():
        return JsonResponse({'error': 'Not found'}, status=404)
    with open(corp_file) as f:
        data = yaml.safe_load(f) or {}
    ...
    return JsonResponse(data)
```

**@csrf_exempt unauthenticated write pattern** — copy from `core/views/navigation.py` lines 145-170 (`api_bridge_selection`). This is the only existing endpoint that accepts POST writes without login and uses `@csrf_exempt`. The new PUT write endpoint follows this pattern exactly:
```python
@csrf_exempt
def api_bridge_selection(request):
    """
    INTENTIONALLY UNAUTHENTICATED: ...
    """
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    ...
```

**SSE broadcast after write pattern** — copy from `core/views/ship.py` lines 73-80. The ship toggle is the existing model for "write to disk then broadcast SSE":
```python
    # Broadcast updated ship status
    try:
        ship_broadcast_data = loader.load_ship_status()
        if ship_broadcast_data:
            broadcaster.announce_ship_status(ship_broadcast_data)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning('Failed to broadcast ship status via SSE: %s', e)
```
The new write view calls `broadcaster.announce_generic('data-changed', {...})` (new method to add to `MessageAnnouncer`) in the same try/except pattern.

**Error response pattern** — copy from `core/views/encounter.py` lines 27-33:
```python
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
```

**Session context view** — no existing analog. Compose state from `core/active_view_store.get_state()` and disk reads. Pattern from `core/views/active_view.py` lines 66-73 (`get_active_view_json`):
```python
def get_active_view_json(request):
    return JsonResponse(build_active_view_payload(get_state()))
```
The session context view follows the same one-liner shape but builds its own payload dict from `get_state()` + `get_loader().load_npcs()` + `get_loader().load_crew()` + `get_loader().load_ship_status()`.

---

### `core/urls.py` (modify — add 4 GM data routes)

**Analog:** `core/urls.py` (self), specifically the existing `api/gm/` prefix block starting at line 27.

**Pattern to follow** — copy the grouping style from lines 27-34 and insert after existing `api/gm/` routes:
```python
    # GM Console React API endpoints
    path('api/gm/locations/', views.api_locations, name='api_locations'),
    path('api/gm/crew/', views.api_crew, name='api_crew'),
    ...
```

**New routes to add** — from RESEARCH.md Pattern 8 (confirmed against existing URL patterns):
```python
    # GM Data API — AI agent file access (Phase 23)
    path('api/gm/data/', views.api_gm_data_list, name='gm_data_list'),
    path('api/gm/data/<path:filepath>', views.api_gm_data_file, name='gm_data_file'),
    path('api/gm/session-context', views.api_gm_session_context, name='gm_session_context'),
    path('api/gm/data-schema', views.api_gm_data_schema, name='gm_data_schema'),
```

**Critical detail:** `<path:filepath>` not `<str:filepath>` — `str` stops at `/`. The existing URL for encounter data uses `<str:location_slug>` (no slashes), but file paths need `path:`. See `config/urls.py` line 34 for the existing use of `<path:path>` in the data file server.

**New views must be exported** from `core/views/__init__.py` following the existing barrel-export pattern (lines 85-95 show the `from .campaign import (...)` style):
```python
from .gm_data import (
    api_gm_data_list,
    api_gm_data_file,
    api_gm_session_context,
    api_gm_data_schema,
)
```

---

### `core/data_loader.py` (modify — `get_loader()` reads `settings.DATA_DIR`)

**Analog:** `core/data_loader.py` lines 901-908 (`get_loader()` convenience function):
```python
_loader: Optional[DataLoader] = None

def get_loader() -> DataLoader:
    global _loader
    if _loader is None:
        _loader = DataLoader()
    return _loader
```

**Modification:** Change `DataLoader()` to `DataLoader(settings.DATA_DIR)`. This requires importing `settings`. The `DataLoader.__init__` signature at line 307 already accepts `data_dir: str = "data"` — no signature change needed:
```python
def __init__(self, data_dir: str = "data"):
    self.data_dir = Path(data_dir)
```

**Updated `get_loader()`:**
```python
from django.conf import settings

def get_loader() -> DataLoader:
    global _loader
    if _loader is None:
        _loader = DataLoader(getattr(settings, 'DATA_DIR', 'data'))
    return _loader
```

**Existing write pattern** — `core/data_loader.py` lines 784-848 show `_save_ship_yaml()`, `save_ship_location()`, etc. These use `yaml.dump()` round-trip with re-serialization. The new `safe_write_yaml()` helper in `gm_data.py` deliberately does NOT use `yaml.dump()` (avoids reformatting). This is intentional per RESEARCH.md Anti-Patterns section.

---

### `config/settings.py` (modify — production config)

**Analog:** `config/settings.py` (self, lines 1-145). The file already has all the structural patterns. Changes are additions.

**Current state relevant to modifications:**

Lines 13-21 (env loading already exists — extend it):
```python
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

from dotenv import load_dotenv
load_dotenv(BASE_DIR / '.env')
```

Lines 30-35 (SECRET_KEY and DEBUG — convert to env-driven):
```python
SECRET_KEY = 'django-insecure-l_lzruv)tsb8uig6#7kesmkl3ri7o%62_&hsa)wbt4b_ia3j4o'
DEBUG = True
ALLOWED_HOSTS = ['*']
```

Lines 50-58 (MIDDLEWARE — insert WhiteNoise after SecurityMiddleware):
```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    # INSERT: 'whitenoise.middleware.WhiteNoiseMiddleware',  # MUST be second
    'django.contrib.sessions.middleware.SessionMiddleware',
    ...
]
```

Lines 130-134 (STATIC_URL — add STATIC_ROOT and STATICFILES_DIRS below it):
```python
STATIC_URL = 'static/'
# ADD below:
# STATIC_ROOT = BASE_DIR / 'staticfiles'
# STATICFILES_DIRS = [BASE_DIR / 'core' / 'static']
```

**All changes to make** (additive, no removals):
1. Replace hardcoded `SECRET_KEY` with `os.environ.get('SECRET_KEY', 'insecure-dev-only')`
2. Replace `DEBUG = True` with `DEBUG = os.environ.get('DEBUG', 'True') == 'True'`
3. Replace `ALLOWED_HOSTS = ['*']` with `ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')`
4. Insert `'whitenoise.middleware.WhiteNoiseMiddleware'` at position 1 in MIDDLEWARE list
5. Add after `STATIC_URL`: `STATIC_ROOT`, `STATICFILES_DIRS`, `STORAGES` (WhiteNoise backend)
6. Add `DATA_DIR = os.environ.get('DATA_DIR', str(BASE_DIR / 'data'))`

---

### `requirements.txt` (modify — add production dependencies)

**Analog:** `requirements.txt` (self, lines 1-6). Current contents:
```
asgiref==3.10.0
Django==5.2.7
sqlparse==0.5.3
PyYAML>=6.0
anthropic>=0.39.0
python-dotenv>=1.0.0
```

**Lines to append** (from RESEARCH.md Standard Stack, all versions verified 2026-05-16):
```
gunicorn==26.0.0
gevent==26.4.0
whitenoise==6.12.0
fastmcp==3.3.1
uvicorn>=0.30.0
httpx>=0.27.0
```

---

### `core/sse_broadcaster.py` (modify — add `announce_generic`)

**Analog:** `core/sse_broadcaster.py` lines 36-45 (`announce_ship_status` method). The new `announce_generic` is identical in structure, parameterized on event name:
```python
def announce_ship_status(self, data: dict) -> None:
    """Broadcast ship status update to all SSE clients on the 'shipstatus' named event."""
    msg = format_sse(json.dumps(data, default=str), event='shipstatus')
    with self._lock:
        listeners = list(self.listeners)
    for i in reversed(range(len(listeners))):
        try:
            listeners[i].put_nowait(msg)
        except queue.Full:
            self.unlisten(listeners[i])
```

**New method** — add after `announce_ship_status`:
```python
def announce_generic(self, event: str, data: dict) -> None:
    """Broadcast a named SSE event with arbitrary data to all connected clients."""
    msg = format_sse(json.dumps(data, default=str), event=event)
    with self._lock:
        listeners = list(self.listeners)
    for i in reversed(range(len(listeners))):
        try:
            listeners[i].put_nowait(msg)
        except queue.Full:
            self.unlisten(listeners[i])
```

---

### `mcp_server.py` (new — FastMCP HTTP tool server)

**Analog:** `core/views/active_view.py` lines 37-61 (SSE stream view). Both are thin delegation layers — active_view delegates to `broadcaster` and `get_state()`; mcp_server delegates to the Django REST API via HTTP. The structural parallel is the same "accept input, call internal service, return result" shape.

**No closer analog exists** — this is the first async Python file in the project. All existing views are synchronous Django. Use RESEARCH.md Pattern 4 verbatim.

**Key pattern from RESEARCH.md Pattern 4** (lines 301-361):
- `from fastmcp import FastMCP` + `mcp = FastMCP("MothershipGM")`
- `@mcp.tool` decorator on each async function
- `async with httpx.AsyncClient() as client:` inside each tool
- `DJANGO_BASE_URL = "http://app:8000"` constant at module top
- `if __name__ == "__main__": mcp.run(transport="http", host="0.0.0.0", port=8001)`

**Five tools to implement:** `get_session_context`, `list_files`, `read_file`, `write_file`, `get_data_schema`

---

### `docker-entrypoint.sh` (new — first-run init)

**Analog:** `start_server.sh` lines 21-27 (detect missing db.sqlite3, run migrate, createsuperuser). The entrypoint replaces this logic in container form.

**Key differences from `start_server.sh`:**
- Always runs `migrate --noinput` (idempotent; no existence check needed per RESEARCH.md Pattern 5)
- Uses `DJANGO_SUPERUSER_USERNAME` / `DJANGO_SUPERUSER_PASSWORD` env vars (not interactive)
- Ends with `exec gunicorn --config gunicorn.conf.py config.wsgi:application`
- Must handle CMD override for `mcp` service (RESEARCH.md Pitfall 6)

**Shell script boilerplate pattern** from `setup.sh` lines 1-8:
```bash
#!/bin/bash
set -e
```

**Use RESEARCH.md Pattern 5 verbatim** including the `if [ "$#" -gt 0 ]; then exec "$@"; fi` CMD override guard (critical — prevents `mcp` service from running migrations).

---

### `Dockerfile` (new — multi-stage build)

**No project analog.** The closest conceptual analog is `setup.sh` (steps 1-5) + `start_server.sh` for the startup flow.

**Use RESEARCH.md Pattern 1 verbatim** with these project-specific details confirmed by inspection:
- `vite.config.ts` line 19: `outDir: 'core/static/js'` — Vite output lands at `core/static/js/`
- `vite.config.ts` line 7: `base: '/static/'` — Django `STATIC_URL` must remain `/static/`
- `package.json` uses pnpm (lock file present) — `RUN corepack enable` in Node stage
- `DJANGO_SETTINGS_MODULE=config.settings` (not `mothership.settings` — confirmed from `config/settings.py` path)
- `config.wsgi:application` (not `mothership.wsgi` — confirmed from `config/settings.py` line 77: `WSGI_APPLICATION = 'config.wsgi.application'`)

---

### `docker-compose.yml` (new — homelab deployment)

**No project analog.** Use RESEARCH.md Pattern 7 verbatim. Confirm image name with actual repo owner before publishing.

---

### `gunicorn.conf.py` (new — gevent worker config)

**No project analog.** Use RESEARCH.md Pattern 3 verbatim.

**Key setting confirmed by RESEARCH.md:** `workers = 1` (not 3) is recommended for homelab with ~5 players to avoid the cross-worker SSE broadcast problem (each worker has its own `broadcaster` singleton).

---

## Shared Patterns

### No-Auth Public Endpoint
**Source:** `core/views/campaign.py` lines 61-74 (`api_corporation`) and `core/views/navigation.py` lines 145-196 (`api_bridge_selection`)
**Apply to:** All four new GM data views (`api_gm_data_list`, `api_gm_data_file`, `api_gm_session_context`, `api_gm_data_schema`)

The project has two no-auth patterns:
1. **Read-only with no decorator** — `api_corporation`, `api_campaign_docs`. Use for GET-only endpoints.
2. **Write with `@csrf_exempt` and comment explaining why** — `api_bridge_selection`. Use for PUT endpoint.

The write endpoint (`api_gm_data_file` for PUT) must use `@csrf_exempt` and include the same style of docstring comment explaining the intentional lack of auth (trust-network model, D-09).

### Error Response Format
**Source:** `core/views/encounter.py` lines 20-33, `core/views/ship.py` lines 48-53
**Apply to:** All new view functions

Consistent format: `JsonResponse({'error': 'message text'}, status=NNN)`

Valid status codes in use: 400 (bad input), 404 (not found), 405 (wrong method), 500 (server error).

### DataLoader Disk Access
**Source:** `core/data_loader.py` lines 900-908 (`get_loader()`) and `core/views/campaign.py` lines 159-162, 171-176
**Apply to:** All new view functions that read campaign data

Always use `get_loader()` — never instantiate `DataLoader` directly in views. After the `data_loader.py` modification, `get_loader()` will automatically use `settings.DATA_DIR`.

```python
loader = get_loader()
data = loader.load_npcs()  # example
```

### YAML Safe Loading
**Source:** `core/data_loader.py` line 48, 143, 183, 210 (all use `yaml.safe_load(f)`)
**Apply to:** `api_gm_data_file` (both reading and validating before write)

The project uses `yaml.safe_load()` exclusively — never `yaml.load()`. The new write endpoint validates with `yaml.safe_load(content)` before writing to disk (RESEARCH.md Pattern 8).

### SSE Broadcast After Mutation
**Source:** `core/views/ship.py` lines 73-80 (broadcast after `save_ship_system`)
**Apply to:** `api_gm_data_file` PUT handler

Pattern: write to disk first, then broadcast in try/except so a broadcast failure doesn't roll back the write. Log warnings, never raise.

### WSGI Module Path
**Source:** `config/settings.py` line 77: `WSGI_APPLICATION = 'config.wsgi.application'`
**Apply to:** `Dockerfile` (ENTRYPOINT command) and `docker-entrypoint.sh`

The WSGI module is `config.wsgi:application`, not `mothership.wsgi:application`. The settings module is `config.settings`, not `mothership.settings`. This differs from what a generic Django tutorial would assume.

---

## No Analog Found

Files with no close codebase match — use RESEARCH.md patterns as primary reference:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `Dockerfile` | config | build-transform | No Docker files exist; setup.sh is partial conceptual analog only |
| `docker-compose.yml` | config | config | No compose files exist in project |
| `.github/workflows/docker-publish.yml` | config | event-driven | No GitHub Actions workflows exist in project |
| `gunicorn.conf.py` | config | config | No WSGI config files exist; project uses `runserver` |
| `mcp_server.py` | service | request-response | No async Python files exist; no MCP integration exists |

For these five files: use RESEARCH.md Patterns 1, 3, 4, 5, 6, 7 verbatim. The patterns are high-confidence (verified against official docs).

---

## Critical Project-Specific Details for Implementors

These are non-obvious facts discovered by reading the actual codebase that override generic tutorial patterns:

1. **Settings module is `config.settings`** (not `mothership.settings`) — `config/settings.py` is the actual settings file. `WSGI_APPLICATION = 'config.wsgi.application'` (line 77).

2. **Vite output dir is `core/static/js/`** (not `dist/`) — `vite.config.ts` line 19: `outDir: 'core/static/js'`. The Dockerfile copies Vite output from `/build/core/static/js/` into the Python stage.

3. **`STATIC_URL` must remain `'static/'`** — `vite.config.ts` line 7: `base: '/static/'` bakes this into chunk import URLs. Note the current settings.py value is `'static/'` without leading slash. Django normalizes this to `/static/`. WhiteNoise will serve at `/static/`. Do not change this value.

4. **Views are a package, not a single file** — `core/views/` is a directory with `__init__.py`. New views go in a new module `core/views/gm_data.py` and must be exported from `core/views/__init__.py` following the barrel-export pattern (lines 1-95 of `__init__.py`).

5. **`get_loader()` is a module-level singleton** — `core/data_loader.py` lines 901-908. The global `_loader` is set once per process. The DATA_DIR fix only takes effect if `_loader` is `None` at the time `get_loader()` is first called. In tests, use `set_loader()` to inject a fixture loader.

6. **FileBasedCache may conflict with gevent** — `config/settings.py` lines 91-98 shows `FileBasedCache` at `/tmp/django_cache`. RESEARCH.md Open Question 2 flags this as a potential gevent incompatibility. If JANUS breaks under gevent, switch to `LocMemCache`.

7. **`emptyOutDir: false` in vite.config.ts** — line 21. The Vite build does NOT wipe `core/static/js/` before building. Non-JS static assets (CSS, images) already in that directory are preserved. The Dockerfile does not need to pre-populate `core/static/js/` with non-JS assets.

---

## Metadata

**Analog search scope:** `/home/gjohnson/mothership/charon/core/views/`, `/home/gjohnson/mothership/charon/core/`, `/home/gjohnson/mothership/charon/config/`
**Files read:** 16 project files
**Pattern extraction date:** 2026-05-16
