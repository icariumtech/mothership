# Codebase Structure

**Analysis Date:** 2026-02-09

## Directory Layout

```
charon/
├── src/                            # React TypeScript frontend source
│   ├── entries/                    # Application entry points
│   ├── components/                 # React components (domain-driven structure)
│   │   ├── domain/                 # Domain-specific features
│   │   ├── gm/                     # GM Console components
│   │   ├── layout/                 # Layout components (header, footer)
│   │   └── ui/                     # Reusable UI components (Panel variants)
│   ├── services/                   # Axios API clients
│   ├── stores/                     # Zustand state stores
│   ├── hooks/                      # Custom React hooks
│   ├── utils/                      # Utility functions
│   ├── types/                      # TypeScript type definitions
│   └── styles/                     # Global CSS styles
├── terminal/                       # Main Django app
│   ├── models.py                   # Django ORM models (ActiveView, Message)
│   ├── views.py                    # API endpoints and template views (1500+ lines)
│   ├── urls.py                     # URL routing (50+ endpoints)
│   ├── data_loader.py              # File-based data loading (DataLoader class)
│   ├── charon_ai.py                # CHARON AI system (Claude integration)
│   ├── charon_session.py           # Session management for CHARON
│   ├── charon_knowledge.py         # Knowledge base and context building
│   ├── templates/                  # Django HTML templates
│   ├── static/                     # Built React app and compiled assets
│   ├── migrations/                 # Django database migrations
│   └── management/                 # Django management commands
├── mothership_gm/                  # Django project settings
│   ├── settings.py                 # Django configuration
│   ├── urls.py                     # Project-level routing
│   ├── wsgi.py                     # WSGI application
│   └── asgi.py                     # ASGI application
├── data/                           # Campaign data (file-based, not DB)
│   ├── campaign/                   # Campaign metadata (crew.yaml, missions.yaml)
│   ├── galaxy/                     # Location hierarchy
│   │   ├── star_map.yaml           # 3D star map definition
│   │   └── {system_slug}/          # Solar system directories
│   │       ├── location.yaml       # System metadata
│   │       ├── system_map.yaml     # 2D system layout
│   │       └── {body_slug}/        # Planet/moon/station directories
│   │           ├── location.yaml
│   │           ├── orbit_map.yaml
│   │           ├── map/            # Facility maps
│   │           │   ├── manifest.yaml
│   │           │   ├── map.yaml
│   │           │   └── map.png
│   │           └── comms/          # Communication terminals
│   └── charon/                     # CHARON conversation archives
├── codemaps/                       # Architecture documentation
│   ├── architecture.md             # System overview
│   ├── backend.md                  # Backend patterns
│   ├── frontend.md                 # Frontend patterns
│   └── data.md                     # Data structure guide
├── scripts/                        # Utility scripts
├── vite.config.ts                  # Vite build configuration
├── tsconfig.json                   # TypeScript configuration
├── package.json                    # npm dependencies
├── manage.py                       # Django management script
└── setup.sh                        # Automated setup script
```

## Directory Purposes

**src/ - Frontend Source Code:**
- Purpose: React TypeScript source code for all UI
- Contains: Components, hooks, services, state management
- Key files: `SharedConsole.tsx`, `GMConsole.tsx`, `sceneStore.ts`
- Build output: Vite compiles to `terminal/static/js/`

**src/entries/ - Application Entry Points:**
- Purpose: Top-level component trees for each view
- Contains: GMConsole, SharedConsole, PlayerConsole entry points
- Key files:
  - `GMConsole.tsx` - Game master control panel (1300+ lines)
  - `SharedConsole.tsx` - Shared terminal display (2200+ lines)
  - `PlayerConsole.tsx` - Player message view

**src/components/domain/ - Feature-Specific Components:**
- Purpose: Components organized by feature domain
- Contains: Feature-specific components and sub-components
- Subdirectories:
  - `dashboard/` - Bridge view (tabs, panels, maps)
  - `maps/` - Map wrappers and R3F scenes
  - `charon/` - CHARON AI terminal components
  - `terminal/` - Communication terminal components
  - `encounter/` - Tactical encounter map components
  - `messages/` - Message display components

**src/components/domain/maps/ - 3D Map Components:**
- Purpose: Canvas wrappers and R3F scene setup
- Contains: GalaxyMap, SystemMap, OrbitMap (wrapper components)
- Location: `src/components/domain/maps/`
- Key files:
  - `GalaxyMap.tsx` - Wrapper with Canvas + GalaxyScene
  - `SystemMap.tsx` - Wrapper with Canvas + SystemScene
  - `OrbitMap.tsx` - Wrapper with Canvas + OrbitScene
- R3F scenes: Subdirectory `r3f/` contains declarative 3D components

**src/components/domain/maps/r3f/ - React Three Fiber Scenes:**
- Purpose: Declarative 3D components using R3F
- Contains: Scene definitions and child objects
- Key files:
  - `GalaxyScene.tsx` - 3D galaxy visualization
  - `SystemScene.tsx` - 3D system (star + planets)
  - `OrbitScene.tsx` - 3D orbital view (planet + moons/stations)
- Subdirectories:
  - `galaxy/` - Galaxy scene child components (Star, Nebula, Route, etc.)
  - `system/` - System scene child components (CelestialBody, Orbit, etc.)
  - `orbit/` - Orbit scene child components (Moon, Station, SurfaceMarker, etc.)
  - `shared/` - Reusable R3F components (SelectionReticle, LoadingScene, TypewriterController, PostProcessing)
  - `hooks/` - Custom R3F hooks (camera control, texture generation, animations)

**src/components/gm/ - GM Console Components:**
- Purpose: Game master control interface
- Contains: Location tree, controls, forms, panels
- Key files:
  - `LocationTree.tsx` - Hierarchical location navigator
  - `ViewControls.tsx` - View mode switcher and controls
  - `CharonPanel.tsx` - CHARON AI channel management
  - `BroadcastForm.tsx` - Message sending form
  - `EncounterPanel.tsx` - Encounter map controls

**src/components/layout/ - Layout Components:**
- Purpose: Page structure and common layout elements
- Contains: Header, footer, container layouts
- Key files: `TerminalHeader.tsx`

**src/components/ui/ - Reusable UI Components:**
- Purpose: Design system components used across app
- Contains: Panel variants with configurable styling
- Key files:
  - `Panel.tsx` - Base panel with chamfered corners, borders, padding
  - `DashboardPanel.tsx` - Pre-styled panel for dashboard use
  - `CompactPanel.tsx` - Minimal variant for dense layouts
  - `README.md` - Component API documentation

**src/services/ - API Client Services:**
- Purpose: HTTP communication with Django backend
- Contains: Axios-based API clients for different domains
- Key files:
  - `charonApi.ts` - CHARON terminal endpoints
  - `gmConsoleApi.ts` - GM console data loading
  - `terminalApi.ts` - Communication terminal data
  - `encounterApi.ts` - Encounter map control
  - `api.ts` - Base Axios instance

**src/stores/ - State Management:**
- Purpose: Zustand stores for centralized state
- Contains: Single Zustand store for entire app
- Key files: `sceneStore.ts` (310+ lines) - R3F scene state, selections, animations

**src/hooks/ - Custom React Hooks:**
- Purpose: Reusable component logic
- Contains: Hooks for debouncing, state persistence, etc.
- Key files:
  - `useDebounce.ts` - Debounce and transition guard hooks
  - `useTreeState.ts` - Collapsed/expanded state persistence
  - `useMessages.ts` - Message polling

**src/components/domain/maps/r3f/hooks/ - R3F Custom Hooks:**
- Purpose: 3D-specific utilities for scene components
- Key files:
  - `useCameraAnimation.ts` - Smooth camera transitions with GSAP
  - `useGalaxyCamera.ts` - Galaxy view camera control
  - `useSystemCamera.ts` - System view camera control
  - `useOrbitCamera.ts` - Orbit view camera control
  - `useProceduralTexture.ts` - Generate textures on canvas
  - `useStarSelection.ts` - Selection state management for stars
  - `useSceneStore.ts` - Zustand selector hook

**src/utils/ - Utility Functions:**
- Purpose: Shared helper functions
- Contains: Transition timing, typewriter logic, etc.
- Key files:
  - `transitionCoordinator.ts` - Transition timing constants and helpers
  - `typewriterUtils.ts` - Typewriter effect computation

**src/types/ - TypeScript Type Definitions:**
- Purpose: Centralized type definitions for API data
- Contains: Interfaces matching backend data structures
- Key files:
  - `starMap.ts` - StarMapData, StarSystem, TravelRoute, Nebula types
  - `systemMap.ts` - SystemMapData, BodyData, OrbitData types
  - `orbitMap.ts` - OrbitMapData, MoonData, StationData, SurfaceMarkerData types
  - `encounterMap.ts` - EncounterMapData, RoomVisibilityState, DoorStatusState types
  - `gmConsole.ts` - Location, ActiveView, Terminal types
  - `charon.ts` - CHARON message and channel types

**src/styles/ - Global Styles:**
- Purpose: Application-wide CSS
- Contains: Global variables, resets, utility classes
- Key files: `global.css`

**terminal/ - Django App:**
- Purpose: Backend application serving API and views
- Contains: Models, views, URL routing, data loading
- Key files:
  - `models.py` - ActiveView (singleton), Message (broadcasts)
  - `views.py` - 50+ API endpoints and HTML template views
  - `urls.py` - Route definitions
  - `data_loader.py` - DataLoader class for YAML traversal
  - `charon_ai.py` - CHARON AI system (Claude API integration)
  - `charon_session.py` - Session and channel management
  - `charon_knowledge.py` - Knowledge base and context building

**terminal/templates/ - Django HTML Templates:**
- Purpose: HTML wrappers for React app and legacy views
- Contains: Script tags injecting data, React root elements
- Key files:
  - `shared_console_react.html` - Main terminal display
  - `gm_console_react.html` - GM control panel
  - `player_console_react.html` - Player messages view

**terminal/static/ - Compiled Assets:**
- Purpose: Built React application and static files
- Generated by: `npm run build` → Vite
- Contains: `js/` (built React), `images/`, `portraits/`

**terminal/migrations/ - Database Migrations:**
- Purpose: Database schema version control
- Generated by: Django ORM
- Contains: Migration files for models changes

**data/ - Campaign Data (File-Based):**
- Purpose: All campaign content and game data
- Organization: Nested directories by location type
- Not stored in database (except ActiveView and Message)
- Formats: YAML (metadata, maps), Markdown (notes), PNG (images)

**data/galaxy/ - Location Hierarchy:**
- Purpose: Campaign world structure
- Organization: Star systems → Planets/Bodies → Facilities → Decks → Rooms
- Each level has: `location.yaml` (metadata), optional `system_map.yaml` or `orbit_map.yaml`
- Examples:
  - `data/galaxy/sol/` - Sol system
  - `data/galaxy/sol/earth/` - Earth
  - `data/galaxy/sol/earth/uscss_morrigan/` - Ship (facility)

**data/campaign/ - Campaign Metadata:**
- Purpose: Campaign-wide information
- Key files: `crew.yaml` (player characters), `missions.yaml` (campaign objectives)

**mothership_gm/ - Django Project Settings:**
- Purpose: Project-level configuration
- Key files:
  - `settings.py` - Django configuration (database, apps, middleware)
  - `urls.py` - Project-level URL routing
  - `wsgi.py` - Production WSGI application
  - `asgi.py` - ASGI application

## Key File Locations

**Entry Points:**
- `src/entries/GMConsole.tsx` - Game master control panel entry
- `src/entries/SharedConsole.tsx` - Shared terminal display entry
- `src/entries/PlayerConsole.tsx` - Player message view entry

**Configuration:**
- `vite.config.ts` - Frontend build configuration
- `tsconfig.json` - TypeScript compiler settings
- `mothership_gm/settings.py` - Django configuration
- `package.json` - npm dependencies and scripts
- `.eslintrc` - Linting rules (if present)

**Core Logic:**
- `src/stores/sceneStore.ts` - Centralized 3D state (Zustand)
- `src/components/domain/maps/r3f/GalaxyScene.tsx` - Galaxy 3D scene
- `src/components/domain/maps/r3f/SystemScene.tsx` - System 3D scene
- `src/components/domain/maps/r3f/OrbitScene.tsx` - Orbit 3D scene
- `terminal/data_loader.py` - File-based data loading
- `terminal/views.py` - API endpoints (Django views)
- `terminal/models.py` - Database models

**Testing:**
- `terminal/tests.py` - Django tests (minimal, can be expanded)

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `GalaxyMap.tsx`, `LocationTree.tsx`)
- Utilities: `camelCase.ts` (e.g., `transitionCoordinator.ts`, `useDebounce.ts`)
- Styles: `kebab-case.css` (e.g., `TabBar.css`, `GalaxyMap.css`)
- Django: `snake_case.py` (e.g., `data_loader.py`, `charon_ai.py`)

**Directories:**
- React domains: `kebab-case/` (e.g., `domain/`, `ui/`, `maps/`)
- Django app: `snake_case/` (e.g., `terminal/`, `mothership_gm/`)
- Nested features: `kebab-case/` (e.g., `r3f/`, `sections/`)

**Components:**
- React: PascalCase (e.g., `GalaxyMap`, `InfoPanel`, `StarMapPanel`)
- Hooks: `use` prefix + PascalCase (e.g., `useDebounce`, `useProceduralTexture`)
- Stores: camelCase + "Store" suffix (e.g., `sceneStore`)

**Functions:**
- Frontend: camelCase (e.g., `selectSystem()`, `buildSystemInfoHTML()`)
- Backend: snake_case (e.g., `get_location_by_slug()`, `load_star_map()`)

**TypeScript Interfaces:**
- API data types: PascalCase + `Data` suffix (e.g., `StarMapData`, `SystemMapData`)
- Props: PascalCase + `Props` suffix (e.g., `GalaxyMapProps`)
- State: camelCase (e.g., `mapViewMode`, `selectedSystem`)

**React Hooks:**
- Selector hooks: `use` + state name (e.g., `useSelectedSystem`, `useMapViewMode`)

## Where to Add New Code

**New Feature:**
- Primary code: Create subdirectory under `src/components/domain/` (e.g., `src/components/domain/newfeature/`)
- Tests: Create `src/components/domain/newfeature/NewFeature.test.tsx` (co-located)
- Types: Add interfaces to `src/types/` if API integration needed
- Services: Create `src/services/newfeatureApi.ts` if backend API needed

**New Component/Module:**
- Reusable UI: `src/components/ui/NewComponent.tsx`
- Domain-specific: `src/components/domain/{feature}/NewComponent.tsx`
- R3F scene objects: `src/components/domain/maps/r3f/{scene}/{NewObject}.tsx`
- GM controls: `src/components/gm/NewPanel.tsx`

**Utilities:**
- Custom hook: `src/hooks/useNewHook.ts` (or `src/components/domain/maps/r3f/hooks/useNewHook.ts` for R3F)
- Helper function: `src/utils/newUtility.ts`
- Styling utilities: Add to `src/styles/global.css` or create `src/styles/newUtility.css`

**Backend:**
- API endpoint: Add view function to `terminal/views.py` and route to `terminal/urls.py`
- New model: Add class to `terminal/models.py`, create migration with `python manage.py makemigrations`
- Data loading: Add method to `DataLoader` class in `terminal/data_loader.py`

**Campaign Data:**
- New location: Create directory under `data/galaxy/{system_slug}/`
- New facility: Create directory with `location.yaml` and optional `map/manifest.yaml`
- New terminal: Create directory under `data/galaxy/{location}/comms/{terminal_slug}/`

## Special Directories

**node_modules/:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (listed in .gitignore)

**terminal/migrations/:**
- Purpose: Django database schema versions
- Generated: Yes (by `python manage.py makemigrations`)
- Committed: Yes (part of source control)

**terminal/static/js/:**
- Purpose: Compiled React application
- Generated: Yes (by `npm run build` → Vite)
- Committed: No (generated artifacts)

**data/charon/:**
- Purpose: CHARON conversation history
- Generated: Yes (by CHARON AI system at runtime)
- Committed: No (runtime data)

**.claude/:**
- Purpose: Claude Code planning and state
- Generated: Yes (by Claude Code tooling)
- Committed: No (excluded from git)

**codemaps/:**
- Purpose: Architecture documentation
- Generated: No (manually maintained)
- Committed: Yes (reference guides)

