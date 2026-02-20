---
phase: 04-npc-portrait-system
plan: 01
subsystem: api
tags: [django, jsonfield, migration, encounter, portraits, npc]

# Dependency graph
requires:
  - phase: 03-encounter-tokens
    provides: encounter_tokens JSONField pattern and encounter API endpoint structure
provides:
  - encounter_active_portraits JSONField on ActiveView (ordered list of NPC IDs)
  - /api/gm/encounter/toggle-portrait/ POST endpoint (add/remove NPC from portrait list)
  - encounter_active_portraits and encounter_npc_data in every /api/active-view/ response
  - Portrait list reset when switching encounter locations via api_switch_view
affects:
  - 04-02 (NPCPortraitOverlay component reads encounter_active_portraits and encounter_npc_data from poll)
  - 04-03 (GM console UI triggers toggle-portrait endpoint)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSONField default=list for ordered ID collections (vs default=dict for maps)"
    - "Always-include pattern: NPC data appended to every active-view poll response (negligible overhead for ~4 NPCs)"
    - "Portal reset on location switch: clear portrait list in is_new_encounter_location block"

key-files:
  created:
    - terminal/migrations/0016_add_encounter_active_portraits.py
  modified:
    - terminal/models.py
    - terminal/views.py
    - terminal/urls.py

key-decisions:
  - "default=list (not default=dict) for encounter_active_portraits since it is an ordered list of IDs, not a map"
  - "Always include encounter_npc_data in every active-view response (not ENCOUNTER-only) to avoid second request from portrait overlay"
  - "Filter NPCs by id presence (if npc.get('id')) to guard against malformed NPC data"
  - "Use separate loader_for_npcs variable to avoid name collision with existing loader in ENCOUNTER-specific block"
  - "Portrait clear is unconditional on new encounter location (outside if location.get('map') guard)"

patterns-established:
  - "Toggle pattern: read list, if present remove else append, save - matches toggle-room pattern in existing code"

requirements-completed: [PORT-01, PORT-04]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 4 Plan 01: NPC Portrait System Backend Summary

**encounter_active_portraits JSONField on ActiveView with toggle API endpoint and NPC data baked into every active-view poll response**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T15:15:38Z
- **Completed:** 2026-02-20T15:17:27Z
- **Tasks:** 2
- **Files modified:** 4 (models.py, views.py, urls.py, migration)

## Accomplishments
- Added `encounter_active_portraits` JSONField (default=list) to ActiveView model with migration 0016
- Extended `/api/active-view/` response to always include `encounter_active_portraits` (list) and `encounter_npc_data` (id->NPC map)
- Added `api_encounter_toggle_portrait` POST endpoint at `/api/gm/encounter/toggle-portrait/` with add/remove toggle logic
- Portrait list clears unconditionally when switching to a new encounter location in `api_switch_view`

## Task Commits

Each task was committed atomically:

1. **Task 1: Add encounter_active_portraits JSONField and migration** - `1ad4e99` (feat)
2. **Task 2: Toggle-portrait endpoint, extended active-view response, URL** - `4eda95d` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `terminal/models.py` - Added encounter_active_portraits JSONField after encounter_tokens
- `terminal/migrations/0016_add_encounter_active_portraits.py` - Migration to add the field
- `terminal/views.py` - Extended get_active_view_json, added api_encounter_toggle_portrait, updated api_switch_view
- `terminal/urls.py` - Registered toggle-portrait URL

## Decisions Made
- default=list not default=dict: this field is an ordered list of NPC IDs for overlay display order, not a lookup map
- Always include encounter_npc_data in every poll response (not gated on ENCOUNTER view type) so the portrait overlay component has name/image data without needing a separate API request
- Added `if npc.get('id')` guard in the dict comprehension to skip NPCs without IDs (defensive coding)
- Used separate `loader_for_npcs` variable to avoid shadowing the `loader` variable used later in the ENCOUNTER-specific block of the same function
- Portrait clear placed before the `if location and location.get('map'):` check so portraits always clear on encounter location switch, even if the location has no map

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all verification commands passed cleanly. Django system check clean, migration applied, URL resolves, NPC data loads (4 NPCs found in campaign data).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend API fully ready for 04-02 (NPCPortraitOverlay frontend component)
- The `/api/active-view/` polling loop now delivers all portrait state in one response
- The toggle endpoint is login-protected (GM-only) and ready for 04-03 GM console UI wiring

---
*Phase: 04-npc-portrait-system*
*Completed: 2026-02-20*
