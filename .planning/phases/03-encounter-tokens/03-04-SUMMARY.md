---
phase: 03-encounter-tokens
plan: 04
subsystem: ui
tags: [encounter, tokens, svg, drag-drop, canvas, visibility]

# Dependency graph
requires:
  - phase: 03-encounter-tokens
    provides: TokenLayer with popup support, TokenPalette drag-and-drop, MapPreview with token rendering
provides:
  - Circular canvas drag preview (40x40px) replacing full-size image ghost
  - Custom tokens added to template grid for reuse and drag placement
  - GM console token popup enabled via selectedTokenId state in MapPreview
  - EncounterMapRenderer.css imported in MapPreview for token label styling
  - Strict room visibility filter (=== true) preventing token bleed into hidden rooms
affects: [player-view, encounter-tokens, gm-console]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Canvas-based drag image pattern: createElement canvas, clip arc, drawImage, setDragImage, requestAnimationFrame cleanup
    - Image pre-loading cache pattern: useRef<Map<string,HTMLImageElement>> loaded on template mount
    - Strict boolean equality for visibility gates (=== true vs !== false)

key-files:
  created: []
  modified:
    - src/components/gm/TokenPalette.tsx
    - src/components/gm/MapPreview.tsx
    - src/components/domain/encounter/TokenLayer.tsx

key-decisions:
  - "Drag preview canvas rendered off-screen at -100px top, removed via requestAnimationFrame after setDragImage call"
  - "Image cache uses useRef<Map> keyed by URL; images pre-loaded on template array population and on custom token creation"
  - "Fallback drag preview draws colored circle + initial letter when image not yet loaded or URL is empty"
  - "Custom tokens added to templates array (setTemplates) so they appear in grid and can be re-dragged after creation"
  - "Visibility filter changed from !== false to === true - undefined/missing room_id now hides token from players"

patterns-established:
  - "Canvas drag preview pattern: create off-screen canvas, set arc clip, drawImage, setDragImage with center hotspot, rAF cleanup"
  - "Image preload cache: map of URL -> HTMLImageElement loaded before drag starts for synchronous canvas draw"

# Metrics
duration: 2min
completed: 2026-02-17
---

# Phase 3 Plan 4: UAT Gap Closure Summary

**5 UAT root causes patched: circular canvas drag preview, custom token grid placement, GM token popup wiring, CSS token label import, and strict player visibility filter**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-17T03:17:58Z
- **Completed:** 2026-02-17T03:20:02Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Drag preview now shows a 40x40 circular token image (not full-size portrait) using canvas API
- Custom tokens created in the palette appear in the template grid and can be re-dragged and reused
- GM console token click now shows popup with name, status toggles (wounded/panicked/stunned), and remove button
- Token labels in GM console show correct initial/full name behavior with readable text (CSS now imported)
- Tokens in unrevealed rooms are now strictly hidden from players (visibility filter changed to `=== true`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix TokenPalette drag preview and custom token placement** - `a0723b5` (fix)
2. **Task 2: Fix MapPreview token popup, CSS import, and TokenLayer visibility filter** - `0faa64f` (fix)

**Plan metadata:** (docs commit - see below)

## Files Created/Modified
- `src/components/gm/TokenPalette.tsx` - Canvas drag preview, image preload cache, custom tokens added to template array, form field clear
- `src/components/gm/MapPreview.tsx` - selectedTokenId state, onTokenSelect wiring to TokenLayer, EncounterMapRenderer.css import
- `src/components/domain/encounter/TokenLayer.tsx` - Visibility filter changed from `!== false` to `=== true`

## Decisions Made
- Canvas drag preview created off-screen at `top: -100px` and removed via `requestAnimationFrame` after `setDragImage` call - this is the correct browser-compatible pattern
- Image cache uses `useRef<Map<string, HTMLImageElement>>` so images are pre-loaded synchronously when drag starts
- Fallback drag preview (when image not loaded) draws a solid colored circle with the token initial letter - matches the template grid thumbnail style
- Visibility filter `=== true` is stricter than `!== false` - rooms without an entry in roomVisibility are now hidden from players (safer default)
- Custom token form fields cleared after creation for UX readiness for next token

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 8 previously failing UAT tests should now pass on manual re-test
- Phase 3 (Encounter Tokens) is fully complete including UAT gap closure
- Ready to move to Phase 4

## Self-Check

Files exist:
- `src/components/gm/TokenPalette.tsx` - FOUND
- `src/components/gm/MapPreview.tsx` - FOUND
- `src/components/domain/encounter/TokenLayer.tsx` - FOUND

Commits:
- `a0723b5` - FOUND (Task 1)
- `0faa64f` - FOUND (Task 2)

## Self-Check: PASSED

---
*Phase: 03-encounter-tokens*
*Completed: 2026-02-17*
