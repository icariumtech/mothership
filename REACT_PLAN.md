# React Migration Plan for Mothership CHARON

## Executive Summary

This is an AI-executable plan for migrating from Django templates to React.js. This plan is designed for Claude Code to execute autonomously, with concrete steps, file paths, and validation criteria.

**Key Goals:**
- ✅ Eliminate code duplication (message rendering duplicated 3x, panels duplicated 2x)
- ✅ Create reusable components (navigation, panels, forms, messages)
- ✅ Keep UI functional at every migration step
- ✅ Migrate incrementally (small chunks, always deployable)
- ✅ Improve code organization and maintainability

**Strategy:** Islands Architecture - React components embedded in Django templates as independent "islands"

**Execution Approach:** Each phase is a complete, testable unit with validation steps to verify success before proceeding to the next phase

---

## Progress Summary

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0 | ✅ COMPLETE | Foundation Setup (Vite, TypeScript, React) |
| Phase A | ✅ COMPLETE | Shared Console Layout Shell (Header, Standby, Dashboard) |
| Phase B | ✅ COMPLETE | Dashboard Logic (Star system interaction, info panels) |
| Phase C | ✅ COMPLETE | Galaxy Map (Three.js TypeScript class with React wrapper) |
| Phase D | ✅ COMPLETE | System Map (Planet orbits, navigation) |
| Phase E | 🔲 PENDING | Orbit Map (Planet detail view) |
| Phase F | 🔲 PENDING | Message System Migration |

---

## AI Execution Strategy

### How This Plan Works

This plan is designed for **Claude Code (me) to execute autonomously**. Each phase contains:
- **Exact file paths** - No ambiguity about what files to create/modify
- **Complete code snippets** - Copy-paste ready code for all components
- **Validation steps** - How to verify each step succeeded
- **Explicit commands** - Exact bash commands to run
- **References to existing code** - Line numbers to read for extracting styles/logic

### Execution Philosophy

1. **One phase at a time** - Complete Phase 0, get approval, then Phase 1, etc.
2. **Match existing styling exactly** - Extract CSS from templates, never invent new styles
3. **Preserve functionality** - Comment out Django code instead of deleting (easy rollback)
4. **Test at every step** - Run `npm run build` and visually verify in browser
5. **Ask for approval** - Explicitly request user approval before starting each new phase

### Phase Completion Criteria

Each phase ends with "STOP HERE and get user approval before proceeding to Phase X"

Before asking for approval, I must:
- ✅ Complete all steps in the phase
- ✅ Run all validation commands
- ✅ Verify app still works in browser
- ✅ Confirm no TypeScript errors
- ✅ Confirm styling matches original pixel-perfect

### Later Phases (2-5) Planning

Phases 2-5 are outlined at high level only. After completing each phase, I will:
1. Create detailed execution steps for the next phase
2. Extract exact CSS and JavaScript from templates
3. Write complete code snippets
4. Add validation steps
5. Get user approval before executing

This iterative approach allows us to learn from each phase and adjust the plan as needed.

---

## Current State Analysis

### Code Duplication Issues

| Component | Duplicated | Impact | LOC |
|-----------|-----------|---------|-----|
| Message rendering | 3 templates | HIGH | ~300 lines |
| Panel architecture | 2 templates | HIGH | ~200 lines |
| Scrollbar styling | 5+ locations | MEDIUM | ~100 lines |
| Navigation header | All templates | MEDIUM | ~80 lines |
| Form components | 3-4 templates | MEDIUM | ~60 lines |
| Tree view logic | 1 template (inline JS) | HIGH | ~285 lines |
| Three.js maps | 1 template (inline JS) | HIGH | ~1,600 lines |

**Total Estimated Reduction:** ~2,600+ lines of duplicated code → ~1,000 lines of reusable React components

### JavaScript Organization

- **Location:** All JavaScript is inline in HTML templates (no separate .js files)
- **Total:** ~3,000 lines of inline JavaScript
- **Complexity:** High (complex Three.js visualizations, state management, polling)
- **Main Issues:**
  - Difficult to test
  - Hard to maintain
  - No code reuse between templates
  - Poor IDE support

### Current Architecture

```
Django Backend
├── URL Routing (/gmconsole/, /terminal/, /messages/)
├── Template Rendering (8 HTML templates)
├── 5 JSON REST APIs (no authentication currently)
└── File-based data (YAML) via DataLoader

Frontend (Inline in Templates)
├── Message polling (~200 lines duplicated)
├── GM Console tree navigation (~285 lines)
├── Galaxy Map (Three.js, ~700 lines)
├── System Map (Three.js, ~900 lines)
└── Standby animations (~250 lines)
```

---

## Migration Strategy: Islands Architecture

### Core Concept

React components will be embedded as "islands" within Django templates. This allows:

✅ **Incremental migration** - One component at a time
✅ **Parallel development** - New features in React, old features stay Django
✅ **No big-bang rewrite** - Application stays functional throughout
✅ **Django still handles:** routing, auth, initial page load, data loading

### Integration Pattern

```html
<!-- Django Template (e.g., gm_console.html) -->
{% extends 'terminal/base.html' %}

{% block content %}
<!-- React mount point -->
<div id="gm-console-root"></div>

<!-- Pass Django context to React -->
<script>
  window.INITIAL_DATA = {
    locations: {{ locations|safe }},
    activeView: {{ active_view|safe }},
    csrfToken: "{{ csrf_token }}"
  };
</script>

<!-- Load React bundle -->
<script type="module" src="{% static 'js/gm-console.bundle.js' %}"></script>
{% endblock %}
```

---

## Component Hierarchy

### Foundation Components (Reusable UI Primitives)

```
src/components/ui/
├── Panel.tsx              # Chamfered panel (eliminates 2x duplication)
├── Button.tsx             # Amber/teal styled buttons
├── Input.tsx              # Terminal-styled form inputs
├── Select.tsx             # Terminal-styled dropdown
├── Textarea.tsx           # Terminal-styled text area
├── Scrollbar.tsx          # Custom floating scrollbar wrapper
└── TreeView/              # Collapsible tree components
    ├── TreeItem.tsx
    ├── TreeToggle.tsx
    └── TreeConnector.tsx
```

### Layout Components

```
src/components/layout/
├── TerminalHeader.tsx     # Top navigation (eliminates duplication across all templates)
└── ViewContainer.tsx      # Main content wrapper
```

### Domain Components

```
src/components/domain/
├── messages/
│   ├── MessageList.tsx    # Reusable message list (eliminates 3x duplication)
│   ├── MessageItem.tsx    # Single message card
│   ├── MessageForm.tsx    # Broadcast message form
│   └── SenderSidebar.tsx  # Sender filter sidebar
│
├── locations/
│   ├── LocationTree.tsx   # GM Console tree view (replaces ~285 lines inline JS)
│   ├── LocationNode.tsx   # Single tree node
│   ├── TerminalNode.tsx   # Terminal node in tree
│   └── ViewControlButtons.tsx
│
├── maps/
│   ├── GalaxyMap.tsx      # Three.js galaxy (replaces ~700 lines inline JS)
│   ├── SystemMap.tsx      # Three.js system (replaces ~900 lines inline JS)
│   ├── OrbitMap.tsx       # Three.js orbit visualization
│   └── SystemInfoPanel.tsx
│
└── dashboard/
    ├── CampaignDashboard.tsx
    ├── CrewPanel.tsx
    ├── MissionsPanel.tsx
    └── ShipStatusPanel.tsx
```

### Custom Hooks (Business Logic)

```
src/hooks/
├── useActiveView.ts       # Poll /api/active-view/ (2-second interval)
├── useMessages.ts         # Poll /api/messages/ (2-second interval)
├── useLocations.ts        # Manage location tree state
├── useTreeState.ts        # LocalStorage tree expansion persistence
├── useThreeScene.ts       # Three.js scene setup and cleanup
└── useViewSwitch.ts       # Handle view switching (POST with CSRF)
```

### API Services

```
src/services/
├── api.ts                 # Axios instance with CSRF token handling
├── viewApi.ts             # Active view endpoints
├── messageApi.ts          # Message endpoints
├── mapApi.ts              # Star/system/orbit map endpoints
└── locationApi.ts         # Location data (if needed)
```

---

## 12-Week Migration Plan

### Phase 0: Foundation Setup

**Goal:** Set up React infrastructure without breaking existing functionality

**Execution Steps:**

#### Step 0.1: Initialize Node.js Project
```bash
# Run from project root: /home/gjohnson/mothership/charon
npm init -y
```

**Validation:** Check that `package.json` exists in project root

#### Step 0.2: Install Dependencies
```bash
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript
npm install -D @types/react @types/react-dom
npm install axios three @react-three/fiber @react-three/drei gsap
npm install -D @types/three
```

**Validation:** Check that `package.json` has all dependencies listed

#### Step 0.3: Create TypeScript Config
**File:** `tsconfig.json` (project root)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@hooks/*": ["./src/hooks/*"],
      "@services/*": ["./src/services/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**File:** `tsconfig.node.json` (project root)
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

**Validation:** Run `npx tsc --noEmit` (should succeed with no errors once src/ exists)

#### Step 0.4: Create Vite Config
**File:** `vite.config.ts` (project root)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/static/',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
    }
  },

  build: {
    outDir: 'terminal/static/js',
    emptyOutDir: false,

    rollupOptions: {
      input: {
        'message-list': './src/entries/MessageList.tsx',
      },

      output: {
        entryFileNames: '[name].bundle.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      }
    },

    minify: 'terser',
    sourcemap: true,
  },

  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/gmconsole': 'http://127.0.0.1:8000',
    }
  }
})
```

**Validation:** File created successfully

#### Step 0.5: Create Directory Structure
```bash
mkdir -p src/components/ui
mkdir -p src/components/layout
mkdir -p src/components/domain/messages
mkdir -p src/components/domain/locations
mkdir -p src/components/domain/maps
mkdir -p src/components/domain/dashboard
mkdir -p src/hooks
mkdir -p src/services
mkdir -p src/entries
mkdir -p src/types
mkdir -p src/styles
```

**Validation:** All directories exist

#### Step 0.6: Extract CSS Variables
**Read existing CSS from:** `terminal/templates/terminal/base.html`

**Create File:** `src/styles/variables.css`
```css
:root {
  --color-teal: #4a6b6b;
  --color-teal-bright: #5a7a7a;
  --color-amber: #8b7355;
  --color-amber-bright: #9a8065;
  --color-bg-primary: #0a0a0a;
  --color-bg-secondary: #1a1a1a;
  --color-bg-panel: #1a2525;
  --color-bg-panel-dark: #0f1515;
  --color-text-primary: #9a9a9a;
  --color-text-secondary: #7a7a7a;
  --color-text-muted: #5a5a5a;
  --color-border-main: #4a6b6b;
  --color-border-subtle: #2a3a3a;
  --color-active: #8b7355;
}
```

**Validation:** File created with all CSS variables extracted from base.html

#### Step 0.7: Create Panel Component (Foundation)
**File:** `src/components/ui/Panel.tsx`

**Must preserve exact styling from:** `terminal/templates/terminal/gm_console.html` (lines 9-106, panel architecture)

```typescript
import React, { ReactNode } from 'react';
import './Panel.css';

interface PanelProps {
  title?: string;
  children: ReactNode;
  isActive?: boolean;
  className?: string;
  chamferCorners?: ('tl' | 'tr' | 'bl' | 'br')[];
}

export function Panel({
  title,
  children,
  isActive = false,
  className = '',
  chamferCorners = ['tl', 'br']
}: PanelProps) {
  const chamferClasses = chamferCorners.map(c => `chamfer-${c}`).join(' ');

  return (
    <div className={`panel-wrapper ${chamferClasses} ${isActive ? 'active' : ''} ${className}`}>
      {title && (
        <div className="panel-header">
          <h3>{title}</h3>
        </div>
      )}
      <div className="panel-content">
        {children}
      </div>
    </div>
  );
}
```

**File:** `src/components/ui/Panel.css`
```css
@import '../../styles/variables.css';

.panel-wrapper {
  background-color: var(--color-bg-panel);
  position: relative;
  display: flex;
  flex-direction: column;

  /* Base clip-path (will be overridden by specific chamfer classes) */
  clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);

  /* Borders using box-shadow */
  box-shadow:
    inset 0 2px 0 0 var(--color-border-main),
    inset -2px 0 0 0 var(--color-border-main),
    inset 0 -2px 0 0 var(--color-border-main),
    inset 2px 0 0 0 var(--color-border-main);
}

.panel-wrapper.active {
  box-shadow:
    inset 0 2px 0 0 var(--color-teal-bright),
    inset -2px 0 0 0 var(--color-teal-bright),
    inset 0 -2px 0 0 var(--color-teal-bright),
    inset 2px 0 0 0 var(--color-teal-bright);
}

/* Diagonal corner lines */
.panel-wrapper.chamfer-tl::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 12px;
  height: 12px;
  background: linear-gradient(
    to bottom right,
    transparent calc(50% - 2px),
    var(--color-border-main) calc(50% - 2px),
    var(--color-border-main) calc(50% + 2px),
    transparent calc(50% + 2px)
  );
}

.panel-wrapper.chamfer-br::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background: linear-gradient(
    to bottom right,
    transparent calc(50% - 2px),
    var(--color-border-main) calc(50% - 2px),
    var(--color-border-main) calc(50% + 2px),
    transparent calc(50% + 2px)
  );
}

/* Panel header */
.panel-header {
  padding: 12px 2px 0 2px;
  flex-shrink: 0;
}

.panel-header h3 {
  color: var(--color-teal);
  font-size: 13px;
  letter-spacing: 2px;
  margin: 0;
  padding: 0 10px 5px 10px;
  border-bottom: 1px solid var(--color-border-subtle);
  font-family: 'Cascadia Code', 'Courier New', monospace;
}

/* Scrollable content */
.panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
  margin: 2px 5px 2px 2px;
  background-color: #171717;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 2px,
    #1a1a1a 2px,
    #1a1a1a 3px
  );
  color: var(--color-text-primary);
  font-size: 12px;
  line-height: 1.6;
}

/* Custom scrollbar */
.panel-content::-webkit-scrollbar {
  width: 10px;
}

.panel-content::-webkit-scrollbar-track {
  background: #171717;
  background-image: repeating-linear-gradient(
    to bottom,
    transparent,
    transparent 2px,
    #1a1a1a 2px,
    #1a1a1a 3px
  );
  border: none;
  margin-top: 2px;
  margin-bottom: 2px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #0f1515;
  border: 1px solid #4a6b6b;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: #1a2525;
}

.panel-content::-webkit-scrollbar-button {
  display: none;
}
```

**Validation:**
- Run `npm run build` and verify no TypeScript errors
- Visually inspect that Panel CSS matches existing design

#### Step 0.8: Create Test Entry Point
**File:** `src/entries/TestPanel.tsx`
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Panel } from '@components/ui/Panel';

function TestApp() {
  return (
    <Panel title="TEST PANEL">
      <p>If you can see this, React is working!</p>
    </Panel>
  );
}

const root = document.getElementById('test-panel-root');
if (root) {
  ReactDOM.createRoot(root).render(<TestApp />);
}
```

Update `vite.config.ts` input to include:
```typescript
input: {
  'test-panel': './src/entries/TestPanel.tsx',
},
```

#### Step 0.9: Test in Django Template
**Edit:** `terminal/templates/terminal/gm_console.html`

Add after the existing content (temporarily, for testing):
```html
<!-- REACT TEST - REMOVE AFTER VALIDATION -->
<div id="test-panel-root" style="margin: 20px; width: 400px; height: 200px;"></div>
<script type="module" src="{% static 'js/test-panel.bundle.js' %}"></script>
```

**Commands to run:**
```bash
npm run build
python manage.py collectstatic --noinput
python manage.py runserver
```

**Validation:**
- Visit http://127.0.0.1:8000/gmconsole/
- Verify "TEST PANEL" appears with correct styling
- Verify chamfered corners match existing panels
- Verify scrollbar styling matches

**After validation, remove test code from template**

#### Step 0.10: Add npm Scripts
**Edit:** `package.json` to add scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  }
}
```

**Deliverables:**
- [x] All dependencies installed
- [x] Vite build pipeline working
- [x] TypeScript compilation successful
- [x] Panel component renders with correct styling
- [x] React successfully embedded in Django template

**Risk:** LOW - No existing functionality touched (test code is isolated)

**STATUS: ✅ COMPLETE**

---

### Phase A: Shared Console Layout Shell (COMPLETE)

**Goal:** Convert shared_console.html layout to React components

**Completed Components:**

#### TerminalHeader Component
**File:** `src/components/layout/TerminalHeader.tsx`
- Fixed navigation bar with title/subtitle
- Right-side text support
- Hidden mode for standby view
- Matches existing terminal header styling

#### StandbyView Component
**File:** `src/components/domain/dashboard/StandbyView.tsx`
- Animated glitch logo with CSS keyframes
- Floating text blocks with typewriter effect
- Random positioning and timing
- Matches original standby animation behavior

#### CampaignDashboard Component
**File:** `src/components/domain/dashboard/CampaignDashboard.tsx`
- 5-panel grid layout (top, left x2, right x2)
- Crew, Notes, Star Map, and Status panels
- Star system list with selection state
- System map navigation buttons
- Reusable DashboardPanel sub-component

#### SharedConsole Entry Point
**File:** `src/entries/SharedConsole.tsx`
- Main entry point for React terminal
- Polls `/api/active-view/` every 2 seconds
- Switches between STANDBY and CAMPAIGN_DASHBOARD views
- Accepts initial data from Django via `window.INITIAL_DATA`

#### Django Integration
**Files:**
- `terminal/templates/terminal/shared_console_react.html` - React template
- `terminal/views.py` - `display_view_react()` view function
- `terminal/urls.py` - Route at `/terminal/react/`

**Build Output:**
- `terminal/static/js/shared-console.bundle.js`
- `terminal/static/js/assets/style.css`
- `terminal/static/js/chunks/client-[hash].js`

**Test URL:** http://127.0.0.1:8000/terminal/react/

**Deliverables:**
- [x] TerminalHeader component
- [x] StandbyView with glitch animations
- [x] CampaignDashboard 5-panel layout
- [x] View switching based on active view API
- [x] Django template integration
- [x] Build pipeline outputting correct bundles

**STATUS: ✅ COMPLETE**

---

### Phase B: Dashboard Logic (COMPLETE)

**Goal:** Wire up star system interaction and info panels

**Completed Components:**

#### useTypewriter Hook
**File:** `src/hooks/useTypewriter.ts`
- Character-by-character typing animation
- Inline cursor at end of typed text (not on separate line)
- HTML tag preservation during animation
- Configurable speed and cursor character
- Sequence tracking to prevent race conditions

#### InfoPanel Component (Generic/Reusable)
**File:** `src/components/domain/dashboard/InfoPanel.tsx`
- Generic floating info panel with typewriter effect
- Props: `title`, `content`, `visible`, `showDecorators`, `typewriterSpeed`
- Triangle decoration positioned dynamically below panel
- ResizeObserver for responsive positioning

**Helper Functions for Content Building:**
- `buildInfoHTML(fields)` - Generic field builder
- `buildSystemInfoHTML(system)` - Star systems
- `buildPlanetInfoHTML(planet)` - Planets
- `buildMoonInfoHTML(moon)` - Moons
- `buildStationInfoHTML(station)` - Stations/facilities
- `buildSurfaceMarkerInfoHTML(marker)` - Surface locations

#### Star System Selection
- Click star system row to select/deselect
- Visual feedback (checkbox fill, amber highlight)
- Info panel displays selected system data

#### Star Map API Integration
- Fetches `/api/star-map/` on mount
- Builds star systems list from API data
- Memoized content building to prevent re-renders
- API enhanced with `has_system_map` field (checks for `system_map.yaml` existence)

#### Star System Row Styling (Refined)
- Drill-down arrow button fills full height of row (right side)
- Taller buttons (12px vertical padding)
- Wider arrow section (18px horizontal padding)
- Teal background/border for arrow button, amber icon
- Arrow only shown for systems with `has_system_map: true`

**Files Created:**
- `src/hooks/useTypewriter.ts`
- `src/components/domain/dashboard/InfoPanel.tsx`
- `src/components/domain/dashboard/InfoPanel.css`

**Files Modified:**
- `src/entries/SharedConsole.tsx` - API fetch, selection state, InfoPanel integration
- `src/components/domain/dashboard/CampaignDashboard.css` - Star system row styling
- `terminal/views.py` - Added `has_system_map` field to star-map API

**Deliverables:**
- [x] useTypewriter hook with inline cursor
- [x] Generic InfoPanel component (reusable for planets, moons, stations)
- [x] Star system selection with visual feedback
- [x] Info panel with typewriter animation
- [x] Triangle decoration (indicator boxes/rectangle removed per user preference)
- [x] API integration for star map data
- [x] Drill-down button styling (full-height, teal bg, amber icon)
- [x] `has_system_map` API field for conditional arrow display

**STATUS: ✅ COMPLETE**

---

### Phase C: Galaxy Map (COMPLETE)

**Goal:** Extract Three.js galaxy map from inline HTML to modular TypeScript with React wrapper

**Approach:** Extract & Wrap (Option B) - Keep existing Three.js logic, extract to TypeScript class, wrap in React component

**Completed Components:**

#### GalaxyScene TypeScript Class
**File:** `src/three/GalaxyScene.ts` (~800 lines)
- Extracted all galaxy visualization logic from shared_console.html
- Creates Three.js scene, camera, renderer
- Generates procedural star textures (starburst with additive blending)
- Renders star systems with labels and selection reticles
- Animates nebulae (emission pulsing, reflection shimmer, planetary rotation)
- Draws travel routes with gradient fade effect
- Handles camera controls (mouse drag, scroll zoom, touch gestures)
- Auto-rotation with 5-second inactivity resume
- Proper cleanup via dispose() method

#### StarMapData Types
**File:** `src/types/starMap.ts`
- TypeScript interfaces for API data structures
- `StarSystem`, `TravelRoute`, `Nebula`, `CameraConfig`, `StarMapData`

#### GalaxyMap React Wrapper
**File:** `src/components/domain/maps/GalaxyMap.tsx`
- React wrapper managing Three.js lifecycle
- Props: `data`, `selectedSystem`, `onSystemSelect`, `visible`
- useEffect hooks for initialization, data loading, selection sync
- Proper cleanup on unmount

**Files Created:**
- `src/types/starMap.ts` - TypeScript types
- `src/three/GalaxyScene.ts` - Three.js class (~800 lines)
- `src/components/domain/maps/GalaxyMap.tsx` - React wrapper
- `src/components/domain/maps/GalaxyMap.css` - Container styling

**Files Modified:**
- `src/entries/SharedConsole.tsx` - Integrated GalaxyMap component

**Build Output:**
- `terminal/static/js/shared-console.bundle.js` (539 KB, 134 KB gzipped)
- Note: Bundle size increase due to Three.js inclusion

**Deliverables:**
- [x] GalaxyScene TypeScript class with full functionality
- [x] Star rendering with procedural textures
- [x] Nebulae animations (pulsing, shimmer, rotation)
- [x] Travel routes with fade effect
- [x] Camera controls (mouse drag, scroll zoom, touch)
- [x] Auto-rotation with inactivity detection
- [x] System selection with targeting reticle
- [x] React wrapper with proper lifecycle management
- [x] TypeScript types for API data

**STATUS: ✅ COMPLETE**

---

### Phase D: System Map (COMPLETE)

**Goal:** Extract Three.js system map from inline HTML to modular TypeScript with React wrapper

**Approach:** Extract & Wrap - Keep existing Three.js logic, extract to TypeScript class, wrap in React component

**Completed Components:**

#### SystemScene TypeScript Class
**File:** `src/three/SystemScene.ts` (~900 lines)
- Extracted system map visualization logic from shared_console.html
- Creates Three.js scene, camera, renderer
- Renders central star with glow effect and point light
- Renders planets as teal-outlined circle sprites
- Draws orbital paths with configurable color/opacity
- Animates planets along their orbits with inclination
- Handles camera controls (mouse drag, scroll zoom, touch gestures)
- Selection reticle for selected planets
- Camera tracking follows selected planet as it orbits
- GSAP-powered camera animations for smooth zoom transitions
- Proper cleanup via dispose() method

#### SystemMapData Types
**File:** `src/types/systemMap.ts`
- TypeScript interfaces for API data structures
- `StarData`, `BodyData`, `OrbitSettings`, `CameraConfig`, `SystemMapData`
- `PlanetRenderData` for internal animation state
- `SystemSceneCallbacks` for event handling

#### SystemMap React Wrapper
**File:** `src/components/domain/maps/SystemMap.tsx`
- React wrapper managing Three.js lifecycle
- Props: `systemSlug`, `selectedPlanet`, `onPlanetSelect`, `onOrbitMapNavigate`, `onBackToGalaxy`, `onSystemLoaded`
- useEffect hooks for initialization, system loading, selection sync
- Exposes `systemMapSelectPlanet` function via window for menu integration
- Proper cleanup on unmount

#### CampaignDashboard Updates
**File:** `src/components/domain/dashboard/CampaignDashboard.tsx`
- Added `mapViewMode` prop to switch between galaxy/system/orbit views
- Added planet list rendering for system view mode
- Added "BACK TO GALAXY" button with amber styling
- Reuses star system row styling for planets

#### SharedConsole Integration
**File:** `src/entries/SharedConsole.tsx`
- Added map view mode state (`galaxy`, `system`, `orbit`)
- Added system slug and planet selection state
- Conditional rendering of GalaxyMap vs SystemMap
- Info panel content adapts to show system star info or selected planet info
- Menu panel content adapts to show star systems or planets

**Files Created:**
- `src/types/systemMap.ts` - TypeScript types
- `src/three/SystemScene.ts` - Three.js class (~900 lines)
- `src/components/domain/maps/SystemMap.tsx` - React wrapper

**Files Modified:**
- `src/entries/SharedConsole.tsx` - Integrated SystemMap, added view mode state
- `src/components/domain/dashboard/CampaignDashboard.tsx` - Added system view props
- `src/components/domain/dashboard/InfoPanel.tsx` - Already had buildPlanetInfoHTML

**Build Output:**
- `terminal/static/js/shared-console.bundle.js` (637 KB, 169 KB gzipped)
- Note: Bundle size increase due to Two Three.js scenes

**Deliverables:**
- [x] SystemScene TypeScript class with full functionality
- [x] Star rendering with glow effect
- [x] Planet rendering with teal circle sprites
- [x] Orbital animations with inclination
- [x] Camera controls (mouse drag, scroll zoom, touch)
- [x] Planet selection with targeting reticle
- [x] Camera tracking follows selected planet
- [x] GSAP camera animations for smooth transitions
- [x] React wrapper with proper lifecycle management
- [x] Navigation from galaxy to system view
- [x] "BACK TO GALAXY" button
- [x] Planet list in menu panel
- [x] TypeScript types for API data

**STATUS: ✅ COMPLETE**

---

### Phase E: Orbit Map (PENDING)

**Goal:** Extract orbit map logic to OrbitScene.ts

**Components to Implement:**
- OrbitScene TypeScript class
- Planet detail view with textured sphere
- Moons with orbital paths and animations
- Orbital stations with sprite rendering
- Surface markers with lat/lon positioning
- Visibility culling for far-side markers
- Targeting reticle and camera tracking
- Camera pause when surface marker selected
- Element selection from menu
- OrbitMap React wrapper

**STATUS: 🔲 PENDING**

---

### Phase F: Message System Migration (DEFERRED)

**Goal:** Migrate message rendering to React (eliminates 3x duplication)

**Why First?** Messages are self-contained and have the most duplication across 3 templates.

**Execution Steps:**

#### Step 1.1: Create Type Definitions
**File:** `src/types/message.ts`
```typescript
export interface Message {
  id: number;
  sender: string;
  content: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  created_at: string;
}

export interface MessageResponse {
  messages: Message[];
  count: number;
}
```

**Validation:** File created

#### Step 1.2: Create API Service
**File:** `src/services/api.ts`
```typescript
import axios from 'axios';

function getCSRFToken(): string {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1] || '';
}

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(config => {
  if (config.method === 'post') {
    config.headers['X-CSRFToken'] = getCSRFToken();
  }
  return config;
});
```

**File:** `src/services/messageApi.ts`
```typescript
import { api } from './api';
import { MessageResponse } from '@/types/message';

export async function getMessages(sinceId?: number): Promise<MessageResponse> {
  const params = sinceId ? { since: sinceId } : {};
  const response = await api.get<MessageResponse>('/messages/', { params });
  return response.data;
}
```

**Validation:** Files created, TypeScript compiles

#### Step 1.3: Create useMessages Hook
**File:** `src/hooks/useMessages.ts`

**Reference existing polling logic from:** `terminal/templates/terminal/player_console.html` (lines 225-246)

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Message } from '@/types/message';
import { getMessages } from '@/services/messageApi';

export function useMessages(pollInterval: number = 2000) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [lastMessageId, setLastMessageId] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await getMessages(lastMessageId);
      if (data.count > 0) {
        setMessages(prev => [...data.messages, ...prev]);
        const maxId = Math.max(...data.messages.map(m => m.id));
        setLastMessageId(maxId);
      }
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch messages:', err);
    }
  }, [lastMessageId]);

  useEffect(() => {
    fetchMessages(); // Initial fetch
    const interval = setInterval(fetchMessages, pollInterval);
    return () => clearInterval(interval);
  }, [fetchMessages, pollInterval]);

  return { messages, error };
}
```

**Validation:** TypeScript compiles, hook logic matches existing polling

#### Step 1.4: Create MessageItem Component
**File:** `src/components/domain/messages/MessageItem.tsx`

**Must match styling from:** `terminal/templates/terminal/player_console.html` (lines 140-153)

```typescript
import React from 'react';
import { Message } from '@/types/message';
import './MessageItem.css';

interface MessageItemProps {
  message: Message;
  isNew?: boolean;
}

export function MessageItem({ message, isNew = false }: MessageItemProps) {
  const priorityClass = `priority-${message.priority}`;
  const newClass = isNew ? 'new-message' : '';

  return (
    <div className={`message ${newClass}`} data-message-id={message.id}>
      <div className="message-header">
        <span className="message-sender">{message.sender}</span>
        <span className={`priority-indicator ${priorityClass}`}>
          {message.priority}
        </span>
        <span className="message-time">{message.created_at}</span>
      </div>
      <div className="message-content">{message.content}</div>
    </div>
  );
}
```

**File:** `src/components/domain/messages/MessageItem.css`

**Extract exact CSS from:** `terminal/templates/terminal/player_console.html` (lines 78-120)

```css
@import '../../../styles/variables.css';

.message {
  padding: 15px;
  margin-bottom: 12px;
  background-color: var(--color-bg-panel-dark);
  border-left: 3px solid var(--color-border-main);
  font-family: 'Cascadia Code', 'Courier New', monospace;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 11px;
}

.message-sender {
  color: var(--color-teal-bright);
  font-weight: bold;
  letter-spacing: 1px;
}

.message-time {
  color: var(--color-text-muted);
  font-size: 10px;
}

.priority-indicator {
  padding: 2px 8px;
  font-size: 10px;
  letter-spacing: 1px;
  border-radius: 2px;
}

.priority-LOW {
  background-color: rgba(74, 107, 107, 0.3);
  color: #7a9a9a;
}

.priority-NORMAL {
  background-color: rgba(139, 115, 85, 0.3);
  color: #9a8065;
}

.priority-HIGH {
  background-color: rgba(139, 85, 85, 0.3);
  color: #b89090;
}

.priority-CRITICAL {
  background-color: rgba(180, 60, 60, 0.5);
  color: #ff9090;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.message-content {
  color: var(--color-text-primary);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.new-message {
  animation: slideIn 0.3s ease-out;
  border-left-color: var(--color-amber-bright);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Validation:** CSS matches existing message styling pixel-perfect

#### Step 1.5: Create MessageList Component
**File:** `src/components/domain/messages/MessageList.tsx`

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { MessageItem } from './MessageItem';
import { useMessages } from '@/hooks/useMessages';
import './MessageList.css';

export function MessageList() {
  const { messages, error } = useMessages(2000);
  const [newMessageIds, setNewMessageIds] = useState<Set<number>>(new Set());
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      // New messages arrived
      const newIds = new Set(messages.slice(0, messages.length - prevMessageCountRef.current).map(m => m.id));
      setNewMessageIds(newIds);

      // Remove "new" indicator after 3 seconds
      setTimeout(() => {
        setNewMessageIds(new Set());
      }, 3000);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  if (error) {
    return <div className="message-error">Error loading messages</div>;
  }

  return (
    <div className="message-list">
      {messages.map(message => (
        <MessageItem
          key={message.id}
          message={message}
          isNew={newMessageIds.has(message.id)}
        />
      ))}
    </div>
  );
}
```

**File:** `src/components/domain/messages/MessageList.css`
```css
.message-list {
  display: flex;
  flex-direction: column;
}

.message-error {
  padding: 20px;
  color: #ff9090;
  text-align: center;
  font-family: 'Cascadia Code', 'Courier New', monospace;
}
```

**Validation:** Component compiles, logic handles real-time updates

#### Step 1.6: Create Entry Point
**File:** `src/entries/MessageList.tsx`
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MessageList } from '@components/domain/messages/MessageList';

const root = document.getElementById('message-list-root');
if (root) {
  ReactDOM.createRoot(root).render(<MessageList />);
}
```

Update `vite.config.ts`:
```typescript
input: {
  'test-panel': './src/entries/TestPanel.tsx',
  'message-list': './src/entries/MessageList.tsx',
},
```

**Validation:** Build succeeds: `npm run build`

#### Step 1.7: Integrate into player_console.html
**File:** `terminal/templates/terminal/player_console.html`

**Find and comment out** (lines ~138-156):
```html
<!-- DJANGO VERSION - BACKUP (remove after validation)
<div class="messages">
  {% for message in messages %}
    <div class="message" data-message-id="{{ message.id }}">
      <div class="message-header">
        <span class="message-sender">{{ message.sender }}</span>
        <span class="priority-indicator priority-{{ message.priority }}">
          {{ message.priority }}
        </span>
        <span class="message-time">{{ message.created_at }}</span>
      </div>
      <div class="message-content">{{ message.content }}</div>
    </div>
  {% endfor %}
</div>
-->

<!-- REACT VERSION -->
<div id="message-list-root"></div>
<script type="module" src="{% static 'js/message-list.bundle.js' %}"></script>
```

**Commands:**
```bash
npm run build
python manage.py collectstatic --noinput
python manage.py runserver
```

**Validation:**
- Visit http://127.0.0.1:8000/messages/
- Verify messages display correctly
- Verify priority colors match original
- Verify new messages slide in with animation
- Wait 2 seconds and verify polling works (send a test message from GM console)

#### Step 1.8: Integrate into display.html
**File:** `terminal/templates/terminal/display.html`

**Repeat same pattern:** Comment out Django loop, add React mount point

**Validation:** Visit http://127.0.0.1:8000/terminal/ and verify messages display

#### Step 1.9: Remove Old Inline JavaScript
**Files to clean up:**
- `terminal/templates/terminal/player_console.html` (lines 225-283, remove old polling JS)
- `terminal/templates/terminal/display.html` (lines 348-410, remove old polling JS)

**After cleanup, verify app still works**

**Deliverables:**
- [ ] MessageItem component with correct styling
- [ ] MessageList component with polling
- [ ] useMessages hook working
- [ ] API service with CSRF token handling
- [ ] All 3 message views using React
- [ ] Real-time polling working (2-second interval)
- [ ] Animations match existing behavior

**Risk:** MEDIUM - CSRF token handling must work correctly

**STOP HERE and get user approval before proceeding to Phase 2**

---

### Phase 2: Location Tree Migration

**Goal:** Migrate GM Console location tree to React (eliminates ~285 lines of inline JS)

**Status:** TO BE PLANNED IN DETAIL after completing Phase 1

**High-Level Approach:**
- Extract tree CSS from `terminal/templates/terminal/gm_console.html` (lines 225-370)
- Build recursive LocationNode component
- Implement localStorage persistence for expansion state
- Handle Display/Show button clicks with CSRF
- Preserve exact tree styling and animations

**Templates to Modify:**
- `terminal/templates/terminal/gm_console.html` (lines 558-829 - tree view section)
- `terminal/templates/terminal/tree_location.html` (recursive include, will be replaced)

**Detailed execution steps will be created after Phase 1 is complete and validated.**

---

### Phase 3: Three.js Map Migration

**Goal:** Migrate Galaxy/System/Orbit maps to React Three Fiber (~1,600 lines of inline JS)

**Status:** TO BE PLANNED IN DETAIL after completing Phase 2

**High-Level Approach:**
- Install React Three Fiber: `npm install @react-three/fiber @react-three/drei`
- Extract Three.js logic from `terminal/templates/terminal/shared_console.html` (lines ~1703-3710)
- Convert imperative Three.js to declarative React Three Fiber components
- Preserve all functionality: Galaxy map, System map, Orbit map
- Maintain 60 FPS performance
- Keep touch controls working

**Why React Three Fiber:**
- Declarative API (easier to understand)
- Automatic cleanup (no memory leaks)
- React state integration (selected system, camera position)
- Better TypeScript support

**Risk:** HIGH - Complex Three.js logic, performance critical

**Detailed execution steps will be created after Phase 2 is complete.**

---

### Phase 4: Dashboard & Standby Views

**Goal:** Migrate Campaign Dashboard and Standby screen

**Status:** TO BE PLANNED IN DETAIL after completing Phase 3

**High-Level Approach:**
- Extract dashboard panel HTML from `terminal/templates/terminal/shared_console.html`
- Reuse Panel component from Phase 0
- Extract standby animation from `terminal/templates/terminal/shared_console.html` (lines ~1293-1510)
- Create React components for each dashboard panel

**Detailed execution steps will be created after Phase 3 is complete.**
- Character-by-character typing animation
- Glitch effects

**Templates to Modify:**
- `terminal/templates/terminal/shared_console.html` (dashboard and standby views)

**Success Criteria:**
- [ ] Dashboard panels layout correctly
- [ ] Standby animations match original
- [ ] Header auto-hide works in standby mode

**Risk:** LOW - Relatively simple components

---

### Phase 5: Optimization & Polish

**Status:** TO BE PLANNED IN DETAIL after completing Phase 4

**Goal:** Optimize API calls, code splitting, performance tuning

**Tasks:**

#### Week 11: API Optimization
1. Create unified polling hook (`usePolling`)
2. Optimize active view syncing
3. Add error handling and retry logic
4. Implement optimistic updates where appropriate

#### Week 12: Polish & Testing
1. Code splitting optimization (vendor, three, utils chunks)
2. Bundle size optimization (target: < 500KB gzipped)
3. Performance tuning (maintain 60 FPS)
4. E2E test suite (Cypress)
5. Documentation updates
6. Deployment preparation

**Success Criteria:**
- [ ] Bundle size < 500KB gzipped (all pages)
- [ ] Page load time < 2 seconds (Lighthouse)
- [ ] All E2E tests passing
- [ ] Documentation complete

**Risk:** LOW - Optimization and polish

---

## Build Setup: Vite

### Why Vite?

✅ Fast HMR (instant feedback during development)
✅ Simple config (less boilerplate than Webpack)
✅ TypeScript support built-in
✅ Tree shaking (smaller bundles)
✅ Modern ES modules (faster in browser)

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/static/',

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
    }
  },

  build: {
    outDir: 'terminal/static/js',
    emptyOutDir: false,

    rollupOptions: {
      input: {
        'gm-console': './src/pages/GMConsole.tsx',
        'shared-terminal': './src/pages/SharedTerminal.tsx',
        'player-console': './src/pages/PlayerConsole.tsx',
        'standby': './src/pages/StandbyScreen.tsx',
      },

      output: {
        entryFileNames: '[name].bundle.js',
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'three': ['three', '@react-three/fiber', '@react-three/drei'],
          'utils': ['axios', 'gsap'],
        }
      }
    },

    minify: 'terser',
    sourcemap: true,
  },

  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/gmconsole': 'http://127.0.0.1:8000',
    }
  }
})
```

### Development Workflow

```bash
# Terminal 1: Django dev server
python manage.py runserver

# Terminal 2: Vite dev server (auto-rebuild on file changes)
npm run dev

# Production build
npm run build
python manage.py collectstatic --noinput
```

---

## State Management: React Context API

### Why Not Redux?

For this application:
- ❌ Redux is overkill - no complex global state mutations
- ❌ Adds boilerplate (actions, reducers, types)
- ❌ Steeper learning curve

### Why React Context?

- ✅ Built-in - no extra dependencies
- ✅ Simple - easy to understand
- ✅ Sufficient - handles our use cases (active view, locations, messages)

### Context Structure

```typescript
// src/contexts/ActiveViewContext.tsx
interface ActiveViewContextValue {
  activeView: ActiveView | null;
  isLoading: boolean;
  error: Error | null;
  switchView: (locationSlug: string, viewType: string) => Promise<void>;
}

// src/contexts/LocationContext.tsx
interface LocationContextValue {
  locations: Location[];
  expandedNodes: Set<string>;
  toggleNode: (slug: string) => void;
  activeSlug: string | null;
}

// src/contexts/MessageContext.tsx
interface MessageContextValue {
  messages: Message[];
  unreadCount: number;
  sendMessage: (data: MessageData) => Promise<void>;
}
```

**Alternative:** If team prefers, can use **Zustand** (simpler state management library)

---

## API Strategy

### Existing APIs (Keep These)

```
GET  /api/active-view/              # Current display state (poll every 2s)
GET  /api/messages/?since={id}      # Broadcast messages (poll every 2s)
GET  /api/star-map/                 # Galaxy map data
GET  /api/system-map/{system_slug}  # Solar system data
GET  /api/orbit-map/{system}/{body} # Orbit map data
```

### New APIs Needed

```
# Convert POST redirects to JSON APIs
POST /api/view-switch/              # Switch active view (returns JSON, no redirect)
POST /api/broadcast-message/        # Send broadcast message (returns JSON)
POST /api/terminal-overlay/         # Show terminal overlay (returns JSON)

# Optional (if needed for React tree)
GET  /api/locations/                # All locations (cached)
```

### API Client Setup

```typescript
// src/services/api.ts
import axios from 'axios';

// Get CSRF token from cookie
function getCSRFToken(): string {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1] || '';
}

// Configure axios instance
export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Add CSRF token to all POST requests
api.interceptors.request.use(config => {
  if (config.method === 'post') {
    config.headers['X-CSRFToken'] = getCSRFToken();
  }
  return config;
});
```

---

## Testing Strategy

### Testing Pyramid

```
         /\
        /  \        E2E Tests (5%) - Cypress
       /____\       - Full user flows
      /      \
     /________\     Integration Tests (15%) - React Testing Library
    /          \    - Component + API integration
   /____________\
  /              \
 /________________\ Unit Tests (80%) - Vitest
                    - Component isolation
                    - Hook testing
                    - Fast feedback
```

### Test Coverage Goals

- **Unit Tests:** 80%+ coverage
- **Integration Tests:** All API interactions
- **E2E Tests:** Critical paths (GM sends message → player receives, map display)

### Example Tests

```typescript
// src/components/ui/Panel.test.tsx
describe('Panel', () => {
  it('renders with chamfered corners', () => {
    render(<Panel title="Test">Content</Panel>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});

// src/hooks/useActiveView.test.ts
describe('useActiveView', () => {
  it('polls every 2 seconds', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useActiveView());
    jest.advanceTimersByTime(2000);
    await waitFor(() => expect(result.current.activeView).toBeDefined());
  });
});
```

---

## Rollback & Risk Mitigation

### Rollback Strategy Per Phase

Each phase is independently reversible:

**Phase 1-2 (Components):** Comment out React mount point, uncomment Django template
**Phase 3 (Location Tree):** Revert to Django recursive include
**Phase 4 (Three.js Maps):** Restore inline script blocks

### Feature Flags (Optional)

```python
# settings.py
FEATURE_FLAGS = {
    'USE_REACT_MESSAGES': env.bool('USE_REACT_MESSAGES', default=False),
    'USE_REACT_LOCATION_TREE': env.bool('USE_REACT_LOCATION_TREE', default=False),
    'USE_REACT_MAPS': env.bool('USE_REACT_MAPS', default=False),
}
```

```html
<!-- Template with feature flag -->
{% if use_react_tree %}
  <div id="location-tree-root"></div>
  <script type="module" src="..."></script>
{% else %}
  <!-- Django template fallback -->
  <ul class="tree-view">...</ul>
{% endif %}
```

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Bundle size too large | Code splitting, lazy loading, tree shaking |
| CSRF token issues | Test early (Phase 1), detailed error logging |
| Three.js performance regression | Benchmark before/after, use InstancedMesh |
| Lost functionality | Keep Django templates as backup (commented) |

---

## Success Metrics

### Code Quality
- ✅ Reduce duplication from 3x message rendering to 1x
- ✅ Lines of code: Target 40% reduction (~3,600 → ~2,200 lines)
- ✅ Test coverage: Maintain 70%+ coverage

### Performance
- ✅ Page load time: < 2 seconds (Lighthouse)
- ✅ Bundle size: < 500KB gzipped (all pages)
- ✅ Three.js FPS: Maintain 60 FPS

### Developer Experience
- ✅ Hot reload: < 200ms (Vite HMR)
- ✅ Type safety: 100% TypeScript coverage
- ✅ Component reuse: 5+ reusable UI components

---

## Go/No-Go Decision Points

### After Week 1 (Foundation)
- ✅ Components render pixel-perfect
- ✅ Vite build pipeline working
- ✅ Django integration working

### After Week 3 (Messages)
- ✅ Message polling working
- ✅ CSRF tokens working
- ✅ No performance regression

### After Week 5 (Location Tree)
- ✅ Tree state persists correctly
- ✅ Display/Show buttons working

### After Week 8 (Three.js Maps)
- ✅ All maps rendering correctly
- ✅ Performance ≥ 60 FPS
- ✅ No memory leaks

---

## Critical Files to Modify

### Phase 1 (Messages)
- `terminal/templates/terminal/player_console.html` - Player message inbox
- `terminal/templates/terminal/display.html` - Public message display
- `terminal/templates/terminal/shared_console.html` - Terminal message rendering
- `terminal/templates/terminal/gm_console.html` - Message form

### Phase 2 (Location Tree)
- `terminal/templates/terminal/gm_console.html` - Tree view replacement
- `terminal/templates/terminal/tree_location.html` - No longer needed

### Phase 3 (Three.js Maps)
- `terminal/templates/terminal/shared_console.html` - Galaxy/System/Orbit maps (lines ~1703-3710)

### Phase 4 (Dashboard/Standby)
- `terminal/templates/terminal/shared_console.html` - Dashboard and standby views

### Backend (API Additions)
- `terminal/views.py` - Add new JSON API endpoints
- `terminal/urls.py` - Add new URL routes

---

## Dependencies to Install

```bash
npm init -y
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript
npm install -D @types/react @types/react-dom
npm install axios three @react-three/fiber @react-three/drei gsap
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D cypress
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint-config-prettier
```

---

## Next Steps

### Immediate Actions (Before Starting Implementation)

1. **Team Review**
   - Review this plan with all developers
   - Discuss React learning curve and training needs
   - Agree on timeline and priorities
   - Adjust phases if needed

2. **Proof of Concept**
   - Set up Vite and build first Panel component
   - Render it in gm_console.html template
   - Verify Django → React data flow works
   - Verify CSRF token handling works

3. **Training (if needed)**
   - React fundamentals (components, hooks, state)
   - React Three Fiber basics
   - TypeScript basics
   - Vite workflow

4. **Documentation**
   - Create component template for consistency
   - Document props interface patterns
   - Document styling approach (CSS modules)
   - Create ADR (Architecture Decision Record) for key decisions

### Phase Prioritization

**Must Have (Critical):** Phases 1-2 (Messages, Location Tree)
**Should Have (High Value):** Phase 3 (Three.js Maps)
**Nice to Have (Polish):** Phases 4-5 (Dashboard, Optimizations)

If timeline slips, deprioritize Phases 4-5.

---

## Alternatives Considered

### Full Rewrite (Rejected)
**Why Rejected:** Too risky, months of non-functional app, lose Django's auth/admin

### Next.js with Server Components (Rejected)
**Why Rejected:** Team expertise is Python/Django (not Node.js), requires different deployment model

### Web Components (Rejected)
**Why Rejected:** Weaker ecosystem, no React Three Fiber equivalent, more boilerplate

### HTMX (Rejected)
**Why Rejected:** Can't handle complex Three.js visualizations, doesn't solve component reuse

### Vue.js (Considered)
**Why Not Selected:** React has better Three.js support (React Three Fiber is mature and well-documented)

---

## Conclusion

This migration plan provides a **safe, incremental path** from Django templates to React while maintaining full functionality at every step. The key benefits are:

1. **Eliminate Duplication:** Message rendering (3x → 1x), panels (2x → 1x), forms, scrollbars
2. **Improve Maintainability:** ~1,600 lines of inline Three.js → ~400 lines of declarative React components
3. **Better Developer Experience:** TypeScript, hot reload, component library, testability
4. **Always Deployable:** Each phase is complete and functional
5. **Low Risk:** Independent rollback plans for each phase

**Expected Outcomes:**
- 40% reduction in total code (better organization)
- 80%+ test coverage (better quality)
- Faster development (reusable components)
- Easier onboarding (clearer structure)

The **12-week timeline** is realistic for a small team with clear decision points. If issues arise, phases can be paused or rolled back independently.

**Biggest wins will come from:**
- Eliminating message rendering duplication (saves ~300 lines)
- Converting Three.js to React Three Fiber (saves ~1,200 lines, better performance)
- Building reusable Panel/Button/Input components (saves ~400 lines across templates)

This approach balances **pragmatism** (keep what works) with **modernization** (React for complex UIs).
