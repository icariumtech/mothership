# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-11)

**Core value:** Give the GM a single tool that enhances the tabletop experience with atmospheric digital interfaces without interrupting gameplay flow.
**Current focus:** Phase 3 - Encounter Tokens

## Current Position

Phase: 3 of 6 (Encounter Tokens)
Plan: 3 of 3 completed
Status: Complete
Last activity: 2026-02-16 — Completed 03-03-PLAN.md (GM Token Controls)

Progress: [██████████] 100% (Phase 3: 3/3 plans)

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
| 03-encounter-tokens | 3 | 9775s | 3258s |

**Recent Trend:**
- Last 5 plans: 521s, 208s, 231s, 292s, 9252s
- Trend: Phase 03-03 significantly longer (9252s) due to complex integration with drag-and-drop, coordinate transforms, and multi-component wiring

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-16 — Phase 3 Plan 3 execution
Stopped at: Completed 03-03-PLAN.md (GM Token Controls) - Phase 3 Complete
Resume file: None
