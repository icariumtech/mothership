---
phase: 05-real-time-push-architecture
plan: "01"
subsystem: api
tags: [sse, server-sent-events, django, streaming, in-memory, pub-sub, threading]

# Dependency graph
requires: []
provides:
  - "Thread-safe in-memory ActiveView singleton store (terminal/active_view_store.py)"
  - "SSE pub/sub broadcaster with per-listener queues (terminal/sse_broadcaster.py)"
  - "GET /api/active-view/stream/ SSE endpoint streaming initial state + changes"
  - "build_active_view_payload() helper that both REST and SSE endpoints share"
  - "Django migration 0017 dropping the ActiveView SQLite table"
affects: [05-02, frontend-sse-client, views-write-paths]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level singleton pattern for in-memory state (threading.Lock)"
    - "Queue-per-listener pub/sub for SSE fan-out (queue.Queue maxsize=5)"
    - "StreamingHttpResponse with generator function for Django SSE"
    - "format_sse() wraps data with named event type so es.addEventListener fires correctly"
    - "build_active_view_payload() as single shared payload builder for REST and SSE"

key-files:
  created:
    - terminal/active_view_store.py
    - terminal/sse_broadcaster.py
    - terminal/migrations/0017_delete_activeview.py
  modified:
    - terminal/models.py
    - terminal/views.py
    - terminal/urls.py
    - terminal/admin.py

key-decisions:
  - "In-memory state store replaces SQLite ActiveView singleton — no DB roundtrip on every push"
  - "Queue-per-listener fan-out with maxsize=5 and dead-queue eviction prevents memory leaks"
  - "SSE uses named event 'activeview' so es.addEventListener('activeview', ...) fires (not onmessage)"
  - "build_active_view_payload() shared between REST GET and SSE initial-event for consistency"
  - "Keepalive comments (': keepalive\\n\\n') sent every 30s on queue.Empty to prevent proxy timeouts"
  - "get_charon_location_path() made dict-aware (supports both dict and ORM object) for mixed-period compatibility"
  - "ActiveView admin registration removed from admin.py since model no longer exists"
  - "Write-path functions (api_switch_view etc.) temporarily use dict from get_state() — Plan 02 adds update_state() + broadcaster.announce()"

patterns-established:
  - "SSE Pattern: StreamingHttpResponse(generator) with Cache-Control: no-cache + X-Accel-Buffering: no"
  - "Store Pattern: module-level _state dict + threading.Lock in get_state()/update_state() — one instance per process"
  - "Broadcaster Pattern: listen() returns queue, announce() fans out, unlisten() on finally block"

requirements-completed: [RTMA-01, RTMA-02, RTMA-03, RTMA-04]

# Metrics
duration: 10min
completed: 2026-02-22
---

# Phase 5 Plan 01: Real-Time Push Architecture - Server SSE Infrastructure Summary

**Thread-safe in-memory ActiveView store plus SSE pub/sub broadcaster with streaming endpoint at /api/active-view/stream/, replacing the SQLite singleton polling model**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-21T23:59:35Z
- **Completed:** 2026-02-22T00:09:01Z
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified, 1 migration created)

## Accomplishments
- Thread-safe `active_view_store.py` singleton with `get_state()` and `update_state()` replacing SQLite ActiveView row
- `sse_broadcaster.py` with `MessageAnnouncer` pub/sub — per-listener queues with dead-queue eviction on queue.Full
- Migration 0017 drops the `terminal_activeview` table; Message table and SQLite db file retained
- `build_active_view_payload(state: dict)` helper shared by both REST (`/api/active-view/`) and SSE (`/api/active-view/stream/`) endpoints
- SSE stream delivers full initial state on connect then pushes changes via named `activeview` events with 30s keepalive

## Task Commits

Each task was committed atomically:

1. **Task 1: Create active_view_store.py and sse_broadcaster.py** - `dd5ce10` (feat)
2. **Task 2: Remove ActiveView model, create migration, add SSE endpoint to views/urls** - `e210234` (feat)

## Files Created/Modified
- `terminal/active_view_store.py` - Thread-safe in-memory state store with get_state()/update_state()
- `terminal/sse_broadcaster.py` - MessageAnnouncer pub/sub with format_sse() helper; module-level singleton
- `terminal/migrations/0017_delete_activeview.py` - Drops ActiveView table
- `terminal/models.py` - ActiveView class removed; Message class retained
- `terminal/views.py` - Added build_active_view_payload, api_active_view_stream; updated get_active_view_json, display_view_react, read-path endpoints to use get_state() with dict access
- `terminal/urls.py` - Added /api/active-view/stream/ route before /api/active-view/
- `terminal/admin.py` - Removed ActiveViewAdmin registration (model no longer exists)

## Decisions Made
- Named SSE events ('activeview') chosen over anonymous events so frontend uses `es.addEventListener('activeview', ...)` not `es.onmessage`; this is more explicit and avoids accidental interception of keepalive comments
- `build_active_view_payload()` inlines the full multi-deck encounter map loading logic (not stubbed) to match the existing REST endpoint behavior exactly
- `get_charon_location_path()` updated to accept both dict and ORM object to support the mixed state during Plan 01/02 transition period

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed admin.py importing deleted ActiveView model**
- **Found during:** Task 2 (migration and model cleanup)
- **Issue:** terminal/admin.py imported `ActiveView` from models and registered `ActiveViewAdmin`, which would cause an ImportError at Django startup after the model was removed
- **Fix:** Removed the ActiveView import and ActiveViewAdmin class from admin.py; Message model admin registration retained
- **Files modified:** terminal/admin.py
- **Verification:** `python manage.py check` passes with no errors
- **Committed in:** e210234 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Admin fix was required for correctness — Django check would fail without it. No scope creep.

## Issues Encountered
- Write-path functions (api_switch_view, api_show_terminal, etc.) still use ORM attribute-access patterns (e.g., `active_view.view_type = x`) that will fail at runtime since `get_state()` now returns a dict. This is expected and explicitly scoped to Plan 02 which replaces these with `update_state(**kwargs)` calls and adds `broadcaster.announce()` after each write.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SSE server infrastructure complete — Plan 02 can now wire broadcaster.announce() into write endpoints
- `build_active_view_payload()` is the single source of truth for payload shape, reducing risk of REST/SSE divergence
- Write-path endpoints are temporarily non-functional at runtime (attribute access on dict); Plan 02 resolves this completely

---
*Phase: 05-real-time-push-architecture*
*Completed: 2026-02-22*
