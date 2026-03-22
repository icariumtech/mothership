---
phase: 10-player-ship-map-view
plan: "01"
subsystem: backend-data-layer
tags: [yaml, data-loader, api, typescript, ship-map]
dependency_graph:
  requires: []
  provides: [ship-deck-yaml, ship-location-api, ship-deck-sse-payload, ship-deck-types]
  affects: [terminal/data_loader.py, terminal/views.py, terminal/urls.py, src/types/gmConsole.ts]
tech_stack:
  added: []
  patterns: [campaign-ship-special-case, sse-payload-extension, csrf-exempt-post-endpoint]
key_files:
  created:
    - data/campaign/ship/location.yaml
    - data/campaign/ship/map/manifest.yaml
    - data/campaign/ship/map/morrigan_main.yaml
  modified:
    - data/campaign/ship.yaml
    - terminal/data_loader.py
    - terminal/views.py
    - terminal/urls.py
    - src/types/gmConsole.ts
decisions:
  - "campaign_ship slug resolved via early-return in find_location_by_slug (not galaxy tree search)"
  - "BRIDGE payload includes ship_deck_data via load_map() on campaign/ship/ directory"
  - "save_ship_location() uses yaml.dump with default_flow_style=False to preserve human-readable format"
  - "Morrigan deck uses 6 polygon rooms with explicit x/y/angle door positions (unit_size: 30)"
metrics:
  duration: 512s
  completed_date: "2026-03-22"
  tasks_completed: 2
  files_modified: 9
---

# Phase 10 Plan 01: Data Layer + Backend API Summary

**One-liner:** Morrigan deck YAML map (6 polygon rooms) + DataLoader ship extensions + BRIDGE SSE payload + POST ship-location endpoint + ShipDeckData TypeScript types.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create Morrigan YAML map files + add location_slug to ship.yaml | `715accf` | data/campaign/ship.yaml, ship/location.yaml, ship/map/manifest.yaml, ship/map/morrigan_main.yaml |
| 2 | Extend DataLoader + BRIDGE payload + ship location API + TypeScript types | `9c055e2` | terminal/data_loader.py, terminal/views.py, terminal/urls.py, src/types/gmConsole.ts |

## What Was Built

### Task 1: Morrigan YAML Map Files

Created the complete data directory for the campaign ship:

- `data/campaign/ship.yaml` — added `location_slug: "tau-ceti/tau-ceti-f"` top-level field
- `data/campaign/ship/location.yaml` — ship location metadata (name, type: ship, description)
- `data/campaign/ship/map/manifest.yaml` — single-deck manifest with morrigan_main as default deck
- `data/campaign/ship/map/morrigan_main.yaml` — 6 polygon rooms with explicit door positions:
  - BRIDGE (forward, 6x5 cells)
  - MEDICAL BAY (port-forward, 4x3 cells)
  - CARGO BAY (midship, 10x6 cells — largest room)
  - AIRLOCK (starboard, 3x6 cells)
  - CREW QUARTERS (port-aft, 5x5 cells)
  - ENGINEERING (aft-center, 5x5 cells)
  - All doors: status CLOSED, type standard, explicit x/y/angle format

### Task 2: Backend Extensions + TypeScript Types

**DataLoader extensions:**
- `find_location_by_slug` — campaign_ship early-return resolves to `data/campaign/ship/` via `load_location_recursive`
- `save_ship_location(location_slug)` — reads ship.yaml, updates location_slug, writes back

**views.py:**
- `build_active_view_payload` — BRIDGE branch adds `ship_deck_data` and `ship_deck_total_decks` to SSE payload
- `api_set_ship_location` — @csrf_exempt POST endpoint that writes location_slug and broadcasts ship SSE

**urls.py:**
- Added `path('api/gm/ship/set-location/', views.api_set_ship_location, ...)`

**TypeScript:**
- `ShipDeckData` interface exported from gmConsole.ts
- `ActiveView.ship_deck_data?: ShipDeckData` and `ActiveView.ship_deck_total_decks?: number` fields added

## Decisions Made

1. **campaign_ship resolver uses early-return** — `find_location_by_slug('campaign_ship')` short-circuits before the galaxy tree search and delegates to `load_location_recursive(data/campaign/ship/)`. This keeps the galaxy tree clean and avoids introducing a fake slug into the hierarchy.

2. **BRIDGE payload is eager-loaded** — `build_active_view_payload` loads the ship map on every BRIDGE SSE event rather than requiring a separate API call from the frontend. This matches the ENCOUNTER view pattern and lets wave 2/3 components render immediately from the SSE payload.

3. **save_ship_location preserves YAML structure** — reads existing ship.yaml, merges the location_slug field, writes back with `default_flow_style=False` to keep human-readable format.

4. **Morrigan room coordinates share exact edges** — polygon vertices align at shared wall boundaries (e.g. BRIDGE bottom edge y=5 == CARGO BAY top edge y=5) so the wall-segment algorithm draws contiguous walls correctly.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `python3 -c "import yaml; d=yaml.safe_load(open('data/campaign/ship.yaml')); assert 'location_slug' in d"` — passed
- `python3 -c "import yaml; d=yaml.safe_load(open('data/campaign/ship/map/morrigan_main.yaml')); assert len(d['rooms']) >= 4"` — passed (6 rooms)
- `npm run typecheck` — passed (0 errors)
- `npm run build` — passed (clean build, 1m 7s)

## Self-Check: PASSED

- FOUND: data/campaign/ship/location.yaml
- FOUND: data/campaign/ship/map/manifest.yaml
- FOUND: data/campaign/ship/map/morrigan_main.yaml
- FOUND: .planning/phases/10-player-ship-map-view/10-01-SUMMARY.md
- FOUND: commit 715accf (Task 1)
- FOUND: commit 9c055e2 (Task 2)
