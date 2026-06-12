# Phase 21: Encounter Geometry Deepening — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Origin:** `/improve-codebase-architecture` grilling session, 2026-05-08

<domain>
## Phase Boundary

Lift the geometry, projection, door model, and reveal-cascade machinery out of `src/components/domain/encounter/EncounterMapRenderer.tsx` (1895 LOC) into a four-module geometry stack with a top-level canonical `Door` model and a pure cascade scheduler. The renderer becomes a thin SVG render tree that holds one `mapView` and asks it for SVG-space positions; geometry, projection, validation, and animation orchestration all sit behind named seams.

The deepening also unlocks a future isometric / rotated-map view: switching projection becomes a one-line constructor change with no other module affected.

This phase **does not** touch the other state machines hidden in the renderer (pan/zoom, token drag-and-drop, popover coordination). Those are deferred candidates captured below.

</domain>

<decisions>
## Architectural Decisions

### Why deepen this now

`EncounterMapRenderer.tsx` is 1895 lines. ~200 of those are 13 pure geometry helpers (`pointInPolygon`, `polygonAreaCentroid`, `getPolygonBoundaryPoint`, `getRectPolygonPoints`, `getDoorAngleRad`, `computeBoundingBox`, `computeRoomWalls`, `getRoomLabelPosition`, `getAdjacentCellForDoor`, `getDoorBothAdjacentCells`, `getDoorSVGPosition`) plus animation cascade plumbing.

**Friction**:
- Geometry bugs hide in a 1895-line file alongside SVG, state, events, and JSX
- `pointInPolygon` already has a second caller in `TokenLayer.tsx` — the seam exists but is unnamed
- The `unit_size` (pixel-per-cell) parameter is threaded through every helper, mixing grid-space and SVG-space concerns
- Door model: doors are nested under one `GridRoom`; the "other room" is inferred by spatial lookup (`findRoomAtCell`) — a clear sign of a model bug
- No tests; the codebase has no test infrastructure at all
- Future iso/rotation work would have to fork this whole stack

**Deletion test confirms each layer earns its keep** — see grilling transcript notes in `21-RESEARCH.md` (TBD if needed) or carry context from CONTEXT.md vocabulary.

### Four-module geometry stack

| Module | Purpose | Dependencies |
|---|---|---|
| `polygon2d` | Pure 2D math (no domain types) | none |
| `roomGeometry` | Grid-space, domain-aware: rooms, doors, walls, label/bbox/centroid | `polygon2d` |
| `gridProjection` | `project(gx, gy) → svg`, `unproject(sx, sy) → grid`. Top-down today, iso later. | none |
| `mapView` | Renderer-facing closure facade combining `roomGeometry` + projection | the above three |

**Why four, not one:** the deletion test concentrates complexity at each seam:

- delete `polygon2d` → math collapses into `roomGeometry`; `TokenLayer` re-imports from there (coupled but workable)
- delete `roomGeometry` → per-room cases land back inside the renderer (current state)
- delete `gridProjection` → `mapView` re-grows pixel logic; iso becomes a fork-and-edit, not a parameter swap
- delete `mapView` → renderer threads `projection.project(...)` through every call site (loses the leverage of C1)

`gridProjection` is parameterized so iso swap is one constructor change:

```ts
const proj = topDownProjection({ unitSize: 40 });          // today
const proj = isoProjection({ unitSize: 40, tilt: 30, rotation: 45 });   // later
const view = makeMapView(proj);
```

Tokens, hull, POIs use `projection.project(...)` directly (no `mapView` wrapping), since they don't need room-aware logic.

### Door model rework (option B from grilling)

Today: doors nested under `GridRoom.doors[]`, synthetic ids `${room.id}_door_${index}`, "other room" inferred geometrically.

New canonical model:
```ts
interface Door {
  id: string
  x: number          // grid coords (door center)
  y: number
  angle: number      // degrees; any value (supports diagonal doors)
  width: number      // grid cells, default 1, fractional allowed
  roomA: string
  roomB: string | null   // null = exterior
  type: DoorType
  status: DoorStatus
}
```

Top-level `doors[]` on the map; `GridRoom.doors?` deprecated and removed.

**Authored YAML formats** (B-rel default + B-pos override):

```yaml
# B-rel — humans / AI / svg_to_map.py write this
- id: bridge_to_mess
  rooms: [bridge, mess]              # single-element list = exterior door
  along: 0.5                          # door center, 0..1 along shared edge
  width: 1                            # optional, default 1
  type: standard
  status: CLOSED

# B-pos — explicit override for fine control or unusual angles
- id: bridge_emergency
  rooms: [bridge, hall]
  position: { x: 12.5, y: 7.0, angle: 30 }
  width: 1
  type: emergency
  status: SEALED
```

A `doorNormalizer` loader maps both authored shapes → canonical, validates against shared-edge geometry, and assigns deterministic ids (`${roomA}__${roomB}__${index}` when omitted).

**Why this matters for AI / human authoring:** `(rooms, along, width)` is a *relational* statement of intent — easy for humans to write and easy for LLMs to generate. `(x, y, angle)` requires geometric reasoning about shared walls, which is hard for both. Tools like `svg_to_map.py` can still emit B-pos when convenient.

**Validation** the loader enforces:
- Both rooms exist
- Rooms share at least one edge (B-rel)
- Position lies on a shared edge (B-pos), within epsilon
- `width ≤ shared_edge_length`
- Doors on the same edge don't overlap (`[along - w/2, along + w/2]` intervals disjoint)
- `along ∈ [width/(2·edge_length), 1 − width/(2·edge_length)]` so the door fits

### Cascade extraction

The room-reveal cascade (lines ~587–691 in the renderer) is its own state machine: visibility diff → Y-ascending sort → per-room timer with cancellation → animation-state Map → CSS class mapping in `renderRoom`.

Split into:

- **`scheduleReveal`** — pure function. `(prev, curr, rooms, mapIdentity, opts) → RevealStep[]`. Trivially testable.
- **`useRoomRevealAnimations`** — hook wrapping `scheduleReveal`, owning the timer side effects, returning `Map<string, 'revealing' | 'hiding'>`.

**Strategy parameter shape is future-friendly** — `scheduleReveal({ strategy: 'y-ascending' })` ships with one strategy. New strategies (center-out, player-position-out, instant) plug in later without breaking callers. One adapter today; pluggable seam when a second exists.

**Policy / mechanism split** — the GM-skip is currently `isGM` baked into the cascade logic. Replace with `enabled` flag at the hook level. Future toggles ("reduced motion," "performance mode") flip the same flag.

**Doors animate ad-hoc, not via this module.** Under the new top-level `doors[]` model, doors render as siblings of rooms. CSS opacity transitions tied to either endpoint room's `revealing`/`hiding` class are sufficient. Promote to `scheduleReveal` only if a second use case appears.

### Test strategy: T3 — pure layers only

The project has zero tests today. Vitest infrastructure lands as part of plan 21-01.

**Tests written:**
- `polygon2d` (pure, table-driven, dozens of cases trivially)
- `gridProjection` (round-trip property + known pairs)
- `roomGeometry` (fixture-driven: synthetic `GridRoom` / `Door` inputs, no React)
- `doorNormalizer` (highest-leverage — validation paths, edge cases, exterior doors, overlap detection)
- `scheduleReveal` (pure cascade scheduling)

**Tests deferred** (would need `@testing-library/react` + fake timers):
- `mapView` (composition; covered indirectly by integration if added)
- `useRoomRevealAnimations` hook (timer plumbing)

The pure layers give ~80% of the safety net for ~20% of the infra cost. `doorNormalizer` tests in particular pay back immediately because the new model adds *real* validation that has to be right.

### Three interface invariants

Documented in module headers / type comments; not branded types unless the renderer keeps slipping pixels into grid arguments.

1. **`roomGeometry` never returns SVG coords.** All return types are grid-space (`GridPoint`, `GridCell`, `GridEdge`, `GridRect`).
2. **`mapView` is the only producer of SVG coords.** No backdoor `* unitSize` in the renderer.
3. **A `Door` is invalid unless `(x, y)` lies on the shared edge of `(roomA, roomB)` ± epsilon.** Enforced at normalize time.

</decisions>

<execution_plan>
## Plan Structure

5 atomic landings, each independently revertible:

| Plan | Title | Wave | Depends on | Touches renderer? |
|---|---|---|---|---|
| 21-01 | Vitest + `polygon2d` + `gridProjection` (foundation) | 1 | — | no |
| 21-02 | Canonical `Door` type + `doorNormalizer` + tests (parallel to legacy) | 1 | — | no |
| 21-03 | `roomGeometry` + `mapView`; renderer adopts canonical model | 2 | 21-01, 21-02 | yes — major lift |
| 21-04 | Backend serializer + `svg_to_map.py` + YAML migration + door-state ID migration | 3 | 21-02, 21-03 | minor |
| 21-05 | `scheduleReveal` + `useRoomRevealAnimations`; renderer drops cascade plumbing | 4 | — (independent) | yes — focused |

After all five land, `EncounterMapRenderer.tsx` should be ~1100–1200 LOC (down from 1895), focused on JSX + interaction handlers, with all geometry / projection / animation orchestration behind named seams.

## Pickup contract

A fresh context resuming this phase should:

1. Read this file (`21-CONTEXT.md`) for design rationale
2. Read `/CONTEXT.md` for domain vocabulary (room, door, hull, projection, mapView, reveal cascade, etc.)
3. Read the relevant `21-NN-PLAN.md` for the active landing
4. Resume execution — atomic commit per landing, summary file after each

</execution_plan>

<deferred>
## Deferred candidates (NOT in scope of this phase)

These were identified during the same grilling session but excluded to keep the phase tractable. Each is a clean follow-up after this phase ships.

### Other state machines inside `EncounterMapRenderer.tsx`

- **Pan/zoom/touch gestures** (~250 LOC): drag start/move/end, pinch, wheel zoom. Wants a `usePanZoom` hook with a clear interface (current state + handlers).
- **Token drag-and-drop** (~200 LOC): drag start, over, drop with cell snapping + occupancy check. Wants `useTokenPlacement`.
- **Popover coordination**: `selectedToken`, `selectedDoor`, `poiPopup`, `contextMenu` are mutually exclusive but stored as four independent useStates — opening one doesn't close the others. Wants a discriminated-union state or `useExclusivePopover<T>`.

### Other deepening candidates from the architecture review

(Listed in priority order — these came up in the same session but were not chosen.)

1. **View transition orchestration** in `SharedConsole.tsx` + `useViewTransition.ts` + `transitionCoordinator.ts` — implicit phase machine spread across three files
2. **SharedConsole god-component** (1064 LOC) — distribute concerns into Bridge / JANUS / terminal-overlay modules
3. **Three near-identical map stacks** (Galaxy/System/Orbit Scene + camera hooks) — collapse to one `ScaleMap` with three adapters
4. **`sceneStore` mixing API data with UI state machine** — split into `mapDataStore` + `viewStateStore`
5. **Bridge view duplicated** across player and GM consoles
6. **Backend `DataLoader.load_all_locations`** does three things in one method (filesystem walk, indexing, ship injection)

</deferred>

<references>
## References

- **Domain vocabulary**: `/CONTEXT.md` (project root)
- **Architecture vocabulary**: `~/.claude/skills/improve-codebase-architecture/LANGUAGE.md` (module / interface / depth / seam / adapter / leverage / locality)
- **Source files affected**:
  - `src/components/domain/encounter/EncounterMapRenderer.tsx` (1895 LOC — primary target)
  - `src/components/domain/encounter/TokenLayer.tsx` (existing `pointInPolygon` consumer)
  - `src/types/encounterMap.ts` (canonical types live here)
  - `terminal/data_loader.py` (backend YAML serializer)
  - `tools/svg_to_map.py` (B-rel emitter)
  - `data/galaxy/**/map/*.yaml` (existing maps to migrate)

</references>
