---
phase: 21-encounter-geometry-deepening
plan: "04"
subsystem: encounter-door-model
tags: [doors, data-layer, migration, yaml, svg-tool, types, backend]
dependency_graph:
  requires: [21-02, 21-03]
  provides: [canonical-door-shape-end-to-end, legacy-door-path-removed]
  affects: [EncounterMapRenderer, doorNormalizer, svg_to_map, data_loader, all-map-YAMLs]
tech_stack:
  added: []
  patterns:
    - "Top-level deck-level doors: array with B-rel {rooms, along} as primary form"
    - "B-pos {rooms, position: {x, y, angle}} for multi-edge disambiguation"
    - "Migration script (tools/migrate_doors_to_canonical.py) as canonical reference for legacy→new id mapping"
    - "Legacy id preservation: migration emits ${room.id}_door_${index} ids so persisted door-status state survives transparently"
key_files:
  created:
    - tools/migrate_doors_to_canonical.py
    - src/components/domain/encounter/doors/__tests__/migratedMaps.test.ts
    - src/components/domain/encounter/doors/__tests__/corridorDoorVisibility.test.ts
  modified:
    - tools/svg_to_map.py
    - data/galaxy/tau-ceti/somnus/map/main_deck.yaml
    - data/galaxy/kepler-442/kepler-442b/base_alpha/deckplan.yaml
    - data/ships/patrol_gunboat/deckplan.yaml
    - data/campaign/ship/deckplan.yaml
    - src/components/domain/encounter/doors/doorNormalizer.ts
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/domain/encounter/geometry/roomGeometry.ts
    - src/types/encounterMap.ts
    - terminal/views.py
    - terminal/active_view_store.py
    - DATA_DIRECTORY_GUIDE.md
decisions:
  - "Door-status state migration: chose legacy id preservation (option a) over invalidation (option b) — migration script emits ${room.id}_door_${index} ids verbatim, canonical Door.id equals legacy id, no DB migration required (door status is in-memory since migration 0017)"
  - "B-rel as default for svg_to_map.py; B-pos fallback only when room pair shares multiple disjoint edges (disambiguation requires explicit coordinates)"
  - "Backend remains pass-through for doors; normalization stays on the frontend — simpler, no Python port of doorNormalizer needed"
  - "doorNormalizer findAllSharedEdges returns ALL maximal runs (not just longest) so resolveBPos accepts doors on any shared edge of a multi-edge room pair"
metrics:
  duration: "~11 hours (across May 9-11, 2026)"
  completed: "2026-05-11"
  tasks_completed: 6
  tasks_planned: 6
  files_created: 3
  files_modified: 12
---

# Phase 21 Plan 04: Data Layer Migration to Canonical Door Shape Summary

Flipped the encounter door data layer end-to-end: svg_to_map.py, all production YAMLs, types, renderer, and door-status state now use the canonical top-level `doors:` array with B-rel `{rooms, along}` shape — the legacy nested-under-room path is fully removed.

## What Was Built

### Task 1 — svg_to_map.py emits B-rel canonical doors (commit `1f91921`)

`--detect-doors` now writes a top-level `doors:` block with `{rooms: [a, b], along: 0.5, type, status}` (B-rel) by default. When two areas share more than one disjoint edge, falls back to B-pos `{rooms, position: {x, y, angle}}` so distinct shared-edge midpoints stay unambiguous under doorNormalizer's resolution logic. Nested-under-room door output removed entirely; each shared room-pair is enumerated once via sorted-pair dedupe.

### Task 2 — YAML migration + doorNormalizer bug fix (commit `61687d3`)

`tools/migrate_doors_to_canonical.py`: one-shot Python script lifting 51 doors across 4 production maps from nested `room.doors[]` to deck-level `doors:` arrays. Mirrors the renderer's legacy `legacyDoorToGridPosition` logic for rect-room `wall+position` doors; preserves explicit `{x, y, angle}` for polygon/circle rooms; spatially resolves "other room" via cell-side probes. Emits B-rel when the room pair shares exactly one edge and the door projects cleanly onto it (perp < 0.05 cells); otherwise emits B-pos. Emits door `id` as `${room.id}_door_${index}` to preserve downstream state keys.

Maps migrated:
- `data/galaxy/tau-ceti/somnus/map/main_deck.yaml` — 18 doors
- `data/galaxy/kepler-442/kepler-442b/base_alpha/deckplan.yaml` — 5 doors
- `data/ships/patrol_gunboat/deckplan.yaml` — 14 doors
- `data/campaign/ship/deckplan.yaml` — 14 doors

`migratedMaps.test.ts`: loads every migrated YAML, runs `normalizeDoors()`, verifies no nested doors remain on rooms, all entries resolve cleanly. 5/5 map cases pass.

### Task 3 — Backend pass-through (commit `8699d57` / `ebbdf8f`)

`terminal/data_loader.py` was already pass-through; no changes needed. `terminal/views.py` `ship_deck_data` builder required a fix (see deviations) — now uses dict spread `{**default_deck, 'deck_id': ...}` so future deck-level fields auto-propagate.

### Task 4 — Legacy adapter removed; renderer consumes mapData.doors directly (commit `ae43a46`)

`EncounterMapRenderer.tsx`: `canonicalDoors` now reads `mapData.doors` directly. The `extractAuthoredDoorsFromRooms` import is gone.

`roomGeometry.ts`: removed `LegacyAuthoredDoor`, `extractAuthoredDoorsFromRooms`, `legacyDoorToGridPosition`, `legacyDoorAngleRad`, `legacyAngleDegToCanonical`, `polygonBoundaryFromCentroid` — 204 lines of dead code deleted.

`src/types/encounterMap.ts`: removed `DoorDef` interface, removed `GridRoom.doors?`, added `doors?: AuthoredDoor[]` to `GridEncounterMapData`. `WallSide` retained with a legacy marker (still useful as an authoring concept).

### Task 5 — Door-status state migration (commit `8699d57`)

Chose option (a): legacy id preservation. The migration script emitted every door's `id` field as `${room.id}_door_${index}`. The canonical `Door.id` now equals the legacy id verbatim, so the in-memory `encounter_door_status` dict continues to resolve transparently. `active_view_store.py` has a comment documenting the id-preservation contract. No DB migration required — door status is in-memory only since migration 0017 deleted the `ActiveView` model.

### Task 6 — End-to-end verification + DATA_DIRECTORY_GUIDE update (commit `e611b4b`)

`DATA_DIRECTORY_GUIDE.md` "Door definitions" section rewritten: describes the canonical top-level schema, both B-rel and B-pos forms, migration note pointing to the script and the id-preservation contract. Final gate results: vitest 137/137, tsc 0 errors, vite build succeeded (4101 modules).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] doorNormalizer resolveBPos accepted only longest shared-edge run**

- **Found during:** Task 2 — Patrol Gunboat map has rooms (`steerage` ↔ `corridor_3`) that share both a horizontal and a vertical edge (two disjoint runs). `findAllSharedEdges` returned only the longest, so `resolveBPos` rejected B-pos doors on the shorter run.
- **Fix:** `findAllSharedEdges` now returns every maximal run. `resolveBPos` accepts a door if its explicit `(x, y)` lies on ANY shared run. Overlap detection buckets B-pos doors by `(roomPair, runKey)` so doors on different shared edges of the same pair are not flagged as duplicates. B-rel behavior unchanged (longest-run, since relational form has no coordinate disambiguator).
- **Files modified:** `src/components/domain/encounter/doors/doorNormalizer.ts`
- **Commit:** `61687d3`

**2. [Rule 1 - Bug] bridge ship_deck_data silently dropped top-level deck doors**

- **Found during:** Post-merge verification / regression investigation
- **Issue:** `terminal/views.py` `ship_deck_data` builder hand-listed deck fields (`deck_id`, `name`, `unit_size`, `rooms`) instead of using dict spread. The new top-level `doors:` field added in plan 21-04 was silently omitted, so `shipDeckData.current_deck.doors` arrived as `undefined` at the renderer. `canonicalDoors` resolved to `[]`. Player bridge status panel ship schematic rendered no doors; corridor reveals surfaced nothing.
- **Fix:** Changed to `{**default_deck, 'deck_id': default_deck['id']}` so all deck fields including `doors:` propagate automatically.
- **Files modified:** `terminal/views.py`, `src/components/domain/encounter/EncounterMapRenderer.tsx` (removed triage logger), `.planning/phases/21-encounter-geometry-deepening/21-04-INTERVENTION.md`
- **Commit:** `ebbdf8f`

**3. [Rule 2 - Missing critical functionality] Regression guard for corridor-door visibility on player terminal**

- **Found during:** Root-cause investigation of bug #2 above
- **Issue:** The renderer's player-side door visibility filter (line 1356-1377) had never been unit-tested. Corridor-adjacent doors have two-sided visibility logic (door shows if EITHER endpoint room is revealed), which is subtle and breakable.
- **Fix:** Added `corridorDoorVisibility.test.ts` with 15 cases covering H1 (normalizer accepts corridor-shared door), H5 (filter passes when only corridor revealed), H5b (filter passes when only connected room revealed), H5c (filter rejects when both hidden), H6 (bulk check — all corridor-adjacent doors show when only corridor revealed). All 15 pass. Test stays as a permanent regression guard.
- **Files modified:** `src/components/domain/encounter/doors/__tests__/corridorDoorVisibility.test.ts`
- **Commit:** `ec7ddf7`

**4. [Rule 2 - Missing] Anomaly logger for corridor door reveal regression (since reverted)**

- **Found during:** Initial regression triage
- **Issue:** Temporary ANOMALY logger added to renderer to surface the bridge vs encounter view divergence. Reverted after root cause was identified (views.py hand-listed fields).
- **Commit added:** `b926bc9` — reverted in `ebbdf8f`

## Known Stubs

None — all maps fully wired, doors render correctly on both encounter view and bridge status panel.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries. `terminal/views.py` change is internal data shaping (no new API surface). YAML files are read-only data.

## Follow-ups Deferred to 21-05

- Room reveal cascade (`scheduleReveal`) lives inline in `EncounterMapRenderer.tsx` — plan 21-05 extracts it as a pure function and hook.

## Self-Check: PASSED

Key files exist:
- `tools/migrate_doors_to_canonical.py` — created
- `src/components/domain/encounter/doors/__tests__/migratedMaps.test.ts` — created
- `src/components/domain/encounter/doors/__tests__/corridorDoorVisibility.test.ts` — created
- `DATA_DIRECTORY_GUIDE.md` — updated

Commits present on branch:
- `1f91921` feat(21-04): svg_to_map.py emits top-level canonical doors
- `61687d3` chore(21-04): migrate all YAML maps to top-level canonical doors
- `ae43a46` refactor(21-04): drop legacy door adapter; renderer consumes top-level doors
- `8699d57` feat(21-04): migrate door-status state to canonical door ids
- `e611b4b` docs(21-04): document top-level doors schema in DATA_DIRECTORY_GUIDE
- `ec7ddf7` test(21-04): repro guard for corridor-room door visibility on player terminal
- `b926bc9` chore(21-04): anomaly logger for corridor door reveal regression (SINCE REVERTED)
- `ebbdf8f` fix(21-04): bridge ship_deck_data carries top-level doors after migration

Verification gates confirmed: vitest 137/137, tsc 0 errors, vite build clean, user-approved.
