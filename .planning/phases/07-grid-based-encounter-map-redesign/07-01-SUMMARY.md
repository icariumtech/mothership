---
phase: 07-grid-based-encounter-map-redesign
plan: 01
subsystem: ui
tags: [typescript, react, encounter-map, yaml, grid, types]

requires: []
provides:
  - "GridRect, WallSide, DoorDef, GridRoom, GridEncounterMapData TypeScript interfaces"
  - "isGridEncounterMap() type guard for routing new vs old map format"
  - "deck_1.yaml rebuilt in grid rects format (13 rooms + corridors)"
  - "deck_2.yaml rebuilt in grid rects format (8 rooms + corridors)"
  - "main_facility.yaml as demonstration map with L-shape and T-shape rooms"
affects:
  - "07-02 (grid renderer will consume GridEncounterMapData and room rects)"
  - "07-03 (panel/token controls use GridRoom.doors and GridEncounterMapData)"

tech-stack:
  added: []
  patterns:
    - "Rooms-as-rects: rooms define their own geometry via rects array, not x/y/w/h scalars"
    - "Wall-attached doors: doors live on rooms (wall + position), no separate connections array"
    - "Corridors are rooms with name empty string, type: corridor"
    - "isGridEncounterMap() type guard routes to new renderer vs old isEncounterMap()"

key-files:
  created:
    - "data/galaxy/kepler-442/kepler-442b/base_alpha/map/main_facility.yaml"
  modified:
    - "src/types/encounterMap.ts"
    - "data/galaxy/sol/earth/uscss_morrigan/map/deck_1.yaml"
    - "data/galaxy/sol/earth/uscss_morrigan/map/deck_2.yaml"

key-decisions:
  - "Grid rooms use rects array (not x/y/w/h scalars) to support L-shapes, T-shapes, and corridors as first-class rooms"
  - "Doors attached to room walls (wall: north/south/east/west, position: N) — no separate connections array"
  - "unit_size: 40 at top level replaces grid: {width, height, unit_size} block — no fixed canvas dimensions"
  - "Corridors are GridRoom entries with name: '' (empty) and type: corridor — renderer omits label for empty names"
  - "isGridEncounterMap() guard uses rooms[0].rects presence to distinguish new format from old EncounterMapData"
  - "Old types (RoomData, EncounterMapData, isEncounterMap, GridConfig) remain exported for backward compatibility"

patterns-established:
  - "Type-guard routing: isGridEncounterMap() before isEncounterMap() in EncounterMapDisplay switch logic"
  - "YAML rects inline flow: {x: N, y: N, w: N, h: N} inline mapping for compact readability"

duration: 2min
completed: 2026-02-23
---

# Phase 7 Plan 01: Grid-Based Types and YAML Data Foundation Summary

**GridRect/GridRoom/DoorDef TypeScript types added to encounterMap.ts plus three YAML map files rebuilt in wall-attached-door rects format with L-shape and T-shape room support**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-23T19:23:12Z
- **Completed:** 2026-02-23T19:25:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- New grid-based TypeScript interfaces (GridRect, WallSide, DoorDef, GridRoom, GridEncounterMapData) appended to encounterMap.ts without touching existing types
- isGridEncounterMap() type guard identifies new format via rooms[0].rects presence
- deck_1.yaml rebuilt: 13 rooms (bridge, crew quarters, medical bay, engineering, cargo bay, airlock bay, life support + 6 corridor rooms), doors on room walls
- deck_2.yaml rebuilt: 8 rooms (maintenance, storage A/B, fuel cells, waste processing + 3 corridor rooms)
- main_facility.yaml rebuilt as full demonstration map with T-shape main_corridor (two rects) and L-shape equipment_bay (two rects)
- npm run typecheck passes with 0 errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add grid-based TypeScript types to encounterMap.ts** - `65471d8` (feat)
2. **Task 2: Rebuild YAML map files in grid-based format** - `9023e2c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/types/encounterMap.ts` - Added 60 lines: GridRect, WallSide, DoorDef, GridRoom, GridEncounterMapData interfaces + isGridEncounterMap() guard
- `data/galaxy/sol/earth/uscss_morrigan/map/deck_1.yaml` - Rebuilt from node-graph format to 13 rooms with rects + wall doors
- `data/galaxy/sol/earth/uscss_morrigan/map/deck_2.yaml` - Rebuilt from node-graph format to 8 rooms with rects + wall doors
- `data/galaxy/kepler-442/kepler-442b/base_alpha/map/main_facility.yaml` - Replaced stub with 5-room demonstration map showing multi-rect rooms

## Decisions Made

- Rooms use rects array instead of x/y/w/h scalars — this enables L-shapes, T-shapes, irregular layouts that the old format could not represent
- Doors live on rooms (wall + position), not in a separate connections array — each door describes the connection from one room's perspective
- unit_size at top level (no grid.width/grid.height) — canvas dimensions are computed from room geometry at render time
- Corridors are named rooms with name: '' — renderer skips label for empty-name rooms
- Old EncounterMapData types preserved untouched for backward compatibility with existing encounter view

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Type contract established: Wave 2 plans (grid renderer, GM panel) can import GridEncounterMapData, GridRoom, GridRect, DoorDef from src/types/encounterMap.ts
- YAML data ready: all three map files parse correctly and conform to the new schema
- isGridEncounterMap() guard ready for use in EncounterMapDisplay routing logic

---
*Phase: 07-grid-based-encounter-map-redesign*
*Completed: 2026-02-23*
