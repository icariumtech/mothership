---
phase: 04-npc-portrait-system
plan: 03
subsystem: ui
tags: [react, typescript, css-animation, encounter, npc-portraits, crt-effects]

# Dependency graph
requires:
  - phase: 04-01
    provides: Backend toggle-portrait endpoint and encounter_active_portraits JSONField
  - phase: 04-02
    provides: NpcPortraitData TypeScript interface, ActiveView portrait fields, encounterApi.togglePortrait()
provides:
  - NPC PORTRAITS section in EncounterPanel GM console (SHOW/DISMISS toggle buttons per NPC)
  - NPCPortraitCard component with flicker→wipe→stable→typing→done CRT animation state machine
  - NPCPortraitOverlay component with dismiss animation using useEffect+useRef pattern
  - NPCPortraitOverlay.css with portrait-flicker, portrait-wipe, portrait-dismiss keyframes and CRT scanline ::after
  - SharedConsole.tsx wired to render NPCPortraitOverlay in ENCOUNTER view when portraits are active
affects:
  - 04-04 (final plan if any; portrait system fully functional after this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CSS clip-path animation for top-to-bottom wipe reveal (portrait-wipe keyframe)
    - CSS steps(1) animation for CRT flicker effect (portrait-flicker keyframe)
    - useRef to track previous prop values for detecting additions/removals without extra renders
    - Animation state machine pattern: flicker→wipe→stable→typing→done driven by async useEffect with cancellation flag
    - setInterval typewriter effect cleared and restarted via useEffect dependency on animPhase
    - CSS ::after pseudo-element for CRT scanlines + vignette overlay on image wrapper

key-files:
  created:
    - src/components/domain/encounter/NPCPortraitCard.tsx
    - src/components/domain/encounter/NPCPortraitOverlay.tsx
    - src/components/domain/encounter/NPCPortraitOverlay.css
  modified:
    - src/components/gm/EncounterPanel.tsx
    - src/entries/SharedConsole.tsx

key-decisions:
  - "npcs derived from Object.values(activeView?.encounter_npc_data || {}) — no new prop, stays fresh from poll"
  - "clip-path applied to .portrait-image-wrapper div, not img element, for Safari compat"
  - "useEffect+useRef pattern for detecting activePortraitIds changes — idiomatic React vs useState comparison"
  - "dismissingIds tracked as Set<string> so multiple cards can dismiss concurrently without conflict"
  - "Panel chamferCorners=['tl','tr','bl','br'] chamferSize=12 for all-four-corner chamfer on portrait card"
  - "ROOM VISIBILITY card given marginBottom: 16 (auto-fix: missing in original to match other cards)"

patterns-established:
  - "Animation state machine: type AnimPhase = literal union, useState drives CSS class, async useEffect with cancelled flag runs sequence"
  - "Dismiss handshake: parent sets isDismissing=true, child plays CSS animation, calls onDismissed after timeout, parent removes from displayedIds"
  - "CRT overlay: repeating-linear-gradient (scanlines) + radial-gradient (vignette) in ::after pseudo-element"

requirements-completed: [PORT-02, PORT-03, PORT-04, PORT-05]

# Metrics
duration: 15min
completed: 2026-02-20
---

# Phase 4 Plan 03: NPC Portrait Frontend Components Summary

**GM console toggle section (SHOW/DISMISS buttons), NPCPortraitCard with CRT flicker/wipe/typewriter reveal, and NPCPortraitOverlay with dismiss animation wired into the player terminal ENCOUNTER view**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-20T17:34:28Z
- **Completed:** 2026-02-20T17:49:16Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- Added NPC PORTRAITS card to EncounterPanel with per-NPC SHOW/DISMISS buttons that reflect encounter_active_portraits state; clicking calls encounterApi.togglePortrait then onViewUpdate
- Built NPCPortraitCard with a 5-phase CSS animation state machine (flicker→wipe→stable→typing→done) and a dismiss handshake pattern for fade-out before unmount
- Built NPCPortraitOverlay with useEffect+useRef to track activePortraitIds changes, mark removed IDs as dismissing, and keep cards rendered until their fade-out completes
- Created NPCPortraitOverlay.css with all keyframes (portrait-flicker, portrait-wipe, portrait-dismiss), CRT scanlines via ::after pseudo-element, and flex tray layout for horizontal tiling
- Wired NPCPortraitOverlay into SharedConsole.tsx ENCOUNTER view block, rendered conditionally when encounter_active_portraits is non-empty

## Task Commits

Each task was committed atomically:

1. **Task 1: Add NPC portrait toggle section to EncounterPanel** - `68486a4` (feat)
2. **Task 2: Build NPCPortraitCard, NPCPortraitOverlay, CSS, and wire into SharedConsole** - `8e59a7a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/gm/EncounterPanel.tsx` - Added handleTogglePortrait callback, npcs/activePortraits derived from activeView, NPC PORTRAITS Card with SHOW/DISMISS buttons
- `src/components/domain/encounter/NPCPortraitCard.tsx` - Single portrait card with CRT animation state machine (flicker→wipe→stable→typing→done) and dismiss handshake
- `src/components/domain/encounter/NPCPortraitOverlay.tsx` - Fixed-position overlay container; tracks displayed vs. dismissing IDs using useEffect+useRef pattern
- `src/components/domain/encounter/NPCPortraitOverlay.css` - All portrait overlay/card/animation styles including portrait-flicker, portrait-wipe, portrait-dismiss keyframes and CRT ::after overlay
- `src/entries/SharedConsole.tsx` - Import NPCPortraitOverlay; wrap ENCOUNTER view in fragment; render NPCPortraitOverlay when encounter_active_portraits is non-empty

## Decisions Made
- Derived NPC list from `Object.values(activeView?.encounter_npc_data || {})` directly in EncounterPanel — no new API call, no new props, stays fresh automatically from the existing poll cycle
- Applied clip-path animation to the `.portrait-image-wrapper` div rather than the `<img>` element for Safari compatibility
- Used `useEffect` + `useRef` to detect activePortraitIds changes (idiomatic React) instead of the `useState` comparison pattern mentioned as a first option in the plan
- `dismissingIds` is a `Set<string>` so multiple cards can be in dismiss animation simultaneously without conflict
- Panel wrapper uses `chamferCorners={['tl', 'tr', 'bl', 'br']}` for all-four-corner angular border on each portrait card

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added marginBottom: 16 to ROOM VISIBILITY card**
- **Found during:** Task 1 (EncounterPanel NPC portraits card)
- **Issue:** ROOM VISIBILITY card had `style={{ background: '#1a1a1a' }}` without `marginBottom: 16`, causing no spacing between it and the new NPC PORTRAITS card below
- **Fix:** Added `marginBottom: 16` to ROOM VISIBILITY card style to match all other cards in the panel
- **Files modified:** src/components/gm/EncounterPanel.tsx
- **Verification:** Consistent with DECK LEVEL, MAP PREVIEW, and TOKENS cards above it
- **Committed in:** 68486a4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minor visual consistency fix, no scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All frontend portrait system components complete
- GM console shows NPC PORTRAITS section with SHOW/DISMISS buttons
- Player terminal renders CRT-animated portrait cards when portraits are active
- Portrait system fully functional end-to-end (backend 04-01, types/API 04-02, frontend 04-03)
- No blockers

---
*Phase: 04-npc-portrait-system*
*Completed: 2026-02-20*
