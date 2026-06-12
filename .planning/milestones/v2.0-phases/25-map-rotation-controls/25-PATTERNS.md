# Phase 25: Map Rotation Controls - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/components/domain/maps/MapPlaybackControls.tsx` | component | event-driven (pointer drag) | `src/components/domain/encounter/Token.tsx` (pointer capture) + `src/components/ui/ViewStatusOverlay.tsx` (overlay positioning) | role-match |
| `src/components/domain/maps/MapPlaybackControls.css` | config/style | — | `src/components/domain/maps/GalaxyMap.css` + `src/components/ui/ViewStatusOverlay.css` | role-match |
| `src/components/domain/maps/GalaxyMap.tsx` | component | request-response | itself (modify) | exact |
| `src/components/domain/maps/SystemMap.tsx` | component | request-response | itself (modify) | exact |
| `src/components/domain/maps/OrbitMap.tsx` | component | request-response | itself (modify) | exact |
| `src/components/domain/maps/r3f/SystemScene.tsx` | component | event-driven (useFrame loop) | itself (modify) | exact |
| `src/components/domain/maps/r3f/OrbitScene.tsx` | component | event-driven (useFrame loop) | itself (modify) | exact |

---

## Pattern Assignments

### `src/components/domain/maps/MapPlaybackControls.tsx` (component, event-driven)

**Primary analog:** `src/components/domain/encounter/Token.tsx` (pointer capture pattern)
**Secondary analog:** `src/components/ui/ViewStatusOverlay.tsx` (overlay structure)

**Imports pattern** — copy from `ViewStatusOverlay.tsx` lines 1-2, extend with `useRef`, `useState`:
```typescript
import { useRef, useState, useCallback } from 'react';
import './MapPlaybackControls.css';
```

**Props interface** — from RESEARCH.md spec:
```typescript
interface MapPlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  showScrub: boolean;
  onScrubDelta?: (deltaX: number) => void;
}
```

**Pointer capture / drag pattern** — copy from `src/components/domain/encounter/Token.tsx` lines 52-60:
```typescript
const handlePointerDown = (e: React.PointerEvent<Element>) => {
  // Capture pointer so pointermove/pointerup route here even if finger moves off-element.
  // Also prevents the browser from converting the touch into simulated mouse events.
  e.currentTarget.setPointerCapture(e.pointerId);
  // ...set drag state
};
```

Extend to the full scrub drag lifecycle:
```typescript
// scrub element gets: onPointerDown, onPointerMove, onPointerUp, onPointerCancel
// style={{ touchAction: 'none' }} — prevents browser scroll interference
const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
  if (!onScrubDelta) return;
  e.currentTarget.setPointerCapture(e.pointerId);
  isDraggingRef.current = true;
  lastXRef.current = e.clientX;
};
const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
  if (!isDraggingRef.current || !onScrubDelta) return;
  const deltaX = e.clientX - lastXRef.current;
  lastXRef.current = e.clientX;
  onScrubDelta(deltaX);
  // update cosmetic thumb state
};
const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
  e.currentTarget.releasePointerCapture(e.pointerId);
  isDraggingRef.current = false;
};
```

**Overlay positioning pattern** — follow `ViewStatusOverlay.css` lines 1-18 but `position: absolute` (not `fixed`) because it sits inside `galaxy-map-container` which is already `position: absolute`:
```tsx
// Inside a .map-playback-controls div:
// position: absolute; top: 24px; left: 50%; transform: translateX(-50%); z-index: 10
return (
  <div className="map-playback-controls">
    <button
      className="map-playback-controls__btn"
      aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
      onClick={onTogglePlay}
    >
      {isPlaying ? '⏸' : '▶'}
    </button>
    {showScrub && (
      <div
        className={`map-playback-controls__scrub${isPlaying ? ' map-playback-controls__scrub--disabled' : ''}`}
        aria-disabled={isPlaying}
        onPointerDown={isPlaying ? undefined : handlePointerDown}
        onPointerMove={isPlaying ? undefined : handlePointerMove}
        onPointerUp={isPlaying ? undefined : handlePointerUp}
        onPointerCancel={isPlaying ? undefined : handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        <div className="map-playback-controls__scrub-track" />
        {!isPlaying && (
          <div
            className="map-playback-controls__scrub-thumb"
            style={{ left: `${thumbX}px` }}
          />
        )}
      </div>
    )}
  </div>
);
```

**State pattern** — use `useRef` for drag state (no re-renders on pointer events); `useState` only for thumb cosmetic position:
```typescript
const isDraggingRef = useRef(false);
const lastXRef = useRef(0);
const trackRef = useRef<HTMLDivElement>(null);
const [thumbX, setThumbX] = useState(0);
const cumulativeXRef = useRef(0);
```

---

### `src/components/domain/maps/MapPlaybackControls.css` (style)

**Primary analog:** `src/components/domain/maps/GalaxyMap.css` (container/overlay within map)
**Secondary analog:** `src/components/ui/ViewStatusOverlay.css` (CRT color palette, font)

**Overlay positioning** — absolute (not fixed) because parent container is already `position: absolute`:
```css
.map-playback-controls {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0;
  /* CRT pill — single top-left chamfer */
  background: #111e1e;
  border: 1px solid #2a4040;
  clip-path: polygon(12px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 12px);
  font-family: 'Share Tech Mono', 'Cascadia Code', 'Courier New', monospace;
  pointer-events: all; /* Re-enable within a pointer-events:none parent if needed */
}
```

**CRT color values** — copy palette from `ViewStatusOverlay.css` lines 9, 27:
```css
/* Teal: #4a6b6b  Amber: #c9a050  Dark panel bg: #111e1e  Border: #2a4040 */
```

**Button pattern** — ≥44×44px touch target per D-12:
```css
.map-playback-controls__btn {
  min-width: 44px;
  min-height: 44px;
  background: transparent;
  border: none;
  border-right: 1px solid #2a4040;
  color: #c9a050;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
}

/* Amber border signals scrub is active (paused state) */
.map-playback-controls--paused .map-playback-controls__btn {
  border-color: #c9a050;
}
```

**Scrub bar** — `touch-action: none` is set inline in TSX; CSS handles sizing and track/thumb visuals:
```css
.map-playback-controls__scrub {
  width: min(300px, calc(100vw - 80px));
  height: 44px;
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 12px;
  cursor: ew-resize;
}
.map-playback-controls__scrub--disabled {
  cursor: default;
  opacity: 0.4;
}
.map-playback-controls__scrub-track {
  width: 100%;
  height: 2px;
  background: #4a8b8b; /* teal when active */
}
.map-playback-controls__scrub--disabled .map-playback-controls__scrub-track {
  background: #2a4040;
}
.map-playback-controls__scrub-thumb {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c9a050;
  top: 50%;
  transform: translate(-50%, -50%);
}
```

---

### `src/components/domain/maps/GalaxyMap.tsx` (modify — add overlay)

**Analog:** itself — `src/components/domain/maps/GalaxyMap.tsx`

**Existing import block** (lines 14-21) — extend with `useSceneStore`/`useAnimationState`:
```typescript
import { useRef, useImperativeHandle, forwardRef, Suspense, useCallback } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
// ADD:
import { useSceneStore, useAnimationState } from '@/stores/sceneStore';
import { MapPlaybackControls } from './MapPlaybackControls';
```

**Store wiring** — add inside the `forwardRef` body, after existing refs (line 58 area):
```typescript
const animations = useAnimationState();
const setAutoRotate = useSceneStore((state) => state.setAutoRotate);
// NOTE: Do NOT call recordInteraction() — that would trigger the 5s auto-resume timer.
// setAutoRotate(false) alone permanently suppresses auto-resume (lastInteractionTime stays null).
const handleTogglePlay = useCallback(() => {
  setAutoRotate(!animations.autoRotate);
}, [animations.autoRotate, setAutoRotate]);
```

**JSX overlay insertion** — sibling to `<Canvas>` inside `<div className={containerClass}>` (line 100-139 pattern):
```tsx
return (
  <div className={containerClass}>
    {/* Existing Canvas block unchanged */}
    <Canvas ...>...</Canvas>

    {/* NEW: play/pause overlay — outside Canvas, inside container */}
    <MapPlaybackControls
      isPlaying={animations.autoRotate}
      onTogglePlay={handleTogglePlay}
      showScrub={false}
    />
  </div>
);
```

---

### `src/components/domain/maps/SystemMap.tsx` (modify — add orbital pause + scrub)

**Analog:** itself — `src/components/domain/maps/SystemMap.tsx`

**Existing import block** (lines 14-23) — extend with `useRef`:
```typescript
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  Suspense,
  useMemo,
} from 'react';
// ADD:
import { MapPlaybackControls } from './MapPlaybackControls';
```

**New local state + refs** — add after `loadedSystemRef` (line 81 area):
```typescript
// Orbital playback state (local — resets on navigation, D-08)
const [isOrbiting, setIsOrbiting] = useState(true);
const scrubOffsetRef = useRef(0); // accumulated radians, read by SystemScene each frame

// Scrub speed: radiansPerPixel = (2π) / (trackWidthPx × (period / TARGET_SECONDS))
// ORBITAL_PERIOD_TARGET_SECONDS = 10 (constant in SystemScene.tsx)
const ORBITAL_PERIOD_TARGET_SECONDS = 10;
const SCRUB_TRACK_WIDTH = 300; // matches CSS min(300px, ...)

const handleScrubDelta = useCallback((deltaX: number) => {
  if (!systemData?.bodies?.length) return;
  const selectedBody = selectedPlanetData; // already computed below
  const period = selectedBody?.orbital_period ?? Math.min(...systemData.bodies.map(b => b.orbital_period ?? 365));
  const radiansPerPixel = (2 * Math.PI) / (SCRUB_TRACK_WIDTH * (period / ORBITAL_PERIOD_TARGET_SECONDS));
  scrubOffsetRef.current += deltaX * radiansPerPixel;
}, [systemData, selectedPlanetData]);

const handleTogglePlay = useCallback(() => {
  setIsOrbiting((prev) => !prev);
}, []);
```

**Pass new props down to SystemScene** — at the `<SystemScene>` JSX (line 232 area):
```tsx
<SystemScene
  ref={sceneRef}
  data={systemData}
  systemSlug={systemSlug}
  selectedPlanet={selectedPlanetData}
  paused={paused}
  orbitsPaused={!isOrbiting}          // NEW
  scrubOffsetRef={scrubOffsetRef}      // NEW
  transitionState={transitionState}
  onPlanetSelect={handlePlanetSelect}
  onReady={onReady}
/>
```

**Overlay insertion** — same sibling-to-Canvas pattern as GalaxyMap:
```tsx
<MapPlaybackControls
  isPlaying={isOrbiting}
  onTogglePlay={handleTogglePlay}
  showScrub={true}
  onScrubDelta={handleScrubDelta}
/>
```

---

### `src/components/domain/maps/OrbitMap.tsx` (modify — same pattern as SystemMap)

**Analog:** `src/components/domain/maps/SystemMap.tsx` (same pattern, mirrored)

Same additions as SystemMap but using `orbitData` and `OrbitScene`. Key difference from RESEARCH.md:

**New local state + refs** — after `loadedLocationRef` (line 78 area):
```typescript
const [isOrbiting, setIsOrbiting] = useState(true);
const scrubOffsetRef = useRef(0);

const handleScrubDelta = useCallback((deltaX: number) => {
  if (!orbitData?.moons?.length && !orbitData?.orbital_stations?.length) return;
  // Use shortest period among moons + stations, or selected element's period
  const allBodies = [
    ...(orbitData?.moons ?? []),
    ...(orbitData?.orbital_stations ?? []),
  ];
  const period = allBodies.length
    ? Math.min(...allBodies.map(b => (b as any).orbital_period ?? 365))
    : 365;
  const radiansPerPixel = (2 * Math.PI) / (300 * (period / 10));
  scrubOffsetRef.current += deltaX * radiansPerPixel;
}, [orbitData]);
```

**Pass new props to OrbitScene** (line 229 area):
```tsx
<OrbitScene
  ...existing props...
  orbitsPaused={!isOrbiting}      // NEW
  scrubOffsetRef={scrubOffsetRef} // NEW
/>
```

---

### `src/components/domain/maps/r3f/SystemScene.tsx` (modify — accept orbitsPaused + scrubOffsetRef)

**Analog:** itself

**Existing props interface** (lines 48-63) — extend:
```typescript
export interface SystemSceneProps {
  // ...existing...
  paused?: boolean;
  /** NEW: freeze orbital math without stopping rendering (play/pause button) */
  orbitsPaused?: boolean;
  /** NEW: accumulated scrub offset in radians, read each frame when orbitsPaused */
  scrubOffsetRef?: React.RefObject<number>;
}
```

**Existing paused derivation** (line 96) — add third flag:
```typescript
const paused = pausedProp || storePaused;
// orbitsPaused ONLY freezes planet position math — never the frameloop or camera
const orbitsPaused = orbitsPausedProp ?? false;
```

**Existing `calculatePlanetPosition`** (lines 234-252) — add scrub offset when paused.
The function currently reads live `Date.now()`. When `orbitsPaused`, it should read a frozen elapsed + scrub offset:

```typescript
// Add ref to capture elapsed seconds at pause time
const frozenElapsedRef = useRef<number | null>(null);

// When orbitsPaused transitions true→false, reset frozenElapsed
// When orbitsPaused transitions false→true, capture current elapsed
useEffect(() => {
  if (orbitsPaused) {
    frozenElapsedRef.current = (Date.now() - startTimeRef.current) / 1000;
  } else {
    // Resuming: shift startTimeRef forward by accumulated scrub so position is continuous
    if (frozenElapsedRef.current !== null && scrubOffsetRef?.current != null) {
      // (optional: re-anchor startTime so position is continuous after scrub)
    }
    frozenElapsedRef.current = null;
  }
}, [orbitsPaused]);

const calculatePlanetPosition = useCallback(
  (body: BodyData): THREE.Vector3 => {
    // Use frozen time + scrub offset when paused, live time when playing
    const elapsedSeconds = orbitsPaused && frozenElapsedRef.current !== null
      ? frozenElapsedRef.current
      : (Date.now() - startTimeRef.current) / 1000;
    const scrubOffset = orbitsPaused ? (scrubOffsetRef?.current ?? 0) : 0;

    const orbitalPeriod = body.orbital_period ?? 365;
    const orbitalSpeed = (2 * Math.PI) / orbitalPeriod * speedMultiplier;
    const initialAngle = (body.orbital_angle ?? 0) * (Math.PI / 180);
    const currentAngle = initialAngle + orbitalSpeed * elapsedSeconds + scrubOffset;
    // ... rest unchanged
  },
  [speedMultiplier, orbitsPaused, scrubOffsetRef]
);
```

**Existing `useFrame` orbital update** (lines 359-379) — add `orbitsPaused` guard so planets still render (freeze position) when orbitsPaused:
```typescript
useFrame(() => {
  if (!data?.bodies) return;

  // When globally paused: skip position updates entirely (frameloop is 'demand')
  // When orbitsPaused: still update planetPositionsRef but from frozen+scrub formula
  if (!paused) {
    data.bodies.forEach((body) => {
      const pos = calculatePlanetPosition(body);  // reads orbitsPaused internally
      planetPositionsRef.current.set(body.name, pos);
    });
    if (selectedPlanet) updateTracking();
  }
  // ... opacity update unchanged
});
```

---

### `src/components/domain/maps/r3f/OrbitScene.tsx` (modify — same as SystemScene pattern)

**Analog:** `src/components/domain/maps/r3f/SystemScene.tsx` (same pattern, mirrored)

**Existing `animationPaused` state** (line 147) — already exists for surface marker selection:
```typescript
const [animationPaused, setAnimationPaused] = useState(false);
```

**New props** — add alongside `paused`:
```typescript
/** NEW: freeze orbital math from play/pause button (independent of animationPaused) */
orbitsPaused?: boolean;
/** NEW: accumulated scrub offset in radians */
scrubOffsetRef?: React.RefObject<number>;
```

**Effective stop condition** — from RESEARCH.md: OR all three independent pause flags:
```typescript
const paused = pausedProp || storePaused;
// animationPaused: surface marker selected (already exists)
// orbitsPaused: play/pause button (new)
// Combined for orbital math only:
const orbitsMathFrozen = orbitsPausedProp || animationPaused;
```

**Existing `useFrame` loop that uses `animationPaused`** (line 612 area):
```typescript
// CURRENT:
useFrame(() => {
  if (paused) return;
  updateTracking();
});
// Moon/station components receive animationPaused={animationPaused} (lines 714, 723, 753, 766)
```

The `orbitsPaused` prop must be threaded to moon/station child components alongside `animationPaused`. Each child ORs them: `effectivelyPaused = animationPaused || orbitsPaused`. The `scrubOffsetRef` is passed similarly.

---

## Shared Patterns

### Zustand sceneStore — autoRotate toggle (galaxy play/pause)
**Source:** `src/stores/sceneStore.ts` lines 250-252 and `src/components/domain/maps/r3f/galaxy/GalaxyControls.tsx` lines 147-154
**Apply to:** `GalaxyMap.tsx` overlay wiring

```typescript
// sceneStore.ts: setAutoRotate action
setAutoRotate: (enabled) => set((state) => ({
  animations: { ...state.animations, autoRotate: enabled },
})),

// GalaxyControls.tsx: how controls call it (for reference — button MUST NOT call recordInteraction)
setAutoRotate(false);
recordInteraction(); // ← button MUST NOT call this — only drag-to-rotate should
```

**Critical gotcha:** The button must call only `setAutoRotate(false)`, not `recordInteraction()`. With `lastInteractionTime` null, the 5-second auto-resume in `GalaxyControls.tsx` lines 294-298 never fires — which is the correct behavior for a manual pause.

### Pointer capture drag pattern
**Source:** `src/components/domain/encounter/Token.tsx` lines 52-60
**Apply to:** `MapPlaybackControls.tsx` scrub drag handlers

```typescript
e.currentTarget.setPointerCapture(e.pointerId);
// Paired with: e.currentTarget.releasePointerCapture(e.pointerId) on pointerup/cancel
// CSS: style={{ touchAction: 'none' }} on the drag element
```

### `useRef` for hot-path state (no re-render)
**Source:** `src/components/domain/maps/r3f/SystemScene.tsx` lines 231-232, 219
**Apply to:** `scrubOffsetRef` in SystemMap/OrbitMap; drag state refs in MapPlaybackControls

```typescript
// Pattern: useRef for values read every frame / every pointer event — avoids React re-render cost
const startTimeRef = useRef(Date.now());
const planetPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
// scrubOffsetRef follows same convention: useRef<number>(0)
```

### CRT color palette
**Source:** `src/components/ui/ViewStatusOverlay.css` lines 9, 26-27
**Apply to:** `MapPlaybackControls.css`

```css
color: #4a6b6b;           /* teal — structure / track active */
text-shadow: 0 0 10px rgba(74, 107, 107, 0.6);
/* amber: #c9a050 — buttons/highlights */
/* dark bg: #111e1e   border: #2a4040 */
```

### Map container CSS positioning
**Source:** `src/components/domain/maps/GalaxyMap.css` lines 1-9 and `SystemMap.css` lines 1-9
**Apply to:** `MapPlaybackControls.css` overlay positioning

```css
/* Parent containers are all position: absolute; width: 100%; height: 100% */
/* Therefore overlay uses position: absolute (not fixed) */
.map-playback-controls {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}
```

### forwardRef + optional props pattern
**Source:** `src/components/domain/maps/SystemMap.tsx` lines 60-76, `GalaxyMap.tsx` lines 45-57
**Apply to:** `MapPlaybackControls.tsx` (simple functional component, no ref needed)

Props follow the project convention of optional callbacks with `?` and inline destructuring defaults.

---

## No Analog Found

All files have close analogs. No entries needed.

---

## Metadata

**Analog search scope:** `src/components/domain/maps/`, `src/components/domain/encounter/`, `src/components/ui/`, `src/stores/`
**Files scanned:** 12
**Pattern extraction date:** 2026-05-22
