---
phase: 13-atmospheric-ui-animations-for-player-facing-transitions-and-element-reveals
plan: 03
subsystem: ui
tags: [css-animation, svg, encounter-map, keyframes, react]

requires:
  - phase: 07-grid-based-encounter-map-redesign
    provides: EncounterMapRenderer with roomVisibility prop and room group SVG elements

provides:
  - CRT flicker animation on encounter map room reveal (roomFlickerIn keyframe, 0.4s steps(1))
  - CRT flicker animation on encounter map room hide (roomFlickerOut keyframe)
  - REVEAL ALL / HIDE ALL cascade stagger via Y-sorted room index (75ms per room)
  - SVG opacity presentation attribute removal during animation window
  - Token fade-in (200ms delay) for tokens in newly-revealed rooms

affects:
  - encounter map rendering
  - player terminal encounter view

tech-stack:
  added: []
  patterns:
    - "usePrevious pattern via useRef to detect roomVisibility transitions without extra hook"
    - "SVG opacity attribute omitted during animation; CSS animation controls opacity; attribute restored after"
    - "CSS custom property --token-reveal-delay passed inline for per-token stagger"
    - "roomAnimState Map cleared via setTimeout after animation window closes (400ms + stagger + 50ms buffer)"

key-files:
  created: []
  modified:
    - src/components/domain/encounter/EncounterMapRenderer.css
    - src/components/domain/encounter/EncounterMapRenderer.tsx
    - src/components/domain/encounter/TokenLayer.tsx

key-decisions:
  - "SVG opacity presentation attribute must be set to undefined during animation; CSS cannot override inline SVG attributes"
  - "room-gm-dim CSS class handles GM's 0.25 opacity for hidden rooms, replacing inline opacity prop"
  - "Token reveal animation is player-only (isGM check); GM already sees all tokens without animation"
  - "newlyRevealedRooms tracked in TokenLayer separately from roomAnimState in EncounterMapRenderer — each component owns its own animation concern"

requirements-completed: [ANIM-ROOM]

duration: 5min
completed: 2026-03-28
---

# Phase 13 Plan 03: Room Reveal Animations Summary

**CRT flicker keyframe animations for encounter map room reveals with Y-sorted cascade stagger and delayed token fade-in**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T00:12:21Z
- **Completed:** 2026-03-28T00:17:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Room reveal triggers `roomFlickerIn` CSS keyframe (0.4s, steps(1) — CRT scan-in effect) applied via `room-revealing` class on `.encounter-map__room-group`
- Room hide triggers `roomFlickerOut` CSS keyframe (reverse flicker, ends at opacity:0) applied via `room-hiding` class
- REVEAL ALL and HIDE ALL cascade top-to-bottom: rooms sorted by Y centroid, each gets `animationDelay: index * 75ms`
- SVG `opacity` presentation attribute removed during animation window so CSS keyframes can control opacity; attribute restored after clear
- Tokens in newly-revealed rooms get `encounter-map__token-reveal` class with 200ms `--token-reveal-delay` CSS custom property (fade-in after room flicker)

## Task Commits

1. **Task 1: Add room reveal/hide CSS keyframes** - `ff34516` (feat)
2. **Task 2: Wire room reveal animations in EncounterMapRenderer and TokenLayer** - `38b757a` (feat)

## Files Created/Modified

- `src/components/domain/encounter/EncounterMapRenderer.css` - Added roomFlickerIn/Out keyframes, room-revealing/room-hiding/room-gm-dim classes, tokenRevealFadeIn keyframe with encounter-map__token-reveal class
- `src/components/domain/encounter/EncounterMapRenderer.tsx` - Added roomAnimState useState, prevRoomVisibilityRef, roomSortedIndex useMemo, roomVisibility change useEffect; renderRoom updated to use roomGroupClass/svgOpacity/staggerDelay for all three room shape branches
- `src/components/domain/encounter/TokenLayer.tsx` - Added prevRoomVisibilityRef, newlyRevealedRooms state, useEffect detecting newly-revealed rooms; token wrapper `<g>` gets reveal class and CSS var delay

## Decisions Made

- SVG opacity presentation attribute must be `undefined` during animation — CSS animations cannot override SVG presentation attributes, only CSS properties
- `room-gm-dim` CSS class (opacity: 0.25) replaces the `opacity={roomOpacity}` SVG attribute for the GM-dim case; this lets the transition from the CSS class be smooth via `transition: opacity 0.2s ease` on `.encounter-map__room-group`
- Token reveal animation is player-only — GM already sees all tokens and does not need the reveal animation
- `newlyRevealedRooms` state lives in TokenLayer (not threaded from EncounterMapRenderer) — each component detects its own visibility transitions independently

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The linter (Biome or Prettier) reverted partial edits to EncounterMapRenderer.tsx twice during execution. Resolved by batching all state/useEffect additions into a single Edit call targeting a complete contiguous block.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Room animation infrastructure complete; ready for additional atmospheric effects in remaining 13-0x plans
- CSS keyframe pattern established (steps(1) for CRT digital flicker) matches NPCPortraitOverlay.css portrait-flicker pattern

---
*Phase: 13-atmospheric-ui-animations-for-player-facing-transitions-and-element-reveals*
*Completed: 2026-03-28*

## Self-Check: PASSED

- EncounterMapRenderer.css: FOUND
- EncounterMapRenderer.tsx: FOUND
- TokenLayer.tsx: FOUND
- Commits ff34516 and 38b757a: verified via git log
