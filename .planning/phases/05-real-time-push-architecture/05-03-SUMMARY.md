---
phase: 05-real-time-push-architecture
plan: "03"
subsystem: ui
tags: [sse, eventsource, react, typescript, vite, websockets]

# Dependency graph
requires:
  - phase: 05-02
    provides: SSE backend endpoint (/api/active-view/stream/) with broadcaster.announce() on every write
provides:
  - useSSE custom hook with EventSource lifecycle, reconnect tracking, and connectionLost toast trigger
  - SSEConnectionToast component for connection-lost warning
  - SharedConsole subscribed to SSE (failureThreshold 5, replaces 2s polling)
  - GMConsole subscribed to SSE (failureThreshold 2, replaces 5s polling)
  - Vite dev proxy configured for SSE passthrough without buffering
affects:
  - phase-06-ui-audio
  - any future frontend feature consuming active-view state

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useSSE hook wraps EventSource with reconnect counter and failure-threshold toast trigger
    - Ref-stabilized onEvent callbacks (activeViewRef pattern) prevent reconnect storms
    - Named SSE event listener (addEventListener('activeview')) not onmessage — required for named events
    - Post-write getActiveView() fetch pattern eliminated — SSE delivers state automatically

key-files:
  created:
    - src/hooks/useSSE.ts
    - src/components/ui/SSEConnectionToast.tsx
  modified:
    - src/entries/SharedConsole.tsx
    - src/entries/GMConsole.tsx
    - vite.config.ts

key-decisions:
  - "useSSE uses addEventListener('activeview') not onmessage — named SSE events require explicit listener"
  - "onEvent wrapped with useCallback(fn, []) with stable ref reads to prevent reconnect storms"
  - "SharedConsole failureThreshold: 5 (player terminal — more tolerant of transient disconnects)"
  - "GMConsole failureThreshold: 2 (GM console — warns sooner to surface server issues quickly)"
  - "All post-write getActiveView() + setActiveView() removed from GMConsole callbacks — SSE push is authoritative"
  - "Initial data load getActiveView() retained in GMConsole — needed for locations bootstrap and loading state before SSE connects"
  - "Vite proxy configure block adds x-accel-buffering: no header for SSE responses to prevent buffering"
  - "handleEncounterViewUpdate retained as no-op for EncounterPanel interface compatibility"

patterns-established:
  - "Ref-stabilized closure pattern: const xRef = useRef(x); useEffect(() => { xRef.current = x; }, [x])"
  - "SSE over polling: all ActiveView state flows through /api/active-view/stream/ not REST polling"
  - "Post-write state sync eliminated: SSE broadcast replaces redundant getActiveView() after writes"

requirements-completed:
  - RTMA-01

# Metrics
duration: 6min
completed: 2026-02-22
---

# Phase 05 Plan 03: Frontend SSE Layer Summary

**useSSE hook + SSEConnectionToast replace 2s/5s polling in SharedConsole and GMConsole with instant EventSource subscriptions backed by named 'activeview' events**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-22T00:16:56Z
- **Completed:** 2026-02-22T00:22:33Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `useSSE` hook: EventSource lifecycle, per-failure reconnect counter, connectionLost state, stable closure via `useCallback(fn, [])`
- Created `SSEConnectionToast`: fixed top-center, CRT red aesthetic, pointerEvents none
- SharedConsole: removed 2s setInterval poll and initial fetchActiveView, wired useSSE with failureThreshold 5 and ref-stable onEvent
- GMConsole: removed 5s setInterval poll, wired useSSE with failureThreshold 2, removed all 8 post-write getActiveView() calls from callbacks
- Vite proxy: configure block sets x-accel-buffering header for SSE responses to prevent chunked buffering

## Task Commits

1. **Task 1: Create useSSE hook and SSEConnectionToast component** - `093c9e4` (feat)
2. **Task 2: Wire useSSE into SharedConsole and GMConsole, fix Vite proxy** - `93c5233` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/hooks/useSSE.ts` - EventSource hook with reconnect tracking and connectionLost state
- `src/components/ui/SSEConnectionToast.tsx` - Fixed-top-center connection warning toast
- `src/entries/SharedConsole.tsx` - Replaced polling with useSSE, added SSEConnectionToast, ref-stable onEvent
- `src/entries/GMConsole.tsx` - Replaced polling with useSSE, removed post-write getActiveView() calls
- `vite.config.ts` - SSE proxy configure block for streaming passthrough

## Decisions Made
- `addEventListener('activeview')` not `onmessage` — server sends named events, onmessage only fires for unnamed events
- `onEvent` with `useCallback(fn, [])` and `activeViewRef` reads avoids dependency churn that would cause reconnect storms
- failureThreshold 5 for player terminal (more tolerant), 2 for GM console (warns sooner)
- All post-write `getActiveView()` calls removed from GMConsole — SSE push makes them redundant and they race with SSE events
- Initial load `getActiveView()` retained (documented with comment) — needed for locations data and loading state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused React import from SSEConnectionToast**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** TypeScript reported `'React' is declared but its value is never read` — project uses JSX transform (no explicit React import needed)
- **Fix:** Removed `import React from 'react'` — JSX transform handles JSX without explicit import
- **Files modified:** src/components/ui/SSEConnectionToast.tsx
- **Verification:** npm run typecheck passed with zero errors
- **Committed in:** 093c9e4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - unused import bug)
**Impact on plan:** Minor fix required by TypeScript strict mode. No scope creep.

## Issues Encountered
None — all planned work executed as specified.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Real-time SSE pipeline complete end-to-end: Django in-memory store → broadcaster → SSE stream → EventSource → React state
- SharedConsole and GMConsole now receive instant updates instead of up-to-2s delayed polls
- Phase 06 (UI Audio) can proceed — no blockers
- Manual E2E test recommended: start Django server, open both consoles, trigger view changes and verify instant propagation

## Self-Check: PASSED

All files verified present on disk. Both task commits confirmed in git log.

---
*Phase: 05-real-time-push-architecture*
*Completed: 2026-02-22*
