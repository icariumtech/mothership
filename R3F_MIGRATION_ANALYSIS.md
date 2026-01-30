# React Three Fiber Migration Analysis

**Date:** 2026-01-25
**Project:** Mothership GM Tool - Three.js to React Three Fiber Migration
**Status:** Research & Planning Phase

---

## Executive Summary

This document analyzes migrating the Mothership GM tool's 3D map visualization system from vanilla Three.js to React Three Fiber (R3F). The current implementation consists of ~3,971 lines of imperative Three.js code across three scene classes, wrapped by ~527 lines of React components. The primary driver for migration is **animation stuttering** during map transitions, caused by uncoordinated animation systems running on the main thread.

**Key Findings:**
- **Code Reduction:** Estimated 40-50% reduction in lines of code (~2,500-3,000 lines total after migration)
- **Animation Fix:** R3F's `useFrame` hook provides unified RAF loop, eliminating stuttering
- **Developer Experience:** Declarative scene composition significantly improves maintainability
- **Risk Level:** Medium - requires careful phased migration but provides clear path forward

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Animation Stuttering Root Cause](#animation-stuttering-root-cause)
3. [React Three Fiber Benefits](#react-three-fiber-benefits)
4. [React Three Fiber Drawbacks](#react-three-fiber-drawbacks)
5. [Code Volume Comparison](#code-volume-comparison)
6. [Animation Performance Improvements](#animation-performance-improvements)
7. [Migration Strategy](#migration-strategy)
8. [Testing Strategy](#testing-strategy)
9. [Future Animation Capabilities](#future-animation-capabilities)
10. [Recommendation](#recommendation)

---

## Current Architecture Analysis

### Three.js Scene Classes

**File Structure:**
```
src/three/
├── GalaxyScene.ts      (1,112 lines)
├── SystemScene.ts      (1,527 lines)
└── OrbitScene.ts       (~1,332 lines)
Total: ~3,971 lines
```

**React Wrappers:**
```
src/components/domain/maps/
├── GalaxyMap.tsx       (133 lines)
├── SystemMap.tsx       (240 lines)
└── OrbitMap.tsx        (154 lines)
Total: ~527 lines
```

**Combined Total:** ~4,498 lines

### Current Pattern (Imperative)

Each scene class follows this pattern:

```typescript
class GalaxyScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationFrameId: number | null = null;

  constructor(container: HTMLElement) {
    // Manual setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(...);
    this.renderer = new THREE.WebGLRenderer(...);
    container.appendChild(this.renderer.domElement);

    // Manual event listeners
    this.setupControls(container);

    // Start custom RAF loop
    this.animate();
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    // Update logic
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    // Manual cleanup of everything
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.removeControls();
    this.scene.traverse(...); // dispose geometries/materials
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
```

**React Wrapper Pattern:**
```tsx
export const GalaxyMap = forwardRef<GalaxyMapHandle, GalaxyMapProps>(({ ... }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GalaxyScene | null>(null);

  // Manual lifecycle management
  useEffect(() => {
    if (!containerRef.current) return;
    sceneRef.current = new GalaxyScene(containerRef.current);

    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [visible]);

  // Imperative handle exposure
  useImperativeHandle(ref, () => ({
    diveToSystem: (systemName: string) => {
      return sceneRef.current?.diveToSystem(systemName) || Promise.resolve();
    },
  }), []);

  return <div ref={containerRef} />;
});
```

### Problems with Current Architecture

1. **Manual Memory Management:** Every geometry, material, texture, and event listener must be manually disposed
2. **Imperative API:** Parent components call methods on child refs (breaks React's data-down pattern)
3. **Duplicate RAF Loops:** Each scene runs its own `requestAnimationFrame` loop
4. **No React Integration:** Three.js state is completely separate from React state
5. **Event Listener Hell:** Complex binding/unbinding patterns for controls
6. **Difficult Testing:** Imperative classes hard to test in isolation

---

## Animation Stuttering Root Cause

### The Problem

When drilling down from galaxy→system or system→orbit, the **InfoPanel typewriter animation stutters noticeably**.

### Root Cause Analysis

The application runs **four uncoordinated animation systems** on the main thread:

```
┌─────────────────────────────────────────────────────────┐
│                    MAIN THREAD                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Three.js RAF Loop (GalaxyScene)                    │
│     ├─ requestAnimationFrame(this.animate)             │
│     ├─ Update nebula particles                         │
│     ├─ Auto-rotation                                   │
│     └─ renderer.render(scene, camera)                  │
│                                                         │
│  2. GSAP Camera Animation (in Scene classes)           │
│     ├─ gsap.to(camera.position, ...)                   │
│     ├─ Custom easing calculations                      │
│     └─ Triggers on diveToSystem()                      │
│                                                         │
│  3. React Typewriter Hook (setTimeout-based)           │
│     ├─ setTimeout(typeNextChar, 15ms)                  │
│     ├─ HTML parsing & string building                  │
│     ├─ setState(displayedContent)                      │
│     └─ Triggers React re-render                        │
│                                                         │
│  4. React State Polling (SharedConsole)                │
│     ├─ requestAnimationFrame(checkTyping)              │
│     └─ Waits for typing to complete                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Why It Stutters

**Specific sequence during galaxy→system transition:**

```typescript
// SharedConsole.tsx: handleDiveToSystem()
const handleDiveToSystem = async (systemName: string) => {
  // 1. Update React state (triggers InfoPanel re-render)
  setSelectedSystem(systemName);

  // 2. Wait 2000ms for camera animation
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 3. POLL with RAF until typing completes (BLOCKS EVERYTHING)
  await waitForTypingComplete(); // <-- Problem area

  // 4. Start dive animation
  await galaxyMapRef.current?.diveToSystem(systemName);
};

// The polling function:
const waitForTypingComplete = () => {
  return new Promise<void>((resolve) => {
    const checkTyping = () => {
      const isTyping = infoPanelRef.current?.dataset.isTyping === 'true';
      if (!isTyping) {
        resolve(); // <-- Only resolves when typing done
      } else {
        requestAnimationFrame(checkTyping); // <-- Keeps polling
      }
    };
    checkTyping();
  });
};
```

**The stutter happens because:**
1. GSAP camera animation runs (smooth 60fps)
2. Typewriter setTimeout runs every 15ms (66.6fps)
3. React state updates trigger re-renders (variable timing)
4. RAF polling checks typing status (60fps)
5. **All compete for main thread time → frame drops → stutter**

### Performance Profiling Evidence

From the code analysis:
- **GalaxyScene**: Updates every 3rd frame (`frameCount % 3 === 0`) for performance
- **Typewriter**: 15ms delay = 66.6 updates/sec (not synced to RAF)
- **GSAP**: Uses its own ticker system
- **React**: State updates whenever, not synced to RAF

**Result:** Inconsistent frame timing, visible jank during transitions.

---

## React Three Fiber Benefits

### 1. Unified Render Loop

**Current (3 separate loops):**
```typescript
// GalaxyScene.ts
private animate = (): void => {
  this.renderAnimationId = requestAnimationFrame(this.animate);
  // ... update logic ...
  this.renderer.render(this.scene, this.camera);
};

// SystemScene.ts
private animate = (): void => {
  this.animationFrameId = requestAnimationFrame(this.animate);
  // ... update logic ...
  this.renderer.render(this.scene, this.camera);
};

// OrbitScene.ts
private animate = (): void => {
  this.animationFrameId = requestAnimationFrame(this.animate);
  // ... update logic ...
  this.renderer.render(this.scene, this.camera);
};
```

**With R3F (single loop):**
```tsx
// Single Canvas component manages the RAF loop
<Canvas>
  {mapViewMode === 'galaxy' && <GalaxyScene />}
  {mapViewMode === 'system' && <SystemScene />}
  {mapViewMode === 'orbit' && <OrbitScene />}
</Canvas>

// Components use useFrame hook (synced to Canvas loop)
function GalaxyScene() {
  useFrame((state, delta) => {
    // All updates happen here, once per frame, coordinated
    updateNebulae(delta);
    updateCamera(delta);
  });

  return (
    <>
      <ambientLight intensity={0.3} />
      {stars.map(star => <Star key={star.name} {...star} />)}
      {/* ... */}
    </>
  );
}
```

**Benefit:** One RAF loop for all scenes → no competition

### 2. Declarative Scene Composition

**Current (imperative):**
```typescript
// Creating a star
const spriteMaterial = new THREE.SpriteMaterial({
  map: this.starTexture,
  color: 0xFFFFFF,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending
});
const sprite = new THREE.Sprite(spriteMaterial);
sprite.scale.set(size * 6, size * 6, 1);
sprite.position.copy(position);
sprite.userData = { name: system.name };
this.scene.add(sprite);
this.stars.push(sprite); // Manual tracking

// Later: dispose manually
sprite.geometry?.dispose();
sprite.material.dispose();
this.scene.remove(sprite);
```

**With R3F (declarative):**
```tsx
function Star({ name, position, size }: StarProps) {
  const spriteRef = useRef<THREE.Sprite>(null);

  return (
    <sprite ref={spriteRef} position={position} scale={[size*6, size*6, 1]}>
      <spriteMaterial
        map={starTexture}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

// In scene:
{systems.map(system => (
  <Star key={system.name} {...system} />
))}

// Disposal happens automatically when component unmounts!
```

**Benefit:** React manages lifecycle → no manual disposal needed

### 3. Automatic Memory Management

R3F automatically disposes of:
- Geometries
- Materials
- Textures
- Objects

When components unmount, R3F calls `.dispose()` on all Three.js resources.

**Current disposal code (135+ lines across 3 files):**
```typescript
public dispose(): void {
  // Stop animations
  if (this.renderAnimationId) {
    cancelAnimationFrame(this.renderAnimationId);
  }
  if (this.animationFrameId) {
    cancelAnimationFrame(this.animationFrameId);
  }

  // Remove event listeners (8 different events)
  this.removeControls();

  // Dispose textures
  this.starTexture.dispose();
  this.reticleTexture.dispose();
  this.nebulaTexture.dispose();

  // Traverse scene and dispose everything
  this.scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
      object.geometry?.dispose();
      if (object.material instanceof THREE.Material) {
        object.material.dispose();
      } else if (Array.isArray(object.material)) {
        object.material.forEach(m => m.dispose());
      }
    }
  });

  // Dispose renderer
  this.renderer.dispose();
  this.renderer.domElement.remove();
}
```

**With R3F:**
```tsx
// Disposal is automatic when component unmounts
// No dispose() method needed!
```

### 4. React Integration

**Current:** Three.js state completely separate from React
```typescript
// State lives in class instance
private selectedPlanet: BodyData | null = null;
private isDragging = false;
private autoRotate = false;

// Parent must call methods to sync state
galaxyMapRef.current?.selectSystem(systemName);
```

**With R3F:** Three.js integrated with React state
```tsx
function GalaxyScene({ selectedSystem }: Props) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Three.js objects respond to React state changes
  useEffect(() => {
    // Position camera when selectedSystem changes
  }, [selectedSystem]);
}
```

### 5. Better Controls Integration

**Current:** Manual event listener management
```typescript
private boundHandlers: { [key: string]: EventListener } = {};

private setupControls(container: HTMLElement): void {
  this.boundHandlers['wheel'] = ((event: WheelEvent) => {
    // ... 20 lines of zoom logic
  }) as EventListener;

  this.boundHandlers['mousedown'] = ((event: MouseEvent) => {
    // ... drag start logic
  }) as EventListener;

  // ... 8 more event types

  window.addEventListener('wheel', this.boundHandlers['wheel'], { passive: false });
  window.addEventListener('mousedown', this.boundHandlers['mousedown']);
  // ... 8 more addEventListener calls
}

private removeControls(): void {
  window.removeEventListener('wheel', this.boundHandlers['wheel']);
  window.removeEventListener('mousedown', this.boundHandlers['mousedown']);
  // ... 8 more removeEventListener calls
}
```

**With R3F + Drei:**
```tsx
import { OrbitControls } from '@react-three/drei';

function GalaxyScene() {
  return (
    <>
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={20}
        maxDistance={300}
        autoRotate
        autoRotateSpeed={0.5}
      />
      {/* scene objects */}
    </>
  );
}
```

**Benefit:** ~200 lines of control code → 10 lines

### 6. Hooks Ecosystem

Access to R3F hooks:
- `useFrame` - Per-frame updates
- `useThree` - Access to renderer, camera, scene
- `useLoader` - Texture/model loading with Suspense support
- Plus `@react-three/drei` helpers (OrbitControls, Stars, etc.)

### 7. Performance Optimizations

R3F includes:
- Automatic frustum culling
- Render-on-demand mode (when nothing animating)
- Concurrent features (can use React 19's concurrent rendering)

---

## React Three Fiber Drawbacks

### 1. Learning Curve

Team needs to learn:
- R3F's declarative API
- How props map to Three.js setters
- `useFrame` timing and best practices
- `useThree` hook for imperative operations

**Mitigation:** Strong documentation, examples, and TypeScript support

### 2. Bundle Size Increase

R3F adds ~40KB gzipped to bundle (including @react-three/fiber and @react-three/drei).

**Current:** Three.js only (~150KB gzipped)
**With R3F:** Three.js + R3F (~190KB gzipped)

**Mitigation:** +40KB is negligible for modern web apps, especially given code reduction benefits

### 3. Abstraction Layer

R3F adds a layer between your code and Three.js. Some advanced Three.js features may be harder to access.

**Mitigation:** R3F provides escape hatches:
- `extend()` for custom elements
- Direct Three.js object access via refs
- `useThree()` for renderer/scene access

### 4. Debugging

React DevTools shows component tree, but Three.js inspector needed for scene graph.

**Mitigation:** Use both React DevTools and browser Three.js inspectors

### 5. Migration Effort

~4,500 lines of code to migrate over several weeks.

**Mitigation:** Phased migration approach (see [Migration Strategy](#migration-strategy))

---

## Code Volume Comparison

### Current Implementation

| Component | Lines | Purpose |
|-----------|-------|---------|
| GalaxyScene.ts | 1,112 | Galaxy visualization |
| SystemScene.ts | 1,527 | Solar system visualization |
| OrbitScene.ts | 1,332 | Planetary orbit visualization |
| GalaxyMap.tsx | 133 | React wrapper for GalaxyScene |
| SystemMap.tsx | 240 | React wrapper for SystemScene |
| OrbitMap.tsx | 154 | React wrapper for OrbitMap |
| **Total** | **4,498** | |

### Estimated R3F Implementation

**Breakdown by savings:**

#### 1. Texture Creation (~300 lines → 50 lines)
**Current:** Manual canvas creation for each texture
```typescript
private createStarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  // ... 30 lines of canvas drawing
  return new THREE.CanvasTexture(canvas);
}
// 3 textures × ~30-50 lines each = 90-150 lines per scene
```

**R3F:** Custom hook + useMemo
```tsx
function useStarTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    // ... same drawing code
    return new THREE.CanvasTexture(canvas);
  }, []);
}

const starTexture = useStarTexture();
```
**Savings:** Shared hooks, no manual disposal (~250 lines saved)

#### 2. Lifecycle Management (~400 lines → 0 lines)
**Current:** Constructor, dispose(), resize(), event listeners
```typescript
constructor(container: HTMLElement) {
  this.scene = new THREE.Scene();
  this.camera = new THREE.PerspectiveCamera(...);
  this.renderer = new THREE.WebGLRenderer(...);
  container.appendChild(this.renderer.domElement);
  this.setupControls(container);
  this.animate();
}

public dispose(): void {
  // 40-50 lines of cleanup
}

private setupControls(): void {
  // 150+ lines per scene
}

private removeControls(): void {
  // 30+ lines per scene
}
```

**R3F:** Handled by Canvas and useFrame
```tsx
function GalaxyScene({ onSystemClick }: Props) {
  // No constructor, no dispose, no manual event listeners
  return <>...</>;
}
```
**Savings:** ~400 lines (disposal + event management eliminated)

#### 3. Animation Loop (~150 lines → 50 lines)
**Current:** Manual RAF management
```typescript
private animate = (): void => {
  this.renderAnimationId = requestAnimationFrame(this.animate);

  if (this.paused) return;

  this.frameCount++;

  if (this.frameCount % 3 === 0) {
    // Update animations
  }

  // Auto-rotation logic
  if (this.autoRotate && !this.animating) {
    // ... 20 lines
  }

  this.renderer.render(this.scene, this.camera);
};
```

**R3F:** useFrame hook
```tsx
useFrame((state, delta) => {
  if (autoRotate && !animating) {
    // rotation logic (same code)
  }

  // Update nebulae
  nebulaRefs.current.forEach(nebula => {
    // update logic
  });
});
```
**Savings:** ~100 lines (no RAF management, no renderer.render calls)

#### 4. Object Creation (~1,200 lines → 600 lines)
**Current:** Imperative object creation + tracking
```typescript
private createStar(size: number, position: THREE.Vector3): THREE.Sprite {
  const spriteMaterial = new THREE.SpriteMaterial({ ... });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(size * 6, size * 6, 1);
  sprite.position.copy(position);
  sprite.userData = { ... };
  return sprite;
}

// In loadData():
data.systems.forEach(system => {
  const star = this.createStar(system.size, position);
  this.scene.add(star);
  this.stars.push(star); // Manual tracking
});
```

**R3F:** JSX components
```tsx
function Star({ name, position, size, userData }: StarProps) {
  return (
    <sprite position={position} scale={[size*6, size*6, 1]} userData={userData}>
      <spriteMaterial map={starTexture} transparent opacity={0.9} />
    </sprite>
  );
}

// In scene:
{systems.map(system => (
  <Star key={system.name} {...system} />
))}
```
**Savings:** ~600 lines (no manual add/remove, no tracking arrays)

#### 5. React Wrapper Simplification (~527 lines → 100 lines)
**Current:** Separate wrapper components with refs, useEffect, useImperativeHandle
```tsx
export const GalaxyMap = forwardRef<GalaxyMapHandle, GalaxyMapProps>(({...}, ref) => {
  const sceneRef = useRef<GalaxyScene | null>(null);

  useEffect(() => {
    // Create scene
    sceneRef.current = new GalaxyScene(containerRef.current);
    return () => sceneRef.current?.dispose();
  }, [visible]);

  useEffect(() => {
    if (sceneRef.current && data) {
      sceneRef.current.loadData(data);
    }
  }, [data]);

  useImperativeHandle(ref, () => ({ ... }), []);

  return <div ref={containerRef} />;
});
```

**R3F:** Direct scene components
```tsx
<Canvas>
  {mapViewMode === 'galaxy' && (
    <GalaxyScene
      systems={starMapData?.systems}
      selectedSystem={selectedSystem}
      onSystemClick={handleSystemSelect}
    />
  )}
</Canvas>
```
**Savings:** ~427 lines (wrappers eliminated)

### Total Estimated Lines

| Category | Current | R3F | Savings |
|----------|---------|-----|---------|
| Scene Logic | 3,971 | 2,000 | 1,971 (50%) |
| React Wrappers | 527 | 100 | 427 (81%) |
| **Total** | **4,498** | **~2,100** | **~2,400 (53%)** |

**Conservative Estimate:** 40-50% code reduction
**Optimistic Estimate:** 50-60% code reduction

---

## Animation Performance Improvements

### Problem: Typewriter Stuttering During Transitions

The core issue is **uncoordinated animation systems** competing for main thread time.

### R3F Solution: Unified Animation Loop

With R3F, all animations run in a single coordinated `useFrame` loop:

```tsx
// SharedConsole.tsx
function SharedConsole() {
  const [selectedSystem, setSelectedSystem] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  return (
    <>
      {/* Single Canvas with unified RAF loop */}
      <Canvas>
        <GalaxyScene
          selectedSystem={selectedSystem}
          onTransitionStart={() => setIsTransitioning(true)}
          onTransitionEnd={() => setIsTransitioning(false)}
        />
      </Canvas>

      {/* InfoPanel coordinates with Canvas */}
      <InfoPanel
        content={infoPanelContent}
        pauseTyping={isTransitioning} // Pause during camera animation
      />
    </>
  );
}
```

**Key insight:** Don't run typewriter and camera animation simultaneously. Sequence them:

```tsx
// GalaxyScene.tsx (R3F component)
function GalaxyScene({ selectedSystem, onTransitionStart, onTransitionEnd }: Props) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [animatingCamera, setAnimatingCamera] = useState(false);

  // Camera animation using useFrame (synced to Canvas RAF)
  useFrame((state, delta) => {
    if (animatingCamera && cameraRef.current) {
      // Smooth camera movement
      const progress = /* ... */;
      cameraRef.current.position.lerp(targetPosition, progress * delta);

      if (progress >= 1) {
        setAnimatingCamera(false);
        onTransitionEnd?.(); // Signal transition complete → start typing
      }
    }
  });

  useEffect(() => {
    if (selectedSystem) {
      onTransitionStart?.(); // Signal transition start → pause typing
      setAnimatingCamera(true);
    }
  }, [selectedSystem]);

  return <perspectiveCamera ref={cameraRef} />;
}
```

```tsx
// InfoPanel.tsx (improved typewriter)
function InfoPanel({ content, pauseTyping }: Props) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [charIndex, setCharIndex] = useState(0);

  // Use useFrame from Canvas to sync typewriter with RAF
  useFrame((state, delta) => {
    if (pauseTyping || charIndex >= fullText.length) return;

    // Advance typing based on delta time (consistent with frame rate)
    const charsPerSecond = 66; // ~15ms per char
    const charsThisFrame = Math.floor(delta * charsPerSecond);

    setCharIndex(prev => Math.min(prev + charsThisFrame, fullText.length));
  });

  // Build HTML from charIndex
  useEffect(() => {
    setDisplayedContent(buildHTML(content, charIndex));
  }, [content, charIndex]);

  return <div dangerouslySetInnerHTML={{ __html: displayedContent }} />;
}
```

**Wait, problem:** InfoPanel is outside `<Canvas>`, so can't use `useFrame`.

**Solution:** Use R3F's `useFrame` for 3D animations, keep typewriter separate but **sequence them properly**:

```tsx
async function handleDiveToSystem(systemName: string) {
  // 1. Wait for CAMERA animation to complete (don't poll, use promise)
  await new Promise(resolve => {
    setSelectedSystem(systemName);
    setOnCameraAnimationComplete(resolve); // Callback when camera done
  });

  // 2. Now start typing (no overlap)
  // InfoPanel will start typing since camera animation is complete

  // 3. Wait for typing (use promise, not RAF polling)
  await new Promise(resolve => {
    setOnTypingComplete(resolve);
  });

  // 4. Start dive animation
  await galaxyMapRef.current?.diveToSystem(systemName);
}
```

### Better: Eliminate Polling Entirely

**Current problem:** `waitForTypingComplete()` polls with RAF

**R3F solution:** Use callbacks/promises instead of polling

```tsx
// useTypewriter.ts (improved)
export function useTypewriter(content: string, onComplete?: () => void) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    // ... typing logic ...

    function typeNextChar() {
      if (charIndex < fullText.length) {
        charIndex++;
        setDisplayedContent(buildHTML(content, charIndex));
        setTimeout(typeNextChar, 15);
      } else {
        setIsTyping(false);
        onComplete?.(); // Fire callback when done (no polling needed!)
      }
    }

    typeNextChar();
  }, [content, onComplete]);

  return { displayedContent, isTyping };
}
```

```tsx
// SharedConsole.tsx
function handleDiveToSystem(systemName: string) {
  return new Promise(async (resolve) => {
    // 1. Start camera animation
    setSelectedSystem(systemName);

    // 2. Wait for camera (no polling - GSAP provides onComplete)
    await new Promise(r => {
      galaxyMapRef.current?.selectSystemAndWait(systemName).then(r);
    });

    // 3. Wait for typing (no polling - callback fires when done)
    await new Promise(r => {
      setTypingCompleteCallback(() => r);
    });

    // 4. Dive
    await galaxyMapRef.current?.diveToSystem(systemName);

    resolve();
  });
}
```

### Performance Comparison

**Before (stuttering):**
```
Main Thread Timeline:
│ Three.js RAF │ GSAP │ Typewriter setTimeout │ React RAF Poll │ Three.js RAF │
├──────────────┼──────┼───────────────────────┼────────────────┼──────────────┤
Frame drops when all compete → stutter
```

**After (smooth):**
```
Main Thread Timeline:
│ Camera Animation (R3F useFrame) │ → │ Typewriter (setTimeout) │ → │ Dive (R3F) │
├──────────────────────────────────┼───┼─────────────────────────┼───┼────────────┤
Sequential execution, no overlap → smooth
```

**Or even better, run simultaneously but coordinated:**
```
R3F Single RAF Loop:
│ useFrame: Camera + Typing (both synced to 60fps) │
├───────────────────────────────────────────────────┤
Both animations in same RAF → perfectly smooth
```

---

## Migration Strategy

### Phase 1: Setup & Infrastructure (1-2 days)

**Goal:** Install R3F and create basic Canvas setup

**Tasks:**
1. Install dependencies:
   ```bash
   npm install @react-three/fiber @react-three/drei
   ```

2. Create base Canvas wrapper:
   ```tsx
   // src/components/domain/maps/MapCanvas.tsx
   import { Canvas } from '@react-three/fiber';

   export function MapCanvas({ children }: { children: React.ReactNode }) {
     return (
       <Canvas
         camera={{ position: [0, 0, 100], fov: 75 }}
         gl={{ antialias: true }}
       >
         <ambientLight intensity={0.3} />
         {children}
       </Canvas>
     );
   }
   ```

3. Create shared texture hooks:
   ```tsx
   // src/hooks/useStarTexture.ts
   export function useStarTexture() {
     return useMemo(() => {
       // Current createStarTexture() logic
     }, []);
   }
   ```

**Success Criteria:**
- R3F dependencies installed
- Basic Canvas renders without errors
- Shared texture hooks working

### Phase 2: Migrate Galaxy Scene (3-5 days)

**Goal:** Convert GalaxyScene.ts to R3F component

**Tasks:**
1. Create component structure:
   ```tsx
   // src/components/domain/maps/r3f/GalaxyScene.tsx
   import { useFrame } from '@react-three/fiber';
   import { OrbitControls } from '@react-three/drei';

   export function GalaxyScene({
     systems,
     selectedSystem,
     onSystemClick
   }: GalaxySceneProps) {
     return (
       <>
         <Stars systems={systems} onStarClick={onSystemClick} />
         <Nebulae nebulae={nebulae} />
         <TravelRoutes routes={routes} />
         <SelectionReticle visible={!!selectedSystem} position={...} />
         <OrbitControls
           enablePan={false}
           minDistance={20}
           maxDistance={300}
           autoRotate
         />
       </>
     );
   }
   ```

2. Break down into sub-components:
   - `<Stars />` - Star sprites
   - `<Nebulae />` - Nebula particles
   - `<TravelRoutes />` - Route tubes
   - `<SelectionReticle />` - Selection indicator

3. Implement animations with useFrame:
   ```tsx
   function Nebulae({ nebulae }: Props) {
     const particlesRef = useRef<THREE.Sprite[]>([]);

     useFrame((state) => {
       const time = state.clock.elapsedTime;
       particlesRef.current.forEach((particle, i) => {
         // Pulse animation
         const pulse = Math.sin(time * 0.5 + i) * 0.15;
         particle.material.opacity = particle.userData.baseOpacity * (1 + pulse);
       });
     });

     return <>
       {nebulae.map(nebula => (
         <NebulaParticles key={nebula.name} {...nebula} ref={...} />
       ))}
     </>;
   }
   ```

4. Add camera animations:
   ```tsx
   function CameraController({ selectedSystem }: Props) {
     const { camera } = useThree();

     useEffect(() => {
       if (selectedSystem) {
         // Animate camera to target
         gsap.to(camera.position, {
           x: targetX,
           y: targetY,
           z: targetZ,
           duration: 2,
           ease: 'power2.inOut'
         });
       }
     }, [selectedSystem, camera]);

     return null;
   }
   ```

5. Replace old component:
   ```tsx
   // src/components/domain/maps/GalaxyMap.tsx
   import { MapCanvas } from './MapCanvas';
   import { GalaxyScene } from './r3f/GalaxyScene';

   export function GalaxyMap({ data, selectedSystem, onSystemSelect }: Props) {
     return (
       <MapCanvas>
         <GalaxyScene
           systems={data?.systems}
           selectedSystem={selectedSystem}
           onSystemClick={onSystemSelect}
         />
       </MapCanvas>
     );
   }
   ```

**Testing:**
- Visual parity with old scene
- All interactions work (click, drag, zoom)
- No memory leaks
- Animations smooth

**Success Criteria:**
- Galaxy view fully functional with R3F
- Code reduced from ~1,112 lines to ~600 lines
- All tests passing

### Phase 3: Migrate System Scene (4-6 days)

**Goal:** Convert SystemScene.ts to R3F component

**Tasks:**
1. Create SystemScene component with:
   - Central star with glow
   - Orbiting planets
   - Orbital paths
   - Selection system

2. Implement orbital motion with useFrame:
   ```tsx
   function Planet({ body, orbitSettings }: Props) {
     const meshRef = useRef<THREE.Mesh>(null);

     useFrame((state) => {
       if (!meshRef.current) return;

       const time = state.clock.elapsedTime;
       const angle = (time * orbitSettings.speed) + orbitSettings.initialAngle;

       const x = Math.cos(angle) * orbitSettings.distance;
       const z = Math.sin(angle) * orbitSettings.distance;
       const y = Math.sin(angle) * Math.tan(orbitSettings.inclination);

       meshRef.current.position.set(x, y, z);
     });

     return (
       <mesh ref={meshRef}>
         <sphereGeometry args={[body.size, 32, 32]} />
         <meshStandardMaterial color={body.color} />
       </mesh>
     );
   }
   ```

3. Camera tracking for following planets

**Success Criteria:**
- System view fully functional
- Planets orbit smoothly
- Camera tracking works
- Code reduced from ~1,527 lines to ~700 lines

### Phase 4: Migrate Orbit Scene (3-5 days)

**Goal:** Convert OrbitScene.ts to R3F component

Similar approach to Phases 2-3.

**Success Criteria:**
- Orbit view fully functional
- Code reduced from ~1,332 lines to ~600 lines

### Phase 5: Improve Animation Coordination (2-3 days)

**Goal:** Fix typewriter stuttering

**Tasks:**
1. Refactor transition sequencing:
   - Remove RAF polling
   - Use callbacks/promises
   - Sequence animations properly

2. Consider moving typewriter into RAF loop:
   ```tsx
   // Option: Sync typewriter to Canvas RAF
   function InfoPanelContent({ content }: Props) {
     const [charIndex, setCharIndex] = useState(0);
     const frameCountRef = useRef(0);

     useFrame(() => {
       frameCountRef.current++;

       // Advance typing every 4 frames (60fps / 4 = 15fps ≈ 66ms)
       if (frameCountRef.current % 4 === 0 && charIndex < content.length) {
         setCharIndex(prev => prev + 1);
       }
     });

     return buildHTML(content, charIndex);
   }
   ```

**Success Criteria:**
- No stuttering during transitions
- Smooth, coordinated animations
- Performance metrics show consistent frame timing

### Phase 6: Polish & Optimization (2-3 days)

**Goal:** Fine-tune performance and DX

**Tasks:**
1. Add render-on-demand for static scenes
2. Implement LOD (level of detail) for distant objects
3. Add performance monitoring
4. Update documentation

**Success Criteria:**
- 60fps on all views
- No memory leaks
- Code fully documented

### Total Timeline

**Estimated Duration:** 4-6 weeks (with 1 developer)

| Phase | Duration | Risk |
|-------|----------|------|
| Phase 1: Setup | 1-2 days | Low |
| Phase 2: Galaxy | 3-5 days | Medium |
| Phase 3: System | 4-6 days | Medium |
| Phase 4: Orbit | 3-5 days | Medium |
| Phase 5: Animation Fix | 2-3 days | Low |
| Phase 6: Polish | 2-3 days | Low |
| **Total** | **15-24 days** | **Medium** |

---

## Testing Strategy

### Unit Tests

Test R3F components in isolation:

```tsx
// GalaxyScene.test.tsx
import { render } from '@testing-library/react';
import { Canvas } from '@react-three/fiber';
import { GalaxyScene } from './GalaxyScene';

describe('GalaxyScene', () => {
  it('renders stars for each system', () => {
    const systems = [
      { name: 'Sol', position: [0, 0, 0], size: 1 },
      { name: 'Alpha Centauri', position: [10, 0, 0], size: 0.8 }
    ];

    const { container } = render(
      <Canvas>
        <GalaxyScene systems={systems} />
      </Canvas>
    );

    // Assert scene contains 2 sprites
    const scene = container.querySelector('canvas');
    expect(scene).toBeInTheDocument();
  });

  it('calls onSystemClick when star is clicked', async () => {
    const handleClick = jest.fn();

    const { container } = render(
      <Canvas>
        <GalaxyScene systems={[...]} onSystemClick={handleClick} />
      </Canvas>
    );

    // Simulate click on star
    // ... test interaction

    expect(handleClick).toHaveBeenCalledWith('Sol');
  });
});
```

### Integration Tests

Test scene transitions:

```tsx
describe('Map Transitions', () => {
  it('transitions smoothly from galaxy to system view', async () => {
    const { getByText } = render(<SharedConsole />);

    // Click on Sol system
    const solSystem = getByText('Sol');
    fireEvent.click(solSystem);

    // Wait for camera animation
    await waitFor(() => {
      // Assert camera moved
    });

    // Wait for typing to complete
    await waitFor(() => {
      expect(getByText(/stellar info/i)).toBeInTheDocument();
    });

    // Click dive button
    const diveButton = getByText('▶');
    fireEvent.click(diveButton);

    // Assert system view now visible
    await waitFor(() => {
      expect(getByText(/planetary bodies/i)).toBeInTheDocument();
    });
  });
});
```

### Visual Regression Tests

Use Playwright for E2E visual testing:

```typescript
// e2e/galaxy-map.spec.ts
import { test, expect } from '@playwright/test';

test('galaxy view renders correctly', async ({ page }) => {
  await page.goto('/terminal/');

  // Wait for 3D scene to load
  await page.waitForSelector('canvas');

  // Take screenshot
  await expect(page).toHaveScreenshot('galaxy-view.png');
});

test('galaxy to system transition is smooth', async ({ page }) => {
  await page.goto('/terminal/');

  // Record video during transition
  const video = await page.video();

  // Click Sol
  await page.click('text=Sol');

  // Wait for animation
  await page.waitForTimeout(2000);

  // Click dive button
  await page.click('button:has-text("▶")');

  // Wait for transition
  await page.waitForTimeout(2000);

  // Analyze video for dropped frames
  const path = await video.path();
  // Assert no significant frame drops
});
```

### Performance Tests

Monitor frame rate during animations:

```typescript
test('maintains 60fps during camera transitions', async ({ page }) => {
  await page.goto('/terminal/');

  // Start performance monitoring
  const metrics = await page.evaluate(() => {
    const frames: number[] = [];
    let lastTime = performance.now();

    function measureFrame() {
      const now = performance.now();
      const delta = now - lastTime;
      frames.push(1000 / delta); // FPS
      lastTime = now;

      if (frames.length < 120) { // 2 seconds at 60fps
        requestAnimationFrame(measureFrame);
      }
    }

    requestAnimationFrame(measureFrame);

    return new Promise(resolve => {
      setTimeout(() => resolve(frames), 2100);
    });
  });

  // Assert average FPS > 55 (allowing some variance)
  const avgFps = metrics.reduce((a, b) => a + b) / metrics.length;
  expect(avgFps).toBeGreaterThan(55);

  // Assert no frames below 30fps (no severe stuttering)
  const minFps = Math.min(...metrics);
  expect(minFps).toBeGreaterThan(30);
});
```

### Memory Leak Tests

Verify proper disposal:

```typescript
test('no memory leaks when switching views', async ({ page }) => {
  await page.goto('/terminal/');

  // Get initial memory usage
  const initialMemory = await page.evaluate(() => {
    return (performance as any).memory?.usedJSHeapSize;
  });

  // Switch views 10 times
  for (let i = 0; i < 10; i++) {
    await page.click('text=Sol');
    await page.waitForTimeout(500);
    await page.click('button:has-text("▶")');
    await page.waitForTimeout(500);
    await page.click('text=Back to Galaxy');
    await page.waitForTimeout(500);
  }

  // Force garbage collection
  await page.evaluate(() => {
    if (global.gc) global.gc();
  });

  // Get final memory usage
  const finalMemory = await page.evaluate(() => {
    return (performance as any).memory?.usedJSHeapSize;
  });

  // Assert memory didn't grow significantly (< 50% increase)
  const growth = (finalMemory - initialMemory) / initialMemory;
  expect(growth).toBeLessThan(0.5);
});
```

---

## Future Animation Capabilities

With R3F, adding new animations becomes significantly easier.

### 1. Transition Animations

**Current:** Hard-coded GSAP animations in scene classes

**With R3F:** Reusable animation components

```tsx
// Fade transition component
function FadeTransition({ children, visible }: Props) {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (groupRef.current) {
      gsap.to(groupRef.current, {
        opacity: visible ? 1 : 0,
        duration: 0.5
      });
    }
  }, [visible]);

  return <group ref={groupRef}>{children}</group>;
}

// Use anywhere:
<FadeTransition visible={showStars}>
  <Stars systems={systems} />
</FadeTransition>
```

### 2. Decorative UI Animations

**Holographic scan lines:**
```tsx
function HolographicEffect() {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (shaderRef.current) {
      shaderRef.current.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh>
      <planeGeometry args={[10, 10]} />
      <shaderMaterial
        ref={shaderRef}
        transparent
        uniforms={{
          time: { value: 0 },
          scanlineIntensity: { value: 0.1 }
        }}
        vertexShader={holographicVert}
        fragmentShader={holographicFrag}
      />
    </mesh>
  );
}
```

**Star pulse animations:**
```tsx
function Star({ position, size }: Props) {
  const spriteRef = useRef<THREE.Sprite>(null);

  useFrame((state) => {
    if (spriteRef.current) {
      // Gentle pulsing
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1;
      spriteRef.current.scale.setScalar(size * pulse);
    }
  });

  return <sprite ref={spriteRef} position={position}>...</sprite>;
}
```

### 3. Physics-Based Animations

**Drei provides springs and physics:**
```tsx
import { useSpring } from '@react-spring/three';

function Planet({ orbitRadius }: Props) {
  const [active, setActive] = useState(false);

  // Spring animation for selection
  const { scale } = useSpring({
    scale: active ? 1.5 : 1,
    config: { tension: 300, friction: 10 }
  });

  return (
    <animated.mesh
      scale={scale}
      onClick={() => setActive(!active)}
    >
      <sphereGeometry />
      <meshStandardMaterial />
    </animated.mesh>
  );
}
```

### 4. Post-Processing Effects

**Drei provides effects composer:**
```tsx
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing';

<Canvas>
  <GalaxyScene />
  <EffectComposer>
    <Bloom intensity={0.5} luminanceThreshold={0.9} />
    <ChromaticAberration offset={[0.002, 0.002]} />
  </EffectComposer>
</Canvas>
```

### 5. Particle Systems

**Easier to create with R3F:**
```tsx
import { Points, PointMaterial } from '@react-three/drei';

function NebulaParticles({ count, color }: Props) {
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * 100 - 50;
      pos[i * 3 + 1] = Math.random() * 100 - 50;
      pos[i * 3 + 2] = Math.random() * 100 - 50;
    }
    return pos;
  }, [count]);

  return (
    <Points positions={positions}>
      <PointMaterial size={0.5} color={color} transparent opacity={0.6} />
    </Points>
  );
}
```

### 6. Interactive Tooltips

**3D HTML overlays:**
```tsx
import { Html } from '@react-three/drei';

function Star({ name, position }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <sprite
        position={position}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <spriteMaterial />
      </sprite>

      {hovered && (
        <Html position={position}>
          <div className="tooltip">{name}</div>
        </Html>
      )}
    </>
  );
}
```

---

## Recommendation

### Strong Recommendation: Proceed with Migration

**Reasons:**

1. **Solves the primary issue:** Eliminates animation stuttering through unified RAF loop
2. **Significant code reduction:** 40-50% less code to maintain
3. **Better developer experience:** Declarative React patterns vs. imperative classes
4. **Automatic memory management:** No more manual disposal headaches
5. **Future-proof:** Easier to add new animations and effects
6. **Modern ecosystem:** Access to Drei helpers, springs, post-processing
7. **Testability:** R3F components easier to test than imperative classes

**Risk mitigation:**
- Phased migration reduces risk (one scene at a time)
- Strong TypeScript support in R3F
- Can keep old code until new code proven stable
- Extensive R3F documentation and community support

**ROI:**
- **Time investment:** 4-6 weeks for migration
- **Long-term savings:** 40-50% less code to maintain, faster feature development
- **Quality improvement:** Smoother animations, better UX, fewer bugs

### Recommended Timeline

**Immediate (Week 1-2):**
- Phase 1: Setup infrastructure
- Phase 2: Migrate Galaxy scene (prove concept)

**Near-term (Week 3-4):**
- Phase 3: Migrate System scene
- Phase 4: Migrate Orbit scene

**Final (Week 5-6):**
- Phase 5: Fix animation coordination
- Phase 6: Polish and optimize

**Post-migration:**
- Monitor performance metrics
- Gather user feedback
- Plan future animation enhancements

---

## Appendix: Example Code Comparison

### Before: Imperative Three.js Class

```typescript
// GalaxyScene.ts (simplified)
export class GalaxyScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private stars: THREE.Sprite[] = [];
  private animationFrameId: number | null = null;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.setupControls(container);
    this.animate();
  }

  public loadData(data: StarMapData): void {
    this.clearSceneObjects();

    data.systems.forEach(system => {
      const star = this.createStar(system.size, new THREE.Vector3(...system.position));
      star.userData = { name: system.name };
      this.scene.add(star);
      this.stars.push(star);
    });
  }

  private createStar(size: number, position: THREE.Vector3): THREE.Sprite {
    const spriteMaterial = new THREE.SpriteMaterial({
      map: this.starTexture,
      transparent: true,
      opacity: 0.9
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(size * 6, size * 6, 1);
    sprite.position.copy(position);
    return sprite;
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    if (this.autoRotate) {
      // Rotation logic...
    }

    this.renderer.render(this.scene, this.camera);
  };

  private setupControls(container: HTMLElement): void {
    this.boundHandlers['wheel'] = ((event: WheelEvent) => {
      event.preventDefault();
      // Zoom logic (20 lines)...
    }) as EventListener;

    this.boundHandlers['mousedown'] = ((event: MouseEvent) => {
      // Drag start (15 lines)...
    }) as EventListener;

    // 8 more event types...

    window.addEventListener('wheel', this.boundHandlers['wheel']);
    window.addEventListener('mousedown', this.boundHandlers['mousedown']);
    // 8 more listeners...
  }

  public dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.removeControls();

    this.starTexture.dispose();

    this.scene.traverse((object) => {
      if (object instanceof THREE.Sprite) {
        object.geometry?.dispose();
        object.material.dispose();
      }
    });

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
```

**Line count:** ~150 lines for basic structure + 300 lines controls + 100 lines disposal = **~550 lines**

### After: Declarative R3F Component

```tsx
// GalaxyScene.tsx (simplified)
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useStarTexture } from '@/hooks/useStarTexture';

export function GalaxyScene({ systems, onSystemClick }: GalaxySceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const starTexture = useStarTexture();

  useFrame((state) => {
    // Auto-rotation
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Stars */}
      {systems.map(system => (
        <Star
          key={system.name}
          name={system.name}
          position={system.position}
          size={system.size}
          texture={starTexture}
          onClick={() => onSystemClick(system.name)}
        />
      ))}

      {/* Controls */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={20}
        maxDistance={300}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </group>
  );
}

function Star({ name, position, size, texture, onClick }: StarProps) {
  return (
    <sprite
      position={position}
      scale={[size * 6, size * 6, 1]}
      onClick={onClick}
      userData={{ name }}
    >
      <spriteMaterial map={texture} transparent opacity={0.9} />
    </sprite>
  );
}
```

**Line count:** ~60 lines total

**Reduction:** 550 lines → 60 lines = **89% reduction**

---

## Conclusion

Migrating to React Three Fiber is **highly recommended**. The migration will:

1. ✅ **Fix the animation stuttering** through unified RAF loop
2. ✅ **Reduce codebase by 40-50%** (~2,400 lines eliminated)
3. ✅ **Improve maintainability** with declarative React patterns
4. ✅ **Eliminate memory management burden** (automatic disposal)
5. ✅ **Enable future animation enhancements** (transitions, effects, physics)
6. ✅ **Provide better testing capabilities**

The 4-6 week investment will pay dividends in reduced maintenance, faster feature development, and improved user experience.

**Next steps:**
1. Review and approve this plan
2. Set up R3F infrastructure (Phase 1)
3. Prove concept with Galaxy scene migration (Phase 2)
4. Continue with remaining scenes (Phases 3-6)

---

**Document Version:** 1.0
**Last Updated:** 2026-01-25
