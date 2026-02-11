# Stack Research: Mothership GM Tool — Milestone 2

## Scope

Adding to existing Django + React 19 + TypeScript + R3F + Zustand app:
1. Draggable encounter map tokens
2. NPC portrait display during encounters
3. Ship dashboard (status/systems display)
4. Bridge tabs (crew, contacts, logs)

## Recommendations

### Encounter Tokens (Drag & Drop on 2D Grid)

**Recommendation: Native HTML5 Drag or Pointer Events (no library)**
- Confidence: HIGH
- Rationale: Encounter maps are already 2D styled React components with a grid system. Adding draggable tokens is a simple pointer-events exercise — track mousedown/mousemove/mouseup, snap to grid. No library needed for this scope.
- What NOT to use:
  - `react-dnd` — overkill for grid snapping on a fixed map; adds bundle size and abstraction for a simple coordinate problem
  - `@dnd-kit` — good library but unnecessary complexity for grid-to-grid movement
  - Canvas-based solutions — encounter maps are already DOM-based, switching to canvas would be a rewrite

**Data pattern:** Token positions stored in encounter map YAML (new `tokens:` section) or in ActiveView state for runtime positions. GM moves tokens, players see updates via polling.

### NPC Portrait Display

**Recommendation: Pure React component with existing patterns**
- Confidence: HIGH
- Rationale: Portrait display is a styled overlay/panel — no special library needed. Use existing Panel/DashboardPanel components. Images served as static files from `data/` or `textures/` directory.
- Image processing: Already have Pillow on backend for image generation; can use existing `convert_npc_portraits.py` script pattern for amber gradient conversion
- What NOT to use:
  - Image carousel libraries — not needed for showing 1-2 portraits at a time
  - Modal libraries — existing panel system handles overlays

### Ship Dashboard

**Recommendation: React components with Zustand store**
- Confidence: HIGH
- Rationale: Dashboard is a collection of status panels displaying YAML data. Fits perfectly into existing patterns: Django serves YAML via API, React renders styled panels, Zustand manages state.
- Consider: Could use simple CSS animations for status indicators (pulsing warnings, flashing alerts) — no GSAP needed for these
- Data source: New YAML schema under ship location directories (e.g., `ship_status.yaml`)
- What NOT to use:
  - D3.js or charting libraries — CRT aesthetic means simple text/bar displays, not complex charts
  - Real-time state management — polling pattern is sufficient

### Bridge Tabs (Crew, Contacts, Logs)

**Recommendation: React components following existing section pattern**
- Confidence: HIGH
- Rationale: Tab infrastructure already exists (TabBar, BridgeView, section components). Each tab is a new section component reading from campaign YAML data.
- Data sources:
  - Crew: `data/campaign/crew.yaml` (already exists per CLAUDE.md)
  - Contacts: New `data/campaign/contacts.yaml` or NPC data in location YAMLs
  - Logs: `data/campaign/notes/` directory with markdown files
- What NOT to use:
  - Rich text editors — logs are read-only for players, GM edits YAML/markdown directly
  - Virtualized lists — unlikely to have enough entries to need virtualization

## No New Dependencies Required

All features can be built with the existing stack:
- React 19 + TypeScript for components
- Zustand for state management
- Existing Panel/DashboardPanel UI components
- Django DataLoader for YAML parsing
- CSS animations for status effects
- Pointer events for token dragging

This keeps bundle size stable and avoids new dependency risk.

## Build Order Implications

1. **Bridge tabs first** — simplest, fills out existing skeleton, validates YAML data patterns
2. **Ship dashboard** — new view type, builds on data patterns from tabs
3. **Encounter tokens** — extends existing encounter map, needs GM-to-player state sync
4. **NPC portraits** — extends encounter view, depends on portrait assets existing
