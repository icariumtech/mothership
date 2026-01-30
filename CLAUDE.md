# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Documentation Map

For detailed information on specific topics, refer to these guides:

- **Read: README.md** - Project overview, quick start, and feature list
- **Read: GETTING_STARTED.md** - First-time setup and basic usage instructions
- **Read: NETWORK_ACCESS.md** - Configuring network access for players
- **Read: QUICK_REFERENCE.md** - Quick reference for network URLs and common commands
- **Read: DATA_DIRECTORY_GUIDE.md** - Complete guide to data directory structure, file formats, and YAML schemas
- **Read: ARCHITECTURE_CHANGES.md** - Recent architecture changes, component refactoring, and migration notes
- **Read: src/components/ui/README.md** - React Panel component API, usage patterns, and migration examples
- **Read: STYLE_GUIDE.md** - UI design system, color palette, panel patterns, and visual specifications

# Overview

**mothership** is a game master tool for running Mothership RPG campaigns. This full-stack web application serves as an interactive command center that enhances the tabletop RPG experience with digital tools and atmospheric computer-like messaging.

**Repository**: https://github.com/icariumtech/mothership
**License**: MIT (2025 icariumtech)
**Primary Languages**: Python (Django backend), TypeScript (React frontend)
**Game System**: Mothership RPG (sci-fi horror TTRPG)

## Project Purpose

This tool is developed collaboratively between the game master and Claude Code. The web app provides players with:

1. **Campaign Tracking**: Track player characters, missions, ship status, resources, and campaign progress
2. **Atmospheric Messaging System**: Send in-character messages to players styled like the iconic CHARON computer from Aliens
3. **Galaxy Map**: Interactive visualization of the galaxy/sector the players are exploring
4. **Session Management**: Track sessions, notes, and story developments

## Persona

You are an expert full stack web developer. You should identify ways to write code that is efficient and easy to read. Create reusable functions instead of duplicating code blocks.

# Technical Stack

## Backend
- **Web Framework**: Django 5.2.7
- **Database**: SQLite (stores ActiveView state and broadcast Messages only)
- **Data Storage**: File-based (YAML + Markdown)
- **Data Parsing**: PyYAML for YAML parsing, Pillow for image generation

## Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 5.4
- **UI Library**: Ant Design 6.1 (layout, forms, tabs, icons)
- **3D Graphics**: React Three Fiber 9.0 (@react-three/fiber) + Three.js 0.182
- **3D Helpers**: @react-three/drei 9.122 (OrbitControls, Suspense helpers, etc.)
- **3D Effects**: @react-three/postprocessing (bloom, post-processing foundation)
- **Animation**: R3F useFrame hook (unified RAF loop) + GSAP 3.14 (camera transitions)
- **HTTP Client**: Axios 1.13 for API communication

## Development Tools
- **Linting**: Ruff (Python), TypeScript compiler (frontend)
- **Testing**: pytest (backend)

# Quick Reference

## Key Commands
```bash
npm run dev              # Start Vite dev server with hot reload
npm run build            # Production build
npm run typecheck        # TypeScript type checking
python manage.py runserver  # Start Django server
```

## Development URLs
- **GM Console**: http://127.0.0.1:8000/gmconsole/
- **Terminal Display**: http://127.0.0.1:8000/terminal/
- **Player Messages**: http://127.0.0.1:8000/messages/
- **Admin**: http://127.0.0.1:8000/admin/
- **API - Active View**: http://127.0.0.1:8000/api/active-view/
- **API - Messages**: http://127.0.0.1:8000/api/messages/

# Architecture

## Directory Structure
```
charon/
├── data/                        # Campaign data (file-based)
│   ├── campaign/                # Campaign YAML files (crew, missions, notes)
│   └── galaxy/                  # Galaxy hierarchy (nested directories)
│       ├── star_map.yaml        # 3D star map visualization
│       └── {system_slug}/       # Solar System (e.g., sol, kepler-442)
│           ├── location.yaml
│           ├── system_map.yaml
│           └── {body_slug}/     # Planet/Moon
│               ├── location.yaml
│               ├── orbit_map.yaml
│               └── {facility_slug}/  # Station/Base/Ship
│                   ├── location.yaml
│                   ├── map/          # Facility map (yaml + png)
│                   ├── comms/        # Communication terminals
│                   └── {deck_slug}/  # Deck/Level (can nest rooms)
├── src/                         # React TypeScript frontend
│   ├── entries/                 # Entry points (GMConsole, SharedConsole, PlayerConsole)
│   ├── components/
│   │   ├── domain/              # Dashboard, maps, encounter, charon, terminal
│   │   │   ├── dashboard/       # Dashboard components (BridgeView, panels, sections)
│   │   │   ├── maps/            # 3D map components (React Three Fiber)
│   │   │   │   ├── r3f/         # R3F scene components (GalaxyScene, SystemScene, OrbitScene)
│   │   │   │   │   ├── galaxy/  # Galaxy scene components (stars, nebulae, routes)
│   │   │   │   │   ├── system/  # System scene components (planets, orbits, star)
│   │   │   │   │   ├── orbit/   # Orbit scene components (moons, stations, planet)
│   │   │   │   │   ├── shared/  # Shared R3F components (reticle, loading, etc.)
│   │   │   │   │   └── hooks/   # Custom R3F hooks (textures, animations)
│   │   │   │   ├── GalaxyMap.tsx  # Galaxy Canvas wrapper
│   │   │   │   ├── SystemMap.tsx  # System Canvas wrapper
│   │   │   │   └── OrbitMap.tsx   # Orbit Canvas wrapper
│   │   │   ├── encounter/       # Encounter view components
│   │   │   ├── charon/          # CHARON AI dialog
│   │   │   └── terminal/        # Communication terminal components
│   │   ├── gm/                  # GM Console components
│   │   ├── layout/              # Layout components
│   │   └── ui/                  # Reusable UI components (Panel, DashboardPanel, etc.)
│   ├── services/                # API client services
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript type definitions
│   └── styles/                  # Global CSS styles
├── scripts/                     # Utility scripts
├── mothership_gm/               # Django project settings
├── terminal/                    # Main Django app
│   ├── models.py                # Message, ActiveView
│   ├── views.py                 # API endpoints and template views
│   ├── data_loader.py           # File-based data loading
│   └── templates/               # HTML template wrappers
└── vite.config.ts               # Vite build configuration
```

## Multi-View Terminal System

The application supports multiple view types displayed on a shared terminal:

| View Type | Description |
|-----------|-------------|
| `STANDBY` | Default idle state with animated text |
| `BRIDGE` | Ship bridge view with galaxy map and status panels |
| `MESSAGES` | Traditional broadcast message system |
| `COMM_TERMINAL` | NPC terminal message logs with inbox/sent |
| `ENCOUNTER` | Tactical maps for combat scenarios |
| `SHIP_DASHBOARD` | Ship status and systems display |
| `CHARON_TERMINAL` | Interactive AI terminal interface |

**Key Design Decisions:**
- File-based data storage (markdown with YAML frontmatter)
- Nested directory hierarchy for locations (unlimited depth)
- On-demand loading from disk (no DB sync required)
- ActiveView singleton tracks current display state
- Auto-refresh terminal polls every 2 seconds

## Bridge View Architecture

The `BRIDGE` view is a tabbed interface providing access to ship systems and campaign information.

### Tab System

The Bridge View uses a tab navigation system with 5 tabs:
- **MAP**: Interactive 3D galaxy/system/orbit maps with navigation
- **CREW**: Player character roster and stats (planned)
- **CONTACTS**: NPC and faction information (planned)
- **NOTES**: Campaign notes and session logs (planned)
- **STATUS**: Ship status and mission objectives (planned)

Tab state persists in `sessionStorage` and restores on page reload.

### Component Structure

**Main Components:**
- `BridgeView.tsx` - Main container component that manages tab state and renders active tab content
- `TabBar.tsx` - Bottom navigation bar for switching between tabs
- `StarMapPanel.tsx` - Left sidebar panel showing star system lists (Galaxy/System/Orbit hierarchy)
- `InfoPanel.tsx` - Right sidebar panel with typewriter effect for displaying location details

**Section Components** (`src/components/domain/dashboard/sections/`):
- `MapSection.tsx` - 3D map views (currently rendered inline in SharedConsole)
- `CrewSection.tsx` - Crew roster display (placeholder)
- `ContactsSection.tsx` - Contact database (placeholder)
- `NotesSection.tsx` - Campaign notes (placeholder)
- `StatusSection.tsx` - Mission status (placeholder)

### Map Navigation System

Three-tiered navigation hierarchy for exploring the galaxy:

1. **Galaxy View** - Shows list of star systems with 3D visualization
   - Select a system to highlight it in 3D space
   - Click "▶" button or use dive action to zoom into system view

2. **System View** - Shows planets and bodies within a star system
   - Displays planet indicators (▼ surface facilities, ◆ orbital stations)
   - Click "BACK TO GALAXY" to return to galaxy view
   - Click "▶" button on planets with orbit maps to dive to orbit view

3. **Orbit View** - Shows moons, stations, and surface facilities around a planet
   - Lists moons (with facility indicators), orbital stations, and surface markers
   - Click "BACK TO SYSTEM" to return to system view

**State Management:**
- `mapViewMode`: Current view level ('galaxy' | 'system' | 'orbit')
- `selectedSystem`: Currently selected star system
- `selectedPlanet`: Currently selected planet/body
- `selectedOrbitElement`: Currently selected moon/station/facility

**Transition Animations:**
- R3F useFrame-powered animations with unified RAF loop
- GSAP for camera transitions (easing and timing)
- Fade in/out transitions between map levels using react-spring
- Tab switching uses CSS transitions with disabled state during animation
- All animations coordinated through single requestAnimationFrame loop (eliminates stuttering)

## Data Models

### Database Models

**ActiveView** (Singleton) - Tracks which view the shared terminal is displaying:
```python
class ActiveView(models.Model):
    location_slug = CharField       # e.g., "research_base_alpha"
    view_type = CharField           # STANDBY, BRIDGE, ENCOUNTER, etc.
    view_slug = CharField           # e.g., "commanders_terminal"
    overlay_location_slug = CharField
    overlay_terminal_slug = CharField
    charon_mode = CharField         # DISPLAY, QUERY
    encounter_level = IntegerField
    encounter_room_visibility = JSONField
```

**Message** - Broadcast messages sent by GM:
```python
class Message(models.Model):
    sender = CharField              # e.g., "CHARON"
    content = TextField
    priority = CharField            # LOW, NORMAL, HIGH, CRITICAL
    created_at = DateTimeField
```

### File-Based Data

Campaign data stored in `data/` directory:
- **Locations**: Nested directory hierarchy (Systems → Planets → Facilities → Decks → Rooms)
- **Maps**: Star maps, system maps, orbit maps, encounter maps (YAML format)
- **Terminals**: Communication terminals with inbox/sent message folders
- **Messages**: Markdown files with YAML frontmatter

**Read: DATA_DIRECTORY_GUIDE.md** for complete documentation.

### Data Access Pattern

```python
from terminal.data_loader import DataLoader

loader = DataLoader()
all_locations = loader.load_all_locations()
location = loader.find_location_by_slug('research_base_alpha')
star_map = loader.load_star_map()
```

# User Interfaces

## GM Console (`/gmconsole/`)

**Tree View Interface:**
- Hierarchical tree of all locations (unlimited nesting depth)
- Triangle icons (▶/▼) to expand/collapse locations
- Eye icon DISPLAY button - shows location map on terminal
- Play icon SHOW button - sets terminal overlay without clearing main display
- LocalStorage persistence for expanded/collapsed state

## Terminal Display (`/terminal/`)

**Auto-switching Display:**
- Polls `/api/active-view/` every 2 seconds
- Automatically reloads when GM changes view
- Displays appropriate view based on `view_type`

## API Endpoints

### `/api/active-view/` (Public)
```json
{
  "location_slug": "uscss_morrigan",
  "view_type": "ENCOUNTER",
  "encounter_level": 1,
  "encounter_room_visibility": {},
  "updated_at": "2025-11-09 06:20:31"
}
```

### `/api/messages/` (Public)
```json
{
  "messages": [
    {"id": 5, "sender": "CHARON", "content": "System status: nominal", "priority": "NORMAL"}
  ],
  "count": 1
}
```

# UI Design System

**Read: STYLE_GUIDE.md** for complete UI specifications.

**Quick Reference:**
- **Primary colors**: Teal (#4a6b6b) for structure, Amber (#8b7355) for actions
- **Panels**: Use `DashboardPanel` or `CompactPanel` from `@components/ui/`
- **Chamfer size**: 12px on angular corners
- **Font**: Cascadia Code (monospace)

## Reusable Components

### Panel Components (`src/components/ui/`)

**Base Panel Component:**
- `Panel.tsx` - Base panel with configurable borders, padding, and chamfering
- `DashboardPanel.tsx` - Pre-configured panel for dashboard use with title header
- `CompactPanel.tsx` - Minimal panel variant for dense layouts

See [src/components/ui/README.md](src/components/ui/README.md) for detailed API documentation.

### Dashboard Components (`src/components/domain/dashboard/`)

**InfoPanel:**
- Floating info panel with typewriter effect
- Displays location details (systems, planets, moons, stations)
- Supports forwardRef for parent access to typing state
- Uses `useTypewriter` hook for character-by-character reveal
- Helper functions: `buildSystemInfoHTML()`, `buildPlanetInfoHTML()`, etc.

**StarMapPanel:**
- Left sidebar panel showing hierarchical location lists
- Three modes: galaxy (systems), system (planets), orbit (moons/stations/facilities)
- Navigation buttons: "BACK TO GALAXY", "BACK TO SYSTEM"
- Dive buttons (▶) for drilling down into sub-levels
- Facility indicators (▼ surface, ◆ orbital) on planet rows

**TabBar:**
- Bottom navigation bar with 5 tabs (MAP, CREW, CONTACTS, NOTES, STATUS)
- Uses base Panel component with full chamfering
- Supports disabled state during transitions
- Active tab highlighted with amber color

# Development Practices

## Mothership RPG Guidelines

### Atmosphere & Theme
- Muted multi-color palette inspired by Alien Romulus (2024) - realistic CRT aesthetic
- Write computer messages in-character as ship/station AI systems - terse, technical, sometimes ominous
- Monospaced fonts, angular panels with chamfered corners, subtle CRT scanline effects

### Game Mechanics Integration
- **Stress System**: Prominently display character stress levels (core Mothership mechanic)
- **Stats**: Follow official format (Strength, Speed, Intellect, Combat)
- **Saves**: Sanity Save, Fear Save, Body Save with clear UI indicators

### Player Experience
- Mobile friendly - players access from phones/tablets at the table
- Quick updates that don't interrupt gameplay
- Read-only mode - players see info but can't modify without GM approval

## React/TypeScript Patterns

### Architecture
- **Component Organization**: Domain-driven structure (domain/gm/layout/ui)
  - `domain/dashboard/` - Bridge view components and sections
  - `domain/maps/` - 3D map wrapper components
  - `domain/encounter/` - Encounter map components
  - `domain/charon/` - CHARON AI dialog
  - `domain/terminal/` - Communication terminals
- **State Management**: React hooks (useState, useEffect, useCallback, useRef)
- **Custom Hooks**: Shared logic in `src/hooks/` (e.g., useTypewriter for text effects)
- **API Services**: Centralized axios-based clients in `src/services/`
- **Type Definitions**: Shared types in `src/types/` (starMap, systemMap, orbitMap, encounterMap)

### Component Patterns

**Container/Presentation Pattern:**
- `SharedConsole.tsx` - Main container managing state and API calls
- `BridgeView.tsx` - Presentation component receiving props and callbacks
- Section components receive data via props, emit events via callbacks

**Ref Forwarding:**
- Map components expose imperative handles via `useImperativeHandle`
- InfoPanel uses `forwardRef` to expose DOM ref and typing state
- Refs used for calling methods like `diveToSystem()`, `zoomOut()`, etc.

**Session Persistence:**
- Tab state saved to `sessionStorage` for persistence across refreshes
- GM Console tree expansion state saved to `localStorage`

### React Three Fiber Integration

**Declarative 3D Architecture:**
The application uses React Three Fiber (R3F) for all 3D visualizations, replacing the previous imperative Three.js classes with declarative React components.

**Key Benefits:**
- **Unified Animation Loop**: Single RAF loop eliminates stuttering (replaces 4 competing animation systems)
- **Automatic Memory Management**: R3F handles disposal of geometries, materials, and textures
- **Declarative API**: Props flow down, events flow up (React-friendly patterns)
- **Code Reduction**: ~40-50% less code than imperative Three.js (2,100 vs 4,500 lines)
- **Better Performance**: Render-on-demand, automatic frustum culling, shared WebGL context

**Component Structure:**
```tsx
// Canvas wrapper (GalaxyMap.tsx, SystemMap.tsx, OrbitMap.tsx)
<Canvas
  camera={{ position: [0, 0, 100], fov: 75 }}
  gl={{ antialias: true, powerPreference: 'high-performance' }}
  frameloop={paused ? 'demand' : 'always'}
>
  <Suspense fallback={<LoadingScene />}>
    <GalaxyScene data={starMapData} selectedSystem={selectedSystem} />
  </Suspense>
  <PostProcessing enabled={false} /> {/* Foundation for bloom effects */}
</Canvas>
```

**R3F Patterns:**
- **useFrame Hook**: Synchronized animations (replaces manual RAF loops)
- **React.Suspense**: Async texture/data loading with fallback
- **@react-three/drei**: Helper components (OrbitControls, Stars, Html, useTexture)
- **Imperative Handles**: Map components expose methods via useImperativeHandle for parent coordination

**Animation Coordination:**
- **3D Animations**: useFrame hook for orbital motion, rotations, particles
- **Camera Transitions**: GSAP for smooth easing (integrated with useFrame)
- **Typewriter Effect**: RAF-driven TypewriterController synchronized with scene animations
- **Post-Processing**: Optional bloom, chromatic aberration (disabled by default)

**File Organization:**
- `src/components/domain/maps/r3f/` - R3F scene components
  - `GalaxyScene.tsx`, `SystemScene.tsx`, `OrbitScene.tsx` - Main scene components
  - `galaxy/`, `system/`, `orbit/` - Scene-specific child components
  - `shared/` - Reusable components (SelectionReticle, LoadingScene, PostProcessing)
  - `hooks/` - Custom hooks (useProceduralTexture, useOrbitalMotion)

### Best Practices
- Use `@/` alias for `src/` directory imports (e.g., `@components/ui/Panel`)
- Prefer `useCallback` and `useMemo` for performance-critical operations
- Use `useRef` for Three.js object references and DOM references
- `async/await` for all API calls with proper error handling
- Extract reusable UI components to `src/components/ui/`
- Keep domain-specific logic in domain components
- Use TypeScript types from `src/types/` for API data structures

### Working with React Three Fiber

**Adding New 3D Elements:**

1. **Create a Component** (declarative JSX):
```tsx
// src/components/domain/maps/r3f/galaxy/Star.tsx
export function Star({ position, size, color, onClick }: StarProps) {
  return (
    <sprite position={position} scale={[size, size, 1]} onClick={onClick}>
      <spriteMaterial
        map={starTexture}
        color={color}
        transparent
        opacity={0.9}
      />
    </sprite>
  );
}
```

2. **Use in Scene**:
```tsx
// In GalaxyScene.tsx
{systems.map(system => (
  <Star
    key={system.name}
    position={system.position}
    size={system.size}
    onClick={() => handleSystemClick(system)}
  />
))}
```

**Animations with useFrame:**

```tsx
function RotatingPlanet({ rotationSpeed }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += rotationSpeed * delta;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial />
    </mesh>
  );
}
```

**Camera Transitions:**

```tsx
function CameraController({ target }: Props) {
  const { camera } = useThree();

  useEffect(() => {
    if (target) {
      gsap.to(camera.position, {
        x: target.x,
        y: target.y,
        z: target.z,
        duration: 2,
        ease: 'power2.inOut',
      });
    }
  }, [target, camera]);

  return null;
}
```

**Texture Loading:**

```tsx
import { useProceduralTexture } from '../hooks/useProceduralTexture';

function CustomElement() {
  const texture = useProceduralTexture(
    (ctx, canvas) => {
      // Draw on canvas
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    [128, 128] // width, height
  );

  return (
    <sprite>
      <spriteMaterial map={texture} />
    </sprite>
  );
}
```

**Performance Tips:**
- Use `frameloop='demand'` when scene is static (paused prop)
- Keep high `luminanceThreshold` (0.9+) for post-processing
- Use `useMemo` for procedural textures
- Implement LOD (level of detail) for distant objects when needed
- Check memory with Chrome DevTools during extended sessions

# Configuration & Tools

## Authentication

*No authentication currently implemented.*

**Planned roles:**
- **Game Master (GM)**: Full access, can edit content and send messages
- **Players**: View-only access to their character and shared campaign info

## Utility Scripts

Scripts in `scripts/` directory:
- `convert_to_amber_gradient.py` - Convert textures to retro amber gradient
- `convert_npc_portraits.py` - Convert NPC portraits to amber gradient style
- `batch_convert_textures.sh` - Batch convert planet textures

# Planned Features

- [ ] Terminal conversation view renderer
- [ ] Ship dashboard display (different from campaign dashboard)
- [ ] Player character management
- [ ] Session tracking
- [ ] Combat/encounter tracking on maps
- [ ] Sound effects and ambient audio
- [ ] GM tools (NPC generator, random encounters, quick reference tables)
