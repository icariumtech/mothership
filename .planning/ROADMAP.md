# Roadmap: Mothership GM Terminal

## Overview

This milestone extends the existing Bridge view with essential GM tools: campaign logs, ship status tracking, encounter tokens for tactical maps, NPC portrait displays, and real-time push architecture to replace polling. Each phase builds on established patterns (YAML → DataLoader → API → React) while introducing new runtime state management for live gameplay features.

## Phases

- [x] **Phase 1: Campaign Logs Tab** - Display session logs in LOGS bridge tab (rename NOTES)
- [x] **Phase 2: Ship Status Dashboard** - Ship systems and status panels in STATUS bridge tab
- [x] **Phase 3: Encounter Tokens** - Movable tokens on encounter maps with live updates
- [x] **Phase 4: NPC Portrait System** - Portrait overlays during encounters with typewriter effects
- [x] **Phase 5: Real-Time Push Architecture** - Replace polling with SSE, move ActiveView out of DB
- [ ] **Phase 6: UI Audio System** - Click sounds, transitions, and mute toggle

## Phase Details

### Phase 1: Campaign Logs Tab
**Goal**: GM can view and players can read campaign session logs in the Bridge interface
**Depends on**: Nothing (first phase)
**Requirements**: LOGS-01, LOGS-02, LOGS-03
**Success Criteria** (what must be TRUE):
  1. LOGS bridge tab displays session log entries in chronological order
  2. Each log entry shows session number and date
  3. Log data loads from YAML files in campaign data directory
  4. Existing NOTES tab successfully renamed to LOGS without breaking navigation
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Backend data pipeline: DataLoader, Django view, INITIAL_DATA, sample sessions
- [x] 01-02-PLAN.md — Frontend LOGS tab: rename NOTES, LogsSection component, react-markdown rendering

### Phase 2: Ship Status Dashboard
**Goal**: Bridge STATUS tab displays real-time ship systems and operational state
**Depends on**: Phase 1
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04, STAT-05, STAT-06
**Success Criteria** (what must be TRUE):
  1. STATUS bridge tab shows ship name, class, and overall status
  2. Hull integrity and armor values are visible
  3. System status panels display operational state for life support, engines, weapons, and comms
  4. Crew count and capacity are displayed
  5. System status changes animate visually when GM toggles states
  6. GM can toggle system states from the GM Console
**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md — Backend data pipeline: ship.yaml, DataLoader, API endpoints, ActiveView overrides, TypeScript types
- [x] 02-02-PLAN.md — Frontend STATUS tab: StatusSection component with schematic, system panels, hull/armor bars, animations
- [x] 02-03-PLAN.md — GM Console controls: ShipStatusPanel with system state dropdowns

### Phase 3: Encounter Tokens
**Goal**: GM can place and move tokens on encounter maps with live player updates
**Depends on**: Phase 2
**Requirements**: TOKN-01, TOKN-02, TOKN-03, TOKN-04, TOKN-05
**Success Criteria** (what must be TRUE):
  1. GM can place tokens on encounter map grid from GM Console
  2. Tokens snap to grid cells
  3. Tokens visually distinguish between types (player, NPC, creature, object)
  4. GM can drag tokens and players see position updates via polling/push
  5. Tokens display status indicators (wounded, dead, panicked)
**Plans:** 4 plans

Plans:
- [x] 03-01-PLAN.md — Backend data pipeline: ActiveView encounter_tokens field, token CRUD API endpoints, TypeScript types, API client
- [x] 03-02-PLAN.md — Frontend token rendering: TokenLayer, Token, TokenStatusOverlay components, encounter map integration, polling wire-up
- [x] 03-03-PLAN.md — GM Console controls: TokenPalette with placement/status/removal, drag-to-move on encounter map
- [x] 03-04-PLAN.md — UAT gap closure: drag preview sizing, custom token placement, GM popup/labels, room visibility filter

### Phase 4: NPC Portrait System
**Goal**: GM can trigger NPC portrait displays during encounters with atmospheric presentation
**Depends on**: Phase 3
**Requirements**: PORT-01, PORT-02, PORT-03, PORT-04, PORT-05
**Success Criteria** (what must be TRUE):
  1. GM can trigger an NPC portrait display on the terminal from GM Console
  2. Portrait panel shows NPC name and basic info with CRT/amber styling
  3. Portrait appears as overlay during encounter view without obscuring map
  4. Multiple portraits can display simultaneously for group conversations
  5. Portrait reveal uses animated typewriter name and fade-in effect
**Plans:** 3/4 plans executed

Plans:
- [x] 04-01-PLAN.md — Backend: encounter_active_portraits field, toggle-portrait endpoint, active-view response extension
- [x] 04-02-PLAN.md — Frontend foundation: TypeScript types (NpcPortraitData, ActiveView fields), togglePortrait API method
- [x] 04-03-PLAN.md — Frontend features: EncounterPanel NPC section, NPCPortraitOverlay, NPCPortraitCard, CSS animations, SharedConsole wiring
- [x] 04-04-PLAN.md — Human verification: end-to-end test of GM trigger flow and CRT animation sequence

### Phase 5: Real-Time Push Architecture
**Goal**: Replace 2-second polling with Server-Sent Events for instant state updates
**Depends on**: Phase 4
**Requirements**: RTMA-01, RTMA-02, RTMA-03, RTMA-04
**Success Criteria** (what must be TRUE):
  1. Terminal views receive state updates via SSE instead of polling
  2. ActiveView ephemeral state moved out of SQLite (in-memory or cache-backed)
  3. Messages remain in SQLite as persistent data
  4. Database retained and prepared for future auth/credentials use
  5. Token movements and portrait displays update instantly without polling delay
**Plans:** 3/4 plans executed

Plans:
- [x] 05-01-PLAN.md — Backend foundation: active_view_store.py, sse_broadcaster.py, migration to drop ActiveView, SSE streaming endpoint
- [x] 05-02-PLAN.md — Backend views refactor: migrate all 17 write endpoints from ActiveView ORM to store + broadcaster
- [x] 05-03-PLAN.md — Frontend SSE: useSSE hook, SSEConnectionToast, replace polling in SharedConsole and GMConsole
- [x] 05-04-PLAN.md — Human verification: end-to-end latency, connection resilience, database integrity

### Phase 6: UI Audio System

**Status: DEFERRED to v2**

Audio requirements (AUDI-01, AUDI-02, AUDI-03) moved to v2 scope. Phase directory was never created.

### Phase 9: Integration + GM Bridge Polish

**Goal:** Close integration gaps from the v1.0 milestone audit and build out the GM BridgeView main content area.
**Depends on:** Phase 8
**Requirements:** RTMA-01 (integration fix), PORT-03 (integration fix), LOGS-02 (GM side fix)
**Gap Closure:** Closes gaps from v1.0-MILESTONE-AUDIT.md

**Success Criteria** (what must be TRUE):
  1. StatusSection.tsx receives ship status via SSE instead of 3s polling — no latency on system toggles
  2. NPC portrait hover tooltip in NpcPortraitsPanel lets GM preview portrait before showing to players
  3. GM BridgeView SessionDetailView renders markdown correctly (react-markdown)
  4. GM BridgeView main area has fixed two-panel dashboard: left 3D map mirror + right ship status panel
  5. GM ship status toggle controls inline in BridgeView — ship-status slide-out removed

**Plans:** 2/2 plans complete

Plans:
- [x] 09-01-PLAN.md — SSE shipstatus event + StatusSection polling removal + NPC portrait tooltip + SessionDetailView react-markdown
- [x] 09-02-PLAN.md — GM BridgeView main dashboard: breadcrumb bar + 3D map mirror + inline ship status panel + remove ship-status slide-out

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Campaign Logs Tab | 2/2 | ✓ Complete | 2026-02-12 |
| 2. Ship Status Dashboard | 3/3 | ✓ Complete | 2026-02-12 |
| 3. Encounter Tokens | 4/4 | ✓ Complete | 2026-02-21 |
| 4. NPC Portrait System | 4/4 | ✓ Complete | 2026-02-21 |
| 5. Real-Time Push Architecture | 4/4 | ✓ Complete | 2026-03-01 |
| 6. UI Audio System | — | Deferred to v2 | - |
| 7. Grid-Based Encounter Map | 4/4 | ✓ Complete | 2026-03-16 |
| 8. Rework GM Console UI | 4/4 | ✓ Complete | 2026-03-16 |
| 9. Integration + GM Bridge Polish | 2/2 | ✓ Complete | 2026-03-20 |
| 10. Player Ship Map View | 3/3 | ✓ Complete | 2026-03-24 |
| 11. Close Functional + Security Gaps | 1/1 | Complete    | 2026-03-24 |
| 12. Requirements Tracking + Dead Code Cleanup | 1/1 | ✓ Complete | 2026-04-17 |
| 13. Atmospheric UI Animations | 5/5 | Complete   | 2026-03-28 |
| 14. Rework Bridge STATUS Tab | 3/3 | Complete   | 2026-04-07 |
| 15. Data Directory Audit + Bug Fixes | 1/1 | ✓ Complete | 2026-04-18 |
| 16. Ship Data Consolidation | 1/1 | ✓ Complete | 2026-04-18 |

### Phase 7: Grid-based encounter map redesign

**Goal:** Replace the floating-room node-graph encounter map with a true grid-based layout where rooms are defined by grid coordinates, share walls with adjacent rooms, support irregular shapes (L/T/U via multi-rect composition), and carry forward all token placement and room visibility features.
**Depends on:** Phase 6
**Requirements:** GRID-01, GRID-02, GRID-03, GRID-04, GRID-05, GRID-06, GRID-07, GRID-08, GRID-09, GRID-10
**Plans:** 4 plans

Plans:
- [x] 07-01-PLAN.md — TypeScript grid types + YAML map files rebuilt in grid format
- [x] 07-02-PLAN.md — EncounterMapRenderer rewrite (wall-segment algorithm, floor texture, GM click-to-reveal) + EncounterMapDisplay routing
- [x] 07-03-PLAN.md — TokenLayer multi-rect update + MapPreview/EncounterPanel grid support + bulk reveal/hide
- [x] 07-04-PLAN.md — Human verification: visual rendering, room reveal, player terminal, door symbols, token multi-rect

### Phase 8: Rework GM console UI

**Goal:** Redesign the GM console from a flat-tab sidebar layout to a view-driven architecture with a left icon rail, full-content main area, and right-side slide-out tool panels for better usability and screen real estate.
**Depends on:** Phase 7
**Requirements:** GMUI-LAYOUT, GMUI-VIEWRAIL, GMUI-TOOLRAIL, GMUI-SLIDEOUT, GMUI-ENCOUNTER, GMUI-TOOLPANELS, GMUI-MAPFULLSCREEN, GMUI-BRIDGE, GMUI-CHARON, GMUI-STANDBY, GMUI-DISPLAY
**Plans:** 3/4 plans executed

Plans:
- [x] 08-01-PLAN.md — Layout shell: ViewRail, ToolRail, SlideOutPanel components + GMConsole flexbox restructure with view routing
- [x] 08-02-PLAN.md — EncounterView: full-screen map with floating controls + 4 slide-out tool panels (tokens, portraits, locations, terminals)
- [x] 08-03-PLAN.md — BridgeView dashboard, CharonView full-screen, StandbyView, DISPLAY button wiring
- [x] 08-04-PLAN.md — Human verification: all views, navigation, tool panels, map interactions, DISPLAY button, tablet layout

### Phase 10: Player ship map view

**Goal:** Integrate the campaign ship as a first-class location with a real grid deck map visible in BRIDGE mode (player STATUS tab + GM right panel), plus a GM action to set the ship's galactic position from the Locations panel.
**Requirements**: SHIP-01
**Depends on:** Phase 9
**Plans:** 3/3 plans complete

Plans:
- [x] 10-01-PLAN.md — Data layer + backend API: Morrigan deck YAML, DataLoader extensions, api_set_ship_location endpoint, BRIDGE payload branch, TypeScript types
- [x] 10-02-PLAN.md — Frontend bridge rendering: ship deck map in player STATUS tab + GmBridgeShipPanel replacing GmBridgeStatusPanel
- [x] 10-03-PLAN.md — GM ship location setter + end-to-end human verification

### Phase 11: Close Functional + Security Gaps
**Goal:** Fix the three real gaps found by the v1.0 milestone audit: add the NPC portrait overlay to GM EncounterView, secure the ship integrity endpoint, thread the Set Ship Here prop into Encounter locations, and eliminate the GM console loading flash.
**Depends on:** Phase 10
**Requirements:** PORT-03, STAT-06, SHIP-01
**Gap Closure:** Closes functional and security gaps from v1.0-MILESTONE-AUDIT.md

**Success Criteria** (what must be TRUE):
  1. NPCPortraitOverlay renders in GM EncounterView when portraits are toggled — overlay visible on GM screen
  2. `/api/gm/ship-status/integrity/` returns 403 for unauthenticated requests
  3. Right-click "Set Ship Here" context menu appears in Encounter view Locations panel
  4. GM console loads without "No ship data available" flash (INITIAL_DATA injected)

Plans:
- [x] 11-01-PLAN.md — Security fix + NPC portrait overlay + Set Ship Here prop + INITIAL_DATA injection

### Phase 12: Requirements Tracking + Dead Code Cleanup
**Goal:** Bring REQUIREMENTS.md and ROADMAP.md into alignment with the actual implemented state: register orphaned requirements, check off completed grid map requirements, and remove dead code left over from the Phase 09 refactor.
**Depends on:** Phase 11
**Requirements:** SHIP-01 (register), GMUI-LAYOUT, GMUI-VIEWRAIL, GMUI-TOOLRAIL, GMUI-SLIDEOUT, GMUI-ENCOUNTER, GMUI-TOOLPANELS, GMUI-MAPFULLSCREEN, GMUI-BRIDGE, GMUI-CHARON, GMUI-STANDBY, GMUI-DISPLAY (register), GRID-01..10 (check off)
**Gap Closure:** Closes tracking and housekeeping gaps from v1.0-MILESTONE-AUDIT.md

**Success Criteria** (what must be TRUE):
  1. REQUIREMENTS.md contains SHIP-01 entry with description and phase reference
  2. REQUIREMENTS.md contains all 11 GMUI-* requirements with descriptions and Phase 8 reference
  3. GRID-01..10 checkboxes are `[x]` in REQUIREMENTS.md
  4. ShipStatusPanel.tsx and ShipStatusToolPanel.tsx deleted (no more orphaned 5s polling loop)
  5. ROADMAP.md progress table and plan checkboxes reflect actual completed state

Plans:
- [x] 12-01-PLAN.md — REQUIREMENTS.md registration + ROADMAP.md sync + dead code removal

### Phase 13: Atmospheric UI animations for player-facing transitions and element reveals

**Goal:** Add atmospheric CRT-aesthetic animations to player-facing UI transitions and element reveals — view-to-view glitch transitions, overlay entrance/exit animations, encounter room reveal flicker, and bridge panel boot stagger. No new features; pure animation polish on existing player-facing elements.
**Requirements**: ANIM-VIEW, ANIM-OVERLAY, ANIM-ROOM, ANIM-BRIDGE
**Depends on:** Phase 12
**Plans:** 5/5 plans complete

Plans:
- [x] 13-01-PLAN.md — useViewTransition hook + ViewStatusOverlay component + SharedConsole view transition wiring
- [x] 13-02-PLAN.md — Overlay animations: DocumentDialog scan-reveal, CharonDialog flicker-in, CommTerminalDialog scan-reveal, shared exit animation
- [x] 13-03-PLAN.md — Encounter room reveal: CSS flicker keyframes + roomAnimState in EncounterMapRenderer + token delayed reveal in TokenLayer
- [x] 13-04-PLAN.md — Bridge panel boot stagger: BridgeView.css stagger classes + BridgeView.tsx staggerDone state
- [x] 13-05-PLAN.md — Human verification: view transitions, overlay animations, room reveals, bridge stagger

### Phase 14: Rework Bridge STATUS Tab Ship Systems — remove armor, add reactor for ship power vs propulsion, align with official Mothership ship sheet

**Goal:** Rework the player-facing Bridge STATUS tab from DashboardPanel cards to two floating terminal-readout panels (systems + resources) over the deck map. Add reactor as a 5th ship system, add consumable resource tracking (fuel, food, O2, cryopods, escape pods), and provide GM controls for all new fields.
**Requirements**: STAT-10, STAT-11, STAT-12, STAT-13, STAT-14
**Depends on:** Phase 13
**Plans:** 3/3 plans complete

Plans:
- [x] 14-01-PLAN.md — Data layer: ship.yaml reactor + resources, TypeScript types, Django resource endpoint, API client
- [x] 14-02-PLAN.md — Player UI: full rewrite of StatusSection.tsx/CSS with terminal panels, stagger animation, change flash
- [x] 14-03-PLAN.md — GM controls: reactor label in system loop, InputNumber resource spinners in BridgeView

### Phase 20: Audit Closure — Security + Requirements Tracking

**Goal:** Close all remaining v1.0 audit gaps: add @login_required to api_set_ship_location, document api_bridge_selection as intentionally public (player-terminal caller), check off STAT-10..14 (Phase 14 already verified), register untracked ANIM-* requirements with traceability rows, append PORT-03 design-deviation note to Phase 11 VERIFICATION.md, write 6 lightweight evidence-referencing VERIFICATION.md files (phases 04, 05, 07, 08, 10, 13), and remove unused getRoomVisibility/setRoomVisibility exports from encounterApi.ts.
**Requirements:** STAT-10, STAT-11, STAT-12, STAT-13, STAT-14, GRID-01..10, ANIM-VIEW, ANIM-OVERLAY, ANIM-ROOM, ANIM-BRIDGE
**Gap Closure:** Closes all gaps from v1.0-MILESTONE-AUDIT.md (security, unregistered reqs, missing verification artifacts)
**Depends on:** Phase 12
**Plans:** 3 plans

Plans:
- [ ] 20-01-PLAN.md — Security + tech debt: @login_required on api_set_ship_location, intentionally-public docstring on api_bridge_selection, remove getRoomVisibility/setRoomVisibility exports
- [ ] 20-02-PLAN.md — REQUIREMENTS.md updates: flip STAT-10..14 checkboxes, register ANIM-* section, update traceability + coverage count to 51
- [ ] 20-03-PLAN.md — VERIFICATION.md authoring: 6 new files (phases 04, 05, 07, 08, 10, 13) + PORT-03 deviation note appended to 11-VERIFICATION.md (Phase 14 untouched per Pitfall 3)

### Phase 15: Data Directory Audit + Bug Fixes

**Goal:** Establish a clean, verified baseline before the data directory restructure — fix dead code in data_loader.py, strip redundant YAML fields, and run TypeScript/YAML alignment audit.
**Depends on:** Phase 12
**Plans:** 1 plan

Plans:
- [x] 15-01-PLAN.md — Bug fixes (load_location, load_maps, duplicate return None), has_orbit_map cleanup, TypeScript/YAML alignment audit, body_slug validation script

### Phase 16: Ship Data Consolidation

**Goal:** Consolidate the Morrigan's data from 4 files into 2 — move ship.yaml into ship/ and merge deck map files into a single deckplan.yaml.
**Depends on:** Phase 15
**Plans:** 1 plan

Plans:
- [x] 16-01-PLAN.md — Move ship.yaml, create deckplan.yaml, add SHIP_YAML_PATH constant, update find_location_by_slug and views.py

### Phase 17: Characters Per-Entity Files

**Goal:** Split crew.yaml and npcs.yaml into one file per character for easier editing and lower AI token cost.
**Depends on:** Phase 15
**Plans:** 1 plan

Plans:
- [x] 17-01-PLAN.md — Split crew + NPC files, update load_crew/load_npcs with glob + id uniqueness check

### Phase 18: Locations Flat Directory

**Goal:** Move all non-celestial locations from data/galaxy/ nesting into data/locations/{slug}/ with explicit parent references and self-registration into orbit maps.
**Depends on:** Phase 16 (Phase 17 can run independently)
**Plans:** 2 plans

Plans:
- [ ] 18-01-PLAN.md — Data migration + load_all_locations, load_deckplan (git tag pre-location-restructure required first)
- [ ] 18-02-PLAN.md — Views: orbit map self-registration injection, facility counting rewrite, slug disambiguation, encounter manifest call site updates, galaxy cleanup

### Phase 19: DATA_DIRECTORY_GUIDE.md Rewrite

**Goal:** Fully rewrite the data directory guide to document the live state after Phases 15–18.
**Depends on:** Phase 18
**Plans:** 1/1 plans complete

Plans:
- [x] 19-01-PLAN.md — Full guide rewrite: new structure, deckplan schema, self-registration pattern, step-by-step workflows
