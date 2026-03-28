---
phase: 13-atmospheric-ui-animations-for-player-facing-transitions-and-element-reveals
plan: 01
subsystem: ui
tags: [react, gsap, css-animation, sse, typescript, transitions]

# Dependency graph
requires:
  - phase: 05-real-time-push-architecture
    provides: SSE useSSE hook and onEvent callback structure in SharedConsole
  - phase: 04-npc-portrait-system
    provides: AnimPhase state machine pattern (cancelled flag + async run sequence)
provides:
  - useViewTransition hook — intercepts SSE view_type changes, sequences glitch-out/dark/fade-in
  - ViewStatusOverlay component — center-screen typewriter boot label during transitions
  - CSS transition classes for .console-content-wrapper (view-glitch-out, view-dark, view-fade-in)
  - SharedConsole wired to animate view changes before committing new state
affects: [13-02, 13-03, 13-04, 13-05, any plan modifying SharedConsole SSE onEvent]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "View transition hook: useViewTransition sequences async animation phases, cancelledRef guards stale commits"
    - "Glitch randomization: CSS custom properties (--glitch-x1 etc.) set imperatively on contentRef for per-transition variation"
    - "SSE commit gating: handleViewChange wraps setActiveView so state only commits after dark frame"

key-files:
  created:
    - src/hooks/useViewTransition.ts
    - src/components/ui/ViewStatusOverlay.tsx
    - src/components/ui/ViewStatusOverlay.css
  modified:
    - src/entries/SharedConsole.css
    - src/entries/SharedConsole.tsx

key-decisions:
  - "useViewTransition uses cancelledRef pattern (not state) for cancellation — mirrors NPCPortraitCard AnimPhase design"
  - "commit() called during dark phase (50ms) so React renders new view while screen is black — no flash"
  - "All post-setActiveView logic (BRIDGE reset, overlay sync) moved inside commit callback so it executes after dark frame"
  - "ViewStatusOverlay lives outside console-content-wrapper — it survives the glitch animation and appears above the fade-in"
  - "Encounter tokens update stays outside handleViewChange — not view-dependent, must not be delayed"

patterns-established:
  - "Pattern: wrap SSE commit with animation hook to sequence out-dark-in without losing any state sync logic"
  - "Pattern: contentRef on wrapper div for imperative CSS property randomization without re-renders"

requirements-completed: [ANIM-VIEW]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 13 Plan 01: View Transition Animation System Summary

**CRT signal-change view transition system: useViewTransition hook glitches out outgoing view, dark-frames the swap, fades in new view with typewriter status label**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-28T03:12:20Z
- **Completed:** 2026-03-28T03:15:48Z
- **Tasks:** 2
- **Files modified:** 5 (3 created, 2 modified)

## Accomplishments
- `useViewTransition` hook sequences glitch-out (300ms) → dark frame (50ms) → fade-in (150ms) on every SSE view_type change
- `ViewStatusOverlay` renders per-view typewriter boot labels (TACTICAL DISPLAY INITIALIZING..., BRIDGE SYSTEMS ONLINE, etc.) with CSS fade-out after 2s
- `SharedConsole.tsx` wired: all state sync logic (BRIDGE reset, overlays, CharonDialog) moved into commit callback so nothing executes during the dark frame
- CSS keyframes `viewGlitchOut` and `viewFadeIn` added to SharedConsole.css with randomized CSS custom property glitch directions

## Task Commits

1. **Task 1: Create useViewTransition hook and ViewStatusOverlay component** - `c58bc25` (feat)
2. **Task 2: Add CSS transition classes to SharedConsole and wire useViewTransition** - `dce9a5f` (feat)

**Plan metadata:** _(created in final commit)_

## Files Created/Modified
- `src/hooks/useViewTransition.ts` - Hook that intercepts SSE view_type changes and sequences 4-phase transition animation
- `src/components/ui/ViewStatusOverlay.tsx` - Center-screen typewriter status label component, appears during fade-in
- `src/components/ui/ViewStatusOverlay.css` - Positioning styles + viewStatusFadeOut keyframe (1.6s delay, 0.4s out)
- `src/entries/SharedConsole.css` - Added console-content-wrapper CSS vars + view-glitch-out/view-dark/view-fade-in classes
- `src/entries/SharedConsole.tsx` - Imported hook/component, added wrapper div with dynamic className, wired handleViewChange

## Decisions Made
- `commit()` is called during the dark phase so React renders new view content while screen is black — eliminates any flash of the new view appearing instantly
- All downstream state sync (BRIDGE reset, overlay slugs, CharonDialog state) moved inside the `commit` callback — they must run atomically with `setActiveView`, not before the animation
- `ViewStatusOverlay` is placed as a sibling outside `console-content-wrapper` so it is unaffected by the glitch animation and renders over the fade-in
- `setEncounterTokens` remains outside `handleViewChange` — encounter token updates are not view-type-dependent and should not be delayed by animation

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing unstaged changes in `src/components/domain/encounter/EncounterMapRenderer.tsx` reference two undeclared variables (`roomAnimState`, `roomSortedIndex`), causing `npm run build` to fail. These are out-of-scope WIP changes unrelated to this plan. Logged to deferred items.

## Deferred Issues

**Pre-existing build failure: EncounterMapRenderer.tsx uses undeclared roomAnimState/roomSortedIndex**
- File: `src/components/domain/encounter/EncounterMapRenderer.tsx` lines 941-942
- These are unstaged WIP changes referencing Map variables not yet declared in the file
- Not caused by plan 13-01
- Resolution: whoever completes the encounter room animation work must declare these Maps

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- View transition foundation complete; plan 13-02 can add room-reveal stagger animations in EncounterMapRenderer
- `useViewTransition` is a standalone hook — no coupling to other planned animation work
- The EncounterMapRenderer WIP should be resolved before attempting 13-02 (which modifies the same file)

## Self-Check: PASSED
- FOUND: src/hooks/useViewTransition.ts
- FOUND: src/components/ui/ViewStatusOverlay.tsx
- FOUND: src/components/ui/ViewStatusOverlay.css
- FOUND commit: c58bc25
- FOUND commit: dce9a5f

---
*Phase: 13-atmospheric-ui-animations-for-player-facing-transitions-and-element-reveals*
*Completed: 2026-03-28*
