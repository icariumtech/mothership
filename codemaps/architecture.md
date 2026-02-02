# Architecture Overview

**Last Updated**: 2026-02-02T00:00:00Z

## System Architecture

**mothership** is a full-stack web application for running Mothership RPG campaigns, featuring a multi-view terminal system with 3D galaxy visualization.

### High-Level Stack

```
Frontend (React + R3F)
    ↓
API Layer (Django REST)
    ↓
Data Layer (SQLite + File-based YAML)
```

## Technology Stack

### Backend
- **Django 5.2.7**: Web framework and routing
- **SQLite**: Database for ActiveView singleton and broadcast Messages
- **PyYAML**: YAML file parsing for campaign data
- **Pillow**: Image generation and processing

### Frontend
- **React 19**: UI framework with TypeScript
- **Vite 5.4**: Build tool and dev server
- **Ant Design 6.1**: UI component library (layout, forms, tabs, icons)
- **React Three Fiber 9.0**: Declarative 3D rendering (replaces imperative Three.js)
- **Three.js 0.182**: WebGL 3D engine
- **@react-three/drei 9.122**: R3F helper components (OrbitControls, Stars, Html)
- **@react-three/postprocessing**: Post-processing effects (bloom, chromatic aberration)
- **GSAP 3.14**: Camera transition animations
- **Axios 1.13**: HTTP client
- **Zustand 5.0**: State management (typewriter coordination)

### Development Tools
- **TypeScript 5.9**: Type safety
- **Ruff**: Python linter
- **pytest**: Backend testing

## Data Flow Architecture

### View State Management

```
GM Console (React)
    → API POST /api/switch-view/
    → ActiveView Model (Django)
    → Polling GET /api/active-view/ (2s interval)
    → Shared Console (React)
```

### File-based Data Loading

```
Data Directory (YAML files)
    → DataLoader.load_all_locations()
    → Recursive hierarchy traversal
    → API JSON response
    → React components
```

### 3D Map Navigation

```
User Interaction
    → SharedConsole state (mapViewMode)
    → Map component refs (dive/zoom methods)
    → GSAP camera transitions
    → R3F useFrame hook (animation)
    → TypewriterController (RAF-driven)
```

## Multi-View Terminal System

The application supports 7 view types on a shared terminal display:

| View Type | Purpose | Data Source |
|-----------|---------|-------------|
| `STANDBY` | Idle animation | Static |
| `BRIDGE` | Ship bridge dashboard with tabbed interface | File-based (star_map, system_map, orbit_map) |
| `MESSAGES` | Broadcast messages | SQLite Message model |
| `COMM_TERMINAL` | NPC terminal message logs | File-based (comms/) |
| `ENCOUNTER` | Tactical encounter maps | File-based (map/) + SQLite (room visibility) |
| `SHIP_DASHBOARD` | Ship systems display | Planned |
| `CHARON_TERMINAL` | AI terminal interface | In-memory session + AI generation |

## React Three Fiber Architecture

**Migration**: Replaced imperative Three.js classes with declarative R3F components (Phase 6 complete).

### Key Benefits
- **Unified RAF Loop**: Single requestAnimationFrame loop eliminates stuttering
- **Automatic Disposal**: R3F handles cleanup of geometries, materials, textures
- **Declarative Props**: React-friendly component patterns
- **40-50% Code Reduction**: 2,100 lines (R3F) vs 4,500 lines (Three.js)

### Component Hierarchy

```
Canvas (GalaxyMap/SystemMap/OrbitMap)
  ├── Suspense (async texture loading)
  │   └── *Scene (GalaxyScene/SystemScene/OrbitScene)
  │       ├── *Controls (camera controls)
  │       ├── Lights (ambient, directional)
  │       ├── Scene Elements (stars, planets, moons)
  │       └── TypewriterController (RAF-driven sync)
  └── PostProcessing (bloom, optional)
```

### Animation Coordination

All animations synchronized through unified RAF loop:
- **3D Scene**: useFrame hook for orbital motion, rotations, particles
- **Camera**: GSAP transitions integrated with useFrame
- **Typewriter**: TypewriterController synchronized with scene RAF
- **UI Transitions**: React.startTransition for non-blocking updates

## Data Storage Strategy

### Database (SQLite)
- **ActiveView**: Singleton tracking current terminal display state
- **Message**: Broadcast messages from GM to players
- **User**: Django auth (planned multi-user support)

### File-based (YAML + Markdown)
- **Locations**: Nested directory hierarchy (unlimited depth)
  - `data/galaxy/{system}/{body}/{facility}/{deck}/location.yaml`
- **Maps**: 3D visualization data
  - `star_map.yaml`, `system_map.yaml`, `orbit_map.yaml`, `manifest.yaml`
- **Terminals**: Communication logs
  - `comms/{terminal_slug}/terminal.yaml`
  - `comms/messages/*.md` (central message store)
- **Campaign**: Crew roster, missions, notes
  - `data/campaign/crew.yaml`

### Design Rationale
- **No DB sync**: On-demand loading from disk (lightweight, version-control friendly)
- **Git-friendly**: YAML text files vs binary DB dumps
- **Infinite nesting**: Hierarchical locations without schema changes
- **Rapid iteration**: Edit YAML, refresh browser (no migrations)

## API Endpoints

### Public (No Auth)
- `GET /api/active-view/` - Current terminal state
- `GET /api/messages/` - Broadcast messages
- `GET /api/star-map/` - Galaxy visualization data
- `GET /api/system-map/{system_slug}/` - Solar system data
- `GET /api/orbit-map/{system_slug}/{body_slug}/` - Orbital data
- `GET /api/encounter-map/{location_slug}/` - Encounter map data
- `GET /api/terminal/{location_slug}/{terminal_slug}/` - Terminal messages
- `POST /api/charon/submit-query/` - Player submits CHARON query (CSRF exempt)
- `POST /api/charon/toggle-dialog/` - Toggle CHARON dialog (CSRF exempt)
- `POST /api/hide-terminal/` - Hide terminal overlay (CSRF exempt)

### GM Only (Login Required)
- `POST /api/switch-view/` - Change active view
- `POST /api/show-terminal/` - Show terminal overlay
- `POST /api/broadcast/` - Send broadcast message
- `POST /api/encounter/toggle-room/` - Toggle room visibility
- `POST /api/encounter/set-door-status/` - Set door status
- `POST /api/encounter/switch-level/` - Switch encounter deck
- `POST /api/charon/switch-mode/` - Switch CHARON mode (DISPLAY/QUERY)
- `POST /api/charon/send-message/` - GM sends CHARON message
- `POST /api/charon/generate/` - Generate AI response for review
- `POST /api/charon/approve/` - Approve pending AI response
- `POST /api/charon/reject/` - Reject pending AI response
- `POST /api/charon/clear/` - Clear CHARON conversation

## Performance Optimizations

### React Three Fiber
- **Render-on-demand**: `frameloop='demand'` when paused (tab inactive)
- **Frustum culling**: Automatic (off-screen objects not rendered)
- **Shared WebGL context**: Single Canvas per map view
- **Procedural textures**: useMemo to prevent regeneration
- **High luminance threshold**: 0.9+ for post-processing (selective bloom)

### Frontend
- **Session persistence**: Tab state, tree expansion in localStorage/sessionStorage
- **Polling**: 2s interval (not WebSockets, simple deployment)
- **React.startTransition**: Non-blocking view switches
- **GSAP RAF integration**: Coordinated with R3F useFrame

### Backend
- **On-demand loading**: No eager DB joins, lazy file reads
- **Minimal DB writes**: Only ActiveView and Message in SQLite
- **Static file serving**: Django serves YAML as static content
