---
phase: 22-renderer-interaction-seams
plan: "02"
subsystem: encounter-map
tags:
  - react-hooks
  - refactor
  - drag-and-drop

dependency_graph:
  requires:
    - src/hooks/usePanZoom.ts
    - src/hooks/useExclusivePopover.ts
    - src/utils/svgCoordinates.ts
    - src/types/encounterMap.ts
    - src/components/domain/encounter/EncounterMapRenderer.tsx
  provides:
    - src/hooks/useTokenPlacement.ts
  affects:
    - src/components/domain/encounter/EncounterMapRenderer.tsx

tech_stack:
  added:
    - useTokenPlacement hook (src/hooks/)
  patterns:
    - dependency-injected hook with all geometry/state predicates as named params
    - verbatim logic extraction with no behavior change

key_files:
  created:
    - src/hooks/useTokenPlacement.ts
  modified:
    - src/components/domain/encounter/EncounterMapRenderer.tsx

key_decisions:
  - "useTokenPlacement receives svgRef as a named param (D-07) — hook owns no refs, matches usePanZoom's caller-owned-ref pattern"
  - "svgRef added to handleDrop dependency array since it is a passed-in param (linting completeness)"
  - "TokenType import retained in renderer — still used in EncounterMapRendererProps.onTokenPlace signature"
  - "message (antd) and getGridCell imports removed from renderer — only callers were the extracted handlers"

patterns_established:
  - "Interaction-seam hook: receives all external dependencies as named params, returns handler-object, owns no state/refs"

requirements_completed: []

duration: ~5min
completed: "2026-05-14"
---

# Phase 22 Plan 02: useTokenPlacement Extraction Summary

**Token drag-and-drop handlers extracted from EncounterMapRenderer into a thin dependency-injected hook at `src/hooks/useTokenPlacement.ts`, completing the renderer interaction-seam decomposition**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-14T~15:00Z
- **Completed:** 2026-05-14T~15:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- New `useTokenPlacement` hook encapsulates the full token-drop logic: dropEffect, JSON parse guard, grid-cell computation, occupied-cell guard, find-room guard, and `onTokenPlace` dispatch
- `EncounterMapRenderer.tsx` no longer defines any interaction state machines inline — all geometry, projection, reveal-cascade, pan/zoom, popovers, and token placement sit behind named hook seams
- Unused imports (`message`, `getGridCell`) removed from renderer; `TokenType` retained (still used in props interface)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useTokenPlacement hook** - `47a7737` (feat)
2. **Task 2: Wire EncounterMapRenderer to useTokenPlacement** - `72b2b4a` (feat)

## Files Created/Modified

- `src/hooks/useTokenPlacement.ts` - New hook: `UseTokenPlacementOpts` interface + `useTokenPlacement` function returning `{handleDragOver, handleDrop}`
- `src/components/domain/encounter/EncounterMapRenderer.tsx` - Import added, two inline useCallback blocks removed, single hook call inserted; unused imports removed

## Decisions Made

- `svgRef` included in `handleDrop` dependency array inside the hook (D-07 pattern — passed-in param, not a local ref, so dependency completeness applies)
- `TokenType` import kept in renderer: it is used in `EncounterMapRendererProps.onTokenPlace` at line 62, not just in the extracted handler

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Verification

- TypeScript: `tsc --noEmit` exits 0 (zero errors, full project)
- Build: `pnpm run build` exits 0 (built in 1m 5s, no type errors)
- Grep gate: exactly one `useTokenPlacement({` call in renderer
- Grep gate: zero inline `const handleDragOver = useCallback` / `const handleDrop = useCallback` in renderer
- Grep gate: `getGridCell` has zero occurrences in renderer
- Grep gate: `message` has zero occurrences in renderer
- Manual smoke: Not run (no browser in executor environment) — structural correctness verified by TypeScript signature alignment and verbatim guard logic in hook

## Known Stubs

None.

## Threat Flags

None — pure internal refactor, no new attack surface. All existing guards (isGM check, JSON parse try/catch, cell-occupancy guard, room-membership guard) moved verbatim.

## Next Phase Readiness

- All interaction seams complete: pan/zoom (usePanZoom), popovers (useExclusivePopover), room reveal (useRoomRevealAnimations), token placement (useTokenPlacement)
- `EncounterMapRenderer.tsx` ready for Plan 03

## Self-Check: PASSED

- `src/hooks/useTokenPlacement.ts` exists: FOUND
- `47a7737` commit: FOUND
- `72b2b4a` commit: FOUND
- TypeScript clean: PASS (0 errors)
- Build clean: PASS

---
*Phase: 22-renderer-interaction-seams*
*Completed: 2026-05-14*
