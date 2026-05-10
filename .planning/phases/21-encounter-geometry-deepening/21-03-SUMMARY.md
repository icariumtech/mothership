---
phase: 21-encounter-geometry-deepening
plan: 03
subsystem: encounter-geometry
tags: [encounter-maps, renderer, geometry, mapView, canonical-door, refactor]

# Dependency graph
requires:
  - 21-01 (polygon2d, gridProjection, vitest infra)
  - 21-02 (canonical Door type, doorNormalizer)
provides:
  - "roomGeometry — grid-space, domain-aware geometry: roomLabelGrid, roomBBoxGrid, roomWallEdges, roomChamferedPolygon, doorGridPosition, doorEndpoints, doorWallAxis"
  - "mapView — closure facade combining roomGeometry + projection (the renderer's only spatial seam)"
  - "extractAuthoredDoorsFromRooms — legacy-YAML adapter that lifts nested room.doors[] to top-level AuthoredDoor[] at load time"
  - "EncounterMapRenderer.tsx using canonical Door[] end-to-end on the frontend"
affects:
  - 21-04-backend-yaml-migration  # backend can now drop nested room.doors and emit top-level mapData.doors[]
  - 21-05-scheduleReveal          # renderer is now small enough that the reveal animation seam is isolatable
  - encounter-map-rendering

# Tech tracking
tech-stack:
  added: []  # no new deps; consumes 21-01/21-02 modules
  patterns:
    - "MapView seam — every grid↔SVG transform in the renderer routes through one mapView instance built from a Projection. Renderer never multiplies by unitSize directly."
    - "Closure facade — makeMapView(projection) captures the projection once; method calls compose roomGeometry helpers with projection.project. Adding isoProjection later changes the factory call site, not the renderer."
    - "Legacy-adapter at load — extractAuthoredDoorsFromRooms walks legacy nested room.doors[] and produces AuthoredDoor[]; doorNormalizer then validates into canonical Door[]. Renderer is canonical-only; backend remains untouched until 21-04."
    - "Stable door identity across the model switch — door.id = `${room.id}_door_${index}` is preserved by the adapter so any persisted runtime doorStatus[id] overrides survive."

key-files:
  created:
    - src/components/domain/encounter/geometry/roomGeometry.ts
    - src/components/domain/encounter/geometry/__tests__/roomGeometry.test.ts
    - src/components/domain/encounter/geometry/mapView.ts
  modified:
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/domain/encounter/TokenLayer.tsx
    - src/types/encounterMap.ts

key-decisions:
  - "Renderer holds exactly one mapView per render — built from topDownProjection({unitSize: mapData.unit_size ?? 40}) inside a useMemo. Future iso/rotation projections plug in at this seam without renderer changes."
  - "Door iteration flipped from nested (mapData.rooms.flatMap(r.doors)) to flat (canonicalDoors[]) in one step. The flat form is the canonical render-time model going forward; legacy YAML is absorbed by extractAuthoredDoorsFromRooms → normalizeDoors at load."
  - "Door visibility is now O(1) reference check on door.roomA / door.roomB. Spatial doorEndpoints fallback retained only for legacy single-room exterior doors where the adapter has not resolved the other side. Removed entirely in 21-04 once YAML carries explicit roomA/roomB."
  - "TokenLayer drops its local pointInPolygon copy and imports from @/utils/polygon2d. Required adapting the call site from tuple form ([number,number][]) to the polygon2d Point/Polygon object form."
  - "mapView.unitSize exposes the projected length of the unit grid x-vector — for top-down it equals input unitSize, but the indirection lets door slot drawing dimensions stay correct under future projections."

patterns-established:
  - "One spatial seam per renderer — the renderer asks the mapView for any answer that mixes grid and SVG. Removing the inline helpers eliminated ~390 LOC and made the reveal animation / hit-testing logic visible (it was buried before)."
  - "Authored vs canonical at the data boundary — load-time normalizers (doorNormalizer, future room normalizer) catch malformed YAML with attributable errors instead of silently producing broken geometry. Renderer code is canonical-only and need not handle authored shapes."

requirements-completed: []

# Metrics
duration: ~90min (executor) + manual smoke test
completed: 2026-05-09
---

# Phase 21 Plan 03: roomGeometry + mapView + Renderer Adoption Summary

**Renderer landing of the geometry refactor: extracted roomGeometry (grid-space, pixel-free) and mapView (closure facade combining roomGeometry with the Projection seam from 21-01), then rewrote EncounterMapRenderer.tsx to use them. Renderer dropped 297 net LOC; ~390 LOC of inline geometry helpers were removed; door iteration flipped from nested-under-room to a top-level canonical Door[] array via a load-time adapter. Frontend now operates on the canonical Door model end-to-end while the backend continues to emit legacy nested doors (deferred to plan 21-04).**

## Performance

- **Tasks:** 6 (4 implementation + 1 manual smoke checkpoint + 1 verification gate)
- **Files created:** 3
- **Files modified:** 3
- **Renderer LOC:** 1895 → 1598 (-297 net; -471 deletions, +174 insertions in EncounterMapRenderer.tsx alone)
- **Vitest:** 117/117 tests passing (36 new in roomGeometry; pre-existing polygon2d / gridProjection / doorNormalizer suites unchanged)
- **Typecheck:** 0 errors
- **Build:** Vite production build succeeds, no regressions

## Accomplishments

- `roomGeometry.ts` lifts every grid-space room/door/wall computation out of the renderer:
  - `roomLabelGrid(room)` — area-weighted centroid for labels (rect / circle / polygon)
  - `roomBBoxGrid(rooms, hull?)` — bounding box including hull, in grid space
  - `roomWallEdges(rects)` — exterior wall edges with shared-edge cancellation
  - `roomChamferedPolygon(rect)` — delegates to polygon2d.octagonFromRect
  - `doorGridPosition(door)` — canonical accessor (kept for parallelism with future iso variants)
  - `doorEndpoints(door, rooms)` — derives the two cells a door connects (one per side; null when exterior)
  - `doorWallAxis(door)` — angle → 'EW' | 'NS' | 'diagonal'
  - All return types are grid-space — module forbids importing `gridProjection` (inverted dependency).
- `mapView.ts` is the renderer's seam:
  - `makeMapView(projection): MapView` — closure factory captures the projection
  - Methods: `doorPosition`, `doorBounds`, `roomPolygonPoints`, `roomChamferedPolygonPoints`, `wallEdges`, `labelPosition`, `bbox`, plus pass-through `project` / `unproject` / `unitSize`
  - All SVG-space queries from the renderer route through this single object.
- `EncounterMapRenderer.tsx` rewritten:
  - Constructs `projection` and `view` once per render via `useMemo`
  - Iterates a top-level `canonicalDoors: Door[]` instead of `mapData.rooms.flatMap(room.doors)`
  - `extractAuthoredDoorsFromRooms` adapter walks legacy nested `room.doors[]`, emits `AuthoredDoor[]` with `rooms: [room.id, inferredOther | null]`; `normalizeDoors` validates into canonical `Door[]`
  - `door.id = ${room.id}_door_${index}` preserved by the adapter so persisted `doorStatus[id]` overrides survive the model switch
  - `handleDoorClick(e, door)` takes a canonical `Door`; `getEffectiveDoorStatus(door)` looks up `door.id` directly
  - Hull / polygon room / circle room rendering all route through `view.project`
  - Removed: `getRectPolygonPoints`, `getDoorAngleRad`, local `pointInPolygon`, `getPolygonBoundaryPoint`, `computeBoundingBox`, `computeRoomWalls`, `polygonAreaCentroid`, `getRoomLabelPosition`, `getAdjacentCellForDoor`, `getDoorBothAdjacentCells`, `getDoorSVGPosition`, `Edge` interface
- `TokenLayer.tsx` imports `pointInPolygon` from `@/utils/polygon2d` (2-arg `Point`/`Polygon` object form) instead of carrying a local copy
- `roomGeometry.test.ts` — 36 vitest cases across all exports, including L-shape polygon centroid, two-rect shared-edge cancellation, exterior door endpoints, mixed rect+polygon+hull bbox

## Task Commits

1. **Task 1: Create roomGeometry module** — `0a0ac0a` (feat)
2. **Task 2: Test roomGeometry (36 cases)** — `84fd23c` (test)
3. **Task 3: Create mapView closure facade** — `84e63b8` (feat)
4. **Task 4: Renderer adoption — remove inline helpers, use mapView, canonical Door** — `9c4a6a7` (refactor/feat)
5. **Task 5: Manual smoke test** — checkpoint, no commit. User-approved on 2026-05-09 for somnus and patrol gunboat in both GM console and player terminal.
6. **Task 6: Verify build + typecheck + tests** — verification only, all green.

## Files Created/Modified

- `src/components/domain/encounter/geometry/roomGeometry.ts` (created, 560 LOC) — domain-aware grid-space geometry exports listed above
- `src/components/domain/encounter/geometry/__tests__/roomGeometry.test.ts` (created, 342 LOC) — 36 test cases
- `src/components/domain/encounter/geometry/mapView.ts` (created, 220 LOC) — `MapView` interface + `makeMapView(projection)` factory
- `src/components/domain/encounter/EncounterMapRenderer.tsx` (modified, 1895 → 1598; net -297 LOC) — removed all inline geometry helpers; adopted mapView + canonical Door[]
- `src/components/domain/encounter/TokenLayer.tsx` (modified, +/- ~9 LOC) — pointInPolygon import flipped to polygon2d
- `src/types/encounterMap.ts` (modified, minor) — touched in support of canonical Door iteration; legacy `DoorDef` and `GridRoom.doors?` retained for the backend transition

## Verification Gates

- **Vitest:** `npx vitest run` → 117/117 passing across polygon2d (23), gridProjection (23), doorNormalizer (35), roomGeometry (36)
- **Typecheck:** `npm run typecheck` → 0 errors (re-verified at SUMMARY time, still clean)
- **Build:** `npm run build` → Vite production build succeeds, no warnings introduced
- **Renderer LOC:** `wc -l EncounterMapRenderer.tsx` → 1598 (target was -300, delivered -297)
- **Manual smoke (Task 5):** User-approved. Somnus (rect-only) and Patrol Gunboat (polygon rooms) render unchanged in both GM console and player terminal. Door visibility, door status (right-click → CLOSED/LOCKED), token placement, and multi-deck switching all confirmed working.

## Decisions Made

- **Single mapView per render via useMemo, not per-call construction.** Keeps the projection capture cheap and makes the dependency explicit (`[projection]`). Re-derived only when `mapData.unit_size` changes.
- **Legacy adapter (`extractAuthoredDoorsFromRooms`) lives in the renderer for now, not in `doorNormalizer`.** Justification: it is a temporary bridge whose lifespan ends with plan 21-04. Pulling it into `doorNormalizer` would conflate "validate authored" with "translate legacy" — keeping it adjacent to the renderer (its only caller) makes the deletion in 21-04 a single-file change.
- **Spatial doorEndpoints fallback retained for partial-resolution case.** When the legacy adapter cannot identify the second room (e.g. a door drawn against a corridor whose synthetic id was lost), `doorEndpoints` is invoked at render time as a fallback so the door still draws against the correct adjacent cell. Removed entirely in 21-04 once YAML carries explicit `roomA`/`roomB`.
- **Door id preservation across the model switch.** The adapter mints `door.id = `${room.id}_door_${index}`` exactly as the legacy renderer did, so persisted runtime door state (open/closed/locked overrides keyed by id) survives without migration. The id contract is documented at the adapter site for the 21-04 author.
- **TokenLayer call-site rewrite, not type alias.** Polygon2d's `Point = {x,y}` form is the convention going forward; renaming TokenLayer's `[number, number]` polygon to `Polygon = Point[]` makes the next reader's mental model match the test layer's. Two locations changed.

## Deviations from Plan

None — plan executed as written. The `extractAuthoredDoorsFromRooms` adapter's location (in the renderer file rather than in `doorNormalizer`) was a judgment call within the plan's allowed scope; no surprise scope expansion. The plan estimated -300 LOC for the renderer; landed -297. Manual smoke test passed on first attempt for both rect-only and polygon-room maps.

## Threat Flags

None. The MapView seam reduces attack surface by funneling all grid↔SVG transforms through a single bottleneck whose contract is enforced by `gridProjection`'s round-trip property tests. Door normalization (lifted in 21-02, used here) catches malformed authored data at load time.

## Follow-ups for 21-04 (Backend YAML Migration)

The frontend is canonical-Door-clean; the next plan flips the backend to match:

- **`backend/encounters/data_loader.py`** still emits doors nested under `GridRoom.doors[]` in the legacy format. 21-04 changes the loader to emit top-level `mapData.doors[]` in canonical Door form (B-pos with explicit `x`, `y`, `angle`, `width`, `roomA`, `roomB`).
- **`tools/svg_to_map.py --detect-doors`** still writes the legacy nested format. 21-04 updates it to write top-level `doors:` block at map root with canonical fields. Existing `x`/`y`/`angle` per-door wire-up stays — the only change is the location and the addition of `roomA`/`roomB` from the shared-edge detector.
- **All YAML maps under `data/galaxy/**/map/`** need migration. Two production maps in tree today (Somnus, Patrol Gunboat) plus any added since. 21-04 includes a one-shot migration script and verifies regenerated YAML round-trips through `data_loader → normalizeDoors → render` without behavior change.
- **`extractAuthoredDoorsFromRooms` (in EncounterMapRenderer.tsx)** is then dead code — delete in 21-04.
- **`DoorDef` legacy type and `GridRoom.doors?` field in `src/types/encounterMap.ts`** are then dead types — delete in 21-04.
- **Spatial `doorEndpoints` fallback at render time** can be removed once YAML guarantees explicit `roomA`/`roomB` on every door — delete in 21-04.

After 21-04 the renderer is fully canonical-only and the backend speaks the same model; no adapter, no fallback, no legacy types.

## Self-Check

Files created exist:
- `src/components/domain/encounter/geometry/roomGeometry.ts` — FOUND
- `src/components/domain/encounter/geometry/__tests__/roomGeometry.test.ts` — FOUND
- `src/components/domain/encounter/geometry/mapView.ts` — FOUND

Files modified:
- `src/components/domain/encounter/EncounterMapRenderer.tsx` — FOUND (1598 LOC)
- `src/components/domain/encounter/TokenLayer.tsx` — FOUND
- `src/types/encounterMap.ts` — FOUND

Commits exist on `worktree-agent-a45107cc095f49e97`:
- `0a0ac0a` (Task 1 / roomGeometry module) — FOUND
- `84fd23c` (Task 2 / roomGeometry tests, 36 cases) — FOUND
- `84e63b8` (Task 3 / mapView closure facade) — FOUND
- `9c4a6a7` (Task 4 / renderer adoption, -297 LOC) — FOUND

## Self-Check: PASSED

---
*Phase: 21-encounter-geometry-deepening*
*Plan: 03*
*Completed: 2026-05-09*
