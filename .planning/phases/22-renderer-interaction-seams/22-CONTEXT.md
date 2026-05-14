# Phase 22: Renderer Interaction Seams — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract the two remaining interaction state machines from `EncounterMapRenderer.tsx` (currently 1302 LOC) that were deferred from Phase 21:

1. **`useExclusivePopover`** — replace the 4 independent `useState` hooks for mutually-exclusive popovers (token tooltip, door status, POI hover, room context menu) with a single discriminated-union hook that enforces exclusivity at open time.

2. **`useTokenPlacement`** — extract `handleDragOver` + `handleDrop` (~35 LOC) into a thin hook that returns the two HTML5 drag-and-drop handlers for palette→map token placement.

`usePanZoom` was already extracted in ad-hoc refactoring after Phase 21. This phase completes the renderer interaction decomposition — after both hooks land, the renderer holds no interaction state machines: all geometry, projection, reveal-cascade, pan/zoom, token placement, and popover coordination sit behind named seams. The remaining renderer body is JSX + SVG rendering + event wiring.

**Not in scope:** SharedConsole decomposition, three-map stack collapse, sceneStore split — those are Phase 23+ targets.

</domain>

<decisions>
## Implementation Decisions

### Scope
- **D-01:** Renderer-complete scope — extract both `useExclusivePopover` AND `useTokenPlacement`. This closes the Phase 21 deferred list cleanly and finishes all interaction extraction from the renderer.
- **D-02:** No expansion to other systems (SharedConsole, three-map stack, sceneStore) — those remain Phase 23+ candidates.

### useExclusivePopover
- **D-03:** Discriminated union interface — single state `{ type: 'token' | 'door' | 'poi' | 'room', payload: ... } | null`. Opening any slot closes the others automatically.
- **D-04:** Generic, payload-agnostic hook — `useExclusivePopover<Slots extends Record<string, unknown>>()`. The hook imports no encounter domain types. The renderer defines its own slot map (EncounterPopoverSlots or similar).
- **D-05:** Lives at `src/hooks/useExclusivePopover.ts` — consistent with `usePanZoom`, generic enough for future reuse in SharedConsole or other components.

### useTokenPlacement
- **D-06:** Returns `{ handleDragOver, handleDrop }` — thin wrapper, mirrors `usePanZoom` pattern.
- **D-07:** Receives all deps as params (svgRef, unitSize, isCellOccupied, findRoomAtCell, isGM, onTokenPlace) — renderer stays in control. Hook owns no state or derived geometry. No duplication of logic already in mapView/roomGeometry seams.
- **D-08:** Lives at `src/hooks/useTokenPlacement.ts`.

### Test Strategy
- **D-09:** Stay T3 — no `@testing-library/react`, no hook tests. TypeScript + visual smoke test covers correctness for both new hooks. Revisit when there's a third stateful hook or when `SharedConsole` decomposition begins.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 21 context (architecture decisions that constrain this phase)
- `.planning/phases/21-encounter-geometry-deepening/21-CONTEXT.md` — Four-module geometry stack design, T3 test strategy, deletion-test methodology, module interface invariants

### Source files being modified
- `src/components/domain/encounter/EncounterMapRenderer.tsx` — Primary target (1302 LOC); the 4 useState popover blocks (lines ~137–160) and drag handlers (lines ~358–392) are the extraction targets
- `src/hooks/usePanZoom.ts` — Pattern to follow for new hooks (interface shape, param-passing style, no own refs to shared state)

### Established hook patterns
- `.planning/codebase/CONVENTIONS.md` — Hook naming (`use` prefix), location (`src/hooks/`), named exports, return-values-directly pattern

### Types (popover payloads need these)
- `src/types/encounterMap.ts` — GridRoom, DoorStatus, PoiData types for popover payload shapes in the renderer's slot map

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hooks/usePanZoom.ts` — Direct pattern to follow: receives a `RefObject` as param, returns `{ viewState, containerHandlers, resetView }`, no own state beyond what the hook manages. `useTokenPlacement` should mirror this exactly.
- `src/components/domain/encounter/EncounterMapRenderer.tsx` lines 137–160 — The 4 useStates to be collapsed into `useExclusivePopover`.
- `src/components/domain/encounter/EncounterMapRenderer.tsx` lines 358–392 — The 2 drag callbacks to be moved into `useTokenPlacement`.

### Established Patterns
- **T3 test strategy** (Phase 21): pure modules get tests, React hooks do not. No `@testing-library/react` in the project.
- **Hook param style** (usePanZoom): external refs passed in as params, not created inside the hook. Keeps the caller in control of the ref.
- **Hook return style** (usePanZoom, useRoomRevealAnimations): return a plain object with named fields, not a tuple.
- **Discriminated unions in the codebase** (CONVENTIONS.md): `type TransitionState = 'idle' | 'diving' | ...` is the established pattern for state variants.

### Integration Points
- `EncounterMapRenderer.tsx` — both hooks are consumed here and nowhere else. No shared-state concerns.
- `src/components/domain/encounter/TokenLayer.tsx` — uses `pointInPolygon` from `polygon2d`; no interaction with the new hooks.

</code_context>

<specifics>
## Specific Ideas

- **useExclusivePopover slot map** — The renderer defines something like:
  ```ts
  type EncounterPopover = 
    | { type: 'token'; payload: { id: string; pos: { x: number; y: number } } }
    | { type: 'door';  payload: { id: string; x: number; y: number; status: DoorStatus } }
    | { type: 'poi';   payload: { poi: PoiData; x: number; y: number } }
    | { type: 'room';  payload: { room: GridRoom; x: number; y: number } }
  ```
  Hook is `useExclusivePopover<EncounterPopover>()` returning `{ popover, open, close }` (or similar). Opening any variant closes the others by replacing state with the new value.

- **useTokenPlacement signature sketch**:
  ```ts
  function useTokenPlacement({
    svgRef, unitSize, isGM, onTokenPlace, isCellOccupied, findRoomAtCell
  }: TokenPlacementProps): { handleDragOver: ..., handleDrop: ... }
  ```

</specifics>

<deferred>
## Deferred Ideas

- **SharedConsole decomposition** (1064 LOC god-component) — Phase 23+ candidate; identified in Phase 21 grilling session
- **Three-map stack collapse** (Galaxy/System/Orbit near-identical R3F scenes) — Phase 23+ candidate
- **sceneStore split** (API data vs UI state machine) — Phase 23+ candidate
- **DataLoader.load_all_locations** (3 things in one method) — Phase 23+ candidate
- **`@testing-library/react` for hook tests** — Revisit when there's a third stateful hook or SharedConsole decomposition begins

</deferred>

---

*Phase: 22-renderer-interaction-seams*
*Context gathered: 2026-05-13*
