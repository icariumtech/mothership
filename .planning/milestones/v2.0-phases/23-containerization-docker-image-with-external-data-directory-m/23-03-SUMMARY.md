---
phase: 23-containerization
plan: 03
subsystem: backend
tags: [django, rest-api, yaml, sse, path-traversal, mcp, file-io]

# Dependency graph
requires:
  - phase: 23-containerization
    plan: 01
    provides: announce_generic SSE method, DATA_DIR env setting, DataLoader singleton
provides:
  - Four GM data REST API view functions in core/views/gm_data.py
  - Behavioral test stubs in core/tests/test_gm_api.py
  - URL routing for four new /api/gm/ endpoints
  - safe_write_yaml helper: validates YAML, enforces extension whitelist, atomic write
affects: [23-04-mcp-server]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: path traversal blocked via Path.resolve() + is_relative_to(data_root)"
    - "Pattern: YAML validated with yaml.safe_load() before atomic write via os.replace()"
    - "Pattern: SSE broadcast in try/except after write — broadcast failure never rolls back write"
    - "Pattern: @csrf_exempt + INTENTIONALLY UNAUTHENTICATED docstring for trust-network endpoints"

key-files:
  created:
    - core/views/gm_data.py
    - core/tests/__init__.py
    - core/tests/test_gm_api.py
  modified:
    - core/views/__init__.py
    - core/urls.py

key-decisions:
  - "safe_write_yaml uses os.replace() not direct write — POSIX-atomic: readers never see partial file"
  - "api_gm_data_list validates path traversal even for reads — prevents directory enumeration outside DATA_DIR"
  - "PUT handler decodes body as UTF-8 before YAML validation — explicit error on binary content"
  - "test_write_file_valid_yaml decorated @unittest.skip — requires writable DATA_DIR; unsafe to run in CI"

# Metrics
duration: 20min
completed: 2026-05-17
---

# Phase 23 Plan 03: GM Data REST API Summary

**Four unauthenticated Django views providing the MCP server with file-level read/write access to campaign YAML data, plus game state snapshot and data schema — all protected by path traversal guard and atomic YAML write**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-05-17T20:39:00Z
- **Completed:** 2026-05-17T20:59:30Z
- **Tasks:** 3
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments

- `core/views/gm_data.py` implements all four GM data API views as specified by requirements D-07, D-08, D-09, D-10:
  - `api_gm_data_list`: lists files in any `DATA_DIR` subdirectory (with path traversal guard)
  - `api_gm_data_file`: reads raw file content (GET) or writes YAML atomically (PUT) — unauthenticated per D-09
  - `api_gm_session_context`: composes `get_state()` + DataLoader NPCs/crew/ship_status into one snapshot
  - `api_gm_data_schema`: returns `DATA_DIRECTORY_GUIDE.md` content as `text/markdown`
- `safe_write_yaml` helper enforces YAML validity, `.yaml`/`.yml` extension whitelist, and atomic `os.replace()` write
- All STRIDE mitigations from the plan's threat model implemented: T-23-03-01 (path traversal), T-23-03-02 (yaml.safe_load), T-23-03-03 (atomic write), T-23-03-05 (SSE broadcast isolation)
- `core/tests/test_gm_api.py` defines behavioral contract: 4 passing tests + 1 skipped (writable DATA_DIR guard)
- URL routing added to `core/urls.py` with correct `<path:filepath>` converter (not `<str:>`) and correct route ordering (list before file)
- `core/views/__init__.py` barrel export updated

## Task Commits

Each task was committed atomically:

1. **Task 1: Create core/tests/test_gm_api.py with behavioral test stubs** — `881e435` (test)
2. **Task 2: Create core/views/gm_data.py with four GM data API views** — `06cf6c6` (feat)
3. **Task 3: Wire new views into __init__.py barrel export and core/urls.py routing** — `14c5f49` (feat)

## Files Created/Modified

- `core/views/gm_data.py` — Four view functions + `safe_write_yaml` helper (225 lines)
- `core/tests/__init__.py` — Package init (empty)
- `core/tests/test_gm_api.py` — `GmDataApiTests` with 5 behavioral test methods
- `core/views/__init__.py` — Added `from .gm_data import (...)` barrel export block
- `core/urls.py` — Added 4 new URL patterns in the `api/gm/` group

## Decisions Made

- Used `os.replace()` for atomic write (not `shutil.move()` or direct file open) — POSIX-atomic rename; readers never see a partial file even if the process crashes mid-write
- Path traversal check on all endpoints (including GET list and GET file) — prevents directory enumeration outside DATA_DIR even without write intent
- `test_write_file_valid_yaml` decorated with `@unittest.skip("requires writable DATA_DIR")` — the test env DATA_DIR is the project's `data/` directory; writing test files there would leave artifacts in git

## Deviations from Plan

**1. [Rule 2 - Missing Critical Functionality] Installed whitenoise in dev venv to unblock tests**
- **Found during:** Task 3 verification
- **Issue:** `whitenoise` was added to `requirements.txt` in Plan 01 but not installed in the dev `.venv`; the Django test client's middleware loading failed with `ModuleNotFoundError: No module named 'whitenoise'`
- **Fix:** `pip install whitenoise==6.12.0` in the dev venv — enables test suite to run without changing any project files
- **Files modified:** None (venv-only change; `requirements.txt` already had the dependency from Plan 01)

## Known Stubs

None — all four view functions are fully implemented and wired to live data sources. No hardcoded empty responses, no placeholder text.

## Threat Surface Scan

All security-relevant surfaces are covered by the plan's threat model (T-23-03-01 through T-23-03-05). No new surfaces introduced beyond what the plan specified. The four endpoints are deliberately unauthenticated per D-09 (trust-network model); this is documented in the `api_gm_data_file` docstring.

## Self-Check

Files created:
- `core/views/gm_data.py` — exists
- `core/tests/test_gm_api.py` — exists
- `core/tests/__init__.py` — exists

Files modified:
- `core/views/__init__.py` — updated with gm_data barrel export
- `core/urls.py` — updated with 4 new routes

Commits:
- `881e435` — test(23-03): add GM data API behavioral test stubs
- `06cf6c6` — feat(23-03): implement GM data API views in core/views/gm_data.py
- `14c5f49` — feat(23-03): wire GM data views into barrel export and URL routing

## Self-Check: PASSED

All files exist, all commits present, `python manage.py check` exits 0, all four URL names resolve, all tests pass (4 pass, 1 skipped).
