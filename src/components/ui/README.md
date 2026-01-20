# UI Components Documentation

This directory contains reusable UI components for the Mothership GM Tool.

## Panel Component System

The panel system provides a consistent, flexible way to create chamfered panels with the retro sci-fi aesthetic matching the Alien Romulus (2024) design language.

### Core Components

#### Panel (Base Component)

The foundational panel component with full customization options.

```tsx
import { Panel } from '@components/ui/Panel';

<Panel
  title="SYSTEM STATUS"
  variant="default"
  chamferCorners={['tl', 'br']}
  isActive={false}
  headerActions={<button>Action</button>}
  footer={<div>Footer content</div>}
  scrollable={true}
  padding="12px"
  minHeight="200px"
  maxHeight="80vh"
  onHeaderClick={() => console.log('Header clicked')}
>
  Panel content here
</Panel>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | - | Panel title displayed in header |
| `children` | `ReactNode` | - | Panel content |
| `variant` | `'default' \| 'dashboard' \| 'info' \| 'compact'` | `'default'` | Visual variant style |
| `isActive` | `boolean` | `false` | Active state (brighter borders) |
| `className` | `string` | `''` | Additional CSS classes |
| `chamferCorners` | `ChamferCorner[]` | `['tl', 'br']` | Which corners to chamfer (`'tl'`, `'tr'`, `'bl'`, `'br'`) |
| `headerActions` | `ReactNode` | - | Optional action buttons/controls in header |
| `footer` | `ReactNode` | - | Optional footer content |
| `scrollable` | `boolean` | `true` | Enable/disable content scrolling |
| `padding` | `string \| number` | - | Custom content padding |
| `minHeight` | `string \| number` | - | Minimum height constraint |
| `maxHeight` | `string \| number` | - | Maximum height constraint |
| `onHeaderClick` | `() => void` | - | Callback when header is clicked |
| `style` | `CSSProperties` | - | Custom styles for panel wrapper |

#### DashboardPanel

Dashboard-specific panel variant with pre-configured styling.

```tsx
import { DashboardPanel } from '@components/ui/DashboardPanel';

<DashboardPanel
  title="CREW ROSTER"
  chamferCorners={['tr', 'bl']}
  headerActions={<button>+</button>}
>
  Crew list content
</DashboardPanel>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | - | Panel title |
| `children` | `ReactNode` | - | Panel content |
| `className` | `string` | `''` | Additional CSS classes |
| `chamferCorners` | `ChamferCorner[]` | `['tr', 'bl']` | Which corners to chamfer |
| `isActive` | `boolean` | `false` | Active state |
| `headerActions` | `ReactNode` | - | Header actions |
| `footer` | `ReactNode` | - | Footer content |
| `onHeaderClick` | `() => void` | - | Header click callback |

**Default Features:**
- Dashboard variant styling (larger content padding, specific font size)
- Default chamfer corners: top-right and bottom-left

#### CompactPanel

Compact panel variant for dense information displays (GM console).

```tsx
import { CompactPanel } from '@components/ui/CompactPanel';

<CompactPanel
  title="LOCATIONS"
  chamferCorners={['tl', 'br']}
  scrollable={true}
>
  Location tree content
</CompactPanel>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | - | Panel title |
| `children` | `ReactNode` | - | Panel content |
| `className` | `string` | `''` | Additional CSS classes |
| `chamferCorners` | `ChamferCorner[]` | `['tl', 'br']` | Which corners to chamfer |
| `isActive` | `boolean` | `false` | Active state |
| `headerActions` | `ReactNode` | - | Header actions |
| `footer` | `ReactNode` | - | Footer content |
| `scrollable` | `boolean` | `true` | Enable scrolling |
| `onHeaderClick` | `() => void` | - | Header click callback |

**Default Features:**
- Compact variant styling (smaller padding, smaller font sizes)
- Ideal for GM console with lots of information
- Default chamfer corners: top-left and bottom-right

#### InfoPanel

Specialized panel for floating info displays with typewriter effect.

```tsx
import { InfoPanel, buildSystemInfoHTML } from '@components/domain/dashboard/InfoPanel';

const systemInfo = buildSystemInfoHTML({
  type: 'G-type main-sequence',
  description: 'Home star system',
  population: '8.2 billion',
  position: [0, 0, 0],
});

<InfoPanel
  title="SYSTEM INFORMATION"
  content={systemInfo}
  visible={true}
  showDecorators={true}
  typewriterSpeed={15}
/>
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | - | Panel title |
| `content` | `string` | - | HTML content to display |
| `visible` | `boolean` | - | Whether panel is visible |
| `showDecorators` | `boolean` | `true` | Show decorative triangle |
| `typewriterSpeed` | `number` | `15` | Speed in ms per character |

**Helper Functions:**
- `buildInfoHTML(fields)` - Build HTML from label/value pairs
- `buildSystemInfoHTML(system)` - Build star system info
- `buildPlanetInfoHTML(planet)` - Build planet info
- `buildMoonInfoHTML(moon)` - Build moon info
- `buildStationInfoHTML(station)` - Build station info
- `buildSurfaceMarkerInfoHTML(marker)` - Build surface marker info

### Utility Functions

```tsx
import {
  createStandardPanel,
  createDashboardPanel,
  createGMPanel,
  createInfoPanel,
  getPanelClasses,
  getCornerLineClass,
  getPanelChamferConfig,
} from '@components/ui/panelUtils';

// Get panel configuration
const config = createDashboardPanel(['tr', 'bl']);
// Returns: { variant: 'dashboard', chamferCorners: ['tr', 'bl'], scrollable: true }

// Get CSS classes for chamfer corners
const classes = getPanelClasses(['tl', 'br']);
// Returns: "chamfer-tl chamfer-br"

// Get corner line class for legacy CSS
const cornerLineClass = getCornerLineClass(['tr', 'bl']);
// Returns: "corner-line-tr-bl"

// Get chamfer clip-path configuration
const chamferConfig = getPanelChamferConfig(['tl', 'br']);
// Returns: { corners: ['tl', 'br'], clipPath: 'polygon(...)' }
```

### Hooks

```tsx
import {
  usePanelCollapse,
  usePanelResize,
  usePanelDrag,
  usePanelVisibility,
} from '@hooks/usePanelState';

// Collapsible panel
function CollapsiblePanel() {
  const { isCollapsed, toggle } = usePanelCollapse(false);

  return (
    <Panel
      title="COLLAPSIBLE PANEL"
      onHeaderClick={toggle}
    >
      {!isCollapsed && <div>Content</div>}
    </Panel>
  );
}

// Panel with resize tracking
function ResizablePanel() {
  const { panelRef, width, height } = usePanelResize((w, h) => {
    console.log('Panel resized:', w, h);
  });

  return (
    <div ref={panelRef}>
      <Panel title="PANEL">
        Panel size: {width}x{height}
      </Panel>
    </div>
  );
}

// Panel with visibility animation
function AnimatedPanel() {
  const { isVisible, show, hide, toggle } = usePanelVisibility(false, 300);

  return (
    <>
      <button onClick={toggle}>Toggle Panel</button>
      {isVisible && <Panel title="ANIMATED">Content</Panel>}
    </>
  );
}
```

## Chamfer Corner Combinations

All corner combinations are supported:

| Corners | Description | Use Case |
|---------|-------------|----------|
| `['tl']` | Top-left only | Custom layouts |
| `['tr']` | Top-right only | Custom layouts |
| `['bl']` | Bottom-left only | Custom layouts |
| `['br']` | Bottom-right only | Custom layouts |
| `['tl', 'br']` | Top-left & bottom-right (diagonal) | Default standard panels |
| `['tr', 'bl']` | Top-right & bottom-left (diagonal) | Dashboard panels |
| `['bl', 'br']` | Both bottom corners | Top title panels |
| `['tl', 'tr']` | Both top corners | Footer panels |
| `['tl', 'tr', 'bl']` | All except bottom-right | Custom layouts |
| `['tl', 'tr', 'br']` | All except bottom-left | Custom layouts |
| `['tl', 'bl', 'br']` | All except top-right | Custom layouts |
| `['tr', 'bl', 'br']` | All except top-left | Custom layouts |
| `['tl', 'tr', 'bl', 'br']` | All four corners | Special emphasis panels |

## Panel Variants

### Default Variant

Standard panel with all base features.

```tsx
<Panel title="DEFAULT PANEL" variant="default">
  Standard panel content
</Panel>
```

### Dashboard Variant

Pre-configured for dashboard layouts:
- Larger content padding (15px)
- Larger font size (13px)
- Default chamfer corners: `['tr', 'bl']`

```tsx
<DashboardPanel title="DASHBOARD PANEL">
  Dashboard content
</DashboardPanel>
```

### Info Variant

Optimized for floating info panels:
- Darker background
- No scanline effect on content
- Transparent content background
- Larger padding (15px)

```tsx
<Panel title="INFO PANEL" variant="info">
  Information display
</Panel>
```

### Compact Variant

Dense layout for GM console:
- Smaller header padding (8px)
- Smaller header font (11px)
- Smaller content padding (8px)
- Smaller content font (11px)
- Tighter line height (1.4)

```tsx
<CompactPanel title="COMPACT PANEL">
  Dense information display
</CompactPanel>
```

## Visual Design System

### Color Variables

Panels use these CSS custom properties from `variables.css`:

- `--color-bg-panel`: Main panel background (#1a2525)
- `--color-bg-panel-dark`: Dark panel background (#0f1515)
- `--color-border-main`: Primary borders (#4a6b6b - muted teal)
- `--color-border-subtle`: Subtle borders (#2a3a3a)
- `--color-teal`: Structural elements (#4a6b6b)
- `--color-teal-bright`: Hover/active states (#5a7a7a)
- `--color-amber`: Interactive elements (#8b7355)
- `--color-amber-bright`: Hover on amber (#9a8065)
- `--color-text-primary`: Body text (#9a9a9a)
- `--color-text-secondary`: Secondary text (#7a7a7a)
- `--color-text-muted`: Disabled text (#5a5a5a)

### Chamfer Size

All chamfered corners use a consistent 12px chamfer size (stored in CSS variable `--chamfer-size`).

The InfoPanel uses a special 48px bottom-right chamfer for visual emphasis.

### Corner Diagonal Lines

Chamfered corners include 4px diagonal lines at 45-degree angles:
- Top-left: `to bottom right` gradient
- Top-right: `to bottom left` gradient
- Bottom-left: `to top right` gradient
- Bottom-right: `to top left` gradient

### Scrollbar Styling

Panel content areas use custom scrollbar styling:
- Width: 10px
- Track: Matches content background with scanlines
- Thumb: Dark with teal border (#0f1515 with 1px #4a6b6b border)
- 3px spacing from panel edge (via content `margin-right`)

## Examples

### Basic Panel

```tsx
<Panel title="BASIC PANEL">
  <p>Simple panel content</p>
</Panel>
```

### Dashboard Panel with Actions

```tsx
<DashboardPanel
  title="CREW ROSTER"
  chamferCorners={['tr', 'bl']}
  headerActions={
    <>
      <button>Add</button>
      <button>Edit</button>
    </>
  }
>
  <ul>
    <li>Commander Drake</li>
    <li>Dr. Sarah Chen</li>
  </ul>
</DashboardPanel>
```

### Active Panel with Footer

```tsx
<Panel
  title="ACTIVE SYSTEM"
  isActive={true}
  footer={<span>Last updated: 2183-06-15</span>}
>
  System information here
</Panel>
```

### Collapsible Panel

```tsx
function CollapsibleExample() {
  const { isCollapsed, toggle } = usePanelCollapse(false);

  return (
    <Panel
      title="COLLAPSIBLE PANEL"
      onHeaderClick={toggle}
      headerActions={<span>{isCollapsed ? '▶' : '▼'}</span>}
    >
      {!isCollapsed && <div>Content visible when expanded</div>}
    </Panel>
  );
}
```

### Custom Styled Panel

```tsx
<Panel
  title="CUSTOM PANEL"
  variant="default"
  chamferCorners={['tl', 'tr', 'bl', 'br']}
  minHeight="300px"
  maxHeight="600px"
  padding="20px"
  style={{ backgroundColor: 'rgba(74, 107, 107, 0.2)' }}
>
  Custom content with all four corners chamfered
</Panel>
```

## Migration from Old Patterns

### Old Inline Panel Component

**Before:**
```tsx
function DashboardPanel({ title, children, className }) {
  return (
    <div className={`panel-base border-all ${className}`}>
      <div className="dashboard-panel-header">
        <h3>{title}</h3>
      </div>
      <div className="dashboard-panel-content">
        {children}
      </div>
    </div>
  );
}

<DashboardPanel title="NOTES" className="chamfer-tr-bl corner-line-tr-bl">
  Content
</DashboardPanel>
```

**After:**
```tsx
import { DashboardPanel } from '@components/ui/DashboardPanel';

<DashboardPanel title="NOTES" chamferCorners={['tr', 'bl']}>
  Content
</DashboardPanel>
```

### Old CSS Class-Based Panel

**Before:**
```html
<div class="panel-base border-all chamfer-tr-bl corner-line-tr-bl">
  <div class="dashboard-panel-header">
    <h3>TITLE</h3>
  </div>
  <div class="dashboard-panel-content">
    Content
  </div>
</div>
```

**After:**
```tsx
<DashboardPanel title="TITLE" chamferCorners={['tr', 'bl']}>
  Content
</DashboardPanel>
```

## Best Practices

1. **Use Variant Components**: Prefer `DashboardPanel`, `CompactPanel` over direct `Panel` usage for consistency
2. **Consistent Chamfer Corners**: Use standard combinations (`['tl', 'br']` or `['tr', 'bl']`)
3. **Avoid Inline Styles**: Use `className` and CSS variables instead of inline `style` prop when possible
4. **Leverage Hooks**: Use provided hooks for common patterns (collapse, resize, visibility)
5. **Semantic Titles**: Use uppercase titles with clear labeling (e.g., "SYSTEM STATUS" not "System Status")
6. **Content Formatting**: Use monospace fonts and retro styling for content

## Troubleshooting

### Panel Not Filling Parent

Ensure parent container has defined height:
```css
.parent-container {
  height: 100%;
  min-height: 0; /* For grid/flexbox containers */
}
```

### Chamfer Corners Not Showing

Verify corners are spelled correctly (`'tl'`, `'tr'`, `'bl'`, `'br'`) and check for CSS conflicts.

### Scrollbar Not Visible

Content must exceed panel height for scrollbar to appear. Check `scrollable` prop is `true`.

### Content Clipped by Chamfers

For 4-corner panels, content near corners may be clipped. Add appropriate padding to content.
