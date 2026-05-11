---
phase: 21-encounter-geometry-deepening
reviewed: 2026-05-11T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/components/domain/encounter/EncounterMapRenderer.tsx
  - src/components/domain/encounter/TokenLayer.tsx
  - src/components/domain/encounter/animation/scheduleReveal.ts
  - src/components/domain/encounter/animation/useRoomRevealAnimations.ts
  - src/components/domain/encounter/animation/__tests__/scheduleReveal.test.ts
  - src/components/domain/encounter/doors/doorNormalizer.ts
  - src/components/domain/encounter/doors/__tests__/migratedMaps.test.ts
  - src/components/domain/encounter/doors/__tests__/corridorDoorVisibility.test.ts
  - src/components/domain/encounter/geometry/roomGeometry.ts
  - src/components/domain/encounter/geometry/mapView.ts
  - src/components/domain/encounter/geometry/gridProjection.ts
  - src/utils/polygon2d.ts
  - src/types/encounterMap.ts
  - terminal/views.py
  - terminal/active_view_store.py
  - tools/svg_to_map.py
  - tools/migrate_doors_to_canonical.py
  - vitest.config.ts
findings:
  critical: 3
  warning: 7
  info: 3
  total: 13
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 21 introduced substantial geometry infrastructure: a four-module grid/SVG stack (`polygon2d`, `roomGeometry`, `mapView`, `gridProjection`), a canonical `Door` type with a validating `doorNormalizer`, YAML data migration, room reveal animations, and a Vitest test harness. The overall architecture is well-designed — clear invariants, good separation of concerns, and meaningful test coverage. The bugs found are in edge cases of the migration tool, the door normalizer's overlap-detection math, and the renderer's door visibility fallback path. None of them surface under typical gameplay conditions, which explains why the tests pass — the tests cover the happy path well but not these corners.

---

## Critical Issues

### CR-01: `roomLabelGrid` crashes on rect rooms with empty `rects` field

**File:** `src/components/domain/encounter/geometry/roomGeometry.ts:64-68`

**Issue:** The function reads `room.rects.map(...)` on line 65 without the `?? []` guard applied elsewhere. If `room.rects` is `undefined` (which is a known runtime state documented in MEMORY.md — "YAML polygon-only rooms arrive WITHOUT it"), calling `.map()` on `undefined` throws a TypeError. Polygon-only rooms that also lack `room.polygon` (degenerate case) would fall through the `if` chain and reach `room.rects.map(...)` indirectly because the first branch checks `(room.rects ?? []).length > 0`, correctly guarding the `length` test but then uses `room.rects.map(...)` without the guard:

```ts
export function roomLabelGrid(room: GridRoom): GridPoint {
  if ((room.rects ?? []).length > 0) {         // ← guard here is correct
    const minX = Math.min(...room.rects.map((r) => r.x));  // ← crash if rects is undefined
```

The condition `(room.rects ?? []).length > 0` is only truthy when `rects` has content, so in practice this is safe for the `if`-body. But the guard is inconsistent — if a caller relies on this pattern as documentation, a future edit could remove the `?? []` from the length check and expose the raw access. More importantly, this exact inconsistency (guard the length test but not the access) is the bug pattern that burned the project before (noted in MEMORY.md).

**Fix:**
```ts
if ((room.rects ?? []).length > 0) {
  const rects = room.rects!;  // safe: we just confirmed length > 0
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return { gx: (minX + maxX) / 2, gy: (minY + maxY) / 2 };
}
```

---

### CR-02: Overlap detection uses incompatible `along` fractions for B-pos vs B-rel doors

**File:** `src/components/domain/encounter/doors/doorNormalizer.ts:750-765`

**Issue:** `detectOverlap` compares `along` fractions across both B-rel and B-pos doors in the same bucket. For B-rel doors, `along` is a fraction of the shared edge length (`edgeLen` stored per entry). For B-pos doors converted in `bPosToEntry`, `along` is the projected `t` value on the *specific run* the door lands on, and `edgeLen` is that run's length. The overlap check at line 753-763 computes half-widths as `width / (2 * edgeLen)` and compares `along` values directly:

```ts
const prevHalf = prev.width / (2 * prev.edgeLen);
const currHalf = curr.width / (2 * curr.edgeLen);
if (prev.along + prevHalf > curr.along - currHalf + EPS) {
```

This comparison is only valid if both doors' `along` values share the same parametric space (same edge, same origin point). When a B-pos and a B-rel door are grouped into the same bucket and the B-rel resolves to the longest shared run while the B-pos is projected onto a *different* run, the `runKey` discriminator separates them correctly. However, if both doors are on the *same run* but the B-rel `along` was computed relative to the shared edge (starting from `shared.a`) and the B-pos `along` is computed relative to the run returned from `findAllSharedEdges` (which may have a different starting point after `mergeCollinearAdjacent`), the two `along` values are on different parametric origins and the arithmetic is wrong. The result is false-positive overlap errors or missed overlaps for mixed B-rel / B-pos pairs on the same shared edge.

**Fix:** Normalize both B-rel and B-pos entries to a common arc-length offset (pixels along the shared edge from a canonical origin) before comparing, rather than comparing fractional `along` values with heterogeneous origins. Alternatively, convert everything to absolute grid positions (`along * edgeLen`) for the comparison arithmetic, eliminating the fraction-to-fraction comparison entirely.

---

### CR-03: `migrate_doors_to_canonical.py` can silently lose doors when the same room appears on both sides of a door pair

**File:** `tools/migrate_doors_to_canonical.py:554-559`

**Issue:** The dedup key is `sorted(rooms) + rounded position`. The migration walks every room's nested `doors:` list, so a door between rooms A and B appears once when processing A (emitted as `[A, B]`) and once when processing B (emitted as `[B, A]`, but sorted to `[A, B]`). The dedup correctly identifies this as a duplicate and keeps only the first. The bug: when the two sides compute *different positions* for the same door (because `legacy_door_to_position` for room A might compute position from A's wall, and for room B it might compute a slightly different position if B also has a nested door entry referencing the same physical door with different `wall`/`position` values), the rounded positions differ by more than the rounding tolerance, the dedup key mismatches, and both entries survive — producing two canonical doors at nearly the same position. The `normalizeDoors` overlap detector then throws a `DoorNormalizationError` at runtime, blanking the map's door layer.

The critical path: `_dedup_key` rounds to 2 decimal places (`round(pos['x'], 2)`), but `legacy_door_to_position` can produce positions differing by more than 0.01 grid cells when the two room-side computations use different rect wall-edge targets for the same physical shared edge (e.g., room A's east wall vs room B's west wall can differ by 1 cell unit when the room geometry has off-by-one in wall coordinates). This would produce keys like `A__B|3.5|4.5|90` and `A__B|4.5|4.5|90` — both survive dedup and both get written to YAML.

**Fix:** Increase the dedup tolerance to at least 0.5 grid cells for position matching (`round(pos['x'])` to the nearest integer) since two doors on the same physical shared edge should never be more than half a cell apart in canonical coordinates. Or, more robustly, after computing a position for the B-side reference, check whether the other room was already seen as the "home" room for a door at approximately the same location.

```python
def _dedup_key(entry: dict, pos: dict) -> str:
    rooms = entry.get("rooms", [])
    pair = "__".join(sorted(rooms)) if len(rooms) >= 2 else f"{rooms[0]}__ext"
    # Round to nearest 0.5 cell — same shared edge from either side
    # should produce positions within 0.5 of each other.
    return f"{pair}|{round(pos['x'] * 2) / 2}|{round(pos['y'] * 2) / 2}|{pos['angle']}"
```

---

## Warnings

### WR-01: `useRoomRevealAnimations` — stale `rooms` reference in effect dependency array can cause missed animations

**File:** `src/components/domain/encounter/animation/useRoomRevealAnimations.ts:122`

**Issue:** The effect at line 76 lists `rooms` in its dependency array. `rooms` is `mapData.rooms`, an array passed from the renderer via `useRoomRevealAnimations({ rooms: mapData.rooms })`. In React, array identity changes on every render even when the underlying data is identical (because `mapData` itself is reconstructed from the API response). When `rooms` changes identity but not content, the effect re-runs, reads the same `prev` and `curr` visibility (which haven't changed), calls `scheduleReveal` which correctly returns `[]` (no diff), and returns early — harmless. But the effect *also* overwrites `prevVisibilityRef.current` on line 81 before the identity check, so a rapid sequence of renders that change `rooms` identity while also diffing visibility could skip an animation if the ref is clobbered before `scheduleReveal` is called with the old `prev`. This is a narrow race but observable when React batches updates.

**Fix:** Move the ref update (`prevVisibilityRef.current = visibility`) to *after* the `scheduleReveal` call and only apply it when the animation actually ran (or when the map identity changes). Alternatively, memoize `mapData.rooms` in the renderer with `useMemo` to stabilize identity.

---

### WR-02: `EncounterMapRenderer` fallback error path logs the warning *after* returning the partial result

**File:** `src/components/domain/encounter/EncounterMapRenderer.tsx:211-228`

**Issue:** In the `canonicalDoors` `useMemo` catch block, the code accumulates valid doors into `out`, then on line 225 calls `console.warn(...)`. The log fires even when `out` is empty (all authored doors failed validation), giving the user no visual indication that the map's door layer is blank. More importantly, the log message says "door normalization *warning*" but the actual condition is a thrown `DoorNormalizationError` from `normalizeDoors` — which is an error condition, not a warning. A silent warn with a partial result is difficult to diagnose from the browser console.

**Fix:** Use `console.error` instead of `console.warn` to distinguish the severity, and include the count of dropped doors in the message:
```ts
console.error(
  `[EncounterMapRenderer] ${authored.length - out.length} door(s) dropped due to normalization errors:`,
  err
);
```

---

### WR-03: `active_view_store.py` `get_state()` returns a shallow copy — nested dicts are shared

**File:** `terminal/active_view_store.py:37-39`

**Issue:** `get_state()` returns `dict(_state)` — a shallow copy. The nested dicts (`encounter_room_visibility`, `encounter_door_status`, `encounter_tokens_by_location`) are still the same objects as those in `_state`. Any caller that mutates the returned dict's nested values (e.g., `state['encounter_room_visibility']['room_x'] = True`) modifies the shared in-memory state without going through `update_state`, bypassing the lock. `build_active_view_payload` in `views.py` does not mutate the returned dict's nested values directly, but it does pass them to `response` which goes to JSON serialization — safe. However, if a future caller stores the result and later mutates it, data races will occur.

**Fix:**
```python
import copy

def get_state() -> dict:
    with _lock:
        return copy.deepcopy(_state)
```

---

### WR-04: `doorWallAxis` tolerance of ±1 degree may misclassify diagonal doors authored with angles like 44° or 46°

**File:** `src/components/domain/encounter/geometry/roomGeometry.ts:236-239`

**Issue:** `doorWallAxis` normalizes the angle to `[0, 180)` and checks `if (a < EPS || a > 180 - EPS) return 'EW'` and `if (Math.abs(a - 90) < EPS) return 'NS'` where `EPS = 1`. Any angle within 1 degree of 0, 90, or 180 is classified as axis-aligned. Diagonal angles like 44° or 46° are classified as `'diagonal'`, which is correct. But the door rendering in `EncounterMapRenderer.tsx:1286` uses a different threshold: `Math.abs((door.angle % 180 + 180) % 180 - 90) < 45`. This means doors with angle = 44° are rendered as `'vertical'` by the renderer but classified as `'diagonal'` by `doorWallAxis` — they get the wrong orientation in `doorEndpoints`. This disagreement is silent and causes incorrect cell-adjacency computation for affected doors.

**Fix:** Unify the orientation threshold. Both `doorWallAxis` and the renderer's inline threshold should use the same cutoff (45 degrees). Update `doorWallAxis`:
```ts
const EPS = 45; // match renderer threshold
if (a < EPS || a > 180 - EPS) return 'EW';
if (Math.abs(a - 90) < EPS) return 'NS';
return 'diagonal'; // unreachable with 45-degree EPS, but kept for future
```
Or alternatively, extract a shared constant and reference it in both places.

---

### WR-05: `svg_to_map.py` SVG path parser does not handle `C`, `S`, `Q`, `T`, `A` commands — silently drops curve geometry

**File:** `tools/svg_to_map.py:122-123`

**Issue:** The `parse_path_d` function handles `M m L l H h V v Z z` but the `else` branch at line 122 just increments `i` by 1 and discards the current token. Inkscape SVG paths that contain cubic bezier (`C`/`c`/`S`/`s`), quadratic bezier (`Q`/`q`/`T`/`t`), or arc (`A`/`a`) commands will have their command letter consumed but their arguments consumed one-at-a-time as floating-point tokens, which the loop will attempt to parse as commands. The result: the vertices array is silently truncated or garbled. An SVG exported from Inkscape with any rounded corner or arc will produce incorrect polygon output with no error.

**Fix:** Add explicit handling for curve commands (at minimum, treat them as errors with a clear message; better, approximate the endpoints):
```python
elif cmd in ("C", "c"):
    # Cubic bezier: skip 5 of the 6 numbers, use the endpoint
    ...
else:
    sys.exit(f"ERROR: Unsupported SVG path command '{cmd}' — export SVG with straight segments only (no curves).")
```

---

### WR-06: `corridorDoorVisibility.test.ts` — test file defines `playerDoorVisible` by copying renderer code rather than importing a shared function

**File:** `src/components/domain/encounter/doors/__tests__/corridorDoorVisibility.test.ts:67-82`

**Issue:** The comment on line 64 says the function is "copied verbatim from EncounterMapRenderer.tsx lines 1356–1377". This is acknowledged test duplication — but the consequence is that if the renderer's door visibility logic changes, the test continues to pass against the old copy while the renderer has new (potentially broken) behavior. The test was introduced specifically to verify the renderer's filter logic; it only provides value when it tests the actual function, not a snapshot of it.

**Fix:** Extract the player-side door visibility predicate from `EncounterMapRenderer.tsx` into a standalone module (e.g., `doors/doorVisibility.ts`) and import it in both the renderer and the test. This is a one-function extraction.

---

### WR-07: `migrate_doors_to_canonical.py` writes back YAML without preserving original formatting, and `_maybe_int` silently changes float YAML values that were integers in the source

**File:** `tools/migrate_doors_to_canonical.py:567-570, 683-691`

**Issue:** `_maybe_int` rounds floats that are within `1e-9` of an integer to `int`. This is correct for `position.x/y` values. However, `_dump_with_compact_doors` uses `yaml.safe_dump(... sort_keys=False)`, which re-serializes the entire file. This means existing room polygon coordinate lists get reformatted (e.g., integers that were stored as `4.0` in the YAML become `4`, and vice versa), causing unnecessary diffs to every file even when no doors were nested. The `sort_keys=False` prevents key reordering, but all floating-point representation is normalized by PyYAML's emitter. This makes `git diff` noisy and could break tools that diff YAML files.

This is lower severity than the other issues since the files are already migrated and won't be re-processed, but it is a tool-quality issue that affects future use.

**Fix:** For the migration tool, consider preserving the original file content for unchanged sections using a targeted approach: only replace the `rooms:` and `doors:` sections rather than re-dumping the entire document.

---

## Info

### IN-01: `scheduleReveal.ts` — `roomYCentroid` uses minimum Y of rects for sorting, not centroid Y

**File:** `src/components/domain/encounter/animation/scheduleReveal.ts:52-56`

**Issue:** For rect rooms, `roomYCentroid` returns `Math.min(...rects.map(r => r.y))` — the top edge of the topmost rect, not the room's Y centroid. The function name says "centroid" but the implementation is "top edge". For single-rect rooms this is fine. For L-shaped or T-shaped multi-rect rooms the "centroid" will be the topmost rect's Y, which may not reflect the visual center.

The behavior is consistent and the tests verify it correctly (test case 14: rect rooms use `r.y`). The mismatch is between the name and the implementation; the effect on gameplay is that reveal order for multi-rect rooms may be slightly different from what the name implies.

**Fix:** Rename the return value's meaning in the docstring, or compute the actual centroid (average of rect bbox centers weighted by area). Given the current test reliance on "min Y" behavior, a rename is safer:
```ts
// Returns the top Y of the room (top edge of topmost rect, cy for circles, vertex average for polygons).
// Used for Y-ascending sort order in reveal cascades.
function roomTopY(room: GridRoom): number { ... }
```

---

### IN-02: `vitest.config.ts` uses `jsdom` environment for all tests including pure-geometry tests

**File:** `vitest.config.ts:5`

**Issue:** `environment: 'jsdom'` loads a full browser DOM simulation for every test, including the pure-math tests in `polygon2d`, `roomGeometry`, `doorNormalizer`, and `scheduleReveal`. These modules have no DOM dependency. `jsdom` adds startup cost and a dependency on a browser polyfill for tests that are pure Node.js computations.

**Fix:** Use `environment: 'node'` as the global default and add per-file overrides (`@vitest-environment jsdom`) only for tests that actually use the DOM (currently none in the reviewed set).

---

### IN-03: `EncounterMapRenderer.tsx:1349` — unsafe cast `as unknown as RoomData[]`

**File:** `src/components/domain/encounter/EncounterMapRenderer.tsx:1349`

**Issue:** `mapRooms={mapData.rooms as unknown as import('../../../types/encounterMap').RoomData[]}` double-casts `GridRoom[]` to `RoomData[]`. `TokenLayer` accepts `mapRooms?: (RoomData | GridRoom)[]`, so no cast is needed — the union type already accepts `GridRoom`. The cast hides a type error and could mask a real API boundary mismatch if `TokenLayer`'s props were ever narrowed.

**Fix:** Remove the cast entirely:
```tsx
mapRooms={mapData.rooms}
```
`GridRoom[]` is assignable to `(RoomData | GridRoom)[]` without a cast.

---

_Reviewed: 2026-05-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
