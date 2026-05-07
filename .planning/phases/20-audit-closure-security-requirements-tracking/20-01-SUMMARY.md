---
phase: 20-audit-closure-security-requirements-tracking
plan: "01"
subsystem: security
tags: [security, auth, api, typescript, django]
dependency_graph:
  requires: []
  provides: [api_set_ship_location_auth_closure, encounterApi_surface_reduction]
  affects: [terminal/views.py, src/services/encounterApi.ts]
tech_stack:
  added: []
  patterns: [login_required_decorator, intentionally_unauthenticated_docstring, void_ts_unused_retention]
key_files:
  created: []
  modified:
    - terminal/views.py
    - src/services/encounterApi.ts
decisions:
  - "@csrf_exempt retained on api_set_ship_location alongside @login_required — Axios may omit CSRF token; @login_required is the actual security control and runs first (innermost decorator)"
  - "api_bridge_selection intentionally left without @login_required — player terminal is unauthenticated by design; only writes ephemeral in-memory state"
  - "getRoomVisibility function retained in encounterApi.ts (not removed) per D-03 scope boundary; void reference added to satisfy TS6133 noUnusedLocals rule"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-07T19:21:13Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 20 Plan 01: Audit Closure — Security Gap and Export Surface Summary

Two surgical source-code edits that close the v1.0 audit gaps: `@login_required` added to the GM ship-location write endpoint (T-20-01), `api_bridge_selection` documented as intentionally unauthenticated (T-20-02), and the `encounterApi` export object trimmed of two unused function references (T-20-03 / D-03).

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Add @login_required to api_set_ship_location; document api_bridge_selection as intentionally public | 42cc16a | terminal/views.py |
| 2 | Remove getRoomVisibility/setRoomVisibility from encounterApi export object | 8767c30 | src/services/encounterApi.ts |

## Changes Made

### Task 1: terminal/views.py

**`api_set_ship_location`** (line 706):
- Added `@login_required` decorator immediately above `def`, below `@csrf_exempt`
- Unauthenticated POST requests now redirect to `/login/` before the handler writes to `ship.yaml` or broadcasts SSE
- Mirrors Phase 11 pattern (`api_ship_update_integrity` at line 1898)
- Existing `from django.contrib.auth.decorators import login_required` import used (not duplicated)

**`api_bridge_selection`** (line 673):
- No decorator change (`@csrf_exempt` only — intentional)
- Docstring expanded with `INTENTIONALLY UNAUTHENTICATED` marker and rationale
- Documents why `@login_required` would break player terminal navigation
- Notes ephemeral-state-only write (no persistent side effect) as the accepted-risk basis

### Task 2: src/services/encounterApi.ts

- Removed `getRoomVisibility` and `setRoomVisibility` from `export const encounterApi = { ... }` object (17 → 15 entries)
- Function definitions retained (lines 107, 115) — internal callers `showAllRooms` (line 128) and `hideAllRooms` (line 137) continue to use `setRoomVisibility` directly
- `getRoomVisibility` has no callers; `void getRoomVisibility;` added after the export type line to satisfy `noUnusedLocals` (TS6133) without removing the function

## Verification Results

All phase-level checks pass from worktree:

| Check | Result |
|-------|--------|
| `npm run typecheck` | Exit 0 |
| Python AST parse of terminal/views.py | Exit 0 |
| `@login_required` above `api_set_ship_location` | Present |
| No `@login_required` above `api_bridge_selection` | Confirmed |
| `INTENTIONALLY UNAUTHENTICATED` count in views.py | 1 |
| `getRoomVisibility` in export object | 0 (removed) |
| `setRoomVisibility` in export object | 0 (removed) |
| `setRoomVisibility` function definition | 1 (intact) |
| `return setRoomVisibility(visibility)` callers | 2 (intact) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript TS6133 noUnusedLocals on getRoomVisibility**
- **Found during:** Task 2, verification
- **Issue:** After removing the export entries, `getRoomVisibility` had no callers, triggering TS6133 "declared but never read" — `npm run typecheck` failed
- **Fix:** Added `void getRoomVisibility;` comment block after `export type { DeckWithRooms, AllDecksResponse };` — standard TypeScript pattern for intentionally-retained-but-unused local symbols. Also updated the function's JSDoc to document the retention rationale.
- **Files modified:** `src/services/encounterApi.ts`
- **Commit:** 8767c30 (same task commit — fix included in original commit)

## Known Stubs

None.

## Threat Flags

No new security-relevant surface introduced. The changes only reduce surface (export removal, access control addition).

## Self-Check: PASSED

- `terminal/views.py` modified and committed: 42cc16a
- `src/services/encounterApi.ts` modified and committed: 8767c30
- Both commits exist on branch `worktree-agent-a742a8948c2ebe981`
- `npm run typecheck` exits 0 (verified post-commit)
- Python AST parse exits 0 (verified post-commit)
