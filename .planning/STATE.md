# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Give the GM a single tool that enhances the tabletop experience with atmospheric digital interfaces without interrupting gameplay flow.
**Current focus:** Phase 4 - NPC Portrait System

## Current Position

Phase: 4 of 6 (NPC Portrait System)
Plan: 3 of 4 completed
Status: In Progress
Last activity: 2026-02-20 — Completed 04-03-PLAN.md (Frontend portrait components)

Progress: [███████░░░] 75% (Phase 4: 3/4 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 18.9 minutes
- Total execution time: 3.11 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-campaign-logs-tab | 2 | 352s | 176s |
| 02-ship-status-dashboard | 3 | 1167s | 389s |
| 03-encounter-tokens | 4 | 9899s | 2475s |
| 04-npc-portrait-system | 3/4 | 1074s (04-01+04-02+04-03) | — |

**Recent Trend:**
- Last 5 plans: 231s, 292s, 9252s, 124s, 79s
- Trend: Phase 04-02 TypeScript types plan was very fast (79s) - pure type additions to 3 files

*Updated after each plan completion*

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-20 — Completed 04-03-PLAN.md (Frontend portrait components)
Stopped at: Completed 04-03-PLAN.md — NPCPortraitCard, NPCPortraitOverlay, EncounterPanel toggle UI, SharedConsole wiring
Resume file: None
