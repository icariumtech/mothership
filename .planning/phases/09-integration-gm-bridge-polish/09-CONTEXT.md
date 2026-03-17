# Phase 9: Integration + GM Bridge Polish - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Close v1.0 milestone audit gaps and build out the GM BridgeView main content area. Specifically:
1. Replace 3-second polling in StatusSection with SSE (RTMA-01)
2. Add portrait hover tooltip in NpcPortraitsPanel (PORT-03, revised scope)
3. Add react-markdown rendering to GM SessionDetailView (LOGS-02)
4. Build GM BridgeView main dashboard (breadcrumbs + 3D map mirror + ship status panel)

No new player-facing features. All work is GM console improvements and integration fixes.

</domain>

<decisions>
## Implementation Decisions

### GM BridgeView Main Content Layout
- **Fixed dashboard layout** — the GM main area always shows the same two-panel structure regardless of what the player is viewing
- **Top breadcrumb bar** — shows what the player is currently looking at: e.g. `MAP > Tau Ceti > Tau Ceti E` or `PERSONNEL > Dr. Valenia Vasques` or `STATUS`. Falls back to just the tab name when no drill-down context is available (e.g. `LOGS`, `CHARON`)
- **Left half** — 3D universe map (read-only mirror using existing GalaxyMap/SystemMap/OrbitMap R3F components), locked to what the player is currently viewing. GM cannot navigate independently — it shows the player's current map view
- **Right half** — Ship schematic + system status + toggle controls inline (full schematic SVG on top, system panels with toggles below). Same visual as the player's StatusSection but with GM toggle controls

### Ship Status Slide-Out Panel
- **Removed** — the right-half of the BridgeView main area replaces the Ship Status slide-out panel. Remove the "ship-status" tool from the ToolRail and the ShipStatusToolPanel slide-out in BridgeView

### LOGS — Session Detail Rendering
- **Stay in modal** — clicking a session in the slide-out panel opens an Ant Design modal (current behavior preserved)
- **react-markdown with remark-gfm** — replace `pre-wrap` div with `<ReactMarkdown remarkPlugins={[remarkGfm]}>`. Supports tables, strikethrough, checkboxes
- **Dark-themed CSS** — custom markdown CSS to match the GM console aesthetic: teal headings (`#4a6b6b`), amber accents (`#8b7355`), dark background code blocks, readable line height

### NPCPortrait in GM EncounterView
- **No overlay on the map** — the NPCPortraitOverlay does NOT render in the GM EncounterView (user confirmed this is out of scope)
- **Hover tooltip in NpcPortraitsPanel** — add an Ant Design `<Tooltip>` to the NPC name in NpcPortraitsPanel that shows the portrait image on hover. The tooltip previews the NPC portrait so GM can verify before showing to players

### SSE — Ship Status Migration
- **Extend existing /api/sse/ endpoint** — add a `shipstatus` event type alongside the existing `activeview` events. SSE broadcaster broadcasts ship status changes when a system toggle is performed
- **useSSE hook** — add `ship_status` event listener alongside existing `activeview` listener
- **StatusSection** — remove the 3-second polling `setInterval`. Subscribe to `ship_status` SSE events via the same hook used by GMConsole/SharedConsole. Initial ship status still loaded from `window.INITIAL_DATA.shipStatus` on mount

### Claude's Discretion
- Breadcrumb logic for deriving player location path from `activeView` fields (`view_slug`, `bridge_tab`, `view_type`)
- CSS approach for the BridgeView main dashboard split (flex vs grid)
- Exact SSE event shape for `shipstatus` event
- Whether ship status SSE events are triggered on toggle or broadcast on a timed interval
- How to handle SSE ship status in SharedConsole vs separate subscription in StatusSection

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Real-Time Architecture
- `src/hooks/useSSE.ts` — SSE hook, currently listens for `activeview` events only; needs `shipstatus` event listener added
- `terminal/sse_broadcaster.py` — SSE broadcaster, currently only broadcasts `activeview` events; needs ship status broadcast support
- `terminal/views.py` lines 281-297 — `event_stream()` function in the SSE endpoint; add `shipstatus` event emission here
- `.planning/phases/05-real-time-push-architecture/05-CONTEXT.md` — Phase 5 SSE decisions (write stays REST, only subscribe path uses SSE)

### GM Console UI Architecture
- `.planning/phases/08-rework-gm-console-ui/08-CONTEXT.md` — Phase 8 layout decisions (ViewRail, ToolRail, SlideOutPanel pattern)
- `src/components/gm/views/BridgeView.tsx` — GM BridgeView (main area currently empty; right panel has ToolRail + slide-outs)
- `src/components/gm/views/EncounterView.tsx` — GM EncounterView structure (ToolRail + SlideOutPanel pattern)
- `src/components/gm/panels/NpcPortraitsPanel.tsx` — NPC portraits panel where hover tooltip must be added

### Ship Status
- `src/components/domain/dashboard/sections/StatusSection.tsx` — player StatusSection with 3s polling; polling must be replaced with SSE
- `src/components/gm/panels/ShipStatusToolPanel.tsx` — existing tool panel (to be replaced by inline main area component in BridgeView)
- `src/types/shipStatus.ts` — ShipStatusData type

### Maps (for left-half mirror)
- `src/components/domain/dashboard/BridgeView.tsx` — player BridgeView, map rendered via children in MAP tab; understand how 3D maps are passed/rendered
- `src/entries/GMConsole.tsx` — top-level GMConsole; check how map props flow to views

### LOGS
- `src/services/gmConsoleApi.ts` — `SessionLog` type and `getSessions()` API call
- `STYLE_GUIDE.md` — color palette for markdown theming (teal `#4a6b6b`, amber `#8b7355`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hooks/useSSE.ts` — `useSSE` hook already handles `activeview` events; extend to support named `shipstatus` events
- `src/components/ui/SSEConnectionToast.tsx` — existing connection lost toast component
- `src/components/gm/panels/ShipStatusToolPanel.tsx` — existing ship status + toggle panel; extract logic for inline use in BridgeView main area
- `src/components/domain/dashboard/sections/StatusSection.tsx` — ship schematic SVG + system panels; the schematic and panel pattern can be reused
- `src/components/domain/encounter/NPCPortraitCard.tsx` — portrait card component; use its image source for the tooltip preview in NpcPortraitsPanel
- `react-markdown` — check if already a project dependency (`package.json`); if not, add with `remark-gfm`

### Established Patterns
- `useSSE({ url, onEvent, onConnect })` pattern in `GMConsole.tsx` and `SharedConsole.tsx` — follow this pattern for ship status subscription
- SlideOutPanel + ToolRail toggle pattern — Phase 8 established this; ship status slide-out removal simplifies BridgeView
- `window.INITIAL_DATA.shipStatus` — initial ship data loaded by Django template; keep as initial value, SSE updates thereafter
- Ant Design `<Tooltip>` component — use for NPC portrait hover preview in NpcPortraitsPanel

### Integration Points
- `GMConsole.tsx` — passes `activeView` and `locations` props down to `BridgeView`; `activeView.bridge_tab` and `activeView.view_slug` are the breadcrumb data sources
- `terminal/sse_broadcaster.py` — `broadcast()` method sends to all SSE clients; call after system toggle in the toggle API endpoint
- `terminal/views.py` — `api_toggle_system` (or equivalent) POST handler; must trigger ship status SSE broadcast after toggle
- `src/entries/GMConsole.tsx` — GMConsole renders map components and passes them to views; understand how map children work for the BridgeView left-half

</code_context>

<specifics>
## Specific Ideas

- Breadcrumb examples: `MAP > Tau Ceti > Tau Ceti E`, `PERSONNEL > Dr. Valenia Vasques`, `LOGS`, `STATUS`, `CHARON`
- The left half map should be the same 3D R3F maps the players see (GalaxyMap, SystemMap, OrbitMap) — not a simplified version
- The right half ship view: full schematic SVG on top (same as player StatusSection), system panels with toggle buttons below — compact enough to fit in half the BridgeView width
- The NPC portrait tooltip: shows the NPC portrait image on hover over the NPC name in the panel (like a thumbnail preview)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 09-integration-gm-bridge-polish*
*Context gathered: 2026-03-17*
