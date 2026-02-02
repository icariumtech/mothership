# Frontend Architecture

**Last Updated**: 2026-02-02T00:00:00Z

## React Application Structure

```
src/
├── entries/                    # Entry points (3 separate apps)
│   ├── SharedConsole.tsx       # Shared terminal display (players + GM)
│   ├── GMConsole.tsx           # GM control panel
│   ├── PlayerConsole.tsx       # Player message view
│   └── TestPanel.tsx           # Component testing
│
├── components/
│   ├── domain/                 # Domain-specific components
│   │   ├── dashboard/          # Bridge view and sections
│   │   │   ├── BridgeView.tsx              # Main tabbed dashboard container
│   │   │   ├── TabBar.tsx                  # Bottom navigation (5 tabs)
│   │   │   ├── StandbyView.tsx             # Idle animation
│   │   │   ├── StarMapPanel.tsx            # Left sidebar (location lists)
│   │   │   ├── InfoPanel.tsx               # Right sidebar (typewriter text)
│   │   │   └── sections/                   # Tab content sections
│   │   │       ├── MapSection.tsx          # (rendered inline in SharedConsole)
│   │   │       ├── CrewSection.tsx         # Crew roster (placeholder)
│   │   │       ├── ContactsSection.tsx     # Contact database (placeholder)
│   │   │       ├── NotesSection.tsx        # Campaign notes (placeholder)
│   │   │       └── StatusSection.tsx       # Mission status (placeholder)
│   │   │
│   │   ├── maps/               # 3D map visualization
│   │   │   ├── GalaxyMap.tsx               # Canvas wrapper for galaxy view
│   │   │   ├── SystemMap.tsx               # Canvas wrapper for system view
│   │   │   ├── OrbitMap.tsx                # Canvas wrapper for orbit view
│   │   │   └── r3f/                        # React Three Fiber components
│   │   │       ├── GalaxyScene.tsx         # Galaxy scene root
│   │   │       ├── SystemScene.tsx         # System scene root
│   │   │       ├── OrbitScene.tsx          # Orbit scene root
│   │   │       ├── galaxy/                 # Galaxy scene elements
│   │   │       │   ├── StarSystem.tsx      # Individual star sprite
│   │   │       │   ├── TravelRoute.tsx     # Route line between systems
│   │   │       │   ├── Nebula.tsx          # Nebula point cloud
│   │   │       │   ├── BackgroundStars.tsx # Background starfield
│   │   │       │   ├── GalaxyControls.tsx  # OrbitControls wrapper
│   │   │       │   └── index.ts            # Barrel export
│   │   │       ├── system/                 # System scene elements
│   │   │       │   ├── CentralStar.tsx     # Sun mesh
│   │   │       │   ├── Planet.tsx          # Planet mesh with rotation
│   │   │       │   ├── OrbitPath.tsx       # Orbital path line
│   │   │       │   ├── PlanetRings.tsx     # Saturn-style rings
│   │   │       │   ├── SystemControls.tsx  # OrbitControls wrapper
│   │   │       │   └── index.ts            # Barrel export
│   │   │       ├── orbit/                  # Orbit scene elements
│   │   │       │   ├── CentralPlanet.tsx   # Planet mesh
│   │   │       │   ├── OrbitPlanetRings.tsx # Ring system
│   │   │       │   ├── Moon.tsx            # Moon mesh with orbit
│   │   │       │   ├── OrbitalStation.tsx  # Station sprite
│   │   │       │   ├── SurfaceMarker.tsx   # Surface facility marker
│   │   │       │   ├── OrbitPath.tsx       # Moon orbit path
│   │   │       │   ├── LatLonGrid.tsx      # Latitude/longitude grid
│   │   │       │   ├── Sun.tsx             # Distant sun light source
│   │   │       │   ├── OrbitControls.tsx   # OrbitControls wrapper
│   │   │       │   └── index.ts            # Barrel export
│   │   │       ├── shared/                 # Shared R3F components
│   │   │       │   ├── SelectionReticle.tsx        # Selection indicator
│   │   │       │   ├── LoadingScene.tsx            # Suspense fallback
│   │   │       │   ├── PostProcessing.tsx          # Bloom effects
│   │   │       │   ├── TypewriterController.tsx    # RAF-driven typewriter
│   │   │       │   ├── textureUtils.ts             # Texture generation
│   │   │       │   └── index.ts                    # Barrel export
│   │   │       ├── hooks/                  # Custom R3F hooks
│   │   │       │   ├── useProceduralTexture.ts     # Canvas texture generation
│   │   │       │   ├── useGalaxyCamera.ts          # Galaxy camera control
│   │   │       │   ├── useSystemCamera.ts          # System camera control
│   │   │       │   ├── useOrbitCamera.ts           # Orbit camera control
│   │   │       │   ├── useStarSelection.ts         # Galaxy selection logic
│   │   │       │   └── useSceneStore.ts            # Zustand store access
│   │   │       └── index.ts                # Main barrel export
│   │   │
│   │   ├── encounter/          # Encounter map components
│   │   │   ├── EncounterView.tsx           # Main encounter container
│   │   │   ├── EncounterMapDisplay.tsx     # Player view (clean)
│   │   │   ├── EncounterMapRenderer.tsx    # Map rendering logic
│   │   │   ├── LegendPanel.tsx             # Map legend
│   │   │   ├── LevelIndicator.tsx          # Deck/level indicator
│   │   │   └── RoomTooltip.tsx             # Room hover info
│   │   │
│   │   ├── charon/             # CHARON AI dialog
│   │   │   └── CharonDialog.tsx            # Overlay dialog component
│   │   │
│   │   ├── terminal/           # Communication terminals
│   │   │   └── CommTerminalDialog.tsx      # Terminal message viewer
│   │   │
│   │   └── messages/           # Broadcast messages
│   │       ├── MessageList.tsx             # Message list container
│   │       ├── MessageItem.tsx             # Individual message
│   │       └── index.ts                    # Barrel export
│   │
│   ├── gm/                     # GM Console components
│   │   ├── LocationTree.tsx                # Hierarchical location tree
│   │   ├── ViewControls.tsx                # View switcher
│   │   ├── BroadcastForm.tsx               # Message composer
│   │   ├── CharonPanel.tsx                 # CHARON GM controls
│   │   ├── EncounterPanel.tsx              # Encounter GM controls
│   │   ├── MapPreview.tsx                  # Map thumbnail preview
│   │   └── DoorStatusPopup.tsx             # Door status editor
│   │
│   ├── layout/                 # Layout components
│   │   └── TerminalHeader.tsx              # Top header bar
│   │
│   └── ui/                     # Reusable UI components
│       ├── Panel.tsx                       # Base panel component
│       ├── DashboardPanel.tsx              # Dashboard variant
│       └── CompactPanel.tsx                # Compact variant
│
├── services/                   # API client services
│   ├── api.ts                              # Axios instance with CSRF
│   ├── messageApi.ts                       # Broadcast message API
│   ├── gmConsoleApi.ts                     # GM console API
│   ├── encounterApi.ts                     # Encounter map API
│   ├── charonApi.ts                        # CHARON terminal API
│   └── terminalApi.ts                      # Comm terminal API
│
├── hooks/                      # Custom React hooks
│   ├── useMessages.ts                      # Message polling
│   ├── useTreeState.ts                     # Tree expansion state
│   └── useDebounce.ts                      # Debounce with transition guard
│
├── stores/                     # Zustand state stores
│   └── sceneStore.ts                       # Typewriter coordination store
│
├── types/                      # TypeScript type definitions
│   ├── starMap.ts                          # Galaxy map types
│   ├── systemMap.ts                        # System map types
│   ├── orbitMap.ts                         # Orbit map types
│   ├── encounterMap.ts                     # Encounter map types
│   ├── message.ts                          # Message types
│   ├── charon.ts                           # CHARON types
│   └── gmConsole.ts                        # GM console types
│
├── styles/                     # Global styles
│   └── global.css                          # CSS variables, base styles
│
└── utils/                      # Utility functions
    └── typewriterUtils.ts                  # Typewriter text processing
```

## Entry Points (Vite Multi-Page)

### SharedConsole.tsx
**Purpose**: Main shared terminal display (players + GM view).

**Key State**:
- `activeView`: Current terminal state (polled from API)
- `mapViewMode`: galaxy | system | orbit
- `selectedSystem`, `selectedPlanet`, `selectedOrbitElement`: Navigation state
- `starMapData`, `systemMapData`, `orbitMapData`: Map data
- `activeTab`: Current Bridge tab (map | crew | contacts | notes | status)
- `charonDialogOpen`: CHARON overlay visibility
- `terminalOverlayOpen`: Comm terminal overlay visibility

**Refs**:
- `galaxyMapRef`, `systemMapRef`, `orbitMapRef`: Imperative map controls
- `infoPanelRef`: InfoPanel DOM reference

**Key Callbacks**:
- `handleDiveToSystem()`: Galaxy → System transition (with pre-fetch + RAF coordination)
- `handleOrbitMapNavigate()`: System → Orbit transition (with pre-fetch + RAF coordination)
- `handleBackToGalaxy()`: System → Galaxy transition (zoom out animation)
- `handleBackToSystem()`: Orbit → System transition (zoom out animation)
- `handleTabChange()`: Tab switching with GSAP fade
- `handleSystemSelect()`: Galaxy map selection
- `handlePlanetSelect()`: System map selection
- `handleOrbitElementSelect()`: Orbit map selection

**Polling**: 2s interval on `/api/active-view/` for view changes.

### GMConsole.tsx
**Purpose**: GM control panel for managing views, messages, encounters.

**Features**:
- Location tree with expand/collapse (localStorage persistence)
- View switcher (DISPLAY, SHOW buttons)
- Broadcast message composer
- CHARON controls (mode switch, message composer, AI generation)
- Encounter controls (room visibility, door status, level switcher)

### PlayerConsole.tsx
**Purpose**: Simple player message view (legacy, minimal).

## Component Patterns

### Container/Presentation Pattern

**SharedConsole** (Container):
- Manages state, API calls, navigation logic
- Passes data and callbacks to presentation components

**BridgeView** (Presentation):
- Receives `activeTab`, `onTabChange`, `tabTransitionActive`
- Renders tab content and TabBar
- Children prop contains map components from SharedConsole

### Ref Forwarding (Imperative Handles)

**Map Components** expose methods via `useImperativeHandle`:
```typescript
export interface GalaxyMapHandle {
  selectSystemAndWait(systemName: string): Promise<void>;
  diveToSystem(systemName: string): Promise<void>;
  positionCameraOnSystem(systemName: string): void;
}
```

**InfoPanel** forwards ref for parent access to typing state:
```typescript
const InfoPanel = forwardRef<HTMLDivElement>((props, ref) => {
  // ...
});
```

### Transition Coordination

**Phase-based Transitions** (handleDiveToSystemInternal):
1. **Pre-fetch**: Load target data before animation
2. **Selection**: Select + wait for camera animation
3. **Dive**: Camera dive animation (GSAP + useFrame)
4. **Switch**: React.startTransition to change view mode
5. **Fade-in**: Wait for CSS transition
6. **Reset**: Clear transition states

**Debouncing**: `useTransitionGuard(fn, 300)` prevents rapid clicks.

## React Three Fiber Integration

### Canvas Wrappers

**GalaxyMap.tsx, SystemMap.tsx, OrbitMap.tsx**:
```typescript
<Canvas
  camera={{ position: [0, 0, 100], fov: 75 }}
  gl={{ antialias: true, powerPreference: 'high-performance' }}
  frameloop={paused ? 'demand' : 'always'}
>
  <Suspense fallback={<LoadingScene />}>
    <GalaxyScene data={starMapData} selectedSystem={selectedSystem} />
  </Suspense>
  <PostProcessing enabled={false} />
</Canvas>
```

**Props**:
- `data`: Map data (StarMapData, SystemMapData, OrbitMapData)
- `selectedSystem/Planet/Element`: Current selection
- `transitionState`: 'idle' | 'transitioning-out' | 'transitioning-in'
- `hidden`: CSS visibility (stays mounted during transitions)
- `paused`: Render-on-demand mode (tab inactive)

**Ref Handle** (`useImperativeHandle`):
- Exposes methods for parent to trigger animations
- Returns Promises for animation completion

### Scene Components

**GalaxyScene.tsx**:
- Renders star systems, travel routes, nebulae, background stars
- `useGalaxyCamera` hook for camera control
- `useStarSelection` hook for selection logic
- `GalaxyControls` (OrbitControls wrapper)

**SystemScene.tsx**:
- Renders central star, planets, orbit paths, rings
- `useSystemCamera` hook for camera control
- Planet click → selection → camera pan
- `SystemControls` (OrbitControls wrapper)

**OrbitScene.tsx**:
- Renders central planet, moons, stations, surface markers
- `useOrbitCamera` hook for camera control
- Element click → selection → camera pan
- `LatLonGrid` for planet surface grid
- `OrbitControls` (OrbitControls wrapper)

### Animation Hooks

**useFrame** (R3F built-in):
```typescript
useFrame((state, delta) => {
  // Runs every frame, synchronized with RAF
  meshRef.current.rotation.y += rotationSpeed * delta;
});
```

**Custom Hooks**:
- `useProceduralTexture(drawFn, [width, height])`: Canvas texture generation (memoized)
- `useGalaxyCamera(camera, selectedSystem)`: Camera pan + GSAP transitions
- `useSystemCamera(camera, selectedPlanet)`: Camera pan + dive/zoom
- `useOrbitCamera(camera, selectedElement)`: Camera pan + dive/zoom
- `useSceneStore()`: Zustand store access (typewriter coordination)

### Texture Generation

**Procedural Textures** (useProceduralTexture):
- Canvas-based drawing (circles, gradients, noise)
- Memoized to prevent regeneration
- Used for: planet surfaces, star sprites, nebula particles, reticles

**Example**:
```typescript
const starTexture = useProceduralTexture(
  (ctx, canvas) => {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  },
  [128, 128]
);
```

### Typewriter Coordination

**Zustand Store** (sceneStore.ts):
```typescript
interface SceneStore {
  typewriterActive: boolean;
  typewriterContent: string;
  startTypewriter: (content: string) => void;
  completeTypewriter: () => void;
}
```

**TypewriterController** (R3F component):
- Runs inside Canvas RAF loop
- Updates DOM directly via `useFrame`
- Synchronized with 3D animations

**InfoPanel**:
- Receives content from parent
- Zustand triggers typewriter via `startTypewriter(content)`
- TypewriterController renders text character-by-character

## State Management

### Local State (useState)
- Component-specific UI state
- Tab selection, dialog visibility
- Transition states

### Session Storage
- `bridgeActiveTab`: Persists tab selection across refreshes
- `treeExpandedKeys`: GM Console tree expansion state

### Zustand Store
- `sceneStore`: Typewriter coordination (shared between RAF and React)

### Polling
- `/api/active-view/` every 2s (SharedConsole)
- `/api/messages/` every 5s (useMessages hook)

## API Services

### api.ts (Base Axios Client)
```typescript
export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// CSRF token interceptor
api.interceptors.request.use(config => {
  if (config.method === 'post') {
    config.headers['X-CSRFToken'] = getCSRFToken();
  }
  return config;
});
```

### Service Modules
- **gmConsoleApi.ts**: Location tree, view switching, terminal overlay
- **encounterApi.ts**: Room visibility, door status, level switching
- **charonApi.ts**: Conversation, query submission, mode switching
- **messageApi.ts**: Broadcast messages
- **terminalApi.ts**: Terminal data, hide overlay

**Pattern**: Each service exports typed functions wrapping `api.get/post`.

## TypeScript Types

### Map Data Types
- **starMap.ts**: `StarSystem`, `TravelRoute`, `Nebula`, `StarMapData`
- **systemMap.ts**: `BodyData`, `StarData`, `SystemMapData`
- **orbitMap.ts**: `MoonData`, `StationData`, `SurfaceMarkerData`, `OrbitMapData`

### Domain Types
- **encounterMap.ts**: `RoomData`, `ConnectionData`, `DoorStatusState`, `EncounterMapData`
- **charon.ts**: `CharonMessage`, `CharonMode`, `PendingResponse`
- **message.ts**: `Message`, `MessagePriority`
- **gmConsole.ts**: `Location`, `Terminal`, `LocationTree`

### Component Props
- Each component exports its own Props interface
- Ref handles exported as separate interfaces (e.g., `GalaxyMapHandle`)

## Performance Optimizations

### React.memo
- Used selectively for expensive components (e.g., MessageItem)

### useMemo
- Info panel content generation (HTML strings)
- Computed derived data (selected system data)

### useCallback
- Event handlers passed to children
- Prevents unnecessary re-renders

### React.startTransition
- Non-blocking view mode switches
- Wraps state updates during transitions

### Debouncing
- `useTransitionGuard(fn, delay)`: Prevents rapid navigation clicks
- Minimum 300ms between transitions

### Canvas Optimization
- `frameloop='demand'` when tab inactive (paused)
- `hidden` prop keeps Canvas mounted but invisible (avoids re-init)
- Shared WebGL context (one Canvas per map view)
