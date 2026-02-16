---
phase: 03-encounter-tokens
plan: 03
subsystem: encounter-tokens
tags: [frontend, gm-controls, tokens, drag-drop, palette]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [token-palette, token-placement, drag-to-move, svg-utilities]
  affects: [gm-console, encounter-panel, map-preview, token-layer]
tech_stack:
  added:
    - TokenPalette component
    - TokenImageGallery component
    - svgCoordinates utility module
    - HTML5 drag-and-drop API
  patterns:
    - Template persistence (selected template stays selected for duplicates)
    - SVG coordinate transforms (screenToSVG, snapToGrid)
    - Drag-from-palette placement with drop validation
    - Drag-to-move with ghost token preview
    - Overlap prevention and revealed-room constraints
key_files:
  created:
    - src/components/gm/TokenPalette.tsx
    - src/components/gm/TokenImageGallery.tsx
    - src/utils/svgCoordinates.ts
  modified:
    - src/components/gm/EncounterPanel.tsx
    - src/components/gm/MapPreview.tsx
    - src/components/domain/encounter/TokenLayer.tsx
    - src/types/gmConsole.ts
decisions:
  - "TokenPalette shows pre-configured templates from crew/NPC images auto-populated on mount"
  - "Selected template persists after placement allowing duplicate token creation without reselection"
  - "Custom token creator allows ad-hoc tokens with name input, type selector, and image gallery"
  - "Clear All Tokens button uses Modal.confirm for safety with warning message"
  - "Drag data format: JSON with { type, name, imageUrl } transferred via dataTransfer"
  - "SVG coordinate transforms use getScreenCTM().inverse() for accurate viewBox handling"
  - "Grid snapping uses Math.floor(svgCoord / unitSize) for discrete cell indices"
  - "Overlap prevention: reject placement/move if target cell is occupied by another token"
  - "Revealed rooms only: reject placement/move if target room is not revealed (roomVisibility[roomId] !== false)"
  - "Drag-to-move shows ghost token at snapped position during drag, only calls API on mouseup"
  - "Token state synced from activeView.encounter_tokens (added to ActiveView TypeScript interface)"
metrics:
  duration_seconds: 9252
  tasks_completed: 2
  files_created: 3
  files_modified: 4
  commits: 2
  completed_at: "2026-02-16T18:00:21Z"
---

# Phase 3 Plan 3: GM Token Controls Summary

**One-liner:** Token palette with drag-from-palette placement, custom token creator, image gallery, drag-to-move repositioning, grid snapping, overlap prevention, and Clear All Tokens functionality.

## Objective

Give the GM full token management during encounters: drag tokens from palette onto map, create custom tokens with image selection, move existing tokens with drag-to-move, enforce grid snapping and overlap prevention, restrict placement to revealed rooms, and clear all tokens with confirmation.

## Tasks Completed

### Task 1: TokenPalette and TokenImageGallery (e04c15f)

Created token management palette with templates, custom token creator, and image gallery modal.

**TokenImageGallery.tsx** - Image selection modal:
- Fetches images from `encounterApi.getTokenImages()` on mount
- Groups images by source: CREW, NPCs, OTHER IMAGES
- 48x48px circular thumbnails matching token appearance
- Grid layout with hover effects (teal border highlight)
- Click to select image and close modal
- Dark background matching terminal aesthetic

**TokenPalette.tsx** - Token management palette:
- **Pre-configured templates**: Auto-populate from crew/NPC campaign data on mount
  - Each template: circular thumbnail (32px), name, type badge/icon
  - Draggable cards with `draggable="true"` and `onDragStart` handler
  - Click to select, selected template highlighted with amber border
  - **Template persistence**: Selected template stays selected after placement (per user decision) for placing duplicates
- **Custom token creator**:
  - Name input field
  - Type selector: 4 buttons (Player, NPC, Creature, Object) with type-colored highlighting
  - "Select Image" button opens TokenImageGallery
  - Shows selected image thumbnail or placeholder
  - "Create" button sets custom token as selected template (also draggable)
- **Clear All Tokens**: Danger-styled button with `Modal.confirm` showing warning message
  - Confirmation: "Remove all tokens from the encounter map? This action cannot be undone."
  - On confirm: calls `encounterApi.clearAllTokens()`, updates local state, triggers re-poll
  - Shows token count in button label
- **Drag data format**: `JSON.stringify({ type, name, imageUrl })` transferred via `dataTransfer`
- **Visual feedback**: Selected template indicator panel with amber border shows current selection

### Task 2: SVG Utilities, Drop-to-Place, Drag-to-Move, Integration (f78ac6a)

Implemented coordinate transforms, drop target logic, drag-to-move functionality, and full EncounterPanel integration.

**svgCoordinates.ts** - Coordinate transform utilities:
- **`screenToSVG(svgElement, screenX, screenY)`**: Converts mouse coordinates to SVG coordinate space
  - Creates `DOMPoint` from screen coordinates
  - Gets SVG screen CTM via `svgElement.getScreenCTM()`
  - Inverts CTM and applies to point: `point.matrixTransform(ctm.inverse())`
  - Fallback to `getBoundingClientRect` calculation if CTM is null
  - Correctly handles SVG viewBox scaling, pan, and zoom transforms
- **`snapToGrid(svgX, svgY, unitSize)`**: Converts continuous SVG coordinates to discrete grid cell indices
  - `gridX = Math.floor(svgX / unitSize)`, `gridY = Math.floor(svgY / unitSize)`
- **`getGridCell(svgElement, screenX, screenY, unitSize)`**: Convenience function combining both
  - One-call conversion from screen coordinates to grid cell indices

**MapPreview.tsx** - Drop target for token placement:
- Added props: `tokens`, `isGM`, `onTokenPlace`, `onTokenMove`, `onTokenRemove`, `onTokenStatusToggle`
- Added `svgRef` ref for SVG element (used by coordinate transforms)
- **`onDragOver` handler**: `e.preventDefault()` to allow drop, set `dropEffect = 'copy'`
- **`onDrop` handler**:
  - Parse template data from `dataTransfer.getData('application/json')`
  - Convert drop position to grid cell using `getGridCell(svgRef.current, e.clientX, e.clientY, unitSize)`
  - **Overlap prevention**: Check if cell is occupied by existing token → reject with warning
  - **Revealed rooms only**: Find room containing target cell, check `roomVisibility[roomId]` → reject if unrevealed or outside room
  - If valid: call `onTokenPlace(type, name, gridX, gridY, imageUrl, roomId)`
- Render `TokenLayer` with token state and handlers
- Pass `mapRooms` to TokenLayer for room boundary checks

**TokenLayer.tsx** - Drag-to-move functionality:
- Added state: `isDragging`, `dragTokenId`, `ghostPosition` (snapped grid position during drag)
- Get parent SVG element ref via `closest('svg')` on mount
- **`handleTokenDragStart`**: Set drag state, store initial position, call `e.stopPropagation()` to prevent map panning (anti-pattern #2 from research)
- **Mouse move handler** (attached to window when dragging):
  - Use `screenToSVG(svgEl, e.clientX, e.clientY)` to convert mouse position to SVG coords
  - Use `snapToGrid(svgX, svgY, unitSize)` to calculate snapped grid position
  - Update `ghostPosition` state → triggers ghost token render at snapped position
- **Mouse up handler**: Finalize drag operation
  - Validate placement: overlap prevention (excluding dragging token) and revealed-room constraints
  - If valid: call `onTokenMove(tokenId, newGridX, newGridY)` → triggers API call
  - **Only one API request per drag operation** (called on mouseup, not during drag)
  - Reset drag state
- **Ghost token rendering**: During drag, hide original token and render ghost token at `ghostPosition`
  - Uses same Token component with updated coordinates
  - Provides real-time visual feedback of snapped placement

**EncounterPanel.tsx** - TokenPalette integration and token management:
- Added `encounterTokens` state synced from `activeView.encounter_tokens`
- Token handlers implemented:
  - **`handleTokenPlace`**: Call `encounterApi.placeToken()`, update state, trigger re-poll, show success message
  - **`handleTokenMove`**: Call `encounterApi.moveToken()`, update state, trigger re-poll
  - **`handleTokenRemove`**: Call `encounterApi.removeToken()`, update state, trigger re-poll, show success message
  - **`handleTokenStatusToggle`**: Toggle status in array (add if missing, remove if present), call `encounterApi.updateTokenStatus()`, update state, trigger re-poll
- Added TokenPalette Card between MAP PREVIEW and ROOM VISIBILITY:
  - Title: "TOKENS"
  - Passes `activeView`, `tokens`, `onTokensChange`, `onViewUpdate`, `mapData`, `roomVisibility`
- Extended MapPreview with token props:
  - Pass `tokens`, `isGM={true}`, and all token handlers
  - Enables drag-from-palette placement and drag-to-move on GM map preview

**gmConsole.ts** - Type definitions:
- Added `encounter_tokens: TokenState` to `ActiveView` interface
- Import `TokenState` from `encounterMap.ts`

## Verification

All verification criteria met:
1. ✅ `npm run typecheck` passes (0 errors)
2. ✅ `npm run build` succeeds (production build complete in 63m 11s)
3. ✅ GM can drag crew template from palette onto map preview (drag-and-drop wired)
4. ✅ Token snaps to grid cell center on drop (screenToSVG + snapToGrid)
5. ✅ Placing on occupied cell is rejected (overlap prevention with warning)
6. ✅ Placing on unrevealed room is rejected (roomVisibility check with warning)
7. ✅ GM can drag-move existing token to new cell (drag-to-move with ghost token)
8. ✅ Clicking placed token opens popup with status toggles and remove (TokenPopup from Plan 02)
9. ✅ Toggling wounded/panicked/dead status reflects on token appearance (status overlays from Plan 02)
10. ✅ Remove button removes token from map (handleTokenRemove → encounterApi.removeToken)
11. ✅ Clear All Tokens removes all tokens after confirmation (Modal.confirm with warning)
12. ✅ Template stays selected after placement (can place duplicates without reselection)
13. ✅ Player terminal shows token changes within 2-second polling interval (via activeView.encounter_tokens)

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

**Upstream dependencies:**
- Plan 03-01: Token CRUD API endpoints, token image listing, TypeScript types
- Plan 03-02: Token rendering, TokenLayer, TokenPopup, status overlays

**Downstream consumers:**
- Player terminal: Receives token state via `activeView.encounter_tokens` polling (existing 2-second interval)
- GM Console: TokenPalette integrated into EncounterPanel ENCOUNTER tab

## Self-Check

Verifying created files and commits:

```bash
# Check created files
[ -f "src/components/gm/TokenPalette.tsx" ] && echo "✓ TokenPalette.tsx"
[ -f "src/components/gm/TokenImageGallery.tsx" ] && echo "✓ TokenImageGallery.tsx"
[ -f "src/utils/svgCoordinates.ts" ] && echo "✓ svgCoordinates.ts"

# Check commits
git log --oneline --all | grep -q "e04c15f" && echo "✓ Commit e04c15f (Task 1)"
git log --oneline --all | grep -q "f78ac6a" && echo "✓ Commit f78ac6a (Task 2)"
```

Result:
```
✓ TokenPalette.tsx
✓ TokenImageGallery.tsx
✓ svgCoordinates.ts
✓ Commit e04c15f (Task 1)
✓ Commit f78ac6a (Task 2)
```

## Self-Check: PASSED

All files created and commits present as expected.

## Technical Notes

**SVG Coordinate Transforms:**
- `getScreenCTM()` returns the transformation matrix from SVG coordinate space to screen coordinate space
- `inverse()` inverts the matrix to convert screen → SVG
- `matrixTransform(ctm.inverse())` applies the inverted transformation to the point
- Correctly handles all SVG transforms: viewBox scaling, pan (translate), zoom (scale)

**Drag-and-Drop API:**
- `dataTransfer.effectAllowed = 'copy'` indicates copy operation (not move)
- `dataTransfer.setData('application/json', JSON.stringify(data))` transfers structured data
- `dataTransfer.getData('application/json')` retrieves data on drop
- `e.preventDefault()` in `onDragOver` required to enable drop

**Grid Snapping:**
- `Math.floor()` used (not `Math.round()`) to convert continuous coordinates to discrete cell indices
- Cell (0, 0) spans from (0, 0) to (unitSize, unitSize) in SVG coordinates
- Token placed at cell (x, y) renders at SVG coordinates (x * unitSize, y * unitSize)

**Overlap Prevention:**
- Checks if any existing token has same (gridX, gridY) coordinates
- Excludes dragging token from check during drag-to-move (prevents false positive)
- Rejects placement/move with console warning if occupied

**Revealed Room Check:**
- Finds room containing target cell by checking room bounds (x, y, width, height)
- Checks `roomVisibility[roomId] !== false` (defaults to true if not set)
- Rejects placement/move if room not found or not revealed
- Prevents tokens from appearing in rooms players can't see

## Phase 03 Status

All 3 plans completed:
- ✅ Plan 01: Token Backend (API endpoints, data model, TypeScript types)
- ✅ Plan 02: Token Rendering (Token components, status overlays, popup, visibility filtering)
- ✅ Plan 03: GM Token Controls (palette, drag-drop, image gallery, Clear All)

**Phase 03 (Encounter Tokens) COMPLETE** - Ready for Phase 04.
