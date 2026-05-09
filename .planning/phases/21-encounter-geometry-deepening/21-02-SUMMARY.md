---
phase: 21-encounter-geometry-deepening
plan: 02
subsystem: encounter-geometry
tags: [encounter-maps, doors, validation, typescript, vitest]

# Dependency graph
requires: []
provides:
  - "Canonical Door type (top-level): {id, x, y, angle, width, roomA, roomB|null, type, status}"
  - "AuthoredDoorRel — primary YAML form (rooms + along + width)"
  - "AuthoredDoorPos — position-override YAML form"
  - "DoorNormalizationError — typed validation error with authored input attached"
  - "doorNormalizer.normalizeDoor / normalizeDoors — validating loader from authored YAML to canonical Door"
affects:
  - 21-03-roomGeometry-mapView   # adopts canonical Door in renderer
  - 21-04-backend-yaml-migration # backend serializer + svg_to_map.py emit B-rel
  - encounter-map-rendering

# Tech tracking
tech-stack:
  added:
    - "vitest@1.6 (compatible with Node 18)"
    - "jsdom@24"
  patterns:
    - "Authored vs canonical model split: YAML/AI shapes flow through a typed normalizer that produces validated canonical types"
    - "Pure module testability — normalizer has zero React/DOM dependencies; all tests are fixture-driven"
    - "Domain-specific error classes carry the offending authored input for UI/log surfacing"

key-files:
  created:
    - "src/components/domain/encounter/doors/doorNormalizer.ts"
    - "src/components/domain/encounter/doors/__tests__/doorNormalizer.test.ts"
  modified:
    - "src/types/encounterMap.ts (additive: Door, AuthoredDoor*, DoorNormalizationError)"

key-decisions:
  - "Used local Pt/Seg geometry primitives in doorNormalizer rather than importing the parallel polygon2d module (plan 21-01) to keep waves independent and avoid merge collisions."
  - "When multiple disjoint shared edges exist between two rooms (e.g. an L-shaped pair touching on two sides), the normalizer picks the longest by total connected length. A future plan can expose an `edge` discriminator on the authored door for ambiguous cases."
  - "Circle rooms are approximated as 64-gons for door anchoring. Exact tangent placement is overkill for the use case; the existing renderer applies a similar approximation."
  - "Exterior doors (single-element rooms list) walk roomA's full exterior boundary by arc-length. `along ∈ [0, 1]` parameterizes the entire perimeter; angle is derived from whichever boundary segment the resolved point lies on."
  - "Installed vitest 1.x rather than 4.x because the host is on Node 18.19.1 (vitest 4 / vite 8 require Node 20+)."
  - "Did NOT modify package.json in this worktree — vitest install lives in the parent node_modules and the worktree symlinks to it. Plan 21-01 (parallel sibling) owns the package.json change."

patterns-established:
  - "Canonical door model (top-level array, not nested under GridRoom). Renderer adoption deferred to plan 21-03 — both legacy and canonical types coexist during the transition."
  - "Three interface invariants enforced at normalize time: (1) both endpoint rooms exist; (2) `(x,y)` lies on the shared edge of `(roomA, roomB)` ± epsilon; (3) doors on the same shared edge do not overlap (interval test on along ± width/(2·edge_length))."

requirements-completed: []

# Metrics
duration: ~30min
completed: 2026-05-09
---

# Phase 21 Plan 02: Canonical Door Type + doorNormalizer Summary

**Top-level canonical `Door` model and a fully validating loader that maps authored YAML (B-rel relational + B-pos override) into it, with shared-edge resolution, overlap detection, stable id derivation, and 35-case test coverage.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-09T18:25Z (approx, after worktree setup)
- **Completed:** 2026-05-09T18:38Z
- **Tasks:** 4 (3 implementation + 1 verification)
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- Added the canonical `Door` interface to `src/types/encounterMap.ts` (top-level, not nested) — supports diagonal doors via continuous `angle` and fractional `width`
- Added two authored YAML door shapes — `AuthoredDoorRel` (primary) and `AuthoredDoorPos` (override) — plus the `AuthoredDoor` union and `isAuthoredDoorPos` type guard
- Added `DoorNormalizationError` carrying the offending authored input for downstream UI/log surfacing
- Implemented `doorNormalizer` (`normalizeDoor` / `normalizeDoors`) — a pure, ~810-line module that:
  - Resolves shared edges across rect / polygon / circle room shapes via boundary segment overlap detection
  - Walks exterior boundaries by arc-length for exterior doors (single-element `rooms` list)
  - Validates room references, width bounds, along-fits-on-edge, position-on-edge
  - Detects overlapping doors on the same shared edge (sorted-pair grouping + interval test)
  - Derives stable ids: `${roomA}__${roomB|exterior}__${index}` when omitted
- 35 test cases in vitest covering all happy paths, validation failures, overlap detection, and id derivation — all passing

## Task Commits

1. **Task 1: Add canonical and authored door types to encounterMap.ts** — `72ff06e` (feat)
2. **Task 2: Create doorNormalizer with validation** — `7b7a252` (feat)
3. **Task 3: Test doorNormalizer comprehensively** — `72f2f0e` (test)
4. **Task 4: Verify build + typecheck + tests** — verification only, no commit

## Files Created/Modified

- `src/types/encounterMap.ts` — additive: canonical `Door`, `AuthoredDoorRel`, `AuthoredDoorPos`, `AuthoredDoor` union, `isAuthoredDoorPos` type guard, `DoorNormalizationError` class. Legacy `DoorDef` and `GridRoom.doors?` left untouched.
- `src/components/domain/encounter/doors/doorNormalizer.ts` — pure module exporting `normalizeDoor(authored, rooms, index)` and `normalizeDoors(authored[], rooms)`. Includes internal geometry primitives (Pt/Seg, segment overlap, polyline arc-length, room boundary extraction by shape), shared-edge resolution, B-rel and B-pos resolution paths, overlap detection.
- `src/components/domain/encounter/doors/__tests__/doorNormalizer.test.ts` — 35 vitest cases across six describe blocks (B-rel happy, B-pos happy, validation failures, overlap detection, stable ids, mixed scenarios).

## Verification

- `npx vitest run` — **35 tests passed** (1 file)
- `npx tsc --noEmit` — **0 errors**
- `npx vite build` — **succeeded** (4096 modules transformed; no regressions)
- `EncounterMapRenderer.tsx` was not touched — renderer behavior unchanged.

## Decisions Made

- **Local geometry primitives (not polygon2d):** Plan 21-01 (parallel wave) lands `polygon2d`, but importing it from this plan would create a phantom dependency that doesn't exist in this worktree. The normalizer uses internal `Pt`/`Seg` types and `segmentOverlap` / `projectOntoSeg` helpers — small, self-contained, removable in a future cleanup plan if 21-03 wires both modules together.
- **Longest-of-disjoint-shared-edges:** When two rooms touch on multiple sides (rare in practice but legal in the YAML schema), the normalizer picks the longest connected shared run. Documented in the module header as a known limitation; `edge` discriminator is the planned escape hatch.
- **Circle approximation:** 64-gon for circle rooms. Door anchoring on circles is rare; precision was traded for code simplicity.
- **Vitest 1.x installed in parent worktree:** Parent dir has Node 18; vitest 4.x errored on missing `node:util.styleText`. Reinstalled `vitest@^1.6.0` + `jsdom@^24.0.0`. Worktree symlinks `node_modules` to parent so the install is visible without polluting this plan's `files_modified` set.

## Deviations from Plan

None — plan executed as written. The plan explicitly noted that 21-01 owns the vitest/package.json install; this plan ran tests using a parent-installed copy of vitest 1.x without modifying the worktree's package.json. That is consistent with the parallel-wave design and not a deviation from the plan's `files_modified` constraints.

## Issues Encountered

- **Vitest 4.x incompatible with Node 18.** Root cause: vitest 4 / vite 8 require Node 20+; system runs Node 18.19.1. Fix: installed `vitest@^1.6.0` + `jsdom@^24.0.0` (Node 18 compatible). Tests run cleanly. Resolution time: ~3 min.
- **`npm install --save-dev` peer-dep conflict** on first try (vitest 1.x peer-deps with installed Vite 5.x mismatched). Fix: re-ran with `--legacy-peer-deps`. No functional impact.

## Threat Flags

None. The Door normalizer reduces attack surface by validating all authored map data at load time; misformed YAML (human, AI, or tool-emitted) is caught with attributable errors instead of silently producing broken geometry.

## Next Plan Readiness (21-03)

Plan 21-03 can now:
- Import `Door` from `src/types/encounterMap.ts` and treat it as the canonical render-time door shape.
- Import `normalizeDoors` to convert `mapData.doors` (authored) into the canonical array at the boundary between data layer and renderer.
- Replace renderer-internal `getDoorSVGPosition`, `getAdjacentCellForDoor`, `getDoorBothAdjacentCells` with `Door.{x, y, angle, width}` reads + `mapView.project(...)` calls.
- The legacy `DoorDef` and `GridRoom.doors?` remain available during the transition; 21-03 chooses when to remove them.

## Self-Check: PASSED

Verified:

- `src/types/encounterMap.ts` — modified, contains `export interface Door`, `export interface AuthoredDoorRel`, `export interface AuthoredDoorPos`, `export class DoorNormalizationError`, `export function isAuthoredDoorPos` ✓
- `src/components/domain/encounter/doors/doorNormalizer.ts` — created, exports `normalizeDoor` and `normalizeDoors` ✓
- `src/components/domain/encounter/doors/__tests__/doorNormalizer.test.ts` — created, 35 test cases pass ✓
- Commit `72ff06e` (Task 1) ✓ in git log
- Commit `7b7a252` (Task 2) ✓ in git log
- Commit `72f2f0e` (Task 3) ✓ in git log
- typecheck: 0 errors ✓
- build: succeeded ✓
- tests: 35/35 passing ✓

---
*Phase: 21-encounter-geometry-deepening*
*Plan: 02*
*Completed: 2026-05-09*
