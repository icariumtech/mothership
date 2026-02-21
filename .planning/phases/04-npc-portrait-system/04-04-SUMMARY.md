---
phase: 04-npc-portrait-system
plan: 04
subsystem: ui
tags: [react, portrait, encounter, animation, crt]

requires:
  - phase: 04-03
    provides: NPCPortraitCard, NPCPortraitOverlay, EncounterPanel toggle UI

provides:
  - Human-verified NPC portrait system end-to-end

affects: []

tech-stack:
  added: []
  patterns:
    - "Panel component used with padding=0 and .panel-content.no-scroll margin:2px override for flush image panels"

key-files:
  created: []
  modified:
    - src/components/domain/encounter/NPCPortraitCard.tsx
    - src/components/domain/encounter/NPCPortraitOverlay.css

key-decisions:
  - "Removed redundant border div wrapping Panel — was causing rectangular box artifact with chamfers appearing inside"
  - "Panel padding=0 with 2px margin override on panel-content.no-scroll keeps border lines visible while image fills the frame"
  - "portrait-panel CSS class used to scope panel-content overrides without touching Panel component"

patterns-established:
  - "Flush image panels: Panel padding=0 + .your-panel .panel-content.no-scroll { margin: 2px } — keeps border visible"

requirements-completed:
  - PORT-01
  - PORT-02
  - PORT-03
  - PORT-04
  - PORT-05

duration: 10min
completed: 2026-02-21
---

# Phase 04-04: Human Verification Summary

**NPC portrait system verified end-to-end — portraits appear within 2s, CRT animations work, tiling and dismiss correct, panel borders fixed flush to image**

## Performance

- **Duration:** 10 min
- **Completed:** 2026-02-21
- **Tasks:** 1 (human verification + panel polish)

## Accomplishments

- GM can show/dismiss NPC portraits from EncounterPanel — appears on terminal within polling cycle (≤2s)
- Portrait reveal animation (flicker → scan-wipe → name typewriter) confirmed working
- Multiple portraits tile side-by-side correctly
- Dismiss fade-out plays smoothly before unmount
- Portrait card panel border fixed — removed erroneous wrapper div, correct 2px content margin

## Task Commits

1. **Panel fix: remove extra border wrapper** - `ad60946` (fix)
2. **Panel fix: 2px margin on panel-content.no-scroll** - `7e241c1` (fix)

## Files Created/Modified

- `src/components/domain/encounter/NPCPortraitCard.tsx` — removed redundant border div, set padding=0, added portrait-panel class
- `src/components/domain/encounter/NPCPortraitOverlay.css` — added .portrait-panel .panel-content.no-scroll margin:2px override

## Decisions Made

- Panel component used correctly — no extra wrapper div, the Panel itself provides the chamfered border
- `padding={0}` + `margin: 2px` pattern established for flush-image panels (border stays visible)

## Deviations from Plan

None — plan was human verification only; panel polish was minor fix during verification.

## Issues Encountered

Portrait card had two visual bugs caught during human verification:
1. Extra `<div style={{ border: '1px solid #4a6b6b' }}>` wrapper around Panel created rectangular box with chamfers appearing "inside" rather than cutting corners
2. Default `panel-content` margin was zero (overridden) causing image to cover the 1px border lines — fixed with 2px margin

## Next Phase Readiness

Phase 04 complete. Ready for Phase 05.

---
*Phase: 04-npc-portrait-system*
*Completed: 2026-02-21*
