# Phase 22: Renderer Interaction Seams — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 22-renderer-interaction-seams
**Areas discussed:** Scope recalibration, useExclusivePopover design, Token placement code, Test strategy for hooks

---

## Scope Recalibration

| Option | Description | Selected |
|--------|-------------|----------|
| Tight — useExclusivePopover only | One focused extraction; renderer ~1260 LOC; other targets Phase 23+ | |
| Renderer-complete — popover + token drag | Extract both; finishes all interaction extraction from the renderer | ✓ |
| Expand scope — add a second structural target | Add SharedConsole, three-map stack, or sceneStore split alongside renderer work | |

**User's choice:** Requested recommendation; Claude recommended renderer-complete.
**Notes:** `usePanZoom` was already extracted in the post-Phase-21 ad-hoc refactoring. Token drag is only ~35 LOC (2 callbacks), not the ~200 LOC described in Phase 21's deferred list. Renderer-complete finishes the Phase 21 story cleanly without scope creep into other systems.

---

## useExclusivePopover Design

### Interface shape

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated union — `{ type, payload } \| null` | Single state; opening any slot closes others automatically | ✓ |
| Generic reusable hook — `useExclusivePopover<T>` | Slot-keyed registry; more flexible but more abstraction than needed | |
| Simple clear-all helper | Keep 4 useStates; add closeAll(); doesn't solve exclusivity-on-open | |

**User's choice:** Discriminated union.

### Hook location

| Option | Description | Selected |
|--------|-------------|----------|
| `src/hooks/useExclusivePopover.ts` | Consistent with usePanZoom; generic for future reuse | ✓ |
| `src/components/domain/encounter/hooks/` | Encounter-local; harder to reuse | |

**User's choice:** `src/hooks/`.

### Payload types

| Option | Description | Selected |
|--------|-------------|----------|
| Generic payload per slot — hook is payload-agnostic | Hook imports no domain types; renderer defines slot map | ✓ |
| Typed encounter-specific variants hardcoded in hook | Simpler now but couples hook to domain | |

**User's choice:** Generic/payload-agnostic hook.

---

## Token Placement Code

### Extraction approach

| Option | Description | Selected |
|--------|-------------|----------|
| `useTokenPlacement` hook — returns `{ handleDragOver, handleDrop }` | Consistent with usePanZoom pattern | ✓ |
| Leave in renderer | Only 35 LOC; extracting adds a large props list | |
| You decide | Claude chooses | |

**User's choice:** Extract to hook.

### Dependency ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Hook receives all deps as params — renderer stays in control | Thin wrapper; mirrors usePanZoom | ✓ |
| Hook owns occupancy/room logic | Reduces renderer surface; duplicates geometry seam logic | |

**User's choice:** Params-in approach.

---

## Test Strategy for Hooks

| Option | Description | Selected |
|--------|-------------|----------|
| Stay T3 — no React testing-library, skip hook tests | TypeScript + visual smoke; revisit for third stateful hook | ✓ |
| Add `@testing-library/react` — test both hooks | ~30-40 test cases; establishes pattern for SharedConsole work | |
| Test `useExclusivePopover` only | Clearest invariant; skip useTokenPlacement | |

**User's choice:** Stay T3.

---

## Claude's Discretion

None — user confirmed all recommendations.

## Deferred Ideas

- SharedConsole decomposition (1064 LOC) — Phase 23+
- Three-map stack collapse — Phase 23+
- sceneStore split — Phase 23+
- DataLoader.load_all_locations — Phase 23+
- `@testing-library/react` hook tests — revisit at Phase 23+ or SharedConsole decomposition
