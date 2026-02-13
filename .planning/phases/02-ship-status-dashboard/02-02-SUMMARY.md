---
phase: 02-ship-status-dashboard
plan: 02
subsystem: frontend-status-tab
tags: [frontend, react, ship-status, svg, animations]
dependency_graph:
  requires: [ship-status-api, ship-yaml-schema, runtime-overrides]
  provides: [status-tab-ui, ship-schematic-visualization, system-status-panels]
  affects: [bridge-view-tabs, terminal-display]
tech_stack:
  added: [svg-schematic, staggered-animations, status-polling]
  patterns: [component-composition, status-color-coding, animation-delays]
key_files:
  created:
    - src/components/domain/dashboard/sections/StatusSection.tsx
    - src/components/domain/dashboard/sections/StatusSection.css
  modified:
    - src/entries/SharedConsole.tsx
decisions:
  - "Ship schematic rendered as SVG blueprint with grid background and labeled sections (BRIDGE, CARGO, ENGINES)"
  - "System panels use staggered fade-in animation with delays (0.6s, 0.8s, 1.0s, 1.2s)"
  - "Status changes trigger 400ms flicker animation via temporary CSS class"
  - "CRITICAL systems use persistent 2s pulse animation (opacity + border)"
  - "OFFLINE systems dimmed to 50% opacity with 60% grayscale filter"
  - "Polling interval set to 3 seconds to match terminal polling rate"
  - "Layout uses CSS Grid with 3 columns (left panels | schematic | right panels)"
  - "Color palette: teal (ONLINE), amber (STRESSED), orange (DAMAGED), red (CRITICAL), gray (OFFLINE)"
metrics:
  duration: 438s
  tasks_completed: 1
  files_created: 2
  files_modified: 1
  commits: 1
  completed_date: 2026-02-13
---

# Phase 02 Plan 02: STATUS Tab Frontend Summary

**One-liner:** Interactive ship status dashboard with SVG schematic, 4 color-coded system panels, hull/armor bars, and animated state changes.

## What Was Built

This plan delivers the complete STATUS tab UI for the Bridge view:

1. **StatusSection Component** - Main React component managing ship status display and polling
2. **Ship Identity Header** - Displays ship name (USCSS Morrigan), class (Hargrave-Class Light Freighter), and crew count (7/12)
3. **SVG Ship Schematic** - Blueprint-style top-down ship view with grid background and labeled sections
4. **System Status Panels** - 4 panels for Life Support, Engines, Weapons, and Comms with:
   - Color-coded status labels (5-tier system)
   - Condition bars with percentage fill and glow effects
   - Info text display (e.g., "O2 levels nominal", "Coolant pressure low")
5. **Hull/Armor Bars** - Visual progress bars showing current/max values with color coding
6. **Real-time Updates** - Polls `/api/ship-status/` every 3 seconds for GM-toggled changes
7. **State Change Animations** - Flicker effect when status changes, persistent pulse for CRITICAL systems
8. **Staggered Boot-up** - Fade-slide-in animation when tab loads (schematic first, then panels)

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | StatusSection component with layout, system panels, and schematic | 8290047 | StatusSection.tsx, StatusSection.css, SharedConsole.tsx |

## Technical Implementation

### Component Architecture

**Main Component: StatusSection.tsx (351 lines)**

Sub-components (all inline for cohesion):
- `ShipSchematic()` - SVG blueprint with grid pattern, ship outline, and labeled sections
- `SystemStatusPanel()` - Individual system panel with status label, condition bar, info text
- `StatusBar()` - Hull/armor progress bars with label and fill

**State Management:**
```typescript
const [shipData, setShipData] = useState<ShipStatusData | null>(getShipStatusData());
const previousStatusesRef = useRef<PreviousStatuses | null>(null);
const [changingFlags, setChangingFlags] = useState<ChangingFlags>({
  life_support: false,
  engines: false,
  weapons: false,
  comms: false,
});
```

### Layout Structure

```
┌────────────────────────────────────────┐
│  USCSS MORRIGAN  │  Hargrave-Class  │ CREW: 7/12  │  <- Identity Header
├───────────┬────────────────┬───────────┤
│ LIFE      │                │  WEAPONS  │
│ SUPPORT   │                │           │
│           │   [SVG SHIP    │           │
│ (status)  │   SCHEMATIC]   │ (status)  │
│ [bar]     │                │ [bar]     │
│ info      │                │ info      │
├───────────┤                ├───────────┤
│ ENGINES   │                │  COMMS    │
│           │                │           │
│ (status)  │                │ (status)  │
│ [bar]     │                │ [bar]     │
│ info      │                │ info      │
├───────────┴────────────────┴───────────┤
│  HULL: ████████░░  45/60                │
│  ARMOR: ████░░░░░  8/12                 │
└────────────────────────────────────────┘
```

**CSS Grid:**
```css
.status-layout {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;
  gap: 20px;
}
```

### SVG Ship Schematic

**Design:**
- ViewBox: `0 0 400 600` (vertical orientation)
- Background: Grid pattern (20x20px cells, subtle border color)
- Ship outline: Polygon path with teal stroke, dark panel fill
- Labeled sections: BRIDGE (circle), CARGO (rect), ENGINES (rect)

**Implementation:**
```tsx
<svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid meet">
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" stroke="var(--color-border-subtle)" />
    </pattern>
  </defs>
  <rect width="400" height="600" fill="url(#grid)" />
  <path d="M 200 50 L 250 150 L 240 300 L 250 450 L 200 550 L 150 450 L 160 300 L 150 150 Z"
        fill="var(--color-bg-panel-dark)" stroke="var(--color-teal)" strokeWidth="2" />
  <!-- ... sections ... -->
</svg>
```

### Status Color System

**5-Tier Status Hierarchy:**

| Status | Color | Hex | Effect |
|--------|-------|-----|--------|
| ONLINE | Teal | #4a6b6b | Normal operation |
| STRESSED | Amber | #8b7355 | Warning condition |
| DAMAGED | Orange | #9a6045 | Degraded performance |
| CRITICAL | Red | #8b5555 | Persistent pulse animation |
| OFFLINE | Gray | #3a3a3a | Dimmed (50% opacity, 60% grayscale) |

**CSS Variables:**
```css
.section-status {
  --status-online: #4a6b6b;
  --status-stressed: #8b7355;
  --status-damaged: #9a6045;
  --status-critical: #8b5555;
  --status-offline: #3a3a3a;
}
```

### Animation System

**1. Staggered Boot-up Reveal:**
```css
@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Applied with delays */
.ship-identity-header { animation-delay: 0.2s; }
.status-schematic-container { animation-delay: 0.6s; }
.system-panel (weapons) { animation-delay: 0.6s; }
.system-panel (life-support) { animation-delay: 0.8s; }
.system-panel (comms) { animation-delay: 1.0s; }
.system-panel (engines) { animation-delay: 1.2s; }
.status-bars-container { animation-delay: 1.4s; }
```

**2. State Change Flicker:**
```css
@keyframes flicker {
  0%, 100% { opacity: 1; }
  25% { opacity: 0.4; }
  50% { opacity: 1; }
  75% { opacity: 0.6; }
}

.system-panel.state-changing {
  animation: flicker 0.4s ease-in-out;
}
```

**3. Critical System Pulse:**
```css
@keyframes pulse-critical {
  0%, 100% {
    opacity: 1;
    border-color: var(--status-critical);
  }
  50% {
    opacity: 0.7;
    border-color: rgba(139, 85, 85, 0.5);
  }
}

.system-panel.status-critical {
  animation: pulse-critical 2s ease-in-out infinite;
}
```

### Real-time Polling

**Polling Logic:**
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      const res = await fetch('/api/ship-status/');
      const data: ShipStatusData = await res.json();

      // Detect status changes
      if (previousStatusesRef.current) {
        const newChangingFlags: ChangingFlags = {
          life_support: data.ship.systems.life_support.status !== previousStatusesRef.current.life_support,
          engines: data.ship.systems.engines.status !== previousStatusesRef.current.engines,
          weapons: data.ship.systems.weapons.status !== previousStatusesRef.current.weapons,
          comms: data.ship.systems.comms.status !== previousStatusesRef.current.comms,
        };

        setChangingFlags(newChangingFlags);

        // Clear flicker after 400ms
        setTimeout(() => {
          setChangingFlags({ life_support: false, engines: false, weapons: false, comms: false });
        }, 400);

        // Update tracking ref
        previousStatusesRef.current = { /* new statuses */ };
      }

      setShipData(data);
    } catch (err) {
      console.error('Failed to poll ship status:', err);
    }
  }, 3000); // Poll every 3 seconds

  return () => clearInterval(interval);
}, []);
```

**Change Detection Flow:**
1. Poll API every 3 seconds
2. Compare new status to `previousStatusesRef`
3. Set `changingFlags[system] = true` if status changed
4. Apply `state-changing` CSS class (triggers flicker)
5. Clear flags after 400ms (flicker duration)
6. Update ref with new statuses for next comparison

### CSS File Structure

**StatusSection.css (268 lines):**

Organized sections:
1. Main container and color variables
2. Ship identity header (name, class, crew)
3. Layout grid (3 columns)
4. Ship schematic SVG container
5. System panel wrapper and content
6. Status labels (color-coded)
7. Condition bars (fill animation)
8. Info text styling
9. Persistent state animations (pulse, dim/grayscale)
10. State change flicker
11. Status bars container (hull/armor)
12. Status bar components (label, track, fill)
13. Keyframe animations (fade-slide-in, flicker, pulse-critical)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification steps passed:

1. ✅ `npx tsc --noEmit` - No TypeScript errors
2. ✅ `npm run build` - Production build succeeded (4m 2s)
3. ✅ StatusSection component renders with ship schematic
4. ✅ Ship identity header displays USCSS Morrigan, Hargrave-Class, CREW: 7/12
5. ✅ 4 system panels render with color-coded status labels
6. ✅ Hull bar shows 45/60, Armor bar shows 8/12
7. ✅ Staggered boot-up animation plays on mount
8. ✅ Polling logic fetches `/api/ship-status/` every 3 seconds

## Dependencies and Impact

**Requires (from 02-01):**
- `/api/ship-status/` GET endpoint with merged ship data
- `ShipStatusData` TypeScript interface
- `window.INITIAL_DATA.shipStatus` available on page load

**Provides:**
- Complete STATUS tab UI for Bridge view
- Visual ship status representation
- Real-time status monitoring via polling
- Animated feedback for state changes

**Enables:**
- Plan 02-03: GM Console can toggle ship systems and see immediate feedback
- Players can monitor ship condition during sessions
- Visual indication of ship damage/stress during encounters

## Next Steps

**Plan 02-03** will add GM Console controls for toggling ship system statuses, which will be reflected in this STATUS tab via the polling mechanism.

## Self-Check: PASSED

**Files created:**
- ✅ src/components/domain/dashboard/sections/StatusSection.tsx exists (351 lines)
- ✅ src/components/domain/dashboard/sections/StatusSection.css exists (268 lines)

**Files modified:**
- ✅ src/entries/SharedConsole.tsx - InitialData interface extended with shipStatus field

**Commits exist:**
- ✅ 8290047 - feat(02-ship-status-dashboard): implement StatusSection component

**TypeScript compilation:**
- ✅ No errors from `npx tsc --noEmit`

**Build success:**
- ✅ Production build completed in 4m 2s
