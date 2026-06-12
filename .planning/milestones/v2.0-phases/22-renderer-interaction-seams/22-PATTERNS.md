# Phase 22: Renderer Interaction Seams — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 3 (2 new hooks + 1 modified renderer)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/hooks/useExclusivePopover.ts` | hook | event-driven | `src/hooks/usePanZoom.ts` | role-match |
| `src/hooks/useTokenPlacement.ts` | hook | event-driven | `src/hooks/usePanZoom.ts` | exact |
| `src/components/domain/encounter/EncounterMapRenderer.tsx` | component | request-response | self (extraction target) | exact |

---

## Pattern Assignments

### `src/hooks/useExclusivePopover.ts` (hook, event-driven)

**Primary analog:** `src/hooks/usePanZoom.ts`
**Secondary analog:** `src/components/domain/encounter/animation/useRoomRevealAnimations.ts`

**Imports pattern** — follow `usePanZoom.ts` lines 1–2, `useRoomRevealAnimations.ts` lines 17–23:
```typescript
import { useState, useCallback } from 'react';
```
No domain imports. The hook is generic — the caller (renderer) provides the discriminated union type as a type parameter. No `import type` from `encounterMap.ts` inside the hook itself.

**Generic type parameter pattern** — follow `useDebounce.ts` and `useRoomRevealAnimations.ts` opts-interface style:
```typescript
// useRoomRevealAnimations.ts lines 25–31 — opts interface for named params
export interface UseRoomRevealAnimationsOpts {
  visibility: RoomVisibilityState | undefined;
  rooms: GridRoom[];
  mapIdentity: string;
  enabled: boolean;
}
```
Apply to `useExclusivePopover`: accept a single generic type parameter `T` that represents the full discriminated union. The hook holds `useState<T | null>`.

**Core pattern** — single `useState` + two `useCallback` operations:
```typescript
// Pattern from usePanZoom.ts lines 29–39 — useState + useCallback pair
export function usePanZoom(containerRef: RefObject<HTMLDivElement | null>) {
  const [viewState, setViewState] = useState<ViewState>({ panX: 0, panY: 0, zoom: 1 });
  ...
  const resetView = useCallback(() => {
    setViewState({ panX: 0, panY: 0, zoom: 1 });
  }, []);
  ...
  return { viewState, containerHandlers, resetView };
}
```
Apply to `useExclusivePopover`:
```typescript
export function useExclusivePopover<T>() {
  const [popover, setPopover] = useState<T | null>(null);

  const open = useCallback((value: T) => {
    setPopover(value);       // replaces any prior open slot — exclusivity enforced here
  }, []);

  const close = useCallback(() => {
    setPopover(null);
  }, []);

  return { popover, open, close };
}
```

**Return shape pattern** — plain named-field object, same as all existing hooks:
```typescript
// usePanZoom.ts line 173
return { viewState, containerHandlers, resetView };

// useRoomRevealAnimations.ts line 141
return animState;     // single value — not an object
```
`useExclusivePopover` returns `{ popover, open, close }` — three named fields.

**Discriminated union at call site** — defined in the renderer (not the hook). Follows CONVENTIONS.md lines 479–481:
```typescript
// CONVENTIONS.md — discriminated union pattern
type MapViewMode = 'galaxy' | 'system' | 'orbit';
type TransitionState = 'idle' | 'diving' | 'zooming-out' | 'fading-in' | 'fading-out';
```
The renderer defines `EncounterPopover` as a discriminated union, then calls `useExclusivePopover<EncounterPopover>()`.

**Existing state being replaced** — `EncounterMapRenderer.tsx` lines 137–160:
```typescript
// lines 137–160 — four independent useState hooks to collapse
const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
const [selectedTokenPos, setSelectedTokenPos] = useState<{ x: number; y: number } | null>(null);

const [selectedDoor, setSelectedDoor] = useState<{
  id: string;
  x: number;
  y: number;
  status: DoorStatus;
} | null>(null);

const [poiPopup, setPoiPopup] = useState<{
  poi: import('../../../types/encounterMap').PoiData;
  x: number;
  y: number;
} | null>(null);

const [contextMenu, setContextMenu] = useState<{
  room: GridRoom;
  x: number;
  y: number;
} | null>(null);
```
These collapse to one `const { popover, open, close } = useExclusivePopover<EncounterPopover>()`.

**Types from `src/types/encounterMap.ts`** used for popover payload shapes (lines 7, 67, 115, and the GridRoom interface further down):
```typescript
export type DoorStatus = 'OPEN' | 'CLOSED' | 'LOCKED' | 'SEALED' | 'DAMAGED';

export interface PoiData {
  id: string;
  type: PoiType;
  room: string;
  position: PoiPosition;
  name: string;
  icon: string;
  status?: string;
  description?: string;
}
```
`GridRoom` is already imported in the renderer — reuse.

---

### `src/hooks/useTokenPlacement.ts` (hook, event-driven)

**Primary analog:** `src/hooks/usePanZoom.ts` — direct pattern match (receives refs/deps as params, returns handler object, no own geometry)

**Imports pattern** — follow `usePanZoom.ts` lines 1–2:
```typescript
import { useCallback } from 'react';
import { message } from 'antd';
import { getGridCell } from '@/utils/svgCoordinates';
import type { TokenType } from '@/types/encounterMap';
```
Note: `message` from antd is already used in the extraction target (line 382 of renderer). `getGridCell` is the coordinate helper used in `handleDrop` (renderer line 378). Use path aliases (`@/`) per CONVENTIONS.md line 139.

**Params-as-object pattern** — follow `useRoomRevealAnimations.ts` lines 25–57 (opts interface + destructure):
```typescript
// useRoomRevealAnimations.ts lines 25–57 — opts interface with destructuring
export interface UseRoomRevealAnimationsOpts {
  visibility: RoomVisibilityState | undefined;
  rooms: GridRoom[];
  mapIdentity: string;
  enabled: boolean;
}

export function useRoomRevealAnimations({
  visibility,
  rooms,
  mapIdentity,
  enabled,
}: UseRoomRevealAnimationsOpts): Map<string, RoomAnimEntry> {
```
Apply to `useTokenPlacement`: define a `TokenPlacementProps` interface, destructure in function signature.

**Core pattern** — the two drag callbacks being extracted from `EncounterMapRenderer.tsx` lines 358–392:
```typescript
// EncounterMapRenderer.tsx lines 358–392 — extraction target (verbatim)
const handleDragOver = useCallback((e: React.DragEvent) => {
  if (!isGM || !onTokenPlace) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}, [isGM, onTokenPlace]);

const handleDrop = useCallback((e: React.DragEvent) => {
  if (!isGM || !onTokenPlace || !svgRef.current) return;
  e.preventDefault();

  const dataStr = e.dataTransfer.getData('application/json');
  if (!dataStr) return;

  let template: { type: TokenType; name: string; imageUrl: string };
  try {
    template = JSON.parse(dataStr);
  } catch {
    return;
  }

  const { gridX, gridY } = getGridCell(svgRef.current, e.clientX, e.clientY, unitSize);

  if (isCellOccupied(gridX, gridY)) {
    message.warning('Cell is already occupied by another token');
    return;
  }

  const room = findRoomAtCell(gridX, gridY);
  if (!room) {
    message.warning('Token can only be placed inside a room');
    return;
  }

  onTokenPlace(template.type, template.name, gridX, gridY, template.imageUrl || '', room.id);
}, [isGM, onTokenPlace, unitSize, isCellOccupied, findRoomAtCell]);
```
Move these bodies verbatim into the hook. The hook receives all dependencies as params — no new state, no new refs created inside.

**Return shape pattern** — plain named-field object, follow `usePanZoom.ts` line 173:
```typescript
// usePanZoom.ts line 173
return { viewState, containerHandlers, resetView };
```
`useTokenPlacement` returns `{ handleDragOver, handleDrop }`.

**Ref param pattern** — follow `usePanZoom.ts` line 29:
```typescript
// usePanZoom.ts line 29 — caller owns the ref, passes it in
export function usePanZoom(containerRef: RefObject<HTMLDivElement | null>) {
```
`useTokenPlacement` receives `svgRef: RefObject<SVGSVGElement | null>` (same pattern, different element type).

**JSDoc block** — follow `usePanZoom.ts` lines 21–28:
```typescript
/**
 * Manages pan and zoom state for an SVG map container.
 *
 * Pass containerRef (owned by the caller) so other code can share the same
 * ref for hit-testing (door popups, context menus, etc.). Spread the returned
 * containerHandlers onto the container div, and apply viewState to the SVG
 * transform.
 */
```

---

### `src/components/domain/encounter/EncounterMapRenderer.tsx` (component, modification)

**Pattern:** Delete the 4 useState declarations at lines 137–160 and the 2 useCallback blocks at lines 358–392. Replace with hook calls at the top of the component body.

**Hook call insertion pattern** — follow existing hook call at `EncounterMapRenderer.tsx` line 164:
```typescript
// line 164 — existing hook call pattern in renderer
const { viewState, containerHandlers, resetView: handleResetView } = usePanZoom(containerRef);
```
New lines go immediately after or before this block:
```typescript
const { popover, open, close } = useExclusivePopover<EncounterPopover>();
const { handleDragOver, handleDrop } = useTokenPlacement({
  svgRef,
  unitSize,
  isGM,
  onTokenPlace,
  isCellOccupied,
  findRoomAtCell,
});
```

**Import additions** — follow `EncounterMapRenderer.tsx` lines 9–10 (existing hook imports):
```typescript
// lines 9–10 — existing hook import pattern
import React, { useMemo, useState, useCallback, useRef } from 'react';
import { usePanZoom } from '../../../hooks/usePanZoom';
```
Add alongside existing hook imports. Remove `useState` from the React import once the 4 local useState calls are gone (TypeScript `noUnusedLocals` will enforce this).

**EncounterPopover discriminated union** — defined at module scope in the renderer (above the component function), using types already imported at lines 13–23:
```typescript
// EncounterMapRenderer.tsx lines 13–23 — existing type imports
import {
  Door,
  GridEncounterMapData,
  GridRoom,
  DoorStatus,
  ...
} from '../../../types/encounterMap';
```
Union defined as:
```typescript
type EncounterPopover =
  | { type: 'token'; payload: { id: string; pos: { x: number; y: number } } }
  | { type: 'door';  payload: { id: string; x: number; y: number; status: DoorStatus } }
  | { type: 'poi';   payload: { poi: PoiData; x: number; y: number } }
  | { type: 'room';  payload: { room: GridRoom; x: number; y: number } }
```

---

## Shared Patterns

### Named export (no default export)
**Source:** All files in `src/hooks/` — `usePanZoom.ts` line 29, `useRoomRevealAnimations.ts` line 52, `useViewTransition.ts` line 31
**Apply to:** Both new hooks
```typescript
// Pattern: named export only, no default
export function useExclusivePopover<T>() { ... }
export function useTokenPlacement({ ... }: TokenPlacementProps) { ... }
```

### Props interface naming
**Source:** `useRoomRevealAnimations.ts` lines 25–31, CONVENTIONS.md lines 308–319
**Apply to:** `useTokenPlacement` params interface
```typescript
// Interface = "Use" + HookName + "Opts" (established pattern from useRoomRevealAnimations)
export interface UseTokenPlacementOpts { ... }
// OR follow CONTEXT.md which sketches it as "TokenPlacementProps" — either is acceptable
```

### useCallback dependency arrays
**Source:** `usePanZoom.ts` lines 38–40, 119–127 — all deps listed explicitly, no omissions
**Apply to:** Both handlers in `useTokenPlacement` — copy the exact deps from renderer lines 362 and 392:
```typescript
// Renderer line 362
}, [isGM, onTokenPlace]);

// Renderer line 392
}, [isGM, onTokenPlace, unitSize, isCellOccupied, findRoomAtCell]);
```

### Error user-messaging pattern
**Source:** `EncounterMapRenderer.tsx` lines 381–388 (within handleDrop)
**Apply to:** `useTokenPlacement.ts` — move verbatim. Use `message.warning()` from antd, same as the renderer already does.

### Path aliases
**Source:** CONVENTIONS.md lines 132–139
**Apply to:** Both new hook files — use `@/utils/svgCoordinates`, `@/types/encounterMap` instead of relative `../../../`

---

## No Analog Found

None. Both new hooks have direct analogs in the existing `src/hooks/` directory.

---

## Metadata

**Analog search scope:** `src/hooks/`, `src/components/domain/encounter/animation/`, `src/components/domain/encounter/EncounterMapRenderer.tsx`, `src/types/encounterMap.ts`, `src/utils/svgCoordinates.ts`, `.planning/codebase/CONVENTIONS.md`
**Files scanned:** 8
**Pattern extraction date:** 2026-05-13
