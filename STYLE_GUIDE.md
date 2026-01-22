# Style Guide

UI Design System for the Mothership GM Tool. This guide defines the visual language inspired by Alien Romulus (2024) - a realistic, muted CRT aesthetic.

## Color Scheme (V2-1: Muted Multi-Color)

**Design Philosophy**: Realistic, muted CRT aesthetic with multiple harmonious colors. No bright neon colors.

**Color Palette** (defined as CSS variables in `terminal/templates/terminal/base.html`):

```css
--color-teal: #4a6b6b;              /* Primary structural color */
--color-teal-bright: #5a7a7a;       /* Hover states, emphasis */
--color-amber: #8b7355;             /* Active/interactive elements */
--color-amber-bright: #9a8065;      /* Hover states on amber */
--color-bg-primary: #0a0a0a;        /* Main background */
--color-bg-secondary: #1a1a1a;      /* Secondary surfaces */
--color-bg-panel: #1a2525;          /* Panel backgrounds */
--color-bg-panel-dark: #0f1515;     /* Dark panel variant */
--color-text-primary: #9a9a9a;      /* Body text */
--color-text-secondary: #7a7a7a;    /* Secondary text */
--color-text-muted: #5a5a5a;        /* Disabled/muted text */
--color-border-main: #4a6b6b;       /* Primary borders */
--color-border-subtle: #2a3a3a;     /* Subtle dividers */
--color-active: #8b7355;            /* Active selections */
```

**Visual Elements**:
- **Angular Panels**: Chamfered corners using CSS `clip-path` polygons (12px chamfer size)
- **CRT Effects**: Subtle scanlines (3px spacing, very low opacity)
- **Text Hierarchy**: Teal for structure/headers, amber for actions, gray for content
- **Diagonal Corner Lines**: 4px wide diagonal lines using linear gradients at chamfered corners

## Layout Standards

### Top Navigation Bar

Class: `terminal-header`

- **Height**: 52px fixed
- **Background**: #1a2828 with horizontal scanline pattern
  - Pattern: `repeating-linear-gradient(to bottom, transparent, transparent 1px, rgba(0, 0, 0, 0.3) 1px, rgba(0, 0, 0, 0.3) 2px)`
- **Position**: Sticky, anchored to top of viewport
- **Padding**: 0 40px 0 22px (22px from left edge, 40px from right)
- **Font**: Cascadia Code (fallback: Courier New, monospace)
- **Text Sizes**:
  - Title/Subtitle: 18px, letter-spacing 3px, color #5a7575 (muted teal)
  - Right side text: 11px, letter-spacing 3px, color #8b7355 (amber)
- **Border**: 1px solid var(--color-border-subtle) at bottom

### Content Layout

- **Content padding**: Remove default padding, controlled by page-specific CSS
- **GM Console spacing**: 30px from left edge, 30px below header
- **Panel gaps**: 20px between major UI components (30px for campaign dashboard)

## Panel Design Patterns

### React Panel Components (Recommended)

For React/TypeScript code, use the standardized Panel component system:

**Component Hierarchy**:
- `Panel` - Base component with full customization
- `DashboardPanel` - Pre-configured for dashboard layouts
- `CompactPanel` - Dense layout for GM console
- `InfoPanel` - Floating info panels with typewriter effect

**Quick Example**:
```tsx
import { DashboardPanel } from '@components/ui/DashboardPanel';

<DashboardPanel title="CREW ROSTER" chamferCorners={['tr', 'bl']}>
  <p>Crew list content</p>
</DashboardPanel>
```

**Read: src/components/ui/README.md** for complete Panel component API documentation.

### HTML/CSS Panels (Legacy)

For HTML templates, panels use chamfered corners (12px), teal borders, and scanline backgrounds:
- Angular panels with `clip-path` polygons for chamfered corners
- Diagonal corner lines using `::before` and `::after` pseudo-elements
- Fixed header with scrollable content area
- Floating scrollbar with teal borders

**Read: terminal/templates/terminal/gm_console_react.html** for reference implementations.

## Scrollbar Styling

### Floating Scrollbar (Panel Content)

```css
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

**Key Features:**
- Track has no borders, blends with scanline background
- Only scrollbar thumb has teal border
- 3px spacing between scrollbar and panel edge (via content margin-right)

### Global Scrollbar (Fallback)

- **Width**: 10px
- **Track**: Background #1a2525, border-left 1px solid #4a6b6b
- **Thumb**: Background #0f1515, border 1px solid #4a6b6b
- **Thumb hover**: Background #1a2525
- **Arrows**: Hidden (`display: none`)
- **Note**: Use webkit pseudo-elements, avoid `scrollbar-width` and `scrollbar-color` (Chrome 121+ conflict)

## Decorative UI Elements

### System Information Panel Decorations

The galaxy map system info panel includes decorative elements below the panel.

**Indicator Boxes**:
- Count: 12 boxes, 14×14px each, 10px spacing
- Color: Muted burgundy (#6b4a4a), opacity 0.7
- Width: (12 × 14px) + (11 × 10px) = 278px total
- Position: 5px below panel, left-aligned

**Rectangle Decoration**:
- Height: 14px, extends from boxes to panel right edge
- Color: #6b4a4a, opacity 0.6
- Spacing: 10px gap from rightmost indicator box

**Triangle Decoration**:
- Isosceles right triangle, 35×35px legs
- Color: #6b4a4a, opacity 0.6
- Position: 5px above rectangle, right-aligned with panel
- Implementation: `clip-path: polygon(0 100%, 100% 100%, 100% 0)`

**Dynamic Positioning**:
Uses `updateIndicatorBoxesPosition()` with ResizeObserver for accurate viewport-relative positioning. Elements positioned as siblings outside panel to avoid `clip-path` clipping.
