# Phase 25: Map rotation controls — Research

**Gathered:** 2026-05-22
**Status:** Complete

---

## Scope Summary

Add playback controls to all three 3D map views:

- **Galaxy map** — play/pause toggle for camera auto-rotation only. No scrub bar.
- **System map** — play/pause + horizontal scrub bar (enabled only when paused).
- **Orbit map** — same as system map.

Controls render as a `position: absolute; top: 24px; left: 50%` overlay pill (outside the R3F Canvas), not inside the 3D scene.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/domain/maps/MapPlaybackControls.tsx` | Stateless presentational overlay component |
| `src/components/domain/maps/MapPlaybackControls.css` | CRT-style pill, button, and scrub bar styles |

---

## Files to Modify

### GalaxyMap.tsx
`src/components/domain/maps/GalaxyMap.tsx`

**Current structure:** `<div className={containerClass}> <Canvas ...> ... </Canvas> </div>`

**Change:** Add `<MapPlaybackControls>` as a sibling to `<Canvas>` inside the container div. Wire `isPlaying` to `useSceneStore(s => s.animations.autoRotate)` and `onTogglePlay` to `setAutoRotate(!autoRotate)`. Pass `showScrub={false}`.

**Key insight:** `autoRotate` starts `true` in initialState. The play/pause button flips `autoRotate`; `GalaxyControls.tsx` already auto-resumes after `autoRotateResumeDelay=5000ms` when the user interacts. The pause button should also call `recordInteraction()` so the resume timer behaves consistently — or simply call `setAutoRotate(false)` and rely on the existing 5-second resume timer being suppressed while `autoRotate` is explicitly false. Currently the resume only fires if `!animations.autoRotate` AND `lastInteractionTime` is set. Calling `setAutoRotate(false)` without `recordInteraction()` means `lastInteractionTime` stays null and auto-resume is permanently suppressed — which is the correct behavior for a manual pause.

### SystemMap.tsx
`src/components/domain/maps/SystemMap.tsx`

**Current structure:** `<div className={containerClass}> <Canvas ...> <SystemScene paused={paused} .../> </Canvas> </div>`

**Change:**
1. Add local `useState<boolean>(true)` for `isOrbiting` (orbits playing by default).
2. Add `useState<number>(0)` for `scrubOffsetRef` accumulator — or use `useRef` for the accumulator and pass a callback down to `SystemScene` that it uses to apply the offset.
3. Add `<MapPlaybackControls>` sibling to `<Canvas>`, passing `isPlaying={isOrbiting}`, `showScrub={true}`, `onTogglePlay`, `onScrubDelta`.
4. Pass `isOrbiting` down as a prop to `SystemScene` for the orbital pause flag (distinct from the global `paused` prop which pauses rendering entirely).

**Orbital pause integration:** `SystemScene` currently checks `paused` (from `useIsPaused()` or the `paused` prop) before calling `calculatePlanetPosition` each frame. A new `orbitsPaused` prop needs to be threaded through `SystemScene` so it can freeze planet positions while still rendering (not the same as the global `paused` which stops the frame loop).

### OrbitScene.tsx / OrbitMap.tsx
`src/components/domain/maps/r3f/OrbitScene.tsx` and `src/components/domain/maps/OrbitMap.tsx`

Same pattern as SystemMap/SystemScene. `OrbitScene` has its own `animationPaused` local state (already!) used when a surface marker is selected. The new `orbitsPaused` flag is a second independent pause — these should be OR'd together: `const effectivelyStopped = paused || orbitsPaused || animationPaused`.

---

## State Architecture

### Galaxy pause state
- **Location:** `sceneStore.animations.autoRotate` — already exists.
- **Toggle:** `setAutoRotate(bool)` — already exists.
- **Reading it in GalaxyMap:** `useSceneStore(s => s.animations.autoRotate)` — note GalaxyMap is a regular React component (not inside Canvas), so it can call Zustand hooks directly.

### System / Orbit orbit-pause state
- **Location:** Local `useState<boolean>` in `SystemMap` and `OrbitMap` respectively (per D-08 — not persisted to store, resets on view change).
- **Prop name to scene:** `orbitsPaused?: boolean` (new prop on `SystemScene` and `OrbitScene`).

### Scrub offset state
- **Location:** Local `useRef<number>` accumulator in `SystemMap` and `OrbitMap`.
- **Thread to scene:** Pass as prop `scrubOffsetRad?: number` OR via a callback `onScrubDelta` that the scene consumes via a ref.
- **Recommended pattern:** Keep the accumulated angle in a `useRef` in the map wrapper; pass it as a prop to the scene; scene reads it each frame in `useFrame`. Using `useRef` (not `useState`) avoids React re-renders on every drag pixel — the scene's `useFrame` reads the current value directly.

### Scrub speed calibration (D-06)
The adaptive speed formula:
```
// No body selected: calibrate to shortest orbital period
const shortestPeriod = Math.min(...data.bodies.map(b => b.orbital_period ?? 365));
const radiansPerPixel = (2 * Math.PI) / (trackWidthPx * (shortestPeriod / ORBITAL_PERIOD_TARGET_SECONDS));

// Body selected: calibrate to that body's period
const bodyPeriod = selectedBody.orbital_period ?? 365;
const radiansPerPixel = (2 * Math.PI) / (trackWidthPx * (bodyPeriod / ORBITAL_PERIOD_TARGET_SECONDS));
```
`ORBITAL_PERIOD_TARGET_SECONDS = 10` is already defined in `SystemScene.tsx`.

The scrub bar calls `onScrubDelta(deltaX)` with raw pixel deltas. The parent hook converts deltaX to radians using the formula above and accumulates into `scrubOffsetRef.current`.

---

## Orbital Position Formula (how scrub offset integrates)

**SystemScene current formula** (in `calculatePlanetPosition`):
```typescript
const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
const orbitalSpeed = (2 * Math.PI) / orbitalPeriod * speedMultiplier;
const initialAngle = (body.orbital_angle ?? 0) * (Math.PI / 180);
const currentAngle = initialAngle + orbitalSpeed * elapsedSeconds;
```

**When paused + scrubbing**, bodies freeze at their last `t` and the scrub offset is applied as an additional angle:
```typescript
// When orbitsPaused:
const frozenAngle = initialAngle + orbitalSpeed * frozenElapsedSeconds;
const currentAngle = frozenAngle + scrubOffsetRad;
```

The simplest integration: when `orbitsPaused` is true, `calculatePlanetPosition` reads `scrubOffsetRad` from a ref instead of computing `elapsedSeconds` from the clock. The scene component needs access to the accumulated offset ref — pass it as a React ref object (`scrubOffsetRef: React.RefObject<number>`).

**Orbit scene (moons/stations)** follows the same formula — each `Moon` and `OrbitalStation` component receives `startTime`, `speedMultiplier`, and orbital params. The same `scrubOffsetRef` approach applies.

---

## Component Interface

```typescript
// src/components/domain/maps/MapPlaybackControls.tsx
interface MapPlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  showScrub: boolean;
  onScrubDelta?: (deltaX: number) => void;
}
```

DOM structure:
```html
<div class="map-playback-controls">
  <button class="map-playback-controls__btn" aria-label="Pause animation | Play animation">
    ⏸ | ▶
  </button>
  <!-- only when showScrub=true -->
  <div class="map-playback-controls__scrub" aria-disabled="true|false">
    <div class="map-playback-controls__scrub-track">
      <div class="map-playback-controls__scrub-thumb" />
    </div>
  </div>
</div>
```

Overlay positioning: `position: absolute; top: 24px; left: 50%; transform: translateX(-50%); z-index: 10` — inside the map container div which is already `position: absolute; width: 100%; height: 100%`.

---

## Visual Spec (from UI-SPEC.md)

| Element | Value |
|---------|-------|
| Overlay background | `#111e1e` (`--color-bg-panel`) |
| Overlay border | `1px solid #2a4040` |
| Overlay clip-path | `polygon(12px 0%, calc(100% - 0px) 0%, 100% 0%, 100% 100%, 0% 100%, 0% 12px)` — single top-left chamfer |
| Button min size | 44×44px (TV touch target) |
| Button icon color | `#c9a050` (`--color-amber`) |
| Button border (paused state) | `#c9a050` — amber signals scrub is live |
| Scrub track (active) | `#4a8b8b` (`--color-teal`), height 2px |
| Scrub track (disabled) | `#2a4040`, height 2px |
| Scrub thumb | 8×8px circle, `#c9a050`, hidden when playing |
| Scrub width | `min(300px, calc(100% - 80px))`, height 44px touch area |
| Font | `'Share Tech Mono', 'Cascadia Code', 'Courier New', monospace` |

Icons: `⏸` (U+23F8) when playing, `▶` (U+25B6) when paused. Icon-only (no text label). `aria-label` carries accessible name.

No tooltip during drag — the map itself is the feedback.

---

## Drag Mechanics (MapPlaybackControls)

```
pointerdown  → setPointerCapture; record startX; set isDragging=true
pointermove  → if isDragging: deltaX = e.clientX - lastX; onScrubDelta(deltaX); lastX = e.clientX
pointerup    → releasePointerCapture; isDragging=false
pointercancel → releasePointerCapture; isDragging=false
```

Thumb visual: tracks `cumulativeX` clamped within `[0, trackWidth]`. Purely cosmetic — does not drive the orbital offset calculation.

---

## Existing Code to Reuse

| Asset | Usage |
|-------|-------|
| `useSceneStore` / `setAutoRotate` | Galaxy play/pause toggle |
| `useAnimationState` | Reading `animations.autoRotate` in GalaxyMap |
| `ORBITAL_PERIOD_TARGET_SECONDS = 10` in SystemScene.tsx | Scrub speed calibration constant |
| `startTimeRef` in SystemScene/OrbitScene | Freeze: capture `Date.now() - startTimeRef.current` at pause time |
| `paused` prop pattern in SystemScene/OrbitScene | Mirror for `orbitsPaused` prop |

---

## Gotchas

1. **GalaxyControls auto-resume:** When the user drag-rotates the galaxy, `GalaxyControls` calls `setAutoRotate(false)` + `recordInteraction()` and auto-resumes after 5 seconds. The play/pause button must only call `setAutoRotate(false)` — NOT `recordInteraction()` — so the 5s timer isn't running. Otherwise, the user pauses via button and the map auto-resumes 5 seconds later unexpectedly.

2. **`paused` vs `orbitsPaused`:** The global `paused` prop stops R3F's frameloop entirely (`frameloop="demand"`). The new `orbitsPaused` freezes orbital math while rendering continues. Never conflate these — passing `orbitsPaused` as `paused` to the scene would freeze all rendering including camera interaction.

3. **SystemScene `paused` currently OR'd from two sources:** `const paused = pausedProp || storePaused`. The new `orbitsPaused` must be a third OR'd flag that only affects orbital position calculation, not the camera tracking update calls.

4. **Overlay z-index vs R3F Canvas:** The Canvas is `position: relative` (or `absolute`, see GalaxyMap.css). The overlay div at `z-index: 10` must sit inside the same stacking context as the canvas. The map container divs (`galaxy-map-container`, `system-map-container`, `orbit-map-container`) are all `position: absolute` — the overlay renders as their child, so z-index 10 works correctly.

5. **Touch TV pointer events:** Use `pointer` events (not `mouse`/`touch`) with `setPointerCapture` so drag works correctly on both mouse and touch. The scrub bar must have `touch-action: none` CSS to prevent browser scroll interference.

6. **OrbitScene `animationPaused` state:** OrbitScene already has a local `animationPaused` for surface marker selection. The new `orbitsPaused` from the play/pause button is separate. Both must independently freeze moon/station orbital math.

---

## Implementation Order

1. Create `MapPlaybackControls.tsx` + `MapPlaybackControls.css` (pure presentational).
2. Wire into `GalaxyMap.tsx` — galaxy play/pause only (simplest, no scrub).
3. Add `orbitsPaused` prop + scrub offset ref to `SystemScene.tsx`.
4. Wire into `SystemMap.tsx` — play/pause + scrub.
5. Repeat steps 3–4 for `OrbitScene.tsx` / `OrbitMap.tsx`.
6. TypeScript check (`pnpm run typecheck`).

---

*Phase: 25-map-rotation-controls*
*Research completed: 2026-05-22*
