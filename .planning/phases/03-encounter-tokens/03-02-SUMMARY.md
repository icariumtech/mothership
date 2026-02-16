---
phase: 03-encounter-tokens
plan: 02
subsystem: encounter-tokens
tags: [frontend, tokens, rendering, polling]
dependency_graph:
  requires: [03-01]
  provides: [token-rendering, token-visibility-filtering, token-popup]
  affects: [encounter-map-renderer, shared-console]
tech_stack:
  added: [Token, TokenLayer, TokenStatusOverlay, TokenPopup]
  patterns: [SVG-clipping, type-colored-glows, room-visibility-filtering]
key_files:
  created:
    - src/components/domain/encounter/Token.tsx
    - src/components/domain/encounter/TokenStatusOverlay.tsx
    - src/components/domain/encounter/TokenPopup.tsx
    - src/components/domain/encounter/TokenLayer.tsx
  modified:
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/domain/encounter/EncounterMapRenderer.css
    - src/components/domain/encounter/EncounterMapDisplay.tsx
    - src/components/domain/encounter/EncounterView.tsx
    - src/entries/SharedConsole.tsx
decisions:
  - "Circular tokens with SVG clipPath for round image clipping"
  - "Type-colored glow/shadow using SVG filters (amber/teal/burgundy/gray)"
  - "Initial label by default, full name on hover using CSS display toggle"
  - "Status overlays positioned around token perimeter (wounded top-right, stunned top-left)"
  - "Room visibility filtering: GM sees all tokens, players only see tokens in revealed rooms"
  - "Player view is read-only (isGM=false, no token manipulation callbacks)"
metrics:
  duration_seconds: 292
  tasks_completed: 2
  files_created: 4
  files_modified: 5
  commits: 2
  completed_at: "2026-02-16T15:23:46Z"
---

# Phase 3 Plan 2: Token Rendering Summary

**One-liner:** Circular image tokens with type-colored glows, status overlays, inline popup, room visibility filtering, and player terminal polling integration.

## Objective

Implement token rendering on the encounter map with circular clipped images, type-based colored glows, status indicators, inline popup for details, room-based visibility filtering for players, and integration with existing 2-second polling.

## Tasks Completed

### Task 1: Token Component Suite (7200342)
Created four core token components with SVG-based rendering:

**Token.tsx** - Individual token rendering:
- Circular image clipping using SVG `<clipPath>` and `<circle>`
- Fallback appearance: colored circle with initial letter when no image
- Type-colored glow/shadow using SVG filters with `feGaussianBlur`
  - Player: amber (#8b7355)
  - NPC: teal (#4a6b6b)
  - Creature: burgundy (#6b4a4a)
  - Object: gray (#5a5a5a)
- Label system: initial by default, full name on hover (CSS-based toggle)
- Drag support placeholder for GM view
- Click handler for popup toggle

**TokenStatusOverlay.tsx** - Status indicator rendering:
- Wounded: red dot at top-right with pulse animation
- Dead: red X across entire token (semi-transparent)
- Panicked: dashed amber ring with pulse animation
- Stunned: blue-gray dot at top-left

**TokenPopup.tsx** - Inline details popup:
- Positioned to right of token using SVG `<foreignObject>`
- Displays token name, type, current status tags
- GM controls (when isGM=true): status toggle buttons, remove button
- Player view (isGM=false): read-only display with name and status
- Close button to dismiss popup

**TokenLayer.tsx** - Token collection manager:
- Filters tokens by room visibility:
  - GM view (isGM=true): shows ALL tokens regardless of room
  - Player view (isGM=false): only shows tokens in revealed rooms or unassigned tokens
- Renders all visible Token components
- Manages selected token state and popup display
- Passes callbacks for token manipulation (move, remove, status toggle)

**CSS additions** (EncounterMapRenderer.css):
- Token cursor styles (grab/pointer)
- Label visibility toggle (initial/full)
- Status indicator pulse animations
- Popup styling with terminal aesthetic
- Token hidden state (40% opacity)

### Task 2: Integration and Polling (524a2d5)
Integrated token layer into encounter map rendering pipeline:

**EncounterMapRenderer.tsx** - Token rendering:
- Accept tokens, isGM, and token callback props
- Render TokenLayer above all other map elements (after POIs)
- Prevent map panning when clicking on tokens
- Track selected token ID for popup display

**EncounterMapDisplay.tsx** - Prop forwarding:
- Extended props interface with token-related fields
- Pass tokens through to EncounterMapRenderer for both single-deck and multi-deck maps

**EncounterView.tsx** - View layer integration:
- Accept token props and forward to EncounterMapDisplay
- Support for both GM and player view modes

**SharedConsole.tsx** - Polling integration:
- Added `encounterTokens` state (TokenState)
- Updated polling handler to extract `encounter_tokens` from API response
- Pass tokens to EncounterView with `isGM={false}` for read-only player view
- Full data flow: `/api/active-view/` → SharedConsole → EncounterView → EncounterMapDisplay → EncounterMapRenderer → TokenLayer → Token

## Deviations from Plan

None - plan executed exactly as written.

## Verification

✅ TypeScript type checking passes
✅ Production build succeeds
✅ Token components render with correct SVG structure
✅ Room visibility filtering implemented (GM vs player logic)
✅ Polling integration extracts encounter_tokens from API
✅ Data flow complete: polling → SharedConsole → EncounterView → renderer → TokenLayer

## Testing Notes

**Manual testing required:**
1. Place tokens via GM console API
2. Verify tokens appear on encounter map in player terminal
3. Check that tokens in hidden rooms are not visible to players
4. Verify circular image clipping works
5. Test fallback appearance for tokens without images
6. Confirm status overlays display correctly
7. Test inline popup shows on token click

## What's Next

Phase 3 Plan 3 (03-03) will implement drag-and-drop token placement in the GM console, completing the encounter token system.

## Self-Check: PASSED

**Created files verified:**
- ✅ src/components/domain/encounter/Token.tsx
- ✅ src/components/domain/encounter/TokenStatusOverlay.tsx
- ✅ src/components/domain/encounter/TokenPopup.tsx
- ✅ src/components/domain/encounter/TokenLayer.tsx

**Commits verified:**
- ✅ 7200342: feat(03-02): create Token, TokenStatusOverlay, TokenPopup, and TokenLayer components
- ✅ 524a2d5: feat(03-02): integrate TokenLayer into EncounterMapRenderer and wire polling

**Modified files verified:**
- ✅ src/components/domain/encounter/EncounterMapRenderer.tsx
- ✅ src/components/domain/encounter/EncounterMapRenderer.css
- ✅ src/components/domain/encounter/EncounterMapDisplay.tsx
- ✅ src/components/domain/encounter/EncounterView.tsx
- ✅ src/entries/SharedConsole.tsx
