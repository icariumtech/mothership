# Phase 5: Real-Time Push Architecture - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the 2-second polling loop with Server-Sent Events (SSE) so the terminal display and GM console receive ActiveView state updates instantly. ActiveView ephemeral state is moved out of SQLite to an in-memory backing store. Messages stay in SQLite. The REST API write endpoints (set active view, toggle token, etc.) remain as-is — only the read/subscribe path changes to SSE.

</domain>

<decisions>
## Implementation Decisions

### SSE scope
- SSE covers ActiveView state only — messages (/api/messages/) keep their current polling behavior
- Write operations (POST endpoints for set-active-view, toggle-token, toggle-portrait, etc.) stay as REST calls — only the subscribe/read path uses SSE

### SSE disconnect and reconnect behavior
- **Silent auto-reconnect:** On disconnect, both clients attempt to reconnect silently in the background
- **Warning after repeated failures:** If reconnect fails beyond a threshold, show a small toast/banner at the top of the screen ("Connection lost — retrying...") — applies to both GM console and player terminal
- **Re-fetch on reconnect:** When SSE reconnects successfully, the client immediately fetches full current state (via REST or SSE initial event) to catch any missed updates
- **Asymmetric tolerance:** Player terminal is more tolerant — waits longer before showing the failure warning. GM console surfaces the warning sooner since the GM needs to know immediately.
- **Auto-dismiss toast:** When SSE reconnects, the warning toast auto-dismisses — no manual close required

### Connection status UI
- No persistent connection indicator (no always-on dot/badge)
- Warning appears only on failure (toast at top of screen)
- Both GM console and player terminal show the warning (player terminal just has a longer delay before showing it)
- Toast auto-dismisses when connection recovers

### ActiveView storage
- In-memory only — no persistence, no file write, no cache framework
- Server restart clears state and resets to STANDBY — GM re-navigates to current encounter
- Storage structure (singleton vs namespaced): Claude's discretion — design for simplest SSE broadcast model
- ActiveView DB model/table handling: Claude's discretion — remove or tombstone, whichever keeps the codebase cleaner

### Polling removal
- Remove polling loops from all clients (SharedConsole, terminal) — full replacement, not coexistence
- Whether REST endpoints are kept for initial page load vs SSE carrying initial state: Claude's discretion
- Write endpoints are unaffected — still REST POST

### Claude's Discretion
- In-memory store implementation (module singleton vs Django cache locmem)
- ActiveView DB model removal strategy (drop table or tombstone)
- Initial state delivery on SSE connect (first SSE event vs separate REST call)
- Write endpoints remain as REST — no changes needed there
- SSE event structure and field names
- Exact reconnect retry timing and thresholds

</decisions>

<specifics>
## Specific Ideas

- The goal is instant updates for token movements and portrait displays — these are the highest-latency-sensitive operations in the current system (2s delay is noticeable during combat)
- The system runs as a single Django dev server (not distributed) — no need to design for multi-process or multi-server SSE fan-out
- Keep the REST API shape intact for write operations so the existing frontend service layer (gmConsole.ts, encounterApi.ts) needs minimal changes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 05-real-time-push-architecture*
*Context gathered: 2026-02-21*
