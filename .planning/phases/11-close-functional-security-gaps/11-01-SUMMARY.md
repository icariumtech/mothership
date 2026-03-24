---
phase: 11-close-functional-security-gaps
plan: "01"
subsystem: backend-security, gm-console, encounter-view
tags: [security, encounter, portrait-overlay, ship-location, initial-data]
dependency_graph:
  requires: []
  provides: [STAT-06, PORT-03, SHIP-01, gm-console-no-flash]
  affects: [terminal/views.py, gm_console_react.html, EncounterView.tsx]
tech_stack:
  added: []
  patterns: [django-login_required, INITIAL_DATA-injection, npco-portrait-overlay]
key_files:
  modified:
    - terminal/views.py
    - terminal/templates/terminal/gm_console_react.html
    - src/components/gm/views/EncounterView.tsx
decisions:
  - "[Phase 11-01]: @login_required added to api_ship_update_integrity matching companion endpoint pattern at api_ship_toggle_system"
  - "[Phase 11-01]: gm_console_react view loads ship_status_json matching display_view_react DataLoader pattern"
  - "[Phase 11-01]: NPCPortraitOverlay rendered as sibling to __map and __right divs — outside transform/will-change elements for correct fixed positioning"
  - "[Phase 11-01]: handleSetShipLocation uses messageApi.success/error feedback matching all other GM action handlers"
metrics:
  duration_seconds: 228
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_modified: 3
---

# Phase 11 Plan 01: Close Functional and Security Gaps Summary

Four surgical changes closing gaps found in the v1.0 milestone audit: security decorator, no-flash ship data, portrait overlay in GM encounter view, and Set Ship Here in the encounter locations panel.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Backend security fix + INITIAL_DATA injection | 06159d3 | terminal/views.py, gm_console_react.html |
| 2 | EncounterView NPCPortraitOverlay + Set Ship Here prop | 30c824f | src/components/gm/views/EncounterView.tsx |

## Changes Made

### Task 1: Backend security fix + INITIAL_DATA injection

**Security fix (STAT-06):** Added `@login_required` decorator to `api_ship_update_integrity` in `terminal/views.py`. The decorator was missing despite being present on all companion endpoints (`api_ship_toggle_system`, etc.). The function now requires authentication before accepting POST requests to update hull/armor values.

**INITIAL_DATA injection (cosmetic flash fix):** Updated `gm_console_react` view to load ship status via `DataLoader` and pass `ship_status_json` as template context — identical pattern to `display_view_react`. Added `<script>window.INITIAL_DATA = { shipStatus: ... }</script>` block to `gm_console_react.html` between the root div and the bundle script tags. `GMConsole.tsx` already reads `window.INITIAL_DATA?.shipStatus` on line 28; no frontend change needed.

### Task 2: EncounterView NPCPortraitOverlay + Set Ship Here prop

**NPCPortraitOverlay (PORT-03):** Imported `NPCPortraitOverlay` from `@/components/domain/encounter/NPCPortraitOverlay` and added conditional render as a sibling to `gm-encounter-view__map` and `gm-encounter-view__right` divs. The overlay uses `position: fixed` internally, so placement outside any transform element is required for correct layering.

**Set Ship Here (SHIP-01):** Imported `gmConsoleApi` and added `handleSetShipLocation` callback using `messageApi` for success/error feedback. Passed as `onSetShipLocation` prop to `LocationTreePanel` — `LocationTreePanel` already accepts this optional prop and renders the "Set Ship Here" context menu item only when the prop is provided.

## Deviations from Plan

None — plan executed exactly as written. All four changes were 1-8 line surgical edits using established patterns.

## Verification Results

- Python syntax check: PASSED
- TypeScript typecheck: PASSED (exit code 0)
- Production build: PASSED (1m 33s)
- `@login_required` on `api_ship_update_integrity`: VERIFIED
- `NPCPortraitOverlay` in EncounterView.tsx: 2 matches (import + JSX)
- `onSetShipLocation` in EncounterView.tsx: verified (prop + callback)
- `window.INITIAL_DATA` in gm_console_react.html: VERIFIED

## Self-Check: PASSED

Files verified:
- terminal/views.py: modified, syntax clean
- terminal/templates/terminal/gm_console_react.html: INITIAL_DATA block present
- src/components/gm/views/EncounterView.tsx: NPCPortraitOverlay + handleSetShipLocation + prop present

Commits verified:
- 06159d3: Task 1 — security fix + INITIAL_DATA
- 30c824f: Task 2 — EncounterView portrait overlay + Set Ship Here
