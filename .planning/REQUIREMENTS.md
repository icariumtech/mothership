# Requirements: Mothership GM Terminal

**Defined:** 2026-02-11
**Core Value:** Give the GM a single tool that enhances the tabletop experience with atmospheric digital interfaces without interrupting gameplay flow.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Logs

- [x] **LOGS-01**: GM can view campaign session log entries in the LOGS bridge tab (renamed from NOTES)
- [x] **LOGS-02**: Log entries display in chronological order with session date and number
- [x] **LOGS-03**: Log data loaded from YAML files in campaign data directory

### Ship Status

- [x] **STAT-01**: STATUS bridge tab displays ship name, class, and overall status
- [x] **STAT-02**: Hull integrity and armor values are visible
- [x] **STAT-03**: System status panels show operational state for life support, engines, weapons, and comms
- [x] **STAT-04**: Crew count and capacity displayed
- [x] **STAT-05**: System status changes animate visually (e.g., OPERATIONAL to WARNING transition)
- [x] **STAT-06**: GM can toggle system states from the GM Console
- [ ] **STAT-10**: STATUS tab uses dual terminal-readout panel layout (left=systems, right=resources) floating over full-screen deck map with semi-transparent backgrounds and chamfered corners
- [ ] **STAT-11**: Reactor added as 5th ship system (SystemData shape: status/condition/info) in YAML, TypeScript types, and Django backend
- [ ] **STAT-12**: Ship resource tracking for fuel, food, O2, cryopods, and escape pods with current/max values stored in ship.yaml and served via SSE
- [ ] **STAT-13**: GM can modify reactor status/condition and all resource values from BridgeView panel using system controls and InputNumber spinners
- [ ] **STAT-14**: Status change-flash animation (600ms row highlight on SSE update) and typewriter stagger-in animation (80ms sequential row reveal on tab load)

### Encounter Tokens

- [x] **TOKN-01**: GM can place tokens on the encounter map grid
- [x] **TOKN-02**: Tokens snap to grid cells
- [x] **TOKN-03**: Tokens visually distinguish between types (player, NPC, creature, object)
- [x] **TOKN-04**: GM can move tokens and players see updates via polling/push
- [x] **TOKN-05**: Tokens display status indicators (wounded, dead, panicked)

### NPC Portraits

- [x] **PORT-01**: GM can trigger an NPC portrait display on the terminal
- [x] **PORT-02**: Portrait panel shows NPC name and basic info with CRT/amber styling
- [x] **PORT-03**: Portrait appears as overlay during encounter view (GM EncounterView — Phase 11)
- [x] **PORT-04**: Multiple portraits can display simultaneously for group conversations
- [x] **PORT-05**: Portrait reveal uses animated typewriter name and fade-in effect

### Real-Time Architecture

- [x] **RTMA-01**: Server-Sent Events replace 2-second polling for terminal state updates (StatusSection — Phase 9)
- [x] **RTMA-02**: ActiveView ephemeral state moved out of SQLite (in-memory or cache-backed)
- [x] **RTMA-03**: Messages remain in SQLite as persistent data
- [x] **RTMA-04**: Database retained and prepared for future auth/credentials use

### Grid-Based Encounter Map

- [x] **GRID-01**: New TypeScript types for grid-based rooms (GridRect, GridRoom, DoorDef, GridEncounterMapData) exported from encounterMap.ts
- [x] **GRID-02**: YAML map files rebuilt in grid-based format (rooms defined by rects, doors on walls, no connections array)
- [x] **GRID-03**: Encounter map renderer uses wall-segment algorithm: interior edges between same-room rects are suppressed, only exterior perimeter drawn
- [x] **GRID-04**: Map background shows faint dark grid in void; room interiors show scanline floor texture
- [x] **GRID-05**: Walls render in amber (#8b7355), room labels centered and only visible when room is revealed
- [x] **GRID-06**: GM click-to-reveal: clicking a room in GM map preview toggles its reveal/hide state; bulk reveal all / hide all buttons available
- [x] **GRID-07**: TokenLayer findRoomAtCell tests all rects in a GridRoom for correct multi-rect room hit detection
- [x] **GRID-08**: MapPreview and EncounterPanel updated for GridRoom schema (no status field, type field, onRoomToggle wired)
- [x] **GRID-09**: isGridEncounterMap() type guard routes new maps to grid renderer in EncounterMapDisplay
- [x] **GRID-10**: End-to-end human verification: visual rendering, room reveal, player terminal, door symbols, token multi-rect placement

### GM Console UI (Phase 8)

- [x] **GMUI-LAYOUT**: GM console uses view-driven architecture with left icon rail, full-content main area, and right slide-out panels
- [x] **GMUI-VIEWRAIL**: Left ViewRail with circular icon buttons for switching views (Encounter, Bridge, CHARON, Standby); DISPLAY button at top
- [x] **GMUI-TOOLRAIL**: Right ToolRail with icon buttons that toggle slide-out tool panels
- [x] **GMUI-SLIDEOUT**: SlideOutPanel component slides out from right when tool activated; closes by re-clicking active tool
- [x] **GMUI-ENCOUNTER**: EncounterView fills main content area with full-screen map
- [x] **GMUI-TOOLPANELS**: Four slide-out panels in EncounterView: Tokens, Portraits, Locations, Terminals
- [x] **GMUI-MAPFULLSCREEN**: Encounter map occupies full available width/height in GM view (fills container, no fixed aspect ratio)
- [x] **GMUI-BRIDGE**: BridgeView main dashboard with breadcrumb nav, 3D map mirror, and inline ship status panel
- [x] **GMUI-CHARON**: CharonView provides full-screen CHARON AI terminal in GM console
- [x] **GMUI-STANDBY**: StandbyView shows animated standby state when no active encounter
- [x] **GMUI-DISPLAY**: DISPLAY button in ViewRail opens/controls the player-facing terminal display

### Player Ship Map (Phase 10)

- [x] **SHIP-01**: Campaign ship deck map visible in BRIDGE mode (player STATUS tab and GM right panel); GM can set ship galactic position from Locations panel via right-click "Set Ship Here"

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### UI Audio

- **AUDI-01**: UI plays click/interaction sounds on buttons and controls
- **AUDI-02**: Transition sounds play when switching views and tabs
- **AUDI-03**: User can mute/unmute all audio via toggle

### Logs

- **LOGS-04**: Log entries filterable by session number
- **LOGS-05**: Text search across log entries

### Ship Status

- **STAT-07**: Stress-inducing visual effects when systems fail (screen flicker, warning colors)
- **STAT-08**: Fuel and supply resource tracking
- **STAT-09**: Jump drive status and countdown display

### Encounter Tokens

- **TOKN-06**: Token size support (1x1, 2x2 for large creatures)
- **TOKN-07**: Token health bars

### NPC Portraits

- **PORT-06**: Portrait linked to full NPC data (stats, faction, notes)

### UI Audio

- **AUDI-04**: Ambient background audio (ship hum, station atmosphere) context-aware per location
- **AUDI-05**: Alert and notification sounds for priority messages
- **AUDI-06**: Volume control slider

### Real-Time Architecture

- **RTMA-05**: WebSocket migration if bidirectional communication needed

## Out of Scope

| Feature | Reason |
|---------|--------|
| Player-controlled token movement | Breaks GM-controlled paradigm; Mothership is theater-of-mind |
| Complex initiative/turn tracking on map | Overkill for Mothership's fast combat system |
| AI-generated NPC portraits | Unnecessary complexity; GM curates portrait assets |
| Player character sheet editing | Read-only for players; GM controls all data |
| Mobile native app | Web-first, mobile responsive is sufficient |
| Animated token movement | Unnecessary visual complexity for CRT aesthetic |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOGS-01 | Phase 1 | Pending |
| LOGS-02 | Phase 1 | Complete |
| LOGS-03 | Phase 1 | Pending |
| STAT-01 | Phase 2 | Pending |
| STAT-02 | Phase 2 | Pending |
| STAT-03 | Phase 2 | Pending |
| STAT-04 | Phase 2 | Pending |
| STAT-05 | Phase 2 | Pending |
| STAT-06 | Phase 2 | Complete |
| STAT-10 | Phase 14 | Pending |
| STAT-11 | Phase 14 | Pending |
| STAT-12 | Phase 14 | Pending |
| STAT-13 | Phase 14 | Pending |
| STAT-14 | Phase 14 | Pending |
| TOKN-01 | Phase 3 | Pending |
| TOKN-02 | Phase 3 | Pending |
| TOKN-03 | Phase 3 | Pending |
| TOKN-04 | Phase 3 | Pending |
| TOKN-05 | Phase 3 | Pending |
| PORT-01 | Phase 4 | Complete |
| PORT-02 | Phase 4 | Complete |
| PORT-03 | Phase 11 | Complete |
| PORT-04 | Phase 4 | Complete |
| PORT-05 | Phase 4 | Complete |
| RTMA-01 | Phase 5 | Complete |
| RTMA-02 | Phase 5 | Complete |
| RTMA-03 | Phase 5 | Complete |
| RTMA-04 | Phase 5 | Complete |
| GRID-01 | Phase 7 | Complete |
| GRID-02 | Phase 7 | Complete |
| GRID-03 | Phase 7 | Complete |
| GRID-04 | Phase 7 | Complete |
| GRID-05 | Phase 7 | Complete |
| GRID-06 | Phase 7 | Complete |
| GRID-07 | Phase 7 | Complete |
| GRID-08 | Phase 7 | Complete |
| GRID-09 | Phase 7 | Complete |
| GRID-10 | Phase 7 | Complete |
| GMUI-LAYOUT | Phase 8 | Complete |
| GMUI-VIEWRAIL | Phase 8 | Complete |
| GMUI-TOOLRAIL | Phase 8 | Complete |
| GMUI-SLIDEOUT | Phase 8 | Complete |
| GMUI-ENCOUNTER | Phase 8 | Complete |
| GMUI-TOOLPANELS | Phase 8 | Complete |
| GMUI-MAPFULLSCREEN | Phase 8 | Complete |
| GMUI-BRIDGE | Phase 8 | Complete |
| GMUI-CHARON | Phase 8 | Complete |
| GMUI-STANDBY | Phase 8 | Complete |
| GMUI-DISPLAY | Phase 8 | Complete |
| SHIP-01 | Phase 10 | Complete |

**Coverage:**
- v1 requirements: 47 total (29 original + 12 GMUI-* + 1 SHIP-01 + 5 STAT-10..14; AUDI-01..03 moved to v2)
- Mapped to phases: 47
- Unmapped: 0

**Phase 09 gap closures (integration fixes):**

| Requirement | Phase | Status | Note |
|-------------|-------|--------|------|
| RTMA-01 | Phase 9 | Complete | StatusSection SSE migration |
| LOGS-02 | Phase 9 | Complete | react-markdown in GM SessionDetailView |

**Phase 11 gap closures:**

| Requirement | Phase | Status | Note |
|-------------|-------|--------|------|
| PORT-03 | Phase 11 | Complete | NPCPortraitOverlay wired into GM EncounterView |
| STAT-06 | Phase 11 | Complete | @login_required on api_ship_update_integrity |
| SHIP-01 | Phase 11 | Complete | onSetShipLocation prop passed in EncounterView |

**Phase 12 gap closures:**

| Requirement | Phase | Status | Note |
|-------------|-------|--------|------|
| GMUI-LAYOUT..GMUI-DISPLAY | Phase 8 | Complete | Registered — audit gap closure |
| SHIP-01 | Phase 10 | Complete | Registered — audit gap closure |
| GRID-01..10 | Phase 7 | Complete | Check off — audit gap closure |

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-04-07 — Phase 14 STATUS tab rework requirements added (STAT-10 through STAT-14)*
