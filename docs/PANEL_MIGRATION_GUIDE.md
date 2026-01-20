# Panel Component Migration Guide

This guide helps you migrate from old panel creation patterns to the new standardized Panel component system.

## Overview

The new panel system provides:
- **Consistent API**: All panels use the same component interface
- **Reusable Components**: `Panel`, `DashboardPanel`, `CompactPanel`, `InfoPanel`
- **Type Safety**: Full TypeScript support
- **Utility Functions**: Helpers for common panel configurations
- **Hooks**: State management for collapsible, resizable, draggable panels

## Migration Checklist

- [ ] Identify all panel usage in your codebase
- [ ] Replace inline panel components with standardized variants
- [ ] Update className-based panels to use component props
- [ ] Consolidate CSS (remove duplicate panel styles)
- [ ] Update imports to use new components
- [ ] Test visual appearance and functionality
- [ ] Remove deprecated code

## Common Migration Patterns

### Pattern 1: Inline Panel Component

**Before:**
```tsx
interface DashboardPanelProps {
  title: string;
  children: ReactNode;
  className?: string;
}

function DashboardPanel({ title, children, className = '' }: DashboardPanelProps) {
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

// Usage
<DashboardPanel title="CREW" className="chamfer-tr-bl corner-line-tr-bl">
  <p>Crew list</p>
</DashboardPanel>
```

**After:**
```tsx
import { DashboardPanel } from '@components/ui/DashboardPanel';

// Usage
<DashboardPanel title="CREW" chamferCorners={['tr', 'bl']}>
  <p>Crew list</p>
</DashboardPanel>
```

**Changes:**
1. Remove inline component definition
2. Import `DashboardPanel` from `@components/ui/DashboardPanel`
3. Replace `className` with `chamferCorners` prop
4. Remove manual chamfer and corner-line classes

### Pattern 2: HTML/CSS Panel

**Before:**
```html
<div class="panel-wrapper chamfer-tl chamfer-br">
  <div class="corner-tl"></div>
  <div class="corner-br"></div>
  <div class="panel-header">
    <h3>SYSTEM STATUS</h3>
  </div>
  <div class="panel-content">
    <p>Status information</p>
  </div>
</div>
```

**After:**
```tsx
import { Panel } from '@components/ui/Panel';

<Panel title="SYSTEM STATUS" chamferCorners={['tl', 'br']}>
  <p>Status information</p>
</Panel>
```

**Changes:**
1. Convert HTML to JSX using `Panel` component
2. Move title to `title` prop
3. Remove manual corner elements (handled automatically)
4. Simplify content structure

### Pattern 3: Legacy Dashboard Panel

**Before:**
```tsx
<div className="panel-base border-all chamfer-tr-bl corner-line-tr-bl">
  <div className="dashboard-panel-header">
    <h3>NOTES</h3>
  </div>
  <div className="dashboard-panel-content">
    {notes.map((note, i) => <p key={i}>&gt; {note}</p>)}
  </div>
</div>
```

**After:**
```tsx
import { DashboardPanel } from '@components/ui/DashboardPanel';

<DashboardPanel title="NOTES" chamferCorners={['tr', 'bl']}>
  {notes.map((note, i) => <p key={i}>&gt; {note}</p>)}
</DashboardPanel>
```

**Changes:**
1. Import `DashboardPanel`
2. Replace `div` structure with component
3. Use `chamferCorners` prop instead of CSS classes
4. Remove wrapper classes (`border-all`, `corner-line-*`)

### Pattern 4: Info Panel Refactoring

**Before:**
```tsx
<div className="info-panel">
  <div className="info-panel-header">
    <h3>SYSTEM INFO</h3>
  </div>
  <div className="info-panel-content">
    <div className="info-panel-body">
      {/* Content */}
    </div>
  </div>
</div>
```

**After:**
```tsx
import { InfoPanel, buildSystemInfoHTML } from '@components/domain/dashboard/InfoPanel';

const content = buildSystemInfoHTML({
  type: 'G-type main-sequence',
  description: 'Home star system',
  population: '8.2 billion',
});

<InfoPanel
  title="SYSTEM INFO"
  content={content}
  visible={true}
/>
```

**Changes:**
1. Use `InfoPanel` component with typewriter effect
2. Build content using helper functions
3. Remove manual HTML structure
4. Automatic visibility and animation handling

## CSS Migration

### Consolidating Panel Styles

**Before:**
```css
/* CampaignDashboard.css */
.panel-base {
  background-color: var(--color-bg-panel);
  position: relative;
  display: flex;
  flex-direction: column;
}

.dashboard-panel-header {
  padding: 12px 2px 0 2px;
}

.dashboard-panel-header h3 {
  color: var(--color-teal);
  font-size: 13px;
  letter-spacing: 2px;
}

.dashboard-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background-color: #171717;
}

/* More duplicate styles... */
```

**After:**
```css
/* CampaignDashboard.css */
/* Panel styles now handled by Panel component */
/* Keep only dashboard-specific overrides */

.campaign-dashboard .panel-wrapper {
  /* Dashboard-specific customizations if needed */
}
```

**Changes:**
1. Remove duplicate panel base styles
2. Keep only component-specific overrides
3. Rely on Panel component's built-in styles
4. Use CSS custom properties for customization

### Removing Chamfer Utility Classes

**Before:**
```css
.chamfer-tl {
  clip-path: polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px);
}

.chamfer-tr {
  clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
}

/* More chamfer classes... */

.corner-line-tr-bl::before {
  /* Diagonal line styles */
}

.corner-line-tr-bl::after {
  /* Diagonal line styles */
}
```

**After:**
```css
/* Chamfer styles now handled by Panel.css */
/* Remove all utility classes from component CSS */
```

**Changes:**
1. Delete chamfer utility classes (handled by `Panel.css`)
2. Delete corner-line pseudo-element styles (handled by Panel component)
3. Trust centralized styling in `Panel.css`

## Step-by-Step Migration Example

Let's migrate the `CampaignDashboard` component as a complete example.

### Step 1: Identify Current Implementation

```tsx
// OLD: CampaignDashboard.tsx
interface DashboardPanelProps {
  title: string;
  children: ReactNode;
  className?: string;
}

function DashboardPanel({ title, children, className = '' }: DashboardPanelProps) {
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

export function CampaignDashboard() {
  return (
    <div>
      <DashboardPanel title="NOTES" className="chamfer-tr-bl corner-line-tr-bl">
        <p>Note content</p>
      </DashboardPanel>

      <DashboardPanel title="STATUS" className="chamfer-tl-br corner-line-tl-br">
        <p>Status content</p>
      </DashboardPanel>
    </div>
  );
}
```

### Step 2: Import New Components

```tsx
// NEW: CampaignDashboard.tsx
import { DashboardPanel } from '@components/ui/DashboardPanel';

export function CampaignDashboard() {
  // ... implementation
}
```

### Step 3: Replace Inline Component

```tsx
// Remove inline DashboardPanel component
// Delete this entire function:
// function DashboardPanel({ title, children, className = '' }: DashboardPanelProps) { ... }
```

### Step 4: Update Component Usage

```tsx
// OLD
<DashboardPanel title="NOTES" className="chamfer-tr-bl corner-line-tr-bl">
  <p>Note content</p>
</DashboardPanel>

// NEW
<DashboardPanel title="NOTES" chamferCorners={['tr', 'bl']}>
  <p>Note content</p>
</DashboardPanel>
```

### Step 5: Clean Up CSS

```css
/* OLD: CampaignDashboard.css */
.panel-base { /* ... */ }
.dashboard-panel-header { /* ... */ }
.dashboard-panel-content { /* ... */ }
.chamfer-tr-bl { /* ... */ }
.corner-line-tr-bl::before { /* ... */ }
.corner-line-tr-bl::after { /* ... */ }

/* NEW: CampaignDashboard.css */
/* Remove all panel base styles - handled by DashboardPanel component */
/* Keep only dashboard-specific layout */
.campaign-dashboard {
  /* Grid layout, positioning, etc. */
}
```

### Step 6: Test

1. Visual check: Panel appearance matches old design
2. Functional check: Scrolling, interactions work
3. Responsive check: Panels resize correctly

## Common Pitfalls

### Pitfall 1: Forgetting to Remove Old CSS

**Problem:**
```css
/* Old CSS still present, causing conflicts */
.panel-base {
  height: 500px; /* Conflicts with Panel component */
}
```

**Solution:**
```css
/* Remove all generic panel styles */
/* Keep only component-specific overrides */
.campaign-dashboard .dashboard-panel-content {
  /* Dashboard-specific styling if needed */
}
```

### Pitfall 2: Incorrect Chamfer Corner Syntax

**Problem:**
```tsx
<DashboardPanel title="PANEL" chamferCorners="tr-bl"> {/* Wrong: string */}
```

**Solution:**
```tsx
<DashboardPanel title="PANEL" chamferCorners={['tr', 'bl']}> {/* Correct: array */}
```

### Pitfall 3: Missing Imports

**Problem:**
```tsx
// No import
<DashboardPanel title="PANEL"> {/* Error: component not defined */}
```

**Solution:**
```tsx
import { DashboardPanel } from '@components/ui/DashboardPanel';

<DashboardPanel title="PANEL">
```

### Pitfall 4: Trying to Use className for Chamfers

**Problem:**
```tsx
<DashboardPanel title="PANEL" className="chamfer-tr-bl"> {/* Won't work */}
```

**Solution:**
```tsx
<DashboardPanel title="PANEL" chamferCorners={['tr', 'bl']}> {/* Correct */}
```

## Testing Your Migration

### Visual Regression Checklist

- [ ] Panel backgrounds match original
- [ ] Chamfered corners render at correct positions
- [ ] Diagonal corner lines appear correctly
- [ ] Border colors and thickness match
- [ ] Panel headers have correct styling
- [ ] Content scrolling works
- [ ] Scrollbar styling matches
- [ ] Active state (if used) renders correctly
- [ ] Panel spacing and gaps match layout
- [ ] Font sizes and colors match

### Functional Testing Checklist

- [ ] Panel content scrolls correctly
- [ ] Header actions (if present) work
- [ ] Footer content (if present) displays
- [ ] Collapsible panels expand/collapse
- [ ] Panel resize behavior works
- [ ] Active/inactive states toggle
- [ ] Click handlers fire correctly
- [ ] No console errors or warnings

### Code Quality Checklist

- [ ] No duplicate panel CSS remaining
- [ ] All imports are correct
- [ ] TypeScript types are satisfied
- [ ] No unused classes in HTML/JSX
- [ ] Consistent chamfer corner usage
- [ ] Component structure is clean
- [ ] File size reduced (less duplication)

## Getting Help

If you encounter issues during migration:

1. **Check the Documentation**: Review `/src/components/ui/README.md`
2. **Compare Examples**: Look at migrated components (e.g., `CampaignDashboard.tsx`, `InfoPanel.tsx`)
3. **Inspect CSS**: Use browser DevTools to check applied styles
4. **Validate Props**: Ensure all props match component interface
5. **Test in Isolation**: Create a minimal test case to debug

## Benefits After Migration

Once migration is complete, you'll have:

✅ **Consistency**: All panels use the same component system
✅ **Maintainability**: Single source of truth for panel styling
✅ **Type Safety**: Full TypeScript support catches errors early
✅ **Flexibility**: Easy to create new panel variants
✅ **Less Code**: Reduced duplication and boilerplate
✅ **Better DX**: Clear API with documentation and examples
✅ **Future-Proof**: Easy to add new features (drag, resize, etc.)

## Next Steps

After completing migration:

1. **Remove Deprecated Code**: Delete old inline components and unused CSS
2. **Update Documentation**: Document any custom panel patterns
3. **Share Knowledge**: Help team members migrate their components
4. **Monitor Performance**: Verify no performance regressions
5. **Iterate**: Identify opportunities for further improvements
