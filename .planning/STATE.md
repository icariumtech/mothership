---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Checkpoint: 13-05 awaiting human visual verification"
last_updated: "2026-03-28T23:04:30.476Z"
last_activity: 2026-03-09 — Completed 08-03 views and dashboard
progress:
  total_phases: 13
  completed_phases: 10
  total_plans: 36
  completed_plans: 35
  percent: 92
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Give the GM a single tool that enhances the tabletop experience with atmospheric digital interfaces without interrupting gameplay flow.
**Current focus:** Phase 8 - Rework GM Console UI

## Current Position

Phase: 8 of 8 (Rework GM Console UI)
Plan: 3 of 4 completed
Status: Executing — Plan 03 views and dashboard complete
Last activity: 2026-03-09 — Completed 08-03 views and dashboard

Progress: [█████████░] 92% (Phase 8: 3/4 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 17.4 minutes
- Total execution time: 3.13 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-campaign-logs-tab | 2 | 352s | 176s |
| 02-ship-status-dashboard | 3 | 1167s | 389s |
| 03-encounter-tokens | 4 | 9899s | 2475s |
| 04-npc-portrait-system | 3/4 | 1074s (04-01+04-02+04-03) | — |
| 05-real-time-push-architecture | 3/4 | 1083s (05-01+05-02+05-03) | — |
| 07-grid-based-encounter-map-redesign | 1/4 | 118s (07-01) | 118s |
| 08-rework-gm-console-ui | 1/4 | 257s (08-01) | 257s |

**Recent Trend:**
- Last 5 plans: 9252s, 124s, 79s, 118s, 257s
- Trend: Phase 08-01 layout shell (257s) — flexbox restructure of GMConsole + 3 new layout components

*Updated after each plan completion*
| Phase 08 P03 | 198 | 2 tasks | 8 files |
| Phase 08 P02 | 299 | 2 tasks | 7 files |
| Phase 09 P01 | 360 | 3 tasks | 8 files |
| Phase 09 P02 | 182 | 2 tasks | 2 files |
| Phase 10 P01 | 512 | 2 tasks | 9 files |
| Phase 10 P02 | 556 | 2 tasks | 7 files |
| Phase 10 P03 | 480 | 1 tasks | 4 files |
| Phase 11 P01 | 228 | 2 tasks | 3 files |
| Phase 13 P01 | 208 | 2 tasks | 5 files |
| Phase 13 P03 | 306 | 2 tasks | 3 files |
| Phase 13 P04 | 356 | 1 tasks | 2 files |
| Phase 13 P02 | 600 | 2 tasks | 6 files |
| Phase 13 P05 | 240 | 1 tasks | 0 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase derivation: Start with low-risk bridge tabs (LOGS, STATUS), then encounter features (tokens, portraits), then real-time architecture as optimization, finally UI audio as independent enhancement
- Build order follows research recommendations: Bridge tabs validate patterns before tackling runtime state complexity
- Session files use same YAML frontmatter + markdown body pattern as message files (01-01)
- Sessions sorted newest-first (descending by session_number) for chronological display (01-01)
- NPCs field normalized to array (supports both array and comma-separated string in YAML) (01-01)
- Date field normalized to date-only string (strips time component if present) (01-01)
- Renamed NOTES tab to LOGS with sessionStorage migration for backward compatibility (01-02)
- Used react-markdown with remark-gfm for GitHub Flavored Markdown support (01-02)
- Memoized LogsDetailView component to prevent re-renders on unrelated state changes (01-02)
- Custom markdown components provide terminal-aesthetic styling (teal headers, amber strong text) (01-02)
- Auto-select newest session on mount for immediate content display (01-02)
- Ship data stored in YAML with runtime overrides in ActiveView.ship_system_overrides JSONField (02-01)
- Override merging happens on read - YAML defaults + ActiveView overrides merged in GET endpoint (02-01)
- Ship systems: life_support, engines, weapons, comms (4 core systems) (02-01)
- System statuses: ONLINE, STRESSED, DAMAGED, CRITICAL, OFFLINE (5 states) (02-01)
- Ship schematic rendered as SVG blueprint with grid background (02-02)
- System panels use staggered fade-in animation with delays for boot-up effect (02-02)
- Status changes trigger 400ms flicker, CRITICAL systems pulse, OFFLINE systems dimmed (02-02)
- STATUS tab polls ship-status API every 3 seconds to match terminal polling rate (02-02)
- [Phase 02]: SHIP STATUS tab positioned between ENCOUNTER and BROADCAST for logical workflow
- [Phase 02]: Auto-polling every 5 seconds keeps GM view in sync with server state
- [Phase 02]: Color-coded status labels use design system palette for quick visual feedback
- [Phase 03]: Token state stored in ActiveView.encounter_tokens JSONField matching existing patterns
- [Phase 03]: Token IDs generated as 8-character hex UUIDs for uniqueness and brevity
- [Phase 03]: Token images discovered from crew/NPC portraits and campaign/NPCs/images/ directory
- [Phase 03]: Token status is array of strings (wounded, dead, panicked) for flexible tracking
- [Phase 03]: Circular tokens with SVG clipPath for round image clipping (03-02)
- [Phase 03]: Type-colored glow/shadow using SVG filters (amber/teal/burgundy/gray for player/NPC/creature/object) (03-02)
- [Phase 03]: Room visibility filtering: GM sees all tokens, players only see tokens in revealed rooms or unassigned (03-02)
- [Phase 03]: Selected template persists after placement for duplicate token creation without reselection (03-03)
- [Phase 03]: SVG coordinate transforms use getScreenCTM().inverse() for accurate viewBox/pan/zoom handling (03-03)
- [Phase 03]: Grid snapping uses Math.floor(svgCoord / unitSize) for discrete cell indices (03-03)
- [Phase 03]: Overlap prevention rejects placement/move if target cell is occupied (03-03)
- [Phase 03]: Tokens can only be placed/moved in revealed rooms (roomVisibility check) (03-03)
- [Phase 03]: Drag-to-move shows ghost token at snapped position, calls API only on mouseup (03-03)
- [Phase 03]: Canvas drag preview (40x40 circular) uses preloaded image cache for synchronous rendering (03-04)
- [Phase 03]: Custom tokens added to template array so they appear in grid and can be re-dragged (03-04)
- [Phase 03]: GM console wires selectedTokenId to TokenLayer enabling TokenPopup (03-04)
- [Phase 03]: Visibility filter uses strict === true; undefined/missing room means hidden from players (03-04)
- [Phase 04]: encounter_active_portraits uses default=list (not default=dict) since it is an ordered list of NPC IDs, not a lookup map (04-01)
- [Phase 04]: Always include encounter_npc_data in every active-view response (not ENCOUNTER-only) to avoid second API request from portrait overlay (04-01)
- [Phase 04]: Portrait clear is unconditional on new encounter location switch (outside map-existence guard) (04-01)
- [Phase 04]: gmConsole.ts ActiveView uses required fields (non-optional) for portrait data; SharedConsole.tsx uses optional to handle old cached responses (04-02)
- [Phase 04]: NpcPortraitData.portrait field is URL string (empty = no image), matching token image_url pattern from Phase 3 (04-02)
- [Phase 04]: togglePortrait returns active_portraits array for optimistic UI update without waiting for poll cycle (04-02)
- [Phase 04]: npcs derived from Object.values(activeView?.encounter_npc_data || {}) in EncounterPanel — no new prop, stays fresh from poll (04-03)
- [Phase 04]: clip-path animation applied to .portrait-image-wrapper div (not img) for Safari compatibility (04-03)
- [Phase 04]: dismissingIds tracked as Set<string> so multiple portrait cards can dismiss concurrently (04-03)
- [Phase 04]: Animation state machine pattern: AnimPhase literal union drives CSS class, async useEffect with cancelled flag sequences phases (04-03)
- [Phase 05-01]: In-memory state store replaces SQLite ActiveView singleton — SSE push replaces 2s polling
- [Phase 05-01]: Queue-per-listener fan-out with maxsize=5 and dead-queue eviction on queue.Full prevents memory leaks
- [Phase 05-01]: SSE named event 'activeview' chosen over anonymous events for explicit frontend listener binding
- [Phase 05-01]: build_active_view_payload() shared between REST GET and SSE initial-event for payload consistency
- [Phase 05-02]: All 17 write endpoints use update_state(**kwargs) + broadcaster.announce(build_active_view_payload(new_state))
- [Phase 05-02]: dict() copy pattern for mutable dict fields prevents shared-reference bugs across concurrent requests
- [Phase 05-02]: active_view.updated_by removed — not needed in store model, not used for SSE change detection
- [Phase 05-03]: useSSE uses addEventListener('activeview') not onmessage — named SSE events require explicit listener
- [Phase 05-03]: onEvent wrapped with useCallback(fn, []) with stable ref reads (activeViewRef) to prevent reconnect storms
- [Phase 05-03]: SharedConsole failureThreshold 5 (tolerant), GMConsole failureThreshold 2 (warns sooner)
- [Phase 05-03]: All post-write getActiveView() + setActiveView() removed from GMConsole callbacks — SSE push is authoritative
- [Phase 05-03]: Initial load getActiveView() retained in GMConsole for locations bootstrap before SSE connects
- [Phase 07-01]: Grid rooms use rects array (not x/y/w/h scalars) to support L-shapes, T-shapes, corridors as first-class rooms
- [Phase 07-01]: Doors attached to room walls (wall: north/south/east/west, position: N) — no separate connections array
- [Phase 07-01]: unit_size: 40 at top level replaces grid: {width, height} block — canvas dimensions computed from room geometry
- [Phase 07-01]: Corridors are GridRoom entries with name: '' and type: corridor — renderer skips label for empty names
- [Phase 07-01]: isGridEncounterMap() guard uses rooms[0].rects presence — checked before isEncounterMap() in routing
- [Phase 07-02]: Wall-segment algorithm: edge-count exclusion — edges shared by 2+ rects are interior (not drawn), exactly 1 = exterior wall
- [Phase 07-02]: SVG bounding box computed from ALL rooms regardless of visibility to prevent layout shift on reveal
- [Phase 07-02]: computeRoomWalls() works per-room — each room group renders its own walls; doors positioned via getDoorSVGPosition()
- [Phase 07-03]: TokenLayer uses duck-typing ('rects' in room) to distinguish GridRoom from legacy RoomData in findRoomAtCell
- [Phase 07-03]: MapPreview early-returns for grid maps delegating to EncounterMapRenderer; onRoomToggle threaded through
- [Phase 07-03]: EncounterPanel bulk buttons changed from icon+tooltip to labeled text (REVEAL ALL / HIDE ALL); status badge removed
- [Phase 08-01]: GMViewType is purely local state — clicking view icons does not call any API
- [Phase 08-01]: DISPLAY button pushes gmView to player terminal via appropriate API call
- [Phase 08-01]: activeCharonChannel derived from gmView (not activeView.view_type) so CHARON channel follows GM's local view
- [Phase 08-01]: Player view indicator uses green dot (6px) on the icon matching activeView.view_type
- [Phase 08]: BridgeView uses plain dark cards (#141414) for utilitarian dashboard, not CRT-styled panels
- [Phase 08]: ShipStatusToolPanel is thin wrapper around existing ShipStatusPanel (no logic duplication)
- [Phase 08]: CharonQuickSend uses channel-aware sendChannelMessage for correct channel routing
- [Phase 08]: CharonView passes currentViewType='CHARON_TERMINAL' to CharonPanel for correct isActive detection
- [Phase 08]: EncounterView owns all encounter state -- EncounterPanel is dead code
- [Phase 08]: SSE is authoritative -- onViewUpdate callbacks removed from encounter handlers
- [Phase 08]: Auto-open locations panel when no encounter location selected for immediate GM guidance
- [Phase 09]: announce_ship_status() is non-fatal in api_ship_toggle_system — SSE failure logs warning but does not break REST response
- [Phase 09]: fetchShipStatus removed (TS6133 dead code); changingFlags/previousStatusesRef preserved via void suppression for Plan 09-02 SSE wiring
- [Phase 09]: Named SSE event pattern: announce_X() + es.addEventListener('X') + useSSE onXEvent mirrors existing activeview pattern
- [Phase 09]: GmBridgeStatusPanel receives shipData from SSE prop (not internal polling) — SSE is authoritative for real-time updates
- [Phase 09]: ship-status ToolRail entry removed from BridgeView — permanent dashboard panel replaces slide-out pattern
- [Phase 09]: GmBridgeStatusPanel is a placeholder — future phase will replace right panel with ship-as-location deck map view using EncounterMapRenderer
- [Phase 10]: campaign_ship slug resolved via early-return in find_location_by_slug (not galaxy tree search)
- [Phase 10]: BRIDGE SSE payload eager-loads ship_deck_data via load_map() — no second API call needed from frontend
- [Phase 10]: Morrigan deck polygon vertices share exact edge coordinates for contiguous wall rendering
- [Phase 10]: ShipSchematic SVG placeholder removed; replaced by real EncounterMapDisplay deck map in player STATUS tab
- [Phase 10]: GmBridgeStatusPanel renamed GmBridgeShipPanel — system toggles + deck map panel combined
- [Phase 10]: EncounterMapDisplay bridge-mode pattern: isGM=false, omit roomVisibility (all rooms visible), slug=campaign_ship
- [Phase 10]: BridgeView handles setShipLocation internally (no prop threading to GMConsole) — same pattern as other GM actions
- [Phase 10]: 'Set Ship Here' button rendered only when onSetShipLocation prop is provided — opt-in at call site
- [Phase 11]: @login_required added to api_ship_update_integrity matching companion endpoint pattern
- [Phase 11]: NPCPortraitOverlay rendered as sibling to __map and __right divs in EncounterView — outside transform elements for correct fixed positioning
- [Phase 11]: gm_console_react loads ship_status_json via DataLoader matching display_view_react pattern; GMConsole.tsx already reads INITIAL_DATA — no frontend change needed
- [Phase 13]: useViewTransition commit() called during dark phase so React renders new view while screen is black — no flash of new content
- [Phase 13]: ViewStatusOverlay is outside console-content-wrapper so it survives the glitch animation and renders over the fade-in
- [Phase 13]: setEncounterTokens stays outside handleViewChange — encounter token updates are not view-type-dependent and must not be delayed
- [Phase 13]: SVG opacity presentation attribute must be undefined during animation; CSS cannot override inline SVG attributes — use CSS class for GM-dim opacity instead
- [Phase 13]: Token reveal animation is player-only; newlyRevealedRooms state lives in TokenLayer independently from EncounterMapRenderer roomAnimState
- [Phase 13]: Duplicated bridge-panel-fade-in keyframe in BridgeView.css rather than importing from StatusSection.css to avoid cross-file CSS coupling
- [Phase 13]: AnimPhase guard uses !open && animPhase === 'entering' so component stays mounted through exit animation
- [Phase 13]: commLineReveal stagger duration capped at 2000ms to handle very long terminal logs gracefully
- [Phase 13]: CharonDialog disableClose prop unchanged; AnimPhase exit triggered only by parent setting open=false

### Roadmap Evolution

- Phase 7 added: Grid-based encounter map redesign
- Phase 8 added: Rework GM console UI
- Phase 10 added: Player ship map view

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-28T23:04:30.468Z
Stopped at: Checkpoint: 13-05 awaiting human visual verification
Resume file: None
