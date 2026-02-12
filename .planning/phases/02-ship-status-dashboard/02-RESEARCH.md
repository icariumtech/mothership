# Phase 2: Ship Status Dashboard - Research

**Researched:** 2026-02-12
**Domain:** React dashboard UI, Django file-based data API, SVG/Canvas rendering
**Confidence:** HIGH

## Summary

Phase 2 implements a ship status dashboard in the Bridge STATUS tab showing real-time ship systems (life support, engines, weapons, comms), hull/armor integrity, crew count, and ship identity. The implementation follows established patterns from Phase 1 (LOGS tab), using React components with Django backend serving file-based YAML data. The centerpiece is a top-down ship schematic (SVG blueprint style) with flanking system panels showing 5-tier status states (Online/Stressed/Damaged/Critical/Offline). GM controls system states from GM Console, triggering animated transitions on the terminal display.

**Primary recommendation:** Use React functional components with DashboardPanel wrappers, load ship data from `data/campaign/ship.yaml` via new Django API endpoint (`/api/ship-status/`), render schematic as inline SVG with CSS styling, and implement state transitions with CSS animations. Avoid external chart libraries - build minimal bar components with native HTML/CSS.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Dashboard layout**
- Top-down ship schematic as visual centerpiece (blueprint-style overhead view)
- Ship identity info (name, class, hull/armor, crew) overlaid on/adjacent to the schematic
- 4 system panels flanking the schematic — 2 on each side (Left: Life Support + Engines, Right: Weapons + Comms)
- Layout inspired by encounter map views — image-centric with data panels around it

**System state display**
- 5 states per system: Online / Stressed / Damaged / Critical / Offline
- Each panel shows: status text label (color-coded) + condition bar below
- Brief info line per system (1-2 lines of flavor context, e.g., "Thrust capacity: 80%", "O2: nominal")
- Hull: visual bar showing current/max plus numeric value (e.g., "HULL: 45/60")
- Armor: bar + numeric display alongside hull

**Status animations**
- Moderate transition drama: color change + brief flicker/flash on affected panel when state changes
- Persistent pulse: critical systems gently pulse, offline systems dim/grayed — ongoing visual reminder
- No visual effects on ship schematic from hull damage (schematic stays clean)
- Staggered reveal on tab load: ship schematic fades in, then panels appear one by one (boot-up sequence feel)

### Claude's Discretion
- GM toggle control design (how GM changes system states in GM Console)
- Exact color mapping for each of the 5 states
- Ship schematic art style and positioning details
- Pulse timing and flicker implementation
- Staggered reveal timing and easing
- Panel border/styling details within CRT aesthetic

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Already in project, hooks pattern |
| TypeScript | 5.x | Type safety | All frontend uses TS |
| Django | 5.2.7 | Backend API | Project backend framework |
| PyYAML | - | YAML parsing | Existing data loader pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| DashboardPanel | (local) | Panel wrapper component | All dashboard sections |
| Ant Design | 6.1 | Select dropdowns (GM Console) | Only for GM controls |
| CSS animations | Native | State transitions | Flicker/pulse effects |
| SVG | Native | Ship schematic | Blueprint-style rendering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native CSS bars | Recharts / Chart.js | Charts add 50-100KB bundle size, overkill for simple bars |
| Inline SVG | React Three Fiber | R3F is for 3D scenes, not 2D blueprints |
| useState | Zustand store | Local component state sufficient for this phase |

**Installation:**
```bash
# No new dependencies needed - use existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/domain/dashboard/sections/
├── StatusSection.tsx           # Main section component
├── ShipSchematic.tsx            # SVG ship blueprint centerpiece
├── SystemStatusPanel.tsx        # Reusable system panel (4 instances)
├── ShipIdentityHeader.tsx       # Name, class, hull, armor, crew
└── StatusSection.css            # Animations and bar styling

data/campaign/
└── ship.yaml                    # Ship status data (file-based)

terminal/
├── views.py                     # Add api_ship_status() endpoint
└── data_loader.py               # Add load_ship_status() method
```

### Pattern 1: Dashboard Section Component
**What:** Section component wrapping multiple panels, similar to LogsSection
**When to use:** All Bridge tab sections
**Example:**
```typescript
// Source: src/components/domain/dashboard/sections/LogsSection.tsx
export function StatusSection() {
  const [shipData, setShipData] = useState<ShipStatusData | null>(null);

  useEffect(() => {
    fetch('/api/ship-status/')
      .then(res => res.json())
      .then(data => setShipData(data));
  }, []);

  if (!shipData) return <div>Loading...</div>;

  return (
    <div className="section-status">
      <ShipIdentityHeader ship={shipData} />
      <div className="status-layout">
        <ShipSchematic schematic={shipData.schematic} />
        <SystemStatusPanel system={shipData.systems.life_support} position="left" />
        {/* ... other panels */}
      </div>
    </div>
  );
}
```

### Pattern 2: DashboardPanel Wrapper
**What:** Pre-configured Panel component with tr-bl chamfering
**When to use:** All dashboard content panels
**Example:**
```typescript
// Source: src/components/ui/DashboardPanel.tsx
<DashboardPanel
  title="LIFE SUPPORT"
  chamferCorners={['tr', 'bl']}
  className={statusClass}
>
  <div className="system-status-label">{statusText}</div>
  <div className="system-status-bar">
    <div className="bar-fill" style={{ width: `${percentage}%` }} />
  </div>
</DashboardPanel>
```

### Pattern 3: File-Based Data Loading
**What:** Django loads YAML files on-demand, returns JSON to React
**When to use:** All campaign data (crew, ship, sessions, NPCs)
**Example:**
```python
# Source: terminal/data_loader.py (load_crew pattern)
def load_ship_status(self):
    """Load ship status from data/campaign/ship.yaml"""
    ship_file = os.path.join(self.campaign_dir, 'ship.yaml')
    if not os.path.exists(ship_file):
        return None

    with open(ship_file, 'r') as f:
        ship_data = yaml.safe_load(f)

    return ship_data

# In views.py
def api_ship_status(request):
    loader = DataLoader()
    ship_data = loader.load_ship_status()
    return JsonResponse(ship_data, safe=False)
```

### Pattern 4: CSS Animations for State Changes
**What:** Keyframe animations for flicker/pulse effects
**When to use:** Status transitions and persistent alerts
**Example:**
```css
/* Flicker on state change (trigger with class) */
.system-panel.state-changing {
  animation: flicker 0.4s ease-out;
}

@keyframes flicker {
  0%, 100% { opacity: 1; }
  25%, 75% { opacity: 0.7; }
  50% { opacity: 0.4; }
}

/* Persistent pulse for critical systems */
.system-panel.critical {
  animation: pulse-critical 2s ease-in-out infinite;
}

@keyframes pulse-critical {
  0%, 100% {
    border-color: var(--color-critical);
    opacity: 1;
  }
  50% {
    border-color: var(--color-critical-dim);
    opacity: 0.8;
  }
}

/* Staggered reveal on mount */
.ship-schematic {
  animation: fade-in 0.6s ease-out;
}

.system-panel:nth-child(1) { animation: fade-in 0.4s ease-out 0.6s backwards; }
.system-panel:nth-child(2) { animation: fade-in 0.4s ease-out 0.8s backwards; }
.system-panel:nth-child(3) { animation: fade-in 0.4s ease-out 1.0s backwards; }
.system-panel:nth-child(4) { animation: fade-in 0.4s ease-out 1.2s backwards; }

@keyframes fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Pattern 5: SVG Ship Schematic
**What:** Inline SVG with <rect>, <path>, <line> elements for blueprint aesthetic
**When to use:** Ship schematic centerpiece
**Example:**
```typescript
export function ShipSchematic({ schematic }: { schematic: SchematicData }) {
  return (
    <svg
      viewBox="0 0 400 300"
      className="ship-schematic"
      style={{ maxWidth: 400, maxHeight: 300 }}
    >
      {/* Background grid for blueprint feel */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--color-border-subtle)" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      {/* Ship outline */}
      <path
        d="M 200 50 L 250 100 L 250 200 L 200 250 L 150 200 L 150 100 Z"
        fill="var(--color-bg-panel-dark)"
        stroke="var(--color-teal)"
        strokeWidth="2"
      />

      {/* Section labels */}
      <text x="200" y="90" textAnchor="middle" fill="var(--color-text-muted)" fontSize="10">
        BRIDGE
      </text>
    </svg>
  );
}
```

### Anti-Patterns to Avoid
- **External chart libraries for simple bars:** Adds 50-100KB for features we won't use. Use native `<div>` with CSS `width` percentage.
- **Image files for schematics:** Hard to style dynamically, can't use CSS variables. Use inline SVG.
- **Zustand store for ship state:** Local component state sufficient, no cross-component coordination needed in this phase.
- **Imperative animations (GSAP):** CSS keyframes are simpler for these effects, no RAF loop needed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Panel borders/chamfering | Custom SVG clip-path | DashboardPanel component | Already handles chamfering, borders, styling |
| GM dropdowns/selects | Custom select component | Ant Design Select | Already in project, accessible, keyboard nav |
| YAML parsing | Custom parser | PyYAML (DataLoader) | Handles edge cases, nested structures, type coercion |
| API CSRF tokens | Manual token management | Django CSRF middleware | Automatic cookie handling, secure defaults |

**Key insight:** The project already has robust patterns for all major architectural pieces. Focus effort on domain-specific rendering (schematic, status bars) rather than rebuilding infrastructure.

## Common Pitfalls

### Pitfall 1: CSS Animation Conflicts
**What goes wrong:** Multiple animations on same element (e.g., stagger reveal + pulse) cause flicker/jank
**Why it happens:** CSS animations don't compose well without careful timing
**How to avoid:**
- Use separate elements for persistent (pulse) and one-time (reveal) animations
- Apply reveal to outer container, pulse to inner panel
- Use `animation-fill-mode: backwards` to prevent FOUC during reveal delay
**Warning signs:** Panel "jumps" or flickers on mount, animation stutters

### Pitfall 2: SVG Viewbox Sizing
**What goes wrong:** Schematic doesn't scale properly in panel, appears cut off or stretched
**Why it happens:** SVG viewBox coordinates don't match container aspect ratio
**How to avoid:**
- Set viewBox to match design coordinates (e.g., `0 0 400 300` for 4:3 aspect)
- Use `preserveAspectRatio="xMidYMid meet"` to maintain aspect ratio
- Set `maxWidth` and `maxHeight` on SVG element to constrain size
**Warning signs:** Schematic looks squashed on different screen sizes

### Pitfall 3: State Change Race Conditions
**What goes wrong:** Multiple rapid GM status changes cause animation conflicts
**Why it happens:** React batches state updates, animations overlap
**How to avoid:**
- Debounce GM toggle calls (300ms)
- Use `key` prop on SystemStatusPanel to force remount on status change
- Clear previous animation classes before adding new ones
**Warning signs:** Panels stuck in "flickering" state, animations don't complete

### Pitfall 4: YAML Schema Mismatch
**What goes wrong:** Backend returns null/errors, frontend crashes on missing fields
**Why it happens:** YAML file doesn't match expected schema, no validation
**How to avoid:**
- Provide complete example ship.yaml in DATA_DIRECTORY_GUIDE.md
- Add TypeScript interface for ShipStatusData with required fields
- Backend returns sensible defaults for missing optional fields
- Frontend checks for null before rendering
**Warning signs:** Console errors about undefined properties, blank sections

### Pitfall 5: Color Palette Inconsistency
**What goes wrong:** Status colors don't match style guide, visual confusion
**Why it happens:** Hardcoded hex values instead of CSS variables
**How to avoid:**
- Use CSS variables from STYLE_GUIDE.md (--color-teal, --color-amber, etc.)
- Define status-specific colors in :root (--status-online, --status-critical)
- Reference variables in both CSS and inline styles
**Warning signs:** Colors look different from other dashboard elements

## Code Examples

Verified patterns from existing codebase:

### Loading Initial Data in React
```typescript
// Source: src/entries/SharedConsole.tsx (display_view_react pattern)
// Backend passes JSON via Django template
function getShipData(): ShipStatusData {
  return window.INITIAL_DATA?.ship || null;
}

export function StatusSection() {
  const [shipData, setShipData] = useState<ShipStatusData | null>(getShipData());

  // Optional: poll for updates if GM can change state during session
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/ship-status/')
        .then(res => res.json())
        .then(data => setShipData(data));
    }, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, []);

  // ...
}
```

### Simple Status Bar Component
```typescript
interface StatusBarProps {
  current: number;
  max: number;
  variant?: 'hull' | 'armor' | 'system';
}

export function StatusBar({ current, max, variant = 'system' }: StatusBarProps) {
  const percentage = Math.round((current / max) * 100);
  const width = Math.max(0, Math.min(100, percentage));

  return (
    <div className={`status-bar status-bar-${variant}`}>
      <div className="status-bar-bg" />
      <div
        className="status-bar-fill"
        style={{ width: `${width}%` }}
      />
      <div className="status-bar-text">
        {current} / {max}
      </div>
    </div>
  );
}
```

### GM Toggle System State (Backend)
```python
# In terminal/views.py
@login_required
def api_toggle_system_state(request):
    """Toggle a ship system's status (GM only)"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    system_name = request.POST.get('system')
    new_state = request.POST.get('state')

    # Load current ship data
    loader = DataLoader()
    ship_data = loader.load_ship_status()

    # Update state in memory (or write back to YAML)
    if system_name in ship_data['systems']:
        ship_data['systems'][system_name]['status'] = new_state

        # Option 1: Store in session/cache (runtime only)
        request.session['ship_status_overrides'] = ship_data

        # Option 2: Write back to YAML (persistent)
        # loader.save_ship_status(ship_data)

    return JsonResponse({'success': True, 'system': system_name, 'state': new_state})
```

### System Status Panel with Pulse
```typescript
interface SystemPanelProps {
  name: string;
  status: 'ONLINE' | 'STRESSED' | 'DAMAGED' | 'CRITICAL' | 'OFFLINE';
  condition: number; // 0-100 percentage
  info?: string;
}

export function SystemStatusPanel({ name, status, condition, info }: SystemPanelProps) {
  const statusClass = `system-panel status-${status.toLowerCase()}`;

  return (
    <DashboardPanel
      title={name}
      chamferCorners={['tr', 'bl']}
      className={statusClass}
      padding="12px"
    >
      <div className="system-status-label">{status}</div>
      <StatusBar current={condition} max={100} variant="system" />
      {info && <div className="system-info">{info}</div>}
    </DashboardPanel>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Imperative Three.js | React Three Fiber (R3F) | Phase 1 | Better memory management, declarative API |
| Prop drilling | Zustand stores | Phase 1 | Centralized state for 3D scenes |
| Placeholder sections | Functional implementations | Phase 1 (LOGS) | Established dashboard patterns |
| Manual RAF loops | useFrame hook (R3F) | Phase 1 | Unified animation loop |

**Deprecated/outdated:**
- None specific to this phase - project is using modern React 19 patterns

## Data Schema

### ship.yaml Structure
```yaml
# data/campaign/ship.yaml
ship:
  name: "USCSS Morrigan"
  class: "Medium Freighter"
  crew_count: 7
  crew_capacity: 12

  hull:
    current: 45
    max: 60

  armor:
    current: 8
    max: 12

  systems:
    life_support:
      status: "ONLINE"           # ONLINE | STRESSED | DAMAGED | CRITICAL | OFFLINE
      condition: 100             # 0-100 percentage
      info: "O2 levels nominal"

    engines:
      status: "STRESSED"
      condition: 72
      info: "Coolant pressure low"

    weapons:
      status: "ONLINE"
      condition: 100
      info: "Defense grid active"

    comms:
      status: "DAMAGED"
      condition: 45
      info: "Long-range offline"

  schematic:
    path: "/static/schematics/morrigan-top.svg"  # Optional: external SVG
    # OR inline: true (render procedurally in component)
```

### TypeScript Interface
```typescript
// src/types/shipStatus.ts
export type SystemStatus = 'ONLINE' | 'STRESSED' | 'DAMAGED' | 'CRITICAL' | 'OFFLINE';

export interface SystemData {
  status: SystemStatus;
  condition: number;  // 0-100
  info?: string;
}

export interface ShipStatusData {
  ship: {
    name: string;
    class: string;
    crew_count: number;
    crew_capacity: number;
    hull: {
      current: number;
      max: number;
    };
    armor: {
      current: number;
      max: number;
    };
    systems: {
      life_support: SystemData;
      engines: SystemData;
      weapons: SystemData;
      comms: SystemData;
    };
    schematic?: {
      path?: string;
      inline?: boolean;
    };
  };
}
```

## Open Questions

1. **GM Control Placement**
   - What we know: GM Console has LocationTree, ViewControls, BroadcastForm, CharonPanel, EncounterPanel
   - What's unclear: Should system toggles be a new dedicated panel, or integrated into existing controls?
   - Recommendation: Create new ShipStatusPanel in GM Console (similar to EncounterPanel pattern). Place below EncounterPanel in right sidebar.

2. **Persistent State Storage**
   - What we know: ActiveView stores encounter state (room visibility, door status) in DB as JSON
   - What's unclear: Should ship system overrides be stored in ActiveView, or only in ship.yaml file?
   - Recommendation: Store runtime overrides in ActiveView.ship_system_overrides JSONField (similar to encounter_door_status pattern). Don't write back to YAML - keep file as defaults.

3. **Schematic Generation**
   - What we know: Need top-down ship blueprint style
   - What's unclear: Procedural SVG generation vs. static SVG files?
   - Recommendation: Start with procedural SVG (simple polygons), allow optional external SVG path in ship.yaml for custom designs. Procedural is faster to implement and style with CSS variables.

4. **Color Mapping**
   - What we know: CRT aesthetic uses teal (#4a6b6b) and amber (#8b7355) as primary colors
   - What's unclear: Best color progression for 5-tier status scale?
   - Recommendation:
     - ONLINE: Teal (#4a6b6b) - normal operations
     - STRESSED: Amber (#8b7355) - warning, reduced efficiency
     - DAMAGED: Orange (#9a6045) - critical warning
     - CRITICAL: Red-brown (#8b5555) - immediate attention
     - OFFLINE: Gray (#3a3a3a) - non-functional

## Sources

### Primary (HIGH confidence)
- Project codebase: `/home/gjohnson/mothership/charon/` (direct inspection)
  - CLAUDE.md - Project architecture overview
  - DATA_DIRECTORY_GUIDE.md - Data structure and schemas
  - STYLE_GUIDE.md - UI design system and color palette
  - codemaps/frontend.md - React component patterns
  - codemaps/backend.md - Django API patterns
  - src/components/domain/dashboard/sections/LogsSection.tsx - Dashboard section pattern
  - src/components/ui/DashboardPanel.tsx - Panel component API
  - terminal/views.py - Django API endpoint patterns
  - terminal/data_loader.py - File-based YAML loading
  - terminal/models.py - ActiveView and database models

### Secondary (MEDIUM confidence)
- [Managing State – React](https://react.dev/learn/managing-state) - Official React state patterns (2026)
- [React State Management in 2025: What You Actually Need](https://www.developerway.com/posts/react-state-management-2025) - Modern state management guidance
- [The Top 5 React Chart Libraries to Know in 2026](https://www.syncfusion.com/blogs/post/top-5-react-chart-libraries) - Chart library comparison

### Tertiary (LOW confidence)
- [Django REST Framework YAML](https://github.com/jpadilla/django-rest-framework-yaml) - YAML parsing (not needed - PyYAML sufficient)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, established patterns
- Architecture: HIGH - Clear precedent from Phase 1 (LOGS tab), LogsSection pattern applicable
- Data schema: HIGH - Follows existing campaign data patterns (crew.yaml, sessions/)
- Rendering: MEDIUM-HIGH - SVG patterns established in encounter maps, bar components new but simple
- Animations: MEDIUM - CSS animations straightforward, timing values need testing
- Pitfalls: MEDIUM - Based on common React/SVG issues, not project-specific experience

**Research date:** 2026-02-12
**Valid until:** 30 days (stable stack, unlikely to change)
