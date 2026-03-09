---
phase: 08-rework-gm-console-ui
plan: 02
subsystem: ui
tags: [react, encounter-map, tool-rail, slide-out-panel, token-palette]

requires:
  - phase: 08-01
    provides: "GMConsole layout shell with ViewRail, ToolRail, SlideOutPanel components"
  - phase: 03-encounter-tokens
    provides: "TokenPalette, MapPreview, token placement/move/remove handlers"
  - phase: 04-npc-portrait-system
    provides: "NPC portrait data in ActiveView, togglePortrait API"
provides:
  - "EncounterView: full-screen tactical map with floating controls and tool rail"
  - "TokenPalettePanel: thin wrapper for TokenPalette in slide-out panel"
  - "NpcPortraitsPanel: NPC portrait toggle list in slide-out panel"
  - "LocationTreePanel: location tree for encounter location selection"
  - "TerminalsPanel: terminal show/hide controls in slide-out panel"
affects: [08-04, encounter-maps, gm-console]

tech-stack:
  added: []
  patterns:
    - "View-owns-state pattern: EncounterView owns all encounter state (decks, visibility, tokens, doors)"
    - "Thin panel wrappers: panel components are pass-through wrappers around existing domain components"

key-files:
  created:
    - src/components/gm/views/EncounterView.tsx
    - src/components/gm/views/EncounterView.css
    - src/components/gm/panels/TokenPalettePanel.tsx
    - src/components/gm/panels/NpcPortraitsPanel.tsx
    - src/components/gm/panels/LocationTreePanel.tsx
    - src/components/gm/panels/TerminalsPanel.tsx
  modified:
    - src/entries/GMConsole.tsx

key-decisions:
  - "EncounterView owns all encounter state -- EncounterPanel is now dead code"
  - "onViewUpdate callbacks removed from handlers -- SSE is authoritative for state sync"
  - "handleSelectLocation guard removed -- location selection only reachable from EncounterView"
  - "Auto-open locations panel when no location selected for immediate GM guidance"

patterns-established:
  - "View-owns-state: each view component manages its own domain state and API calls"
  - "Panel decomposition: monolithic panels decomposed into view (state) + panel wrappers (presentation)"

requirements-completed: [GMUI-ENCOUNTER, GMUI-TOOLPANELS, GMUI-MAPFULLSCREEN]

duration: 5min
completed: 2026-03-09
---

# Phase 8 Plan 02: Encounter View Summary

**Full-screen encounter map with floating deck/reveal controls and 4 slide-out tool panels (tokens, portraits, locations, terminals)**

## Performance

- **Duration:** 5 min (299s)
- **Started:** 2026-03-09T21:41:55Z
- **Completed:** 2026-03-09T21:46:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- EncounterView renders full-screen tactical map with MapPreview filling the main content area
- Floating top-left controls show deck level dropdown + REVEAL ALL / HIDE ALL buttons
- Right tool rail with 4 icons opens slide-out panels for tokens, portraits, locations, terminals
- Auto-opens locations panel when no encounter location is selected
- All encounter state management lifted from EncounterPanel (606 lines, now dead code)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EncounterView and 4 tool panel components** - `dbc80b1` (feat)
2. **Task 2: Wire EncounterView into GMConsole and remove dead code** - already committed in `bca9d85` (08-03 wiring commit)

## Files Created/Modified
- `src/components/gm/views/EncounterView.tsx` - Full-screen encounter map view with all state management
- `src/components/gm/views/EncounterView.css` - Layout styles for full-screen map + floating controls
- `src/components/gm/panels/TokenPalettePanel.tsx` - Thin wrapper rendering TokenPalette
- `src/components/gm/panels/NpcPortraitsPanel.tsx` - NPC portrait toggle list (SHOW/DISMISS)
- `src/components/gm/panels/LocationTreePanel.tsx` - LocationTree wrapper with selectionEnabled=true
- `src/components/gm/panels/TerminalsPanel.tsx` - Terminal show/hide toggles with active highlighting
- `src/entries/GMConsole.tsx` - Wired EncounterView, removed dead code

## Decisions Made
- EncounterView owns all encounter state (manifest, decks, visibility, doors, tokens) -- moved from EncounterPanel
- Removed all onViewUpdate callbacks from handlers since SSE is authoritative for state sync
- Removed activeView.view_type === 'ENCOUNTER' guard from handleSelectLocation -- location selection only reachable from within EncounterView
- Auto-open locations panel via useEffect when locationSlug is empty

## Deviations from Plan

None - plan executed exactly as written. Task 2 GMConsole wiring was already committed by Plan 08-03 execution (which ran concurrently and wired all views including EncounterView).

## Issues Encountered
- Task 2 GMConsole.tsx changes were already present from 08-03 commit (bca9d85) which wired all views. No additional commit needed for Task 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- EncounterView fully functional with all tool panels
- Ready for Plan 04 (polish, responsive, finishing touches)
- EncounterPanel.tsx is dead code and can be removed in cleanup

---
*Phase: 08-rework-gm-console-ui*
*Completed: 2026-03-09*
