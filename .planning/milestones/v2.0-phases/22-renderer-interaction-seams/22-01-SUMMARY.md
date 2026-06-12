---
phase: 22-renderer-interaction-seams
plan: "01"
subsystem: encounter-map
tags:
  - react-hooks
  - refactor
  - discriminated-union
dependency_graph:
  requires:
    - src/hooks/usePanZoom.ts
    - src/types/encounterMap.ts
    - src/components/domain/encounter/EncounterMapRenderer.tsx
  provides:
    - src/hooks/useExclusivePopover.ts
  affects:
    - src/components/domain/encounter/EncounterMapRenderer.tsx
tech_stack:
  added:
    - useExclusivePopover generic hook (src/hooks/)
  patterns:
    - discriminated-union exclusive state machine
    - generic hook with zero domain imports
key_files:
  created:
    - src/hooks/useExclusivePopover.ts
  modified:
    - src/components/domain/encounter/EncounterMapRenderer.tsx
decisions:
  - "EncounterPopover discriminated union defined at renderer module scope — hook stays generic"
  - "useExclusivePopover returns {popover, open, close} only; no isOpen boolean (consumers derive from popover !== null)"
  - "openPopover / closePopover used as local aliases to avoid shadowing builtin 'open'"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-14T14:51:34Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 22 Plan 01: useExclusivePopover Extraction Summary

Generic exclusive-popover hook replacing four independent useState blocks in EncounterMapRenderer with a single discriminated-union state machine that enforces mutual exclusivity structurally.

## What Was Built

### Task 1: useExclusivePopover hook (`0c1cbac`)

New file `src/hooks/useExclusivePopover.ts` — a generic, payload-agnostic hook that holds at most one popover open at a time. Opening any value via `open(value: T)` atomically replaces the prior slot; `close()` nulls it. The hook imports only from `react`. Callers define their own discriminated union as the type parameter.

### Task 2: Wire EncounterMapRenderer (`9293c10`)

Modified `src/components/domain/encounter/EncounterMapRenderer.tsx`:

- Added `EncounterPopover` discriminated union at module scope (four variants: `token`, `door`, `poi`, `room`)
- Removed five `useState` calls (`selectedTokenId`, `selectedTokenPos`, `selectedDoor`, `poiPopup`, `contextMenu`)
- Replaced with single `useExclusivePopover<EncounterPopover>()` call
- Updated all four call sites: `handleDoorClick`, `handleRoomContextMenu`, `handleRoomPointerUp`, POI hover handler, `TokenLayer.onTokenSelect`
- Updated all four render guards to discriminated-union narrowing (`popover?.type === 'token'` etc.)
- Removed `useState` from React import (no longer used)

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript: `tsc --noEmit` exits 0 (full project, zero errors)
- Build: `vite build` exits 0 (4105 modules, no type errors)
- Grep gate: zero references to old setters (`setSelectedTokenId`, `setSelectedTokenPos`, `setSelectedDoor`, `setPoiPopup`, `setContextMenu`)
- Grep gate: exactly one `useExclusivePopover<EncounterPopover>()` call site
- Manual smoke: Not run by executor (browser unavailable in this environment) — structural correctness verified by TypeScript narrowing at all four render sites

## Known Stubs

None.

## Threat Flags

None — pure internal refactor, no new attack surface.

## Self-Check: PASSED

- `src/hooks/useExclusivePopover.ts` exists: FOUND
- `0c1cbac` commit: FOUND
- `9293c10` commit: FOUND
- TypeScript clean: PASS (0 errors)
- Build clean: PASS
