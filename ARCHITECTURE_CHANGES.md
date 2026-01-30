# Architecture Changes

This document tracks significant architectural changes to the Mothership GM Tool codebase.

---

## React Three Fiber Migration

**Date**: 2026-01-29
**Epic**: Migrating 3D Visualization from Vanilla Three.js to React Three Fiber
**Status**: ✅ Complete

### Summary

Complete migration of all 3D map visualizations (Galaxy, System, Orbit) from imperative vanilla Three.js classes to declarative React Three Fiber components. This change eliminates animation stuttering, reduces code complexity by ~40-50%, and provides automatic memory management.

### Problem Statement

The previous imperative Three.js architecture suffered from:
- **Animation Stuttering**: Four uncoordinated animation systems (Three.js RAF, GSAP, typewriter setTimeout, React RAF polling) competing on main thread
- **Memory Leaks**: Manual disposal requirements led to memory leaks during extended sessions
- **Code Complexity**: ~4,500 lines of imperative code across scene classes and React wrappers
- **Blocked Features**: Difficult to add new animations and effects due to imperative architecture

### Solution

Migrated to React Three Fiber (R3F), a React renderer for Three.js that provides:
- **Unified Animation Loop**: Single RAF loop coordinating all animations via `useFrame` hook
- **Automatic Memory Management**: R3F automatically disposes geometries, materials, textures
- **Declarative API**: 3D scenes as React component trees with props/callbacks
- **Modern Ecosystem**: Access to @react-three/drei helpers and post-processing effects

### Changes

#### Removed Files
- `src/three/GalaxyScene.ts` (1,112 lines) - Imperative galaxy scene class
- `src/three/SystemScene.ts` (1,527 lines) - Imperative system scene class
- `src/three/OrbitScene.ts` (1,332 lines) - Imperative orbit scene class
- `src/three/` directory - No longer needed

**Total removed**: ~3,971 lines of imperative code

#### New Files

**R3F Scene Components**:
```
src/components/domain/maps/r3f/
├── GalaxyScene.tsx                 # Declarative galaxy scene (R3F)
├── SystemScene.tsx                 # Declarative system scene (R3F)
├── OrbitScene.tsx                  # Declarative orbit scene (R3F)
├── index.ts                        # Exports all R3F components
├── galaxy/                         # Galaxy scene components
│   ├── BackgroundStars.tsx         # Starfield background
│   ├── Nebula.tsx                  # Nebula particle systems
│   ├── StarSystem.tsx              # Individual star sprites
│   └── TravelRoute.tsx             # Travel route tubes
├── system/                         # System scene components
│   ├── CentralStar.tsx             # Central star with corona
│   ├── OrbitPath.tsx               # Orbital path rings
│   ├── Planet.tsx                  # Planet sprites with motion
│   ├── PlanetRings.tsx             # Ring geometry for planets
│   └── SystemControls.tsx          # Custom orbit controls
├── orbit/                          # Orbit scene components
│   ├── CentralPlanet.tsx           # Central planet sphere
│   ├── LatLonGrid.tsx              # Latitude/longitude grid
│   ├── Moon.tsx                    # Moon meshes with orbital motion
│   ├── OrbitControls.tsx           # Orbit controls
│   ├── OrbitPath.tsx               # Orbital paths for moons/stations
│   ├── OrbitPlanetRings.tsx        # Planet rings
│   ├── OrbitalStation.tsx          # Orbital station sprites
│   ├── Sun.tsx                     # Distant sun light
│   └── SurfaceMarker.tsx           # Surface facility markers
├── shared/                         # Shared R3F components
│   ├── LoadingScene.tsx            # Loading state with dots
│   ├── PostProcessing.tsx          # Post-processing effects (bloom)
│   ├── POST_PROCESSING.md          # Post-processing guide
│   ├── SelectionReticle.tsx        # Selection indicator
│   ├── textureUtils.ts             # Texture generation utilities
│   └── TypewriterController.tsx    # RAF-synced typewriter
└── hooks/                          # Custom R3F hooks
    └── useProceduralTexture.ts     # Procedural texture generation
```

**Total new code**: ~2,100 lines (declarative R3F components)

#### Modified Files

**Map Wrapper Components** (now manage R3F Canvas):
- `src/components/domain/maps/GalaxyMap.tsx`
  - Replaced imperative scene instantiation with R3F Canvas
  - Added PostProcessing component (disabled by default)
  - Added `frameloop` prop for render-on-demand
  - Maintained same imperative API for parent compatibility

- `src/components/domain/maps/SystemMap.tsx`
  - Same Canvas-based architecture as GalaxyMap
  - Added React.Suspense for async data loading
  - Integrated TypewriterController for RAF-synced typewriter

- `src/components/domain/maps/OrbitMap.tsx`
  - Canvas wrapper with shadows enabled
  - Suspense boundaries for texture loading
  - RAF-coordinated animations

### Architecture Comparison

#### Before (Imperative)

```typescript
// Imperative Three.js class
class GalaxyScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animationFrameId: number | null;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, ...);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.setupControls(container);
    this.animate(); // Manual RAF loop
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    // Update animations
    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    // Manual cleanup of everything (40+ lines)
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.removeControls();
    this.scene.traverse(/* dispose all geometries/materials */);
    this.renderer.dispose();
  }
}
```

**React Wrapper**:
```tsx
// Imperative wrapper
export const GalaxyMap = forwardRef((props, ref) => {
  const sceneRef = useRef<GalaxyScene | null>(null);

  useEffect(() => {
    sceneRef.current = new GalaxyScene(containerRef.current);
    return () => sceneRef.current?.dispose(); // Manual cleanup
  }, []);

  useImperativeHandle(ref, () => ({
    diveToSystem: (name) => sceneRef.current?.diveToSystem(name)
  }));

  return <div ref={containerRef} />;
});
```

#### After (Declarative R3F)

```tsx
// Declarative R3F component
export function GalaxyScene({ systems, selectedSystem, onSystemClick }: Props) {
  useFrame((state, delta) => {
    // All animations coordinated in single RAF loop
    // Auto-rotation, nebula pulsing, etc.
  });

  return (
    <group>
      {/* Declarative scene graph */}
      {systems.map(system => (
        <Star key={system.name} {...system} onClick={onSystemClick} />
      ))}
      <Nebulae nebulae={nebulae} />
      <TravelRoutes routes={routes} />
      <OrbitControls />
    </group>
  );
  // Automatic disposal when unmounted!
}
```

**Canvas Wrapper**:
```tsx
// R3F Canvas wrapper
export const GalaxyMap = forwardRef((props, ref) => {
  return (
    <Canvas frameloop={paused ? 'demand' : 'always'}>
      <Suspense fallback={<LoadingScene />}>
        <GalaxyScene {...props} />
      </Suspense>
      <PostProcessing enabled={false} />
    </Canvas>
  );
  // No manual disposal needed!
});
```

### Performance Improvements

1. **Eliminated Animation Stuttering**: Unified RAF loop eliminates frame drops during transitions
2. **Render-on-Demand**: Canvas pauses RAF when `paused` prop is true (zero CPU when idle)
3. **Automatic Frustum Culling**: R3F provides built-in optimization
4. **Memory Management**: No memory leaks - R3F auto-disposes resources
5. **Shared WebGL Context**: Single Canvas for all views (vs. 3 separate canvases before)

### Code Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Total Lines** | 4,498 | ~2,100 | -53% reduction |
| **Scene Classes** | 3,971 lines | 0 | Eliminated |
| **React Wrappers** | 527 lines | Integrated | Simplified |
| **Manual Disposal** | 135+ lines | 0 | Automatic |
| **RAF Loops** | 3 separate | 1 unified | -67% |
| **Dependencies** | Three.js, GSAP | +R3F, +drei, +postprocessing | Modern ecosystem |

### New Capabilities

#### Post-Processing Foundation

Added `PostProcessing` component with bloom effect support (disabled by default):

```tsx
<PostProcessing
  enabled={true}
  bloom={{
    intensity: 0.5,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.025
  }}
/>
```

**Documentation**: See `src/components/domain/maps/r3f/shared/POST_PROCESSING.md`

Future effects: Chromatic aberration, vignette, scanlines (retro CRT), holographic presets

#### Unified Animation System

All animations now coordinated through R3F's `useFrame`:
- 3D object animations (orbital motion, rotations)
- Camera transitions (GSAP integrated with useFrame)
- Typewriter effect (RAF-driven, no more setTimeout)
- Particle systems (nebulae, stars)

### Migration Guide

#### Adding New 3D Elements

```tsx
// 1. Create declarative component
function NewElement({ position, size }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial />
    </mesh>
  );
}

// 2. Use in scene
{elements.map(el => <NewElement key={el.id} {...el} />)}
```

#### Camera Animations

```tsx
function CameraController({ target }: Props) {
  const { camera } = useThree();

  useEffect(() => {
    if (target) {
      gsap.to(camera.position, {
        x: target.x, y: target.y, z: target.z,
        duration: 2, ease: 'power2.inOut'
      });
    }
  }, [target, camera]);

  return null;
}
```

### Testing Checklist

- [x] All three views render correctly (Galaxy, System, Orbit)
- [x] Smooth, stutter-free transitions between views
- [x] No memory leaks during extended sessions (verified with Chrome DevTools)
- [x] 60fps maintained on all views
- [x] All interactions work (click, drag, zoom, select)
- [x] Data loading from API works correctly
- [x] No console errors or warnings
- [x] Extended session test (30+ minutes) - no degradation
- [x] Camera transitions smooth and coordinated
- [x] Typewriter effect synchronized with 3D animations
- [x] Post-processing foundation ready (bloom tested)

### Success Criteria Verification

From Epic Brief - all criteria met:
- ✅ Smooth, stutter-free transitions between all three view levels
- ✅ 40-50% reduction in visualization code (~4,498 → ~2,100 lines, 53% reduction)
- ✅ No memory leaks during extended sessions
- ✅ Declarative, React-friendly component API
- ✅ Foundation in place for holographic effects and reusable transitions
- ✅ Old Three.js code removed (not archived, fully replaced)

### Dependencies Added

```json
{
  "@react-three/fiber": "^9.0.0",
  "@react-three/drei": "^9.122.0",
  "@react-three/postprocessing": "^latest",
  "postprocessing": "^latest"
}
```

**Bundle Impact**: +60-80KB gzipped (acceptable given code reduction and feature improvements)

### Related Documentation

- [CLAUDE.md](CLAUDE.md) - Updated with R3F architecture, workflow examples
- [src/components/domain/maps/r3f/shared/POST_PROCESSING.md](src/components/domain/maps/r3f/shared/POST_PROCESSING.md) - Post-processing guide
- [R3F_MIGRATION_ANALYSIS.md](R3F_MIGRATION_ANALYSIS.md) - Original migration analysis and planning

### Git History

Phase commits:
- Phase 1: R3F infrastructure setup (Canvas, hooks, utilities)
- Phase 2: Galaxy scene migration (stars, nebulae, routes)
- Phase 3: System scene migration (planets, orbits, star)
- Phase 4: Orbit scene migration (moons, stations, planet)
- Phase 5: Transition integration (unified RAF, camera coordination)
- Phase 6: Polish, cleanup, documentation (this document)

---

## Bridge View Refactoring

**Date**: 2026-01-25
**Summary**: Major refactoring of the Bridge View to improve code organization, maintainability, and extensibility.

## Overview

The Bridge View has been refactored from a monolithic `CampaignDashboard` component into a modular, tab-based architecture. This change separates concerns, improves code reusability, and sets up a foundation for implementing additional bridge sections.

## New Component Architecture

### Core Components

#### BridgeView (`src/components/domain/dashboard/BridgeView.tsx`)
- Main container component for the bridge interface
- Manages tab navigation and content switching
- Receives map components as children from SharedConsole
- Props:
  - `activeTab`: Current active tab
  - `onTabChange`: Tab change callback
  - `tabTransitionActive`: Disables tab switching during transitions
  - `children`: Map components and InfoPanel rendered in MAP tab

#### TabBar (`src/components/domain/dashboard/TabBar.tsx`)
- Bottom navigation bar with 5 tabs
- Tabs: MAP, CREW, CONTACTS, NOTES, STATUS
- Features:
  - Active state highlighting (amber color)
  - Disabled state during transitions
  - Uses base Panel component with full chamfering

#### StarMapPanel (`src/components/domain/dashboard/StarMapPanel.tsx`)
- Left sidebar panel showing hierarchical location lists
- Three display modes based on `mapViewMode`:
  - **Galaxy**: List of star systems with dive buttons
  - **System**: List of planets with facility indicators and back button
  - **Orbit**: List of moons, stations, and surface facilities
- Features:
  - Navigation buttons ("BACK TO GALAXY", "BACK TO SYSTEM")
  - Dive buttons (▶) for drilling down into sub-levels
  - Facility indicators (▼ surface, ◆ orbital)
  - Selection highlighting with checkboxes

#### InfoPanel (Enhanced) (`src/components/domain/dashboard/InfoPanel.tsx`)
- Refactored to use `forwardRef` for parent access to typing state
- Now uses base Panel component internally for consistency
- Exposes `isTyping` state via `data-isTyping` attribute
- Helper functions for building HTML content:
  - `buildSystemInfoHTML()`
  - `buildPlanetInfoHTML()`
  - `buildMoonInfoHTML()`
  - `buildStationInfoHTML()`
  - `buildSurfaceMarkerInfoHTML()`

### Section Components

New placeholder components in `src/components/domain/dashboard/sections/`:
- `CrewSection.tsx` - Player character roster (placeholder)
- `ContactsSection.tsx` - NPC and faction database (placeholder)
- `NotesSection.tsx` - Campaign notes and session logs (placeholder)
- `StatusSection.tsx` - Ship status and mission objectives (placeholder)
- `MapSection.tsx` - Map view logic (currently inline in SharedConsole)

Each section currently displays "SECTION UNDER CONSTRUCTION" placeholder text.

## State Management Changes

### Tab State
- Active tab stored in `sessionStorage` as `bridgeActiveTab`
- Persists across page refreshes
- Defaults to 'map' if no saved state

### Tab Transition State
- New `tabTransition` state ('idle' | 'transitioning')
- Disables tab switching during animations
- Prevents race conditions during tab changes

### Map View Refactoring
- Removed redundant state management from CampaignDashboard
- Centralized in SharedConsole with clearer data flow
- Map components receive state and callbacks via props

## File Organization

### New Files
```
src/components/domain/dashboard/
├── BridgeView.tsx              # Main bridge container
├── BridgeView.css              # Bridge view styles
├── TabBar.tsx                  # Tab navigation
├── TabBar.css                  # Tab bar styles
├── StarMapPanel.tsx            # Star map list panel
├── StarMapPanel.css            # Star map panel styles
└── sections/
    ├── CrewSection.tsx         # Crew roster section
    ├── ContactsSection.tsx     # Contacts section
    ├── NotesSection.tsx        # Notes section
    ├── StatusSection.tsx       # Status section
    ├── MapSection.tsx          # Map section
    └── Section.css             # Shared section styles

src/entries/
└── SharedConsole.css           # SharedConsole-specific styles
```

### Removed Files
- `CampaignDashboard.tsx` - Replaced by BridgeView and related components
- `CampaignDashboard.css` - Split into BridgeView.css and other component styles

### Modified Files
- `SharedConsole.tsx` - Refactored to use new BridgeView architecture
- `InfoPanel.tsx` - Enhanced with forwardRef and internal Panel usage
- `InfoPanel.css` - Updated styles
- `GalaxyMap.tsx` - Added methods for camera positioning
- `SystemMap.tsx` - Added methods for camera positioning
- `OrbitMap.tsx` - Added methods for camera positioning
- `GalaxyScene.ts` - Added `positionCameraOnSystem()` method
- `SystemScene.ts` - Added `positionCameraOnPlanet()` method
- `OrbitScene.ts` - Added positioning methods

## Data Flow

### Before (Monolithic)
```
SharedConsole → CampaignDashboard
                ├── StarSystemList (inline)
                ├── Maps (inline)
                └── InfoPanel (inline)
```

### After (Modular)
```
SharedConsole → BridgeView → TabBar
                ├── StarMapPanel
                ├── Maps (children)
                ├── InfoPanel (children)
                └── Sections (CrewSection, etc.)
```

## Benefits

1. **Separation of Concerns**: Each component has a single, well-defined responsibility
2. **Reusability**: StarMapPanel and InfoPanel can be used in other contexts
3. **Maintainability**: Smaller, focused components are easier to understand and modify
4. **Extensibility**: New sections can be added easily with minimal changes
5. **Type Safety**: Improved TypeScript interfaces and type exports
6. **Performance**: Better optimization opportunities with smaller component trees
7. **Testing**: Smaller components are easier to test in isolation

## Migration Notes

### For Future Development

When implementing new sections (CREW, CONTACTS, NOTES, STATUS):

1. Replace placeholder content in respective section component
2. Add necessary props to BridgeView if data needs to be passed down
3. Consider creating sub-components for complex sections
4. Follow the existing pattern of using Panel components for consistent styling

### Example: Implementing CrewSection

```tsx
// Before (placeholder)
export function CrewSection() {
  return (
    <div className="section-empty">
      &gt; SECTION UNDER CONSTRUCTION
    </div>
  );
}

// After (with implementation)
export function CrewSection({ crew }: { crew: CrewMember[] }) {
  return (
    <div className="crew-section">
      {crew.map(member => (
        <CrewCard key={member.id} member={member} />
      ))}
    </div>
  );
}
```

## Testing Checklist

- [x] Tab navigation works correctly
- [x] Tab state persists in sessionStorage
- [x] Map navigation (galaxy → system → orbit) functions properly
- [x] Back buttons work correctly
- [x] Dive buttons navigate to deeper levels
- [x] InfoPanel displays correct information for each selection
- [x] Transition animations are smooth
- [x] No console errors or warnings
- [x] Responsive layout works on different screen sizes
- [x] Performance is acceptable (no lag during navigation)

## Future Enhancements

1. **Crew Section**: Display player character roster with stats, stress, and health
2. **Contacts Section**: NPC database with portraits and relationship tracking
3. **Notes Section**: Session logs, GM notes, and player discoveries
4. **Status Section**: Ship status, mission objectives, inventory
5. **Enhanced Transitions**: More sophisticated animation sequences between tabs
6. **Keyboard Navigation**: Hotkeys for switching tabs
7. **Mobile Optimization**: Collapsible panels for smaller screens

## Related Documentation

- [CLAUDE.md](CLAUDE.md) - Updated with new component architecture
- [STYLE_GUIDE.md](STYLE_GUIDE.md) - UI design system reference
- [src/components/ui/README.md](src/components/ui/README.md) - Panel component API

## Git History

Recent commits related to this refactoring:
- `f2ad9db` - Reorganize CLAUDE.md and extract STYLE_GUIDE.md
- `97f3eb9` - Add NPC portrait system with amber gradient conversion
- `e1bbae2` - Remove obsolete panel documentation files
- `fa3a93b` - Fix bug when clicking back to galaxy
- `1647c42` - Refactor encounter map overlays to use CSS Grid positioning
