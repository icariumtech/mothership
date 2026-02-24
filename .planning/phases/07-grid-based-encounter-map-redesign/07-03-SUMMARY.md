---
plan: 07-03
phase: 07-grid-based-encounter-map-redesign
status: complete
completed: 2026-02-23
duration_seconds: ~600
requirements: [GRID-07, GRID-08]
---

# 07-03 Summary: Consumer Component Updates

## What Was Built

Updated three consumer components (TokenLayer, MapPreview, EncounterPanel) to work with the new GridRoom type and grid-based encounter maps.

## Key Files

### Modified
- `src/components/domain/encounter/TokenLayer.tsx` — `findRoomAtCell` updated to test all rects in GridRoom via `room.rects.some(r => ...)` with fallback to legacy `x/y/width/height` for RoomData; `mapRooms` prop now accepts `(RoomData | GridRoom)[]`
- `src/components/gm/MapPreview.tsx` — isGridEncounterMap check at top of component delegates to EncounterMapRenderer for grid maps; `onRoomToggle` prop added; legacy path uses `legacyMapData` alias
- `src/components/gm/EncounterPanel.tsx` — RoomWithDeck interface updated to support both GridRoom and legacy RoomData shapes; status badge replaced with type badge; bulk buttons changed from icon-only to labeled (REVEAL ALL / HIDE ALL); `onRoomToggle={handleRoomToggle}` wired to MapPreview
- `src/components/gm/TokenPalette.tsx` — `mapData` prop type updated to `EncounterMapData | GridEncounterMapData | null`

## Decisions Made

- TokenLayer uses duck-typing: `'rects' in room && Array.isArray(room.rects)` to distinguish GridRoom from RoomData
- MapPreview early returns for grid maps — no code duplication, single responsibility
- EncounterPanel bulk buttons: replaced icon+tooltip pattern with plain text labels for clarity in grid-era UI
- Status badge removed entirely from room list (no status field in GridRoom); type badge shown conditionally for non-corridor rooms
- onRoomToggle threading: EncounterPanel.handleRoomToggle already existed — just forwarded to MapPreview

## Verification

- `npm run typecheck`: 0 errors
- `npm run build`: success
- `grep -n "rects.some" src/components/domain/encounter/TokenLayer.tsx` — present
- `grep -n "REVEAL ALL" src/components/gm/EncounterPanel.tsx` — present
- `grep -n "onRoomToggle" src/components/gm/MapPreview.tsx` — present

## Self-Check: PASSED
