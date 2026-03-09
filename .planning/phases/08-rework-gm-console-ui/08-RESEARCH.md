# Phase 8: Rework GM Console UI - Research

**Researched:** 2026-03-09
**Domain:** React UI layout restructure, Ant Design component patterns
**Confidence:** HIGH

## Summary

This phase is a pure frontend restructure of the GM console (`GMConsole.tsx` entry point + `src/components/gm/` directory). The current layout is a 400px sidebar (LocationTree) + content area with Ant Design Tabs (CHARON, ENCOUNTER, SHIP STATUS, BROADCAST). This gets replaced with a left icon rail (~60px) for view switching, a full-width main content area that changes entirely per view, and right-side slide-out tool panels for views that need controls.

The existing codebase uses Ant Design 6.1 with dark theme, React 19, and all GM component styles are inline (no CSS files exist in `src/components/gm/`). The encounter domain components use plain `.css` files (not CSS modules). The restructure touches no backend/API code -- all services (`gmConsoleApi`, `encounterApi`, `charonApi`) and SSE subscription stay as-is.

**Primary recommendation:** Decompose the monolithic `EncounterPanel.tsx` (606 lines) into separate tool panel components, build a reusable `SlideOutPanel` wrapper, and use CSS files (matching existing project pattern) for the new layout system.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Left view rail:** Narrow vertical icon strip (~60px) replacing the 400px sidebar. Contains view icons (STANDBY, BRIDGE, ENCOUNTER, CHARON) with tooltips on hover, no text labels
- **Main content area:** Fills remaining width. Content changes entirely when a view icon is clicked (view-driven, no tabs)
- **Right tool rail:** Icon strip on the right edge of views that need tool panels (ENCOUNTER, BRIDGE). Clicking an icon slides out a ~300px floating panel overlay. Only one panel open at a time -- clicking the same icon toggles it closed, clicking a different icon swaps panels
- **Location tree:** Removed from sidebar. Accessible as a right-side tool panel in ENCOUNTER view only
- **View icons switch GM view only -- does NOT auto-push to player terminal**
- **DISPLAY button:** Separate icon at bottom of left rail pushes current GM view to player terminal
- **Active indicator:** Small dot/highlight on the view icon currently displayed on the player terminal
- **Views:** STANDBY, BRIDGE, ENCOUNTER, CHARON (4 total -- BROADCAST removed)
- **ENCOUNTER view:** Map fills entire main content area. Floating top-left controls (deck dropdown + REVEAL ALL / HIDE ALL). Right tool rail: Token Palette, NPC Portraits, Location Tree, Terminals
- **BRIDGE view:** Dashboard overview (location context, ship status summary, crew count). Right tool rail: Ship Status controls, CHARON Quick-Send
- **CHARON view:** Full-screen conversation display and controls. No right tool rail
- **STANDBY view:** No controls, just idle state
- **BROADCAST:** Removed entirely from GM console (API remains)
- **Styling:** Utilitarian/clean dark UI, not CRT-styled. Ant Design components (dark theme). Fixed ~300px width for all right-side slide-out panels
- **Responsive:** Tablet-friendly, support landscape tablets (iPad)

### Claude's Discretion
- CSS approach (modules vs regular CSS files per component)
- Exact icon choices for view rail and tool rail buttons
- Dashboard widget layout and specific summary panels for BRIDGE view
- Transition animations for panel slide-in/out
- How the view rail adapts on tablets
- Component decomposition strategy

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| antd | ^6.1.1 | UI components (Layout, Tooltip, Select, Button, etc.) | Already the project's UI framework |
| @ant-design/icons | ^6.1.0 | Icon library for rail icons and tool buttons | Already installed, extensive icon set |
| React | ^19.2.3 | Component framework | Already installed |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| GSAP | ^3.14.2 | Slide-out panel animations | Optional -- CSS transitions may suffice |

### No New Dependencies Needed
This phase requires zero new npm packages. Ant Design's icon library has sufficient icons for view rail and tool rail buttons. CSS transitions handle panel slide animations. Ant Design's `Tooltip` handles rail icon tooltips.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── entries/
│   └── GMConsole.tsx              # Restructured: ViewRail + view routing + state
├── components/
│   └── gm/
│       ├── layout/
│       │   ├── ViewRail.tsx           # Left icon rail (60px)
│       │   ├── ViewRail.css
│       │   ├── ToolRail.tsx           # Right icon rail (per-view)
│       │   ├── ToolRail.css
│       │   ├── SlideOutPanel.tsx      # Reusable slide-out panel wrapper
│       │   └── SlideOutPanel.css
│       ├── views/
│       │   ├── EncounterView.tsx      # Full-screen map + floating controls
│       │   ├── EncounterView.css
│       │   ├── BridgeView.tsx         # Dashboard overview
│       │   ├── BridgeView.css
│       │   ├── CharonView.tsx         # Full-screen CHARON (wraps existing CharonPanel)
│       │   └── StandbyView.tsx        # Empty/idle
│       ├── panels/                    # Right-side slide-out panel contents
│       │   ├── TokenPalettePanel.tsx   # Wraps existing TokenPalette
│       │   ├── NpcPortraitsPanel.tsx   # Extracted from EncounterPanel
│       │   ├── LocationTreePanel.tsx   # Wraps existing LocationTree
│       │   ├── TerminalsPanel.tsx      # Terminal show/hide toggles
│       │   ├── ShipStatusPanel.tsx     # Wraps existing ShipStatusPanel
│       │   └── CharonQuickSend.tsx     # Minimal message composer
│       ├── LocationTree.tsx           # Existing (unchanged)
│       ├── CharonPanel.tsx            # Existing (unchanged, used by CharonView)
│       ├── ShipStatusPanel.tsx        # Existing (unchanged, used by panels/)
│       ├── TokenPalette.tsx           # Existing (unchanged, used by panels/)
│       ├── TokenImageGallery.tsx      # Existing (unchanged)
│       ├── MapPreview.tsx             # Existing (unchanged, used by EncounterView)
│       └── DoorStatusPopup.tsx        # Existing (unchanged)
```

### Pattern 1: View-Driven Routing (no react-router)
**What:** GMConsole maintains a `gmView` state that determines which view fills the main content area. This is purely a GM console concept -- separate from the `activeView.view_type` which tracks what the player terminal displays.
**When to use:** Always -- this is the core navigation pattern.
**Example:**
```typescript
// GMConsole.tsx
type GMViewType = 'STANDBY' | 'BRIDGE' | 'ENCOUNTER' | 'CHARON';
const [gmView, setGmView] = useState<GMViewType>('STANDBY');

// Render based on gmView
{gmView === 'ENCOUNTER' && <EncounterView ... />}
{gmView === 'BRIDGE' && <BridgeView ... />}
{gmView === 'CHARON' && <CharonView ... />}
{gmView === 'STANDBY' && <StandbyView />}
```

### Pattern 2: SlideOutPanel Wrapper
**What:** A reusable component that handles the slide-in/out animation and fixed 300px width for all right-side tool panels.
**When to use:** Every tool panel in the right rail.
**Example:**
```typescript
interface SlideOutPanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

// CSS: position absolute, right: 0, width: 300px, transform: translateX(100%) when closed
// Transition: transform 200ms ease-in-out
```

### Pattern 3: Tool Rail Configuration Per View
**What:** Each view declares its tool rail buttons as configuration, not hardcoded in the layout.
**When to use:** ENCOUNTER and BRIDGE views.
**Example:**
```typescript
interface ToolRailButton {
  key: string;
  icon: React.ReactNode;
  tooltip: string;
}

// EncounterView declares its tools
const encounterTools: ToolRailButton[] = [
  { key: 'tokens', icon: <TeamOutlined />, tooltip: 'Token Palette' },
  { key: 'portraits', icon: <UserOutlined />, tooltip: 'NPC Portraits' },
  { key: 'locations', icon: <ApartmentOutlined />, tooltip: 'Location Tree' },
  { key: 'terminals', icon: <MessageOutlined />, tooltip: 'Terminals' },
];
```

### Pattern 4: GM View vs Player View Separation
**What:** `gmView` (local state) controls what the GM sees. `activeView.view_type` (from server via SSE) tracks what the player terminal displays. The DISPLAY button bridges them by calling the API to push the current gmView to the server.
**When to use:** Core architectural distinction.
**Example:**
```typescript
// Left rail shows indicator dot on the view matching activeView.view_type
// DISPLAY button calls: gmConsoleApi.switchView(gmView, locationSlug)
// This updates activeView.view_type on the server, SSE pushes to players
```

### Anti-Patterns to Avoid
- **Coupling GM view to player view:** Do NOT auto-push to player terminal when GM switches views. The DISPLAY button is the explicit mechanism.
- **Inline styles in new code:** The CONTEXT.md says to move away from inline styles. Use CSS files for all new layout components.
- **Monolithic view components:** Each view component should delegate to existing components (MapPreview, CharonPanel, etc.) rather than reimplementing their logic.
- **Multiple panels open simultaneously:** Right rail must enforce single-panel-at-a-time constraint.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icon tooltips | Custom tooltip | `antd Tooltip` with `placement="right"` / `"left"` | Already used elsewhere, consistent behavior |
| Dark theme tokens | Custom colors | Ant Design `ConfigProvider` dark theme (existing) | Maintains consistency |
| Slide-out animation | GSAP timeline | CSS `transform` + `transition` | Simpler, no JS overhead for a basic slide |
| Floating controls | Absolute-positioned divs with z-index juggling | CSS `position: absolute` within a `position: relative` map container | Standard overlay pattern |
| Deck level dropdown | Custom dropdown | `antd Select` component | Already used in ShipStatusPanel for system selectors |

## Common Pitfalls

### Pitfall 1: GM View vs Player View State Confusion
**What goes wrong:** The current code tightly couples "what view the GM is working in" with "what's displayed on the player terminal" through `activeView.view_type`. After this rework, these are separate concepts.
**Why it happens:** `activeView.view_type` is set by API calls (switchView, switchToBridge, etc.) which immediately update what players see. If the GM view changes trigger these same API calls, players will see every GM navigation click.
**How to avoid:** Introduce `gmView` as purely local state. Only the DISPLAY button triggers the API call to update `activeView.view_type`.
**Warning signs:** Players seeing view changes when the GM is just browsing different panels.

### Pitfall 2: EncounterPanel State Scattering
**What goes wrong:** `EncounterPanel.tsx` (606 lines) manages a lot of state: room visibility, door status, tokens, deck selection, map data loading, NPC portraits. Splitting this into separate panel components means this state needs a shared owner.
**Why it happens:** The tool panels (TokenPalette, NPC Portraits, Location Tree, Terminals) all need access to encounter state but will be rendered as separate slide-out panels.
**How to avoid:** Keep encounter state management in `EncounterView.tsx` (the parent view component). Pass state and callbacks as props to the individual tool panel components. The EncounterView owns the data; panels are just UI controls.
**Warning signs:** Duplicate API calls, stale state in panels, prop drilling deeper than 2 levels.

### Pitfall 3: Map Interaction Beneath Slide-Out Panel
**What goes wrong:** The slide-out panel overlays the map. Clicks/drags on the map area beneath the panel could bleed through or be blocked unexpectedly.
**Why it happens:** The map uses mouse events for pan, zoom, token drag, room right-click. The overlay panel needs to intercept clicks in its area.
**How to avoid:** Panel uses `position: absolute` with proper z-index. Panel container uses `pointer-events: auto`. Map area beneath panel is naturally blocked. Token drag-to-map from panel must still work -- the drag starts in the panel but ends on the map.
**Warning signs:** Cannot drag tokens from palette to map, cannot right-click rooms near the panel edge, cannot zoom while panel is open.

### Pitfall 4: Ant Design Layout Component Conflicts
**What goes wrong:** Ant Design's `Layout`, `Sider`, `Content` components apply their own styles that can conflict with the custom rail layout.
**Why it happens:** Current code uses `<Layout>` + `<Sider width={400}>` + `<Content>`. The new design needs a 60px rail which is too narrow for Sider's default behavior.
**How to avoid:** Drop Ant Design's Layout/Sider/Content. Use plain `<div>` elements with CSS flexbox for the top-level layout. The 60px rail and main content area are simple flex children. Ant Design components are still used for individual UI elements (buttons, tooltips, selects, etc.) but not for the page-level layout.
**Warning signs:** Unexpected padding, min-width constraints, collapsed sider behavior.

### Pitfall 5: Losing the ENCOUNTER Location Selection Flow
**What goes wrong:** Currently, location selection is done via the sidebar LocationTree which is always visible. In the new design, LocationTree is a slide-out panel. If the GM hasn't opened the location panel, they can't select an encounter location.
**Why it happens:** The LocationTree moves from always-visible sidebar to on-demand tool panel.
**How to avoid:** When switching to ENCOUNTER view with no location selected, either auto-open the Location Tree panel or show a clear prompt directing the GM to open it. Consider persisting the last selected encounter location.
**Warning signs:** GM switches to ENCOUNTER view and sees an empty screen with no obvious way to select a location.

### Pitfall 6: Token Drag from Panel to Map
**What goes wrong:** Token drag-and-drop currently works within the same parent component hierarchy. Moving TokenPalette into a slide-out panel that overlays the map means the drag origin and drop target are in different DOM subtrees.
**Why it happens:** The current drag implementation uses HTML5 drag events or mouse event coordinates relative to the SVG.
**How to avoid:** The existing drag implementation uses `getScreenCTM().inverse()` for coordinate conversion, which works regardless of DOM position. Ensure the slide-out panel doesn't set `overflow: hidden` which would clip the drag ghost. The existing canvas drag preview (40x40 circular) should continue to work.
**Warning signs:** Drag ghost disappears when crossing panel boundary, token placement offset is wrong.

## Code Examples

### View Rail Component
```typescript
// ViewRail.tsx
import { Tooltip } from 'antd';
import {
  PauseCircleOutlined,
  DashboardOutlined,
  RadarChartOutlined,
  RobotOutlined,
  SendOutlined,
} from '@ant-design/icons';
import './ViewRail.css';

interface ViewRailProps {
  gmView: GMViewType;
  playerView: string;  // activeView.view_type from server
  onViewChange: (view: GMViewType) => void;
  onDisplay: () => void;
}

const VIEW_ITEMS = [
  { key: 'STANDBY', icon: <PauseCircleOutlined />, tooltip: 'Standby' },
  { key: 'BRIDGE', icon: <DashboardOutlined />, tooltip: 'Bridge' },
  { key: 'ENCOUNTER', icon: <RadarChartOutlined />, tooltip: 'Encounter' },
  { key: 'CHARON', icon: <RobotOutlined />, tooltip: 'CHARON' },
] as const;

// playerView indicator: small dot on the view that matches activeView.view_type
// DISPLAY button at bottom: pushes gmView to player terminal
```

### SlideOutPanel CSS Pattern
```css
/* SlideOutPanel.css */
.slide-out-panel {
  position: absolute;
  top: 0;
  right: 48px; /* width of tool rail */
  width: 300px;
  height: 100%;
  background: #141414;
  border-left: 1px solid #303030;
  transform: translateX(100%);
  transition: transform 200ms ease-in-out;
  overflow-y: auto;
  z-index: 10;
}

.slide-out-panel.open {
  transform: translateX(0);
}
```

### Encounter View Floating Controls
```typescript
// EncounterView.tsx - floating controls over map
<div className="encounter-view-container">
  <MapPreview mapData={...} ... />

  {/* Floating top-left controls */}
  <div className="encounter-floating-controls">
    <Select value={currentDeckId} onChange={handleDeckSelect} ... />
    <Button onClick={handleShowAll}>REVEAL ALL</Button>
    <Button onClick={handleHideAll}>HIDE ALL</Button>
  </div>

  {/* Tool rail + slide-out panels on right */}
  <ToolRail tools={encounterTools} activePanel={activePanel} onToggle={setActivePanel} />
  <SlideOutPanel open={activePanel === 'tokens'} ...>
    <TokenPalette ... />
  </SlideOutPanel>
  {/* ... other panels */}
</div>
```

### BRIDGE Dashboard Layout
```typescript
// BridgeView.tsx - dashboard with summary widgets
// Use existing DashboardPanel/CompactPanel components for widget cards
// Layout: CSS grid, 2-column on desktop, 1-column on tablet
// Widgets: Location context, Ship info (name/class/hull/armor), Crew count, System statuses
// Data source: activeView (location info) + ship status API
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ant Design Layout/Sider | Plain flexbox with custom CSS | This phase | More control over narrow rail widths |
| Ant Design Tabs | View-driven conditional rendering | This phase | Full-content views, no tab overhead |
| 400px sidebar always visible | 60px icon rail + on-demand panels | This phase | More screen real estate for map |
| Inline styles everywhere | CSS files per component | This phase | Maintainability, Ant Design override avoidance |

## CSS Approach Recommendation

**Use plain CSS files** (not CSS modules). Rationale:
- Project already uses plain `.css` files for encounter components (`EncounterMapRenderer.css`, `EncounterView.css`, etc.)
- No CSS modules exist anywhere in the project
- Consistency with established pattern
- BEM-style naming (e.g., `.view-rail`, `.view-rail__item`, `.view-rail__item--active`) avoids collisions without modules

## Icon Recommendations

View rail (left):
| View | Icon | Ant Design Name |
|------|------|-----------------|
| STANDBY | Pause circle | `PauseCircleOutlined` |
| BRIDGE | Dashboard | `DashboardOutlined` |
| ENCOUNTER | Radar/compass | `RadarChartOutlined` |
| CHARON | Robot | `RobotOutlined` |
| DISPLAY (push) | Send/upload | `SendOutlined` or `UploadOutlined` |

Encounter tool rail (right):
| Tool | Icon | Ant Design Name |
|------|------|-----------------|
| Token Palette | Team/users | `TeamOutlined` |
| NPC Portraits | User/picture | `UserOutlined` or `PictureOutlined` |
| Location Tree | Hierarchy | `ApartmentOutlined` |
| Terminals | Message | `MessageOutlined` |

Bridge tool rail (right):
| Tool | Icon | Ant Design Name |
|------|------|-----------------|
| Ship Status | Dashboard/setting | `ToolOutlined` or `SettingOutlined` |
| CHARON Quick-Send | Robot/send | `RobotOutlined` |

## Tablet Adaptation

For landscape iPad (1024x768 viewport):
- View rail: Keep at 60px, icons are already touch-friendly at that width
- Tool panels: Keep at 300px (fits within remaining ~664px)
- Map: Gets ~664px minus tool rail width -- still usable for tactical maps
- Touch targets: Ensure all rail icons are at least 44x44px (Apple HIG minimum)

For portrait iPad (768x1024):
- Consider collapsing tool panel to full-width bottom sheet, but this is an edge case (GM likely uses landscape). Defer complex responsive behavior -- just ensure nothing breaks at 768px wide.

## Validation Architecture

> nyquist_validation not set in config.json -- including this section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (no test framework configured) |
| Config file | none |
| Quick run command | `npm run typecheck` |
| Full suite command | `npm run build` |

### Phase Requirements -> Test Map
No formal requirement IDs for this phase. Validation is:
| Behavior | Test Type | Automated Command |
|----------|-----------|-------------------|
| TypeScript compiles | type check | `npm run typecheck` |
| Build succeeds | build | `npm run build` |
| View rail renders, switching works | manual | Visual verification |
| Slide-out panels open/close | manual | Visual verification |
| Token drag from panel to map | manual | Visual verification |
| DISPLAY button pushes to player terminal | manual | Visual verification |
| Tablet layout doesn't break | manual | Browser dev tools responsive mode |

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run build`
- **Phase gate:** Full build + manual visual verification

### Wave 0 Gaps
None -- no test infrastructure to create. TypeScript type checking and build verification are the automated gates.

## Open Questions

1. **CHARON channel context in new layout**
   - What we know: Current CharonPanel derives channel from `activeView.view_type` (BRIDGE -> 'bridge', ENCOUNTER -> 'encounter-slug', CHARON_TERMINAL -> 'story'). With the new GM view separation, the GM might be viewing ENCOUNTER locally but the player terminal shows BRIDGE.
   - What's unclear: Should CHARON channel follow the GM's local view or the player terminal's active view?
   - Recommendation: Follow the GM's local view (`gmView`). The GM is working in that context. The Quick-Send in BRIDGE view would use the 'bridge' channel. The CHARON full view would use 'story' channel.

2. **BroadcastForm removal**
   - What we know: BROADCAST view removed entirely from GM console. The API remains.
   - What's unclear: Whether any other mechanism should allow the GM to send broadcasts.
   - Recommendation: Simply remove the component and its import. If needed later, it can be added as a tool panel.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `GMConsole.tsx`, `EncounterPanel.tsx`, `ViewControls.tsx`, `CharonPanel.tsx`, `ShipStatusPanel.tsx`, `LocationTree.tsx`, `MapPreview.tsx`
- `package.json` for exact library versions
- `vite.config.ts` for build configuration
- Existing CSS files in `src/components/domain/encounter/` for CSS pattern validation

### Secondary (MEDIUM confidence)
- Ant Design 6.x icon availability -- based on training knowledge of `@ant-design/icons` package contents. Icon names should be verified during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed, versions confirmed from package.json
- Architecture: HIGH - based on thorough analysis of existing codebase structure and CONTEXT.md decisions
- Pitfalls: HIGH - identified from actual code patterns (inline styles, state management, drag-and-drop)
- CSS approach: HIGH - verified from existing project patterns (plain CSS files in encounter components)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- no fast-moving dependencies)
