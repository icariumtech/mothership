# Phase 8: Rework GM Console UI - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Redesign the GM console layout and interaction model for better usability and intuitiveness. The current flat-tab layout with fixed sidebar is replaced by a view-driven architecture with a left icon rail, full-content main area, and right-side slide-out tool panels. No new backend features — this is a pure frontend restructure of existing GM controls.

</domain>

<decisions>
## Implementation Decisions

### Layout architecture
- **Left view rail:** Narrow vertical icon strip (~60px) replacing the 400px sidebar. Contains view icons (STANDBY, BRIDGE, ENCOUNTER, CHARON) with tooltips on hover, no text labels
- **Main content area:** Fills remaining width. Content changes entirely when a view icon is clicked (view-driven, no tabs)
- **Right tool rail:** Icon strip on the right edge of views that need tool panels (ENCOUNTER, BRIDGE). Clicking an icon slides out a ~300px floating panel overlay. Only one panel open at a time — clicking the same icon toggles it closed, clicking a different icon swaps panels
- **Location tree:** Removed from sidebar. Accessible as a right-side tool panel in ENCOUNTER view only (via button in the right rail)

### View rail behavior
- View icons switch what the GM sees in the console only — does NOT auto-push to player terminal
- **DISPLAY button:** A separate icon at the bottom of the left rail pushes the current GM view to the player terminal
- **Active indicator:** Small dot/highlight on the view icon that's currently displayed on the player terminal, so GM always knows what players see
- Views: STANDBY, BRIDGE, ENCOUNTER, CHARON (4 total — BROADCAST removed)

### ENCOUNTER view
- **Map fills entire main content area** — full-screen tactical map
- **Floating top-left controls over map:** Deck level dropdown + REVEAL ALL / HIDE ALL buttons
- **Right tool rail buttons:**
  - Token Palette (slide-out panel for drag-to-map token placement)
  - NPC Portraits (slide-out panel for show/dismiss portraits)
  - Location Tree (slide-out panel for encounter location selection)
  - Terminals (slide-out panel for COMM_TERMINAL show/hide toggles)
- **Room visibility list removed** — GM uses right-click context menu on rooms directly (existing behavior preserved)
- **Door status popup** — keep current floating popup behavior as-is
- **Map pan/zoom** — scroll to zoom, drag to pan (current behavior, no minimap or zoom buttons)
- Token placement: drag from slide-out Token Palette panel to map

### BRIDGE view
- **Main content:** Dashboard overview showing location context (current system/planet/station), ship status summary (name/class/hull/armor), crew count, system statuses
- **Right tool rail buttons:**
  - Ship Status (slide-out panel with system state toggle controls)
  - CHARON Quick-Send (slide-out panel with small message composer for sending CHARON messages without switching views)

### CHARON view
- **Full-screen:** Conversation display and controls fill the entire main content area
- No right tool rail needed

### STANDBY view
- **No controls:** Just the idle state. GM switches to another view to do anything

### BROADCAST
- **Removed entirely** from GM console. The broadcast messaging API remains but no dedicated GM console interface

### Styling approach
- **Utilitarian/clean dark UI** — not CRT-styled. GM tool prioritizes usability over atmosphere
- **Ant Design components** as primary UI building blocks (dark theme)
- Move away from inline styles to organized CSS (Claude's discretion on CSS modules vs regular CSS files)
- Fixed ~300px width for all right-side slide-out panels

### Responsive
- **Tablet-friendly:** Support landscape tablets (iPad). View rail and tool panels should adapt to smaller screens

### Claude's Discretion
- CSS approach (modules vs regular CSS files per component)
- Exact icon choices for view rail and tool rail buttons
- Dashboard widget layout and specific summary panels for BRIDGE view
- Transition animations for panel slide-in/out
- How the view rail adapts on tablets
- Component decomposition strategy (how to break up the monolithic components)

</decisions>

<specifics>
## Specific Ideas

- View rail inspired by VS Code / Discord server list pattern — narrow, icon-only, vertical
- Right-side tool panels similar to IDE tool windows — slide out as overlays, one at a time
- ENCOUNTER view should feel like a proper map tool where the map is the primary focus, with controls accessible but not dominating
- BRIDGE dashboard should give the GM quick situational awareness without needing to drill into anything

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Panel.tsx`, `DashboardPanel.tsx`, `CompactPanel.tsx` — existing chamfered panel components (may be useful for dashboard widgets)
- `ViewControls.tsx` (58 lines) — current view button component, will be reworked into icon rail
- `LocationTree.tsx` (155 lines) — tree navigation, moves to right-side panel
- `MapPreview.tsx` (846 lines) — SVG map rendering, becomes the main content for ENCOUNTER view
- `EncounterMapRenderer` — grid-based map renderer, already handles full layout
- `TokenPalette.tsx` (500 lines) — token templates + creation, moves to right-side panel
- `DoorStatusPopup.tsx` (136 lines) — floating door controls, keep as-is
- `ShipStatusPanel.tsx` (222 lines) — ship system controls, moves to BRIDGE right-side panel
- `CharonPanel.tsx` (460 lines) — CHARON conversation, becomes full-screen CHARON view
- `BroadcastForm.tsx` (80 lines) — removed from console

### Established Patterns
- SSE via `useSSE` hook for real-time updates — keep this pattern
- Ant Design dark theme with custom token — keep and extend
- `gmConsoleApi`, `charonApi`, `encounterApi` service modules — no changes to API layer
- `useTreeState` hook for persisted tree expand/collapse state

### Integration Points
- `GMConsole.tsx` (396 lines) — main entry point, will be heavily restructured
- `EncounterPanel.tsx` (606 lines) — will be decomposed into separate tool panel components
- ActiveView SSE subscription — stays in GMConsole, data flows to child components
- Vite config `gm-console.bundle.js` entry — no changes needed

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-rework-gm-console-ui*
*Context gathered: 2026-03-09*
