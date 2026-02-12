# Requirements: Mothership GM Terminal

**Defined:** 2026-02-11
**Core Value:** Give the GM a single tool that enhances the tabletop experience with atmospheric digital interfaces without interrupting gameplay flow.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Logs

- [ ] **LOGS-01**: GM can view campaign session log entries in the LOGS bridge tab (renamed from NOTES)
- [ ] **LOGS-02**: Log entries display in chronological order with session date and number
- [ ] **LOGS-03**: Log data loaded from YAML files in campaign data directory

### Ship Status

- [ ] **STAT-01**: STATUS bridge tab displays ship name, class, and overall status
- [ ] **STAT-02**: Hull integrity and armor values are visible
- [ ] **STAT-03**: System status panels show operational state for life support, engines, weapons, and comms
- [ ] **STAT-04**: Crew count and capacity displayed
- [ ] **STAT-05**: System status changes animate visually (e.g., OPERATIONAL to WARNING transition)
- [ ] **STAT-06**: GM can toggle system states from the GM Console

### Encounter Tokens

- [ ] **TOKN-01**: GM can place tokens on the encounter map grid
- [ ] **TOKN-02**: Tokens snap to grid cells
- [ ] **TOKN-03**: Tokens visually distinguish between types (player, NPC, creature, object)
- [ ] **TOKN-04**: GM can move tokens and players see updates via polling/push
- [ ] **TOKN-05**: Tokens display status indicators (wounded, dead, panicked)

### NPC Portraits

- [ ] **PORT-01**: GM can trigger an NPC portrait display on the terminal
- [ ] **PORT-02**: Portrait panel shows NPC name and basic info with CRT/amber styling
- [ ] **PORT-03**: Portrait appears as overlay during encounter view
- [ ] **PORT-04**: Multiple portraits can display simultaneously for group conversations
- [ ] **PORT-05**: Portrait reveal uses animated typewriter name and fade-in effect

### UI Audio

- [ ] **AUDI-01**: UI plays click/interaction sounds on buttons and controls
- [ ] **AUDI-02**: Transition sounds play when switching views and tabs
- [ ] **AUDI-03**: User can mute/unmute all audio via toggle

### Real-Time Architecture

- [ ] **RTMA-01**: Server-Sent Events replace 2-second polling for terminal state updates
- [ ] **RTMA-02**: ActiveView ephemeral state moved out of SQLite (in-memory or cache-backed)
- [ ] **RTMA-03**: Messages remain in SQLite as persistent data
- [ ] **RTMA-04**: Database retained and prepared for future auth/credentials use

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

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
| LOGS-02 | Phase 1 | Pending |
| LOGS-03 | Phase 1 | Pending |
| STAT-01 | Phase 2 | Pending |
| STAT-02 | Phase 2 | Pending |
| STAT-03 | Phase 2 | Pending |
| STAT-04 | Phase 2 | Pending |
| STAT-05 | Phase 2 | Pending |
| STAT-06 | Phase 2 | Pending |
| TOKN-01 | Phase 3 | Pending |
| TOKN-02 | Phase 3 | Pending |
| TOKN-03 | Phase 3 | Pending |
| TOKN-04 | Phase 3 | Pending |
| TOKN-05 | Phase 3 | Pending |
| PORT-01 | Phase 4 | Pending |
| PORT-02 | Phase 4 | Pending |
| PORT-03 | Phase 4 | Pending |
| PORT-04 | Phase 4 | Pending |
| PORT-05 | Phase 4 | Pending |
| RTMA-01 | Phase 5 | Pending |
| RTMA-02 | Phase 5 | Pending |
| RTMA-03 | Phase 5 | Pending |
| RTMA-04 | Phase 5 | Pending |
| AUDI-01 | Phase 6 | Pending |
| AUDI-02 | Phase 6 | Pending |
| AUDI-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-02-11*
*Last updated: 2026-02-11 — Traceability mapping complete, 100% coverage achieved*
