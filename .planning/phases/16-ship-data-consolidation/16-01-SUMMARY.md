---
phase: "16-ship-data-consolidation"
plan: "16-01"
subsystem: "data/backend"
tags: [refactor, data-layout, yaml, ship, data_loader, views]
dependency_graph:
  requires: ["15-01"]
  provides: ["data/campaign/ship/ship.yaml", "data/campaign/ship/deckplan.yaml", "DataLoader.load_deckplan", "DataLoader.SHIP_YAML_PATH"]
  affects: ["terminal/data_loader.py", "terminal/views.py", "data/campaign/ship/"]
tech_stack:
  added: []
  patterns: ["SHIP_YAML_PATH class constant for single-point path management", "load_deckplan() returns {decks, hull, total_decks}", "views.py transforms deckplan into MultiDeckMapData for frontend compatibility"]
key_files:
  created:
    - data/campaign/ship/ship.yaml
    - data/campaign/ship/deckplan.yaml
  modified:
    - terminal/data_loader.py
    - terminal/views.py
  deleted:
    - data/campaign/ship.yaml
    - data/campaign/ship/location.yaml
    - data/campaign/ship/map/manifest.yaml
    - data/campaign/ship/map/main_deck.yaml
decisions:
  - "Transformed deckplan output in views.py to MultiDeckMapData shape — avoids breaking frontend type system (5 files) for a pure backend refactor"
  - "load_deckplan() returns clean {decks, hull, total_decks} — translation to old shape happens in build_active_view_payload where context is available"
  - "ship.yaml has no ship: wrapper — file was already flat structure from Phase 14 refactor; plan mention of wrapper was from older state"
  - "find_location_by_slug campaign fallback checks ship.yaml (not location.yaml) as sentinel for ship directory"
metrics:
  duration_seconds: 753
  completed_date: "2026-04-18"
  tasks_completed: 7
  files_changed: 6
---

# Phase 16 Plan 01: Ship Data Consolidation Summary

Consolidated USCSS Morrigan's campaign data from 4 files into 2, with a SHIP_YAML_PATH constant centralizing the path and a new load_deckplan() method replacing the manifest+file-reference pattern for the ship directory.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Move ship.yaml into ship/ directory | 13a3da9 | data/campaign/ship.yaml → ship/ship.yaml |
| 2 | Create deckplan.yaml (merge manifest + main_deck) | 7181901 | data/campaign/ship/deckplan.yaml |
| 3 | Delete redundant files + map/ directory | 76812b8 | location.yaml, map/manifest.yaml, map/main_deck.yaml |
| 4 | Add SHIP_YAML_PATH constant, update all save_ship_* | 70c1116 | terminal/data_loader.py |
| 5 | Add load_deckplan() method | 0ceb54c | terminal/data_loader.py |
| 6 | Update find_location_by_slug() ship fallback | 978fe83 | terminal/data_loader.py |
| 7 | Update views.py to use load_deckplan() | dd50d3b | terminal/views.py |

## Verification

- `data/campaign/ship/ship.yaml` exists; old `data/campaign/ship.yaml` deleted
- `data/campaign/ship/deckplan.yaml` exists with hull: at top, decks: list with rooms embedded
- `data/campaign/ship/map/` directory removed (was empty after Task 3)
- `data/campaign/ship/location.yaml` deleted
- `data/campaign/ship/map/manifest.yaml` deleted
- `SHIP_YAML_PATH = 'campaign/ship/ship.yaml'` at DataLoader class level
- All 10 references to ship file path use `self.SHIP_YAML_PATH` (grep confirmed: 0 old hardcoded paths)
- `find_location_by_slug()` checks `ship.yaml` presence for campaign ship directory
- `views.py` uses `load_deckplan(ship_dir)` and transforms to MultiDeckMapData shape
- Python syntax check passed for both modified files

## Deviations from Plan

### Auto-fixed / Design Decisions

**1. [Design Decision] Frontend shape compatibility in views.py**
- **Found during:** Task 7
- **Issue:** `load_deckplan()` returns `{decks, hull, total_decks}` but `EncounterMapDisplay` and `ShipDeckData` TypeScript type expect `MultiDeckMapData` shape (`is_multi_deck, manifest, current_deck, current_deck_id, slug`). Changing the frontend would touch 5+ files (types/encounterMap.ts, types/gmConsole.ts, BridgeView.tsx x2, StatusSection.tsx, EncounterMapDisplay.tsx).
- **Fix:** `build_active_view_payload()` in views.py transforms the deckplan response into `MultiDeckMapData` shape. `load_deckplan()` stays clean (`{decks, hull, total_decks}`); the translation is the view layer's responsibility.
- **Files modified:** terminal/views.py

**2. [Observation] No ship: wrapper in ship.yaml**
- **Found during:** Task 1
- **Issue:** Plan mentioned preserving the `ship:` wrapper but the file (from Phase 14 refactor) has no wrapper — data is flat at top level. DataLoader methods access top-level keys (`systems`, `resources`, etc.) directly.
- **Fix:** Moved file as-is (flat structure). No wrapper added — code is consistent with flat format.

## Known Stubs

None — all data wired through to existing frontend consumers.

## Threat Flags

None — this is a pure file reorganization and backend refactor with no new network endpoints or trust boundary changes.

## Self-Check: PASSED

- data/campaign/ship/ship.yaml: FOUND
- data/campaign/ship/deckplan.yaml: FOUND
- data/campaign/ship/map/: GONE (confirmed)
- Commits 13a3da9, 7181901, 76812b8, 70c1116, 0ceb54c, 978fe83, dd50d3b: all in git log
- grep "campaign/ship.yaml\\b" terminal/data_loader.py: 0 results (only SHIP_YAML_PATH definition and docstrings)
