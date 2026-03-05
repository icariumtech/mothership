---
plan: 07-02
phase: 07-grid-based-encounter-map-redesign
status: complete
completed: 2026-02-23
duration_seconds: ~900
requirements: [GRID-03, GRID-04, GRID-05, GRID-06, GRID-09]
---

# 07-02 Summary: Grid-Based SVG Renderer

## What Was Built

Rewrote `EncounterMapRenderer.tsx` from a node-graph renderer to a true grid-based wall-segment renderer. Added updated CSS and EncounterMapDisplay routing.

## Key Files

### Created / Modified
- `src/components/domain/encounter/EncounterMapRenderer.tsx` — Complete rewrite: wall-segment algorithm, floor texture, background grid, GM click-to-reveal, door positioning helpers
- `src/components/domain/encounter/EncounterMapRenderer.css` — Updated CSS: amber wall styling, floor texture, room label, scanline grid animation removed, node-graph classes removed
- `src/components/domain/encounter/EncounterMapDisplay.tsx` — isGridEncounterMap routing branch added before isEncounterMap; multi-deck branch also checks format

## Decisions Made

- Wall-segment algorithm uses edge-count exclusion: edges shared by 2+ rects are interior (not drawn), edges shared by exactly 1 rect are exterior walls
- SVG bounding box computed from ALL rooms regardless of visibility (prevents layout shift on reveal)
- `computeRoomWalls()` works per-room (not globally) — each room group renders its own walls
- Room labels: centered in bounding box of all rects, only shown for named rooms, only when visible
- Doors: positioned on wall edges using getDoorSVGPosition() with wall direction and ordinal position
- GM click-to-reveal: invisible transparent rect overlays trigger onRoomToggle callback
- Hidden rooms: opacity 0.25 for GM view, display none for player view (via roomVisibility state)
- Old node-graph code removed: getConnectionEdge, renderConnectionPath, allConnections, renderTerminal, renderPoi, POI_ICONS, selectedRoom state, tooltip state

## Verification

- `npm run typecheck`: 0 errors
- `npm run build`: success
- Grep confirms wall-segment: `computeRoomWalls` present in EncounterMapRenderer.tsx
- Grep confirms routing: `isGridEncounterMap` present in EncounterMapDisplay.tsx
- Grep confirms old code removed: `getConnectionEdge` not in EncounterMapRenderer.tsx

## Self-Check: PASSED
