---
phase: 04-npc-portrait-system
plan: 02
subsystem: ui
tags: [typescript, react, api-client, encounter, npc-portraits]

# Dependency graph
requires: []
provides:
  - NpcPortraitData interface exported from src/types/gmConsole.ts
  - encounter_active_portraits and encounter_npc_data fields in ActiveView (gmConsole.ts)
  - Optional encounter_active_portraits? and encounter_npc_data? in SharedConsole.tsx local ActiveView
  - encounterApi.togglePortrait(npcId) method POSTing to /api/gm/encounter/toggle-portrait/
affects:
  - 04-03 (EncounterPanel NPC portrait toggle UI depends on these types and API method)
  - 04-04 (PortraitOverlay display depends on NpcPortraitData type and SharedConsole portrait fields)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - NpcPortraitData as shared interface for NPC portrait state across GM and player views
    - Optional portrait fields in SharedConsole.tsx local interface to handle old cached API responses
    - encounterApi pattern: async function + export object member for all encounter GM actions

key-files:
  created: []
  modified:
    - src/types/gmConsole.ts
    - src/entries/SharedConsole.tsx
    - src/services/encounterApi.ts

key-decisions:
  - "ActiveView in gmConsole.ts uses required fields (no ?) since GM console always receives portrait data from API"
  - "SharedConsole.tsx local ActiveView uses optional fields (?) to handle old cached responses without portrait data"
  - "NpcPortraitData portrait field is a URL string (empty string when no image) matching existing token image_url pattern"
  - "togglePortrait returns active_portraits array so caller can update UI state without waiting for next poll"

patterns-established:
  - "NpcPortraitData: { id, name, portrait } - lightweight interface for portrait display"
  - "encounterApi functions defined before export object, then referenced by name in export"

requirements-completed: [PORT-01]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 4 Plan 02: NPC Portrait TypeScript Types and API Client Summary

**NpcPortraitData interface, ActiveView portrait fields, and encounterApi.togglePortrait() method enabling portrait overlay system**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-20T15:15:23Z
- **Completed:** 2026-02-20T15:17:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added NpcPortraitData TypeScript interface to gmConsole.ts for use across GM console components
- Extended ActiveView in both gmConsole.ts and SharedConsole.tsx with encounter_active_portraits and encounter_npc_data fields
- Added encounterApi.togglePortrait(npcId) method that POSTs to the backend toggle-portrait endpoint

## Task Commits

Each task was committed atomically:

1. **Task 1: Add NPC portrait types to gmConsole.ts and SharedConsole.tsx** - `2557dc6` (feat)
2. **Task 2: Add togglePortrait method to encounterApi.ts** - `bfda7a1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/types/gmConsole.ts` - Added NpcPortraitData interface; added encounter_active_portraits and encounter_npc_data to ActiveView
- `src/entries/SharedConsole.tsx` - Added optional encounter_active_portraits? and encounter_npc_data? to local ActiveView interface
- `src/services/encounterApi.ts` - Added togglePortrait function and export

## Decisions Made
- gmConsole.ts ActiveView uses required fields (non-optional) since the GM API will always return portrait data; SharedConsole.tsx uses optional fields to avoid breaking old cached responses
- portrait field in NpcPortraitData is a URL string (empty string = no image) matching the token image_url pattern already established in Phase 3
- togglePortrait returns `{ success, active_portraits }` so callers can optimistically update UI without waiting for the next poll cycle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Types and API client complete; Plan 04-03 (EncounterPanel toggle UI) and 04-04 (PortraitOverlay display) can now import NpcPortraitData and call encounterApi.togglePortrait()
- No blockers

---
*Phase: 04-npc-portrait-system*
*Completed: 2026-02-20*
