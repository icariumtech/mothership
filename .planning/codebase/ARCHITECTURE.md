# Architecture

**Analysis Date:** 2026-02-09

## Pattern Overview

**Overall:** Three-tier full-stack MVC with server-driven view state and client-side R3F visualization

**Key Characteristics:**
- Django backend serves view-state and file-based data (YAML + Markdown)
- React frontend with TypeScript manages UI, handles API calls, and renders 3D scenes
- React Three Fiber (R3F) replaces imperative Three.js with declarative 3D components
- Zustand store as single source of truth for 3D scene state
- Real-time polling for state synchronization (2-5 second intervals)

## Layers

**Presentation Layer:**
- Purpose: React components rendering views and UI
- Location: `src/components/` (domain/, gm/, layout/, ui/)
- Contains: View containers, section components, forms, dialogs
- Depends on: Services layer, Zustand store, R3F components
- Used by: Browser clients (players, GM, display terminal)

**Services Layer:**
- Purpose: Axios-based API clients abstracting HTTP communication
- Location: `src/services/` (charonApi.ts, terminalApi.ts, gmConsoleApi.ts, encounterApi.ts, terminalApi.ts)
- Contains: Request/response handling, data transformation, error handling
- Depends on: Django backend API endpoints
- Used by: Presentation components, containers

**State Management Layer:**
- Purpose: Zustand store manages centralized 3D scene state
- Location: `src/stores/sceneStore.ts`
- Contains: Scene view modes, selections, camera state, animations, typewriter progress
- Depends on: Type definitions (src/types/)
- Used by: R3F scene components, dashboard components, hooks

**React Three Fiber Scene Layer:**
- Purpose: Declarative 3D scene components using R3F
- Location: `src/components/domain/maps/r3f/`
- Contains: GalaxyScene, SystemScene, OrbitScene, and child components
- Depends on: Zustand store, Three.js, procedural texture hooks, camera animation hooks
- Used by: Map wrapper components (GalaxyMap, SystemMap, OrbitMap)

**Utility Layer:**
- Purpose: Shared helper functions and coordination logic
- Location: `src/utils/`, `src/hooks/`
- Contains: Transition timing, typewriter computation, debouncing, tree state persistence
- Depends on: Zustand store, React hooks
- Used by: Components, services, custom hooks

**Backend Layer:**
- Purpose: Django app serving API endpoints and HTML templates
- Location: `terminal/` (models.py, views.py, data_loader.py, charon_ai.py, charon_session.py)
- Contains: Models (ActiveView, Message), API endpoints, file-based data loading
- Depends on: Django ORM, PyYAML, data/ directory structure
- Used by: React services

**Data Persistence Layer:**
- Purpose: File-based data storage (not traditional database queries)
- Location: `data/` directory (campaign/, galaxy/)
- Contains: YAML frontmatter location definitions, maps, terminals, messages
- Depends on: Filesystem
- Used by: DataLoader, views.py API endpoints

## Data Flow

**Initial Page Load (SharedConsole):**

1. Django renders `terminal/shared_console_react.html` with INITIAL_DATA injected
2. React hydrates with activeView state from window.INITIAL_DATA
3. SharedConsole initializes Zustand store with default view mode ('galaxy')
4. useEffect triggers API call to `/api/star-map/` → setStarMapData in store
5. GalaxyMap component renders with starMapData from store
6. R3F Canvas initializes with TypewriterController (RAF-driven animation)
7. Poll interval set on activeView (5 second interval) to detect GM changes
8. Terminal polls `/api/active-view/` every 2 seconds to auto-switch view type

**Viewing Bridge Map:**

1. GM clicks "DISPLAY" in GMConsole → `/api/gm/switch-view/` to set ActiveView
2. Terminal detects view_type changed to 'BRIDGE' (polling)
3. SharedConsole re-renders with BridgeView (tabbed interface)
4. User selects MAP tab → renders GalaxyMap component
5. User selects system from StarMapPanel → calls selectSystem on store
6. GalaxyScene reads selectedSystem from store, highlights in 3D
7. InfoPanel reads typewriter progress from store, displays system details

**Dive Transition (Galaxy → System):**

1. User clicks ▶ dive button on system
2. SharedConsole calls map ref: `galaxyMapRef.current.selectSystemAndWait(systemName)`
3. GalaxyScene triggers zoom animation (GSAP + useFrame loop)
4. InfoPanel typewriter effect plays via RAF (not setTimeout)
5. Waits for typewriter completion via polling store
6. After 2 second zoom, calls `setMapViewMode('system')`
7. Fade out → API call to `/api/system-map/{slug}/` → fade in
8. SystemMap mounts with systemMapData from store
9. Selection is preserved through Zustand store

**State Management:**

- **View Mode**: mapViewMode in store controls which scene renders
- **Selections**: selectedSystem, selectedPlanet, selectedOrbitElement in store (reads by scenes)
- **Camera**: camera position/target synced in store from R3F
- **Animations**: Controlled via useFrame hook (unified RAF loop)
- **Typewriter**: TypewriterController increments progress every frame, stores in Zustand

## Key Abstractions

**ActiveView Model:**
- Purpose: Singleton Django model tracking what terminal displays
- Examples: `terminal/models.py` ActiveView class
- Pattern: GET_CURRENT singleton pattern, auto-updates on save()
- Fields: view_type, location_slug, view_slug, overlay_*, encounter_*, charon_*

**Scene Components (R3F):**
- Purpose: Declarative 3D scene trees (galaxy, system, orbit)
- Examples: `src/components/domain/maps/r3f/GalaxyScene.tsx`, SystemScene, OrbitScene
- Pattern: useImperativeHandle to expose methods to parent, useFrame for animations
- Responsibilities: Render objects, handle interactions, sync with Zustand

**Map Wrapper Components:**
- Purpose: Canvas setup + Suspense boundary + imperative handle forwarding
- Examples: `src/components/domain/maps/GalaxyMap.tsx`, SystemMap, OrbitMap
- Pattern: forwardRef + useImperativeHandle for parent-child coordination
- Responsibilities: Create Canvas, manage error boundaries, expose API to parent

**API Services:**
- Purpose: Encapsulate HTTP calls and data transformation
- Examples: `src/services/charonApi.ts`, terminalApi.ts, gmConsoleApi.ts
- Pattern: Named async functions returning Promise<T>, error handling
- Responsibilities: Request marshalling, response parsing, error logging

**Custom Hooks:**
- Purpose: Reusable component logic and camera/texture utilities
- Examples: `useDebounce`, `useTreeState`, `useCameraAnimation`, `useProceduralTexture`
- Pattern: React hooks (useState, useEffect, useRef, custom)
- Responsibilities: State logic, API coordination, resource management

**DataLoader Class:**
- Purpose: Filesystem navigation and YAML parsing
- Examples: `terminal/data_loader.py`
- Pattern: Recursive directory traversal building location hierarchy
- Responsibilities: Load locations, maps, terminals, build tree structures

## Entry Points

**GM Console (Web UI for Game Master):**
- Location: `src/entries/GMConsole.tsx`
- Triggers: Direct browser navigation to `/gmconsole/`
- Responsibilities:
  - Displays location tree (collapsible hierarchy)
  - Controls active view (DISPLAY/SHOW buttons)
  - Manages broadcast messages
  - CHARON panel for AI interaction
  - Encounter panel for tactical maps

**Shared Terminal (Display for All Players):**
- Location: `src/entries/SharedConsole.tsx`
- Triggers: Direct browser navigation to `/terminal/`
- Responsibilities:
  - Polls ActiveView every 2 seconds for GM updates
  - Renders appropriate view (STANDBY, BRIDGE, ENCOUNTER, CHARON_TERMINAL, etc.)
  - Manages 3D map scenes (galaxy, system, orbit)
  - Coordinates state and transitions between views
  - Handles panel info display and typewriter effects

**Player Messages (Read-Only):**
- Location: `src/entries/PlayerConsole.tsx`
- Triggers: Direct browser navigation to `/messages/`
- Responsibilities: Display broadcast messages in typewriter style

**Django View Functions:**
- Locations: `terminal/views.py` (50+ endpoints)
- Triggers: HTTP requests from React services
- Responsibilities: Load data, update models, return JSON

## Error Handling

**Strategy:** Try-catch in services, error states in components, console logging

**Patterns:**

**API Error Handling (Services):**
```typescript
// src/services/gmConsoleApi.ts
async function getLocations(): Promise<Location[]> {
  try {
    const response = await api.get<Location[]>('/api/gm/locations/');
    return response.data;
  } catch (error) {
    console.error('Failed to load locations:', error);
    throw error;
  }
}
```

**Component Error States:**
```typescript
// src/entries/GMConsole.tsx
const [error, setError] = useState<string | null>(null);
try {
  const data = await gmConsoleApi.getLocations();
  setLocations(data);
  setError(null);
} catch (err) {
  setError('Failed to load data');
}
```

**R3F Error Boundaries:**
- Suspense with LoadingScene fallback for texture/data loading
- Error boundaries would wrap Suspense (not currently implemented)
- useFrame errors logged to console, scene continues rendering

**Backend Error Responses:**
- Django views return JsonResponse with `success: false` on errors
- HTTP status codes (500, 404) for critical failures
- Messages logged via console.error

## Cross-Cutting Concerns

**Logging:**
- Frontend: console.log/error for debugging, no structured logging
- Backend: Django logging framework (configured in settings.py)
- R3F: Special timing logs in transitionCoordinator (console.warn on timeout)

**Validation:**
- Frontend: TypeScript types prevent invalid data shapes
- Backend: Django models enforce field types and choices
- API response validation: Light (TypeScript types as safety net)
- Frontend form validation: Ant Design Form component validation rules

**Authentication:**
- Backend: Django auth (User model), login_required decorator
- Frontend: No token-based auth (uses Django session cookies)
- Public endpoints: marked with @csrf_exempt (terminal display, messages)
- GM endpoints: Protected with view-level permission checks (not role-based yet)

**Performance:**
- Frontend: React.memo on expensive components, useCallback for handlers
- Zustand selectors prevent unnecessary re-renders
- R3F: frameloop='demand' when paused, render-on-demand when static
- Canvas: antialias: true, powerPreference: 'high-performance'
- Polling: 2-5 second intervals (reasonable tradeoff for real-time feel)

**Consistency:**
- Single source of truth: Zustand store for all 3D state
- Declarative rendering: R3F components sync with store
- Backend state: ActiveView model is single source of view type
- No prop drilling: Zustand hooks used directly in nested components

