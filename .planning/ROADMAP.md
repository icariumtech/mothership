# Roadmap: Mothership GM Terminal

## Overview

This milestone extends the existing Bridge view with essential GM tools: campaign logs, ship status tracking, encounter tokens for tactical maps, NPC portrait displays, and real-time push architecture to replace polling. Each phase builds on established patterns (YAML → DataLoader → API → React) while introducing new runtime state management for live gameplay features.

## Phases

- [x] **Phase 1: Campaign Logs Tab** - Display session logs in LOGS bridge tab (rename NOTES)
- [x] **Phase 2: Ship Status Dashboard** - Ship systems and status panels in STATUS bridge tab
- [ ] **Phase 3: Encounter Tokens** - Movable tokens on encounter maps with live updates
- [ ] **Phase 4: NPC Portrait System** - Portrait overlays during encounters with typewriter effects
- [ ] **Phase 5: Real-Time Push Architecture** - Replace polling with SSE, move ActiveView out of DB
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
- [ ] 03-01-PLAN.md — Backend data pipeline: ActiveView encounter_tokens field, token CRUD API endpoints, TypeScript types, API client
- [ ] 03-02-PLAN.md — Frontend token rendering: TokenLayer, Token, TokenStatusOverlay components, encounter map integration, polling wire-up
- [ ] 03-03-PLAN.md — GM Console controls: TokenPalette with placement/status/removal, drag-to-move on encounter map
- [ ] 03-04-PLAN.md — UAT gap closure: drag preview sizing, custom token placement, GM popup/labels, room visibility filter

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
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: UI Audio System
**Goal**: Add atmospheric audio feedback for UI interactions and view transitions
**Depends on**: Phase 5
**Requirements**: AUDI-01, AUDI-02, AUDI-03
**Success Criteria** (what must be TRUE):
  1. UI plays click/interaction sounds on buttons and controls
  2. Transition sounds play when switching views and tabs
  3. User can mute/unmute all audio via toggle in UI
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Campaign Logs Tab | 2/2 | ✓ Complete | 2026-02-12 |
| 2. Ship Status Dashboard | 3/3 | ✓ Complete | 2026-02-12 |
| 3. Encounter Tokens | 0/4 | In Progress | - |
| 4. NPC Portrait System | 0/TBD | Not started | - |
| 5. Real-Time Push Architecture | 0/TBD | Not started | - |
| 6. UI Audio System | 0/TBD | Not started | - |
