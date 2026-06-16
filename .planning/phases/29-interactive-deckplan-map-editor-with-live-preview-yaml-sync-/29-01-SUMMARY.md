---
phase: 29-interactive-deckplan-map-editor-with-live-preview-yaml-sync-
plan: "01"
subsystem: backend/data
tags: [deckplan, legacy-removal, migration, regression-test, schema]
dependency_graph:
  requires: []
  provides: [deckplan-only-loader, somnus-deckplan-yaml]
  affects: [core/data_loader.py, core/views/encounter.py, core/views/navigation.py, core/payload_builder.py]
tech_stack:
  added: []
  patterns: [deckplan-primary-load, has_map-via-deckplan]
key_files:
  created:
    - data/ships/somnus/deckplan.yaml
    - core/tests/test_data_loader.py
  modified:
    - core/data_loader.py
    - core/views/encounter.py
    - core/views/navigation.py
    - docs/schemas/schema-encounters.md
  deleted:
    - data/ships/somnus/map/manifest.yaml
    - data/ships/somnus/map/main_deck.yaml
decisions:
  - "deckplan.yaml is the sole canonical map format; legacy map/ directory loaders deleted"
  - "has_map display flag now sourced from len(load_deckplan(dir)['decks']) > 0 in both _inject_ship and load_location_recursive"
  - "api_encounter_map_data and api_encounter_all_decks restructured to deckplan-primary (no location.get('map') gate)"
  - "navigation.py room-visibility init rewrites to iterate load_deckplan()['decks'] with rooms inline"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-16"
  tasks: 3
  files: 7
---

# Phase 29 Plan 01: Consolidate on deckplan.yaml — Legacy Format Removal Summary

**One-liner:** Migrated somnus to single-file deckplan.yaml, deleted legacy map/ loaders (load_map/load_encounter_manifest/load_deck_map), restructured encounter/navigation views to deckplan-primary, added regression test and schema doc update.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Migrate somnus to deckplan.yaml, delete map/ dir | 2fc6270 | data/ships/somnus/deckplan.yaml (created), map/ (deleted) |
| 2 | Remove legacy loaders, restructure views to deckplan-primary | 1d8a3df | core/data_loader.py, core/views/encounter.py, core/views/navigation.py |
| 3 | Schema doc update + Django regression test (EDIT-01) | b663d89 | core/tests/test_data_loader.py, docs/schemas/schema-encounters.md |

## Verification Results

- `python manage.py test core.tests` — 63 tests OK, 3 skipped (all pre-existing expected skips)
- `python manage.py test core.tests.test_data_loader` — 8 tests OK
- `grep -rn "def load_map|def load_encounter_manifest|def load_deck_map" core/` — no matches
- `grep -rn "load_deck_map" core/views/ core/payload_builder.py` — no matches
- `data/ships/somnus/deckplan.yaml` parses valid: 15 rooms, 18 doors, hull polygon, main_deck id
- `data/ships/somnus/map/` directory deleted
- `has_map` flag preserved in both `_inject_ship` and `load_location_recursive` via deckplan check
- `core/views/encounter.py` — deckplan is primary path in both `api_encounter_map_data` and `api_encounter_all_decks`
- `core/views/navigation.py` — room-visibility init uses `load_deckplan()['decks']`
- `docs/schemas/schema-encounters.md` — legacy format documented as removed (P2 pitfall added)

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **`has_map` sourced from deckplan** — Both `_inject_ship` and `load_location_recursive` now compute `has_map = len(self.load_deckplan(dir)['decks']) > 0`. The `loc['map']` and `loc['maps']` blob fields were removed entirely; they were only needed by the legacy encounter views which now call `load_deckplan()` directly.

2. **Deckplan-primary restructure (not just fallback delete)** — Both encounter endpoints were restructured so deckplan is the first (and only) path, returning 404 when no `deckplan.yaml` exists. The old logic checked `location.get('map')` first; with the blob removed that check was always falsy, making the deckplan block the effective primary. Restructuring to explicit deckplan-first improves readability per the plan's instruction.

3. **navigation.py init — single flat list comprehension** — The rewrite uses `[r['id'] for deck in decks for r in deck.get('rooms', [])]`. Each deck dict in `load_deckplan()` already has rooms inline — no per-deck file load needed. This eliminates the old multi-step manifest → `load_deck_map()` per deck loop.

4. **Schema doc pitfall P2** — Added `P2` pitfall note about the removed `map/` directory format alongside the existing `P1`, per the schema-doc style convention. The MCP Path Conventions section now explicitly states the legacy format was removed in Phase 29.

## Known Stubs

None — this plan is a removal/migration with no UI stubs.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries. The `yaml.safe_load` guard in `load_deckplan` was already in place.

## Self-Check: PASSED

- `data/ships/somnus/deckplan.yaml` — EXISTS
- `core/tests/test_data_loader.py` — EXISTS
- `docs/schemas/schema-encounters.md` — MODIFIED (deckplan.yaml count: 9)
- Commit 2fc6270 — FOUND
- Commit 1d8a3df — FOUND
- Commit b663d89 — FOUND
- No unintended file deletions in final commit
