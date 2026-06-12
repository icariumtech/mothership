---
phase: 22-renderer-interaction-seams
reviewed: 2026-05-14T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/hooks/useExclusivePopover.ts
  - src/components/domain/encounter/EncounterMapRenderer.tsx
  - src/hooks/useTokenPlacement.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-05-14
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three files were reviewed: the new `useExclusivePopover` hook, the refactored `EncounterMapRenderer`, and the extracted `useTokenPlacement` hook. The hooks themselves are small and well-structured. The renderer contains the bulk of the logic and most of the findings.

Two critical bugs were found: a falsy-value short-circuit in `getEffectiveDoorStatus` that silently discards the `'OPEN'` authored default, and a misnamed CSS grid area that makes the Reset View button invisible. Four warnings cover a stale ref pattern, a type-safety bypass, a cross-file circular dependency, and unguarded `roomTapStart` state. Two info items flag minor clean-up opportunities.

---

## Critical Issues

### CR-01: `getEffectiveDoorStatus` discards authored `'OPEN'` status via `||` short-circuit

**File:** `src/components/domain/encounter/EncounterMapRenderer.tsx:247`

**Issue:** The expression `(doorStatus?.[door.id] as DoorStatus) || door.status || 'CLOSED'` uses JavaScript `||`, which treats any falsy value as absent. All five `DoorStatus` strings are non-empty and therefore truthy — **but only while they remain in that set**. More critically, if a runtime `doorStatus` override entry exists in the `DoorStatusState` map and somehow resolves to `undefined` (e.g. a stale key from a deck that was just switched), the `||` falls through to `door.status`. The asymmetry with the `??` operator is a correctness trap: authored `door.status === 'OPEN'` is correctly passed through today only because `'OPEN'` is truthy, but any future `DoorStatus` value that is falsy (empty string, `0`, `false`) would be silently dropped. More practically, a runtime override entry whose value is `undefined` (TypeScript does not prevent this since `DoorStatusState` is `Record<string, DoorStatus>` but runtime JSON can deliver `null`) will cascade to the authored default rather than behaving as "no override", which may hide GM state bugs.

**Fix:** Use `??` (nullish coalescing) for the runtime-override lookup, which is the semantically correct operator here — `undefined`/`null` means "no override", not "falsy value means no override":

```typescript
const getEffectiveDoorStatus = useCallback((door: Door): DoorStatus => {
  return (doorStatus?.[door.id] ?? door.status) ?? 'CLOSED';
}, [doorStatus]);
```

---

### CR-02: Reset View button uses `gridArea: 'top-center'` which is not defined in `gridTemplateAreas`

**File:** `src/components/domain/encounter/EncounterMapRenderer.tsx:1121-1135`

**Issue:** The overlay grid defines three named areas — `"top-left . top-right" ". . ." "bottom-left . bottom-right"` — but the Reset View button is assigned `gridArea: 'top-center'`. There is no `top-center` area in the template. In CSS Grid, assigning an element to an undefined named area silently places it outside the grid's explicit tracks (it becomes an auto-placed element or is treated as an error depending on browser), but in practice the button is positioned outside the visible layout region and is not rendered where intended. The intent is clearly top-center, but the required grid area name for that position is `.` (an unnamed cell), which is not addressable by name. The correct fix is either to add a named center column area or use an alternative layout approach.

**Fix:** Add a named center area to the grid template, then use that name:

```tsx
gridTemplateAreas: '"top-left top-center top-right" ". . ." "bottom-left . bottom-right"',
// ...then on the button:
gridArea: 'top-center',
alignSelf: 'start',
justifySelf: 'center',
```

Alternatively, keep the current 3-column template and position the button with `gridColumn: 2; gridRow: 1` instead of a named area.

---

## Warnings

### WR-01: `roomTapStart` ref is never cleared on `pointercancel` or when pan begins

**File:** `src/components/domain/encounter/EncounterMapRenderer.tsx:320-343`

**Issue:** `roomTapStart.current` is set on `pointerdown` (line 324) and cleared only in `handleRoomPointerUp` (line 330). If the pointer is cancelled (e.g. browser interrupts with a notification, or a multi-touch gesture starts), `pointerup` never fires and `roomTapStart.current` is left with a stale position. The next `pointerdown` on any room will overwrite it, so the bug is silent most of the time — but if `pointerup` eventually fires after cancellation (some browsers synthesize it), the stale `start` coordinates could cause an unintended room-tap popup opening.

**Fix:** Add a `pointercancel` handler on the SVG or container that clears the ref:

```tsx
const handleRoomPointerCancel = useCallback(() => {
  roomTapStart.current = null;
}, []);

// On each room hit target:
onPointerCancel={handleRoomPointerCancel}
```

Or clear `roomTapStart.current` in `handleRoomPointerDown` before writing (a no-op but documents intent), and add a document-level `pointercancel` listener in a `useEffect`.

---

### WR-02: `mapRooms` prop passed with `as unknown as RoomData[]` type coercion

**File:** `src/components/domain/encounter/EncounterMapRenderer.tsx:1104`

**Issue:** `mapData.rooms` is typed as `GridRoom[]`. `TokenLayer.mapRooms` is typed as `(RoomData | GridRoom)[]`. The cast `as unknown as RoomData[]` is unnecessary and incorrect — `GridRoom[]` is already assignable to `(RoomData | GridRoom)[]` because `GridRoom` is one branch of the union. The double cast bypasses TypeScript's structural check entirely, meaning future changes to either type that introduce an incompatibility will not produce a compiler error.

**Fix:** Remove the cast. `GridRoom[]` is a subtype of `(RoomData | GridRoom)[]`:

```tsx
mapRooms={mapData.rooms}
```

---

### WR-03: `tokenTouchActive` mutable module-level flag creates circular dependency and global state

**File:** `src/components/domain/encounter/TokenLayer.tsx:20` / `src/hooks/usePanZoom.ts:2`

**Issue:** `tokenTouchActive` is a mutable `export let` from `TokenLayer.tsx` (a UI component) that is imported directly by `usePanZoom.ts` (a general-purpose hook). This creates a circular dependency in the module graph — `EncounterMapRenderer` imports both; `usePanZoom` imports from a domain component. Additionally, as a mutable module singleton, the flag is never reset if `TokenLayer` unmounts while a touch is in progress (e.g. the map deck switches mid-drag). A stuck `tokenTouchActive = true` would permanently disable touch panning.

The flag is also reset at three call sites inside `TokenLayer` (`handlePointerUp`, `onPointerCancel`, `handleTokenPointerDragStart`), but not in `stopDrag` itself. If `stopDrag` is called without going through those code paths (e.g. an un-handled edge case), the flag leaks.

**Fix (short-term):** Move `tokenTouchActive` into a shared, framework-agnostic module (e.g. `src/utils/touchState.ts`) that neither component depends on circularly.

**Fix (long-term):** Pass a callback prop `onTouchDragActive: (active: boolean) => void` from `EncounterMapRenderer` down to `TokenLayer`, and let `EncounterMapRenderer` propagate the signal to `usePanZoom` via a ref — eliminating the module-level global entirely.

---

### WR-04: `handleDrop` calls `e.preventDefault()` after guard checks that may silently swallow drop events

**File:** `src/hooks/useTokenPlacement.ts:50-57`

**Issue:** `handleDrop` correctly delays `e.preventDefault()` until placement succeeds (the comment on line 55 explains the intent: failed drops should snap back via browser default). However, the guards `isCellOccupied` (line 50) and `findRoomAtCell` (line 52) return early **without** calling `e.preventDefault()`. On some browsers, the `dragover` handler having called `e.preventDefault()` (line 31) is sufficient to suppress the snap-back animation regardless of whether `drop` calls it. On others (Firefox in particular), the `drop` event's `preventDefault()` is also required to suppress the visual "rejected" feedback. The current code will show inconsistent feedback on drop into an occupied cell or outside a room depending on browser.

More importantly, `e.preventDefault()` is called on line 56 (only on success), but on line 50 and 52 the function returns without `e.preventDefault()` — which is the **intended** behavior per the comment. This is actually correct logic, but the comment says "Failed drops snap back via browser default" without acknowledging that `dragover`'s `preventDefault` already suppresses that on most browsers. The behavior is inconsistent cross-browser and may confuse future maintainers into thinking the snap-back is reliable.

**Fix:** Document explicitly what browsers do here, or ensure consistent feedback by calling `e.preventDefault()` unconditionally and providing explicit visual feedback for failure instead of relying on browser snap-back:

```typescript
const handleDrop = useCallback((e: React.DragEvent) => {
  // Always prevent browser default (snap-back is unreliable cross-browser
  // once dragover has called preventDefault). Provide explicit failure feedback instead.
  e.preventDefault();
  if (!isGM || !onTokenPlace || !svgRef.current) return;
  // ... rest of handler
}, [...]);
```

---

## Info

### IN-01: `renderDoorSymbol` and `renderPoi` are plain functions defined inside the component, not `useCallback`

**File:** `src/components/domain/encounter/EncounterMapRenderer.tsx:357-580` (renderDoorSymbol), `845-908` (renderPoi)

**Issue:** Both `renderDoorSymbol` and `renderPoi` are defined as plain non-memoized functions inside the `EncounterMapRenderer` function body. They are recreated on every render, but since they are called directly (not passed as props to children), this is not a performance issue in isolation. However, `renderPoi` closes over `containerRef`, `openPopover`, `closePopover`, `isGM`, `isRoomVisible`, and `view` — none of which are listed in any dependency array because the function is not wrapped in `useCallback`. This pattern is inconsistent with the rest of the renderer (which wraps all handlers in `useCallback`) and could cause confusion if `renderPoi` is later extracted to a child component or stabilized.

**Fix:** Either wrap `renderPoi` in `useCallback` with the correct dependency array, or extract it as a subcomponent that receives props explicitly. For `renderDoorSymbol`, it takes no external state via closure (all inputs are parameters), so it could be moved to module scope.

---

### IN-02: `useExclusivePopover` — no `toggle` convenience; callers implement it inconsistently

**File:** `src/hooks/useExclusivePopover.ts:22-34`

**Issue:** The hook exposes `open` and `close` but no `toggle(value)`. At `EncounterMapRenderer.tsx:1074-1075`, the caller implements toggle logic inline: `selectedTokenId === id ? null : id` before deciding whether to call `closePopover()` or `openPopover(...)`. This is a common enough pattern (open if different value, close if same value) that a `toggle` method on the hook would remove duplication and reduce the risk of callers implementing it incorrectly.

This is a suggestion, not a defect. The hook's JSDoc says "Consumers can derive `isOpen` from `popover !== null`" which is the right philosophy, but toggle is a recurring need beyond simple open/close.

**Fix (optional):**

```typescript
const toggle = useCallback((value: T) => {
  setPopover(prev =>
    prev !== null && JSON.stringify(prev) === JSON.stringify(value) ? null : value
  );
}, []);
```

Note: deep equality via `JSON.stringify` is fragile for complex objects; for this codebase's discriminated-union payloads a shallow `prev?.type === value.type` check per call site may be safer. Consider leaving as-is and accepting the inline toggle pattern.

---

_Reviewed: 2026-05-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
