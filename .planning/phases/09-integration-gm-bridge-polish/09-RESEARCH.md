# Phase 9: Integration + GM Bridge Polish - Research

**Researched:** 2026-03-17
**Domain:** React/TypeScript frontend integration, Django SSE extension, GM console BridgeView build-out
**Confidence:** HIGH — all findings verified against live source files

## Summary

Phase 9 closes three v1.0 audit gaps (RTMA-01, PORT-03, LOGS-02) and builds the GM BridgeView main content area. All required libraries are already installed. The SSE infrastructure from Phase 5 already does most of the work: `api_ship_toggle_system` already calls `broadcaster.announce(build_active_view_payload(new_state))` after every toggle — the `activeview` SSE event already carries `ship_system_overrides`. The primary SSE work is adding a dedicated `shipstatus` named event so `StatusSection` can subscribe without re-fetching from the REST endpoint.

The react-markdown implementation is already proven in the player `LogsSection.tsx` — the GM `SessionDetailView` simply needs the same pattern applied inside its existing Ant Design modal. NpcPortraitsPanel is a tiny 40-line file; adding an Ant Design `<Tooltip>` with an `<img>` preview is a surgical two-line change. The BridgeView main area build is the largest work item: a fixed two-panel layout (left = 3D map mirror locked to player's current map, right = ship schematic + toggle controls) plus a breadcrumb bar derived from `activeView` fields.

**Primary recommendation:** Implement in four self-contained tasks: (1) SSE shipstatus event + StatusSection migration, (2) NpcPortraitsPanel tooltip, (3) SessionDetailView react-markdown, (4) BridgeView main dashboard.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **GM BridgeView main content layout:** Fixed dashboard — always shows the same two-panel structure regardless of what the player is viewing.
- **Top breadcrumb bar:** Shows what the player is currently viewing (e.g. `MAP > Tau Ceti > Tau Ceti E`). Falls back to just the tab name when no drill-down context is available.
- **Left half:** 3D universe map (read-only mirror using existing GalaxyMap/SystemMap/OrbitMap R3F components), locked to player's current map view. GM cannot navigate independently.
- **Right half:** Ship schematic + system status + toggle controls inline (full schematic SVG on top, system panels with toggles below). Replaces the Ship Status slide-out panel.
- **Ship Status slide-out removed:** Remove the "ship-status" tool from ToolRail and `ShipStatusToolPanel` slide-out in BridgeView.
- **LOGS — Stay in modal:** Clicking a session opens an Ant Design modal (current behavior preserved).
- **LOGS — react-markdown with remark-gfm:** Replace `pre-wrap` div with `<ReactMarkdown remarkPlugins={[remarkGfm]}>`. Supports tables, strikethrough, checkboxes.
- **LOGS — Dark-themed CSS:** Custom markdown CSS matching GM console aesthetic: teal headings (`#4a6b6b`), amber accents (`#8b7355`), dark background code blocks.
- **NPCPortrait — No overlay on map:** `NPCPortraitOverlay` does NOT render in GM EncounterView.
- **NPCPortrait — Hover tooltip in NpcPortraitsPanel:** Add Ant Design `<Tooltip>` to NPC name in NpcPortraitsPanel showing portrait image on hover.
- **SSE — Extend existing `/api/sse/` endpoint:** Add a `shipstatus` event type alongside existing `activeview` events.
- **SSE — useSSE hook:** Add `ship_status` event listener alongside existing `activeview` listener.
- **StatusSection:** Remove 3-second polling `setInterval`. Subscribe to `ship_status` SSE events. Initial ship status still loaded from `window.INITIAL_DATA.shipStatus` on mount.

### Claude's Discretion
- Breadcrumb logic for deriving player location path from `activeView` fields (`view_slug`, `bridge_tab`, `view_type`)
- CSS approach for the BridgeView main dashboard split (flex vs grid)
- Exact SSE event shape for `shipstatus` event
- Whether ship status SSE events are triggered on toggle or broadcast on a timed interval
- How to handle SSE ship status in SharedConsole vs separate subscription in StatusSection

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RTMA-01 | Server-Sent Events replace 3s polling for StatusSection state updates | SSE broadcaster already fires on toggle; extend with named `shipstatus` event; `useSSE` hook extension pattern documented below |
| PORT-03 | Portrait appears as overlay during encounter view (revised: hover tooltip in NpcPortraitsPanel) | NpcPortraitsPanel is 40-line file; `NpcPortraitData.portrait` field is the image URL; Ant Design `<Tooltip>` overlayInnerStyle pattern documented below |
| LOGS-02 | Log entries display with markdown rendering in GM SessionDetailView | react-markdown@10.1.0 + remark-gfm@4.0.1 already installed; player LogsSection.tsx is the exact pattern to copy |
</phase_requirements>

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^10.1.0 | Markdown rendering | Already in package.json; used by player LogsSection |
| remark-gfm | ^4.0.1 | GFM extensions (tables, checkboxes) | Already in package.json; paired with react-markdown |
| antd | 6.1 | Tooltip, Modal, Button | Already project UI library |
| React Three Fiber | 9.0 | 3D map components | Already used by GalaxyMap/SystemMap/OrbitMap |

### No new dependencies needed
All libraries required for Phase 9 are already present in `package.json`. No `npm install` step needed.

## Architecture Patterns

### Pattern 1: SSE Named Event Extension

The `useSSE` hook currently only listens for the named `activeview` event:

```typescript
// Current — src/hooks/useSSE.ts line 44
es.addEventListener('activeview', (e: MessageEvent) => { ... });
```

To add `shipstatus` support, the hook needs a second `addEventListener`. The cleanest approach given the single-consumer design is to add a separate `onShipStatusEvent` callback option:

```typescript
// Extended interface
interface UseSSEOptions {
  url: string;
  onEvent: (data: unknown) => void;           // activeview events
  onShipStatusEvent?: (data: unknown) => void; // shipstatus events (optional)
  onConnect?: () => void;
  failureThreshold?: number;
  retryDelayMs?: number;
}

// In connect():
if (options.onShipStatusEvent) {
  es.addEventListener('shipstatus', (e: MessageEvent) => {
    try {
      options.onShipStatusEvent!(JSON.parse(e.data));
    } catch {
      console.error('[SSE] Failed to parse shipstatus event data:', e.data);
    }
  });
}
```

The `onShipStatusEvent` callback must be wrapped with `useCallback(fn, [])` + stable ref reads (same pattern as `onEvent` in GMConsole.tsx) to prevent reconnect storms.

### Pattern 2: SSE Broadcaster Extension

The broadcaster's `announce()` method hardcodes the `activeview` event name:

```python
# Current — terminal/sse_broadcaster.py line 26
def announce(self, data: dict) -> None:
    msg = format_sse(json.dumps(data, default=str), event='activeview')
```

Add a second method for ship status events:

```python
def announce_ship_status(self, data: dict) -> None:
    msg = format_sse(json.dumps(data, default=str), event='shipstatus')
    with self._lock:
        listeners = list(self.listeners)
    for i in reversed(range(len(listeners))):
        try:
            listeners[i].put_nowait(msg)
        except queue.Full:
            self.unlisten(listeners[i])
```

Call `broadcaster.announce_ship_status(ship_data)` from `api_ship_toggle_system` after storing the override. The event payload should be the fully merged `ShipStatusData` (YAML defaults + overrides applied), not just the overrides dict. This avoids StatusSection needing to fetch `/api/ship-status/` at all after the initial mount.

**Critical detail:** `api_ship_toggle_system` already has access to the merged ship data via the DataLoader pattern used by `get_ship_status_json`. The broadcaster call should go at the end of the handler, after `update_state()`.

### Pattern 3: StatusSection SSE Migration

Current polling pattern (lines 279-283 of StatusSection.tsx):
```typescript
useEffect(() => {
  fetchShipStatus(true);
  const interval = setInterval(() => fetchShipStatus(), 3000);
  return () => clearInterval(interval);
}, []);
```

Replacement pattern — initial data stays from `window.INITIAL_DATA.shipStatus`, SSE updates thereafter:
```typescript
// Remove the polling useEffect entirely.
// Add to parent (GMConsole.tsx) or subscribe directly via useSSE extended hook.
// On shipstatus event: call setShipData(newData) after applying flicker detection.
```

**Key architecture decision (Claude's Discretion):** The cleanest integration is to add `onShipStatusEvent` to the `useSSE` call in `GMConsole.tsx` and pass `shipData` + `setShipData` down to StatusSection as props — or have StatusSection subscribe independently using a second `useSSE` call pointing to the same URL. The second `useSSE` call approach is simpler (no prop drilling) but creates two SSE connections per GM session. The GMConsole prop-passing approach reuses the existing connection. Recommendation: pass shipData down from GMConsole since it already manages activeView state centrally.

**Flicker detection:** The existing `changingFlags` logic in StatusSection compares previous vs new status. This still works when driven by SSE — compare previous statuses ref against the incoming `ShipStatusData`.

### Pattern 4: NpcPortraitsPanel Tooltip

Current NPC name element (NpcPortraitsPanel.tsx line 26):
```tsx
<Text style={{ fontSize: 12 }}>{npc.name}</Text>
```

Replace with Ant Design Tooltip wrapping the Text:
```tsx
import { Tooltip } from 'antd';

<Tooltip
  title={
    npc.portrait ? (
      <img
        src={npc.portrait}
        alt={npc.name}
        style={{ width: 120, height: 160, objectFit: 'cover', borderRadius: 2 }}
      />
    ) : 'No portrait'
  }
  placement="left"
  overlayInnerStyle={{ padding: 4, background: '#0a0f0f', border: '1px solid #4a6b6b' }}
>
  <Text style={{ fontSize: 12, cursor: 'default' }}>{npc.name}</Text>
</Tooltip>
```

`npc.portrait` is a URL string — empty string means no image (from `NpcPortraitData` type). The tooltip should gracefully fall back when `portrait` is empty.

### Pattern 5: SessionDetailView react-markdown

The existing `SessionDetailView` in `BridgeView.tsx` (lines 452-489) renders `session.body` with `whiteSpace: 'pre-wrap'`. Replace with react-markdown using the exact same custom-components pattern from the player's `LogsSection.tsx`:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// In SessionDetailView, replace the pre-wrap div with:
{session.body ? (
  <div className="gm-session-markdown">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {session.body}
    </ReactMarkdown>
  </div>
) : (
  <Text type="secondary" style={{ fontSize: 12 }}>No content.</Text>
)}
```

The `markdownComponents` object mirrors `LogsSection.tsx` but uses GM console CSS classes (`gm-md-h1`, etc.) for the dark modal context. Add a `BridgeView.markdown.css` (or inline within the existing `BridgeView.css`) for the styling.

### Pattern 6: BridgeView Main Dashboard Layout

The `gm-bridge-view` currently renders only `gm-bridge-view__right` (the ToolRail + SlideOutPanels). The main area is empty. Add a `gm-bridge-view__main` div that fills the left content area:

```
gm-bridge-view (position: relative, flex row)
├── gm-bridge-view__main (flex: 1, flex-column)
│   ├── gm-bridge-breadcrumb (height: 36px, flex row, border-bottom)
│   ├── gm-bridge-content (flex: 1, flex row)
│   │   ├── gm-bridge-map-panel (flex: 1, position: relative) — 3D map mirror
│   │   └── gm-bridge-status-panel (width: 360px, overflow-y: auto) — ship status + toggles
└── gm-bridge-view__right (width: 48px) — ToolRail only (ship-status tool removed)
```

**Map mirror pattern:** The GM BridgeView does not currently mount any R3F components — those live in `SharedConsole.tsx`. The CONTEXT.md says the left half "should be the same 3D R3F maps" locked to what the player sees. Two approaches:

1. **Lift map mounting to GMConsole.tsx:** GMConsole creates GalaxyMap/SystemMap/OrbitMap instances and passes them as `children` to BridgeView (same as player's BridgeView receives `children` from SharedConsole). This mirrors the player architecture exactly.
2. **Mount maps inside BridgeView:** BridgeView itself creates and owns the map components, driven by `activeView` props.

Recommendation: Option 2 (maps owned by BridgeView) is simpler — avoids the SharedConsole `children` pattern complexity (transitions, handles, GSAP). The GM map is read-only and doesn't need navigation callbacks. Mount the correct map type based on `activeView.view_slug` and `activeView.bridge_tab`. The maps accept `data` as a prop — fetch the star map data the same way GMConsole already fetches it on initial load if needed.

**Critical: Derive which map to show.** The `activeView` fields available:
- `view_type` — will be `BRIDGE` when player is on bridge
- `bridge_tab` — `map`, `personnel`, `logs`, `status`, `charon`
- `view_slug` — set by `/api/bridge-selection/` endpoint when player navigates map (system slug, planet slug, etc.)

The GM map mirror should only render when `bridge_tab === 'map'`. When `bridge_tab` is anything else, show a text indicator ("PLAYER VIEWING: {tab}") in the left half, or collapse it.

**Breadcrumb derivation (Claude's Discretion):**
```typescript
function deriveBreadcrumb(activeView: ActiveView | null): string {
  if (!activeView || activeView.view_type !== 'BRIDGE') return 'BRIDGE';
  const tab = activeView.bridge_tab?.toUpperCase() || 'MAP';
  if (tab !== 'MAP') return tab;
  // MAP tab — use view_slug to determine drill-down level
  const slug = activeView.view_slug;
  if (!slug) return 'MAP';
  // view_slug could be a system slug, planet slug, or orbit element
  // Look up in locations tree to get display names
  return `MAP > ${slug}`; // Simplified — planner can refine
}
```

### Pattern 7: Remove ShipStatusToolPanel from BridgeView

Remove from `BridgeView.tsx`:
- The `'ship-status'` entry from the `tools` array (line 64)
- The `<SlideOutPanel>` block for `'ship-status'` (lines 171-173)
- The `import { ShipStatusToolPanel }` statement (line 14)

The `ShipStatusToolPanel.tsx` and `ShipStatusPanel.tsx` files can be deleted or left in place — they are no longer used by BridgeView. Verify no other imports reference them before deletion.

### Anti-Patterns to Avoid

- **Separate SSE connection per component:** Do not have StatusSection create its own `useSSE` call while GMConsole already has one. Reuse the existing connection via prop drilling or context.
- **Fetching ship status in response to SSE:** If the `shipstatus` SSE event carries the full merged `ShipStatusData`, StatusSection should use it directly — not fire a follow-up `/api/ship-status/` fetch. Reduces latency to zero.
- **R3F map duplication:** Do not try to render a miniaturized version of the maps. Use the actual GalaxyMap/SystemMap/OrbitMap components at full container size — they will fill whatever container they're in.
- **CSS class collision:** Per Phase 8 decisions, the GM BridgeView uses class `gm-bridge-view` (not `bridge-view`). New panels should use `gm-bridge-*` prefixes to avoid collision with player terminal CSS.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom parser | `react-markdown` + `remark-gfm` | Already installed, already used in LogsSection |
| Portrait image preview | Custom hover component | Ant Design `<Tooltip>` with img content | Handles positioning, escape, overflow automatically |
| SSE event formatting | Custom event format | `format_sse()` in sse_broadcaster.py | Already handles SSE spec correctly |
| Ship status flicker animation | Custom CSS transition | Existing `state-changing` CSS class in StatusSection.css | Already implemented and tested |

## Common Pitfalls

### Pitfall 1: SSE Reconnect Storm from Unstable Callback
**What goes wrong:** `onShipStatusEvent` callback passed to `useSSE` changes on every render, triggering reconnect on every state update.
**Why it happens:** `useSSE` uses `connect` in its dependency array; `connect` depends on `onEvent`/`onShipStatusEvent`.
**How to avoid:** Wrap the ship status handler with `useCallback(fn, [])` and use a stable ref inside the callback (same pattern as `onEvent` in GMConsole.tsx line 64-66).
**Warning signs:** Network tab shows repeated SSE connection opens/closes.

### Pitfall 2: ship_system_overrides vs Full Ship Status
**What goes wrong:** Passing `ship_system_overrides` dict from the `activeview` SSE event directly to StatusSection instead of the merged `ShipStatusData`.
**Why it happens:** `build_active_view_payload` includes `ship_system_overrides` (the overrides only), not the full merged ship status. StatusSection needs the full merged object.
**How to avoid:** The `shipstatus` SSE event should carry fully-merged `ShipStatusData` — load YAML + apply overrides in the broadcaster call, just like `/api/ship-status/` does.
**Warning signs:** StatusSection shows only overridden fields, HULL/ARMOR/crew_count missing.

### Pitfall 3: Map Mirror Shows Blank for Non-MAP Tabs
**What goes wrong:** Left half of BridgeView is blank or shows a loading spinner when player is on LOGS/STATUS/etc tabs.
**Why it happens:** Map components only make sense when `bridge_tab === 'map'`.
**How to avoid:** Conditionally render the map or show a placeholder. Don't conditionally mount R3F canvases repeatedly — use `display: none` to preserve WebGL context, or simply show a "PLAYER VIEWING: {tab}" message when not in map mode.

### Pitfall 4: NPC Portrait URL is Empty String
**What goes wrong:** Tooltip shows broken image icon for NPCs without portraits.
**Why it happens:** `NpcPortraitData.portrait` is `""` (empty string) when no portrait is set.
**How to avoid:** Conditionally render the `<img>` only when `npc.portrait` is truthy. Fall back to a text string like `'No portrait'`.

### Pitfall 5: Ant Design Tooltip with img Content Sizing
**What goes wrong:** Portrait tooltip is too large or extends off-screen.
**Why it happens:** Ant Design Tooltip does not constrain its content by default.
**How to avoid:** Set explicit `width` and `height` on the `<img>` element inside the tooltip title. The `overlayStyle` or `overlayInnerStyle` props control tooltip container sizing.

## Code Examples

### SSE Broadcaster — announce_ship_status
```python
# terminal/sse_broadcaster.py — add alongside announce()
def announce_ship_status(self, ship_data: dict) -> None:
    """Broadcast ship status update to all connected SSE clients."""
    msg = format_sse(json.dumps(ship_data, default=str), event='shipstatus')
    with self._lock:
        listeners = list(self.listeners)
    for i in reversed(range(len(listeners))):
        try:
            listeners[i].put_nowait(msg)
        except queue.Full:
            self.unlisten(listeners[i])
```

### api_ship_toggle_system — add broadcast at end
```python
# terminal/views.py — in api_ship_toggle_system, after broadcaster.announce():
# Also broadcast merged ship status on the shipstatus channel
loader = DataLoader()
ship_data = loader.load_ship_status()
if ship_data and ship_data.get('ship'):
    for sys_name, override in overrides.items():
        if sys_name in ship_data['ship'].get('systems', {}):
            ship_data['ship']['systems'][sys_name].update(override)
broadcaster.announce_ship_status(ship_data)
```

### react-markdown in SessionDetailView
```tsx
// In BridgeView.tsx — SessionDetailView component
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents = {
  h1: ({ children, ...props }: any) => <h1 className="gm-md-h1" {...props}>{children}</h1>,
  h2: ({ children, ...props }: any) => <h2 className="gm-md-h2" {...props}>{children}</h2>,
  h3: ({ children, ...props }: any) => <h3 className="gm-md-h3" {...props}>{children}</h3>,
  p:  ({ children, ...props }: any) => <p  className="gm-md-p"  {...props}>{children}</p>,
  strong: ({ children, ...props }: any) => <strong className="gm-md-strong" {...props}>{children}</strong>,
  code: ({ children, ...props }: any) => <code className="gm-md-code" {...props}>{children}</code>,
};

// Replace the pre-wrap div:
<div className="gm-session-markdown">
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
    {session.body}
  </ReactMarkdown>
</div>
```

### NpcPortraitsPanel — Tooltip wrapper
```tsx
// NpcPortraitsPanel.tsx
import { Button, Typography, Tooltip } from 'antd';

// Replace <Text style={{ fontSize: 12 }}>{npc.name}</Text> with:
<Tooltip
  title={
    npc.portrait
      ? <img src={npc.portrait} alt={npc.name} style={{ width: 120, height: 160, objectFit: 'cover' }} />
      : 'No portrait available'
  }
  placement="left"
  overlayInnerStyle={{ padding: 4 }}
>
  <Text style={{ fontSize: 12, cursor: 'default' }}>{npc.name}</Text>
</Tooltip>
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| StatusSection polls `/api/ship-status/` every 3s | SSE push on toggle — zero polling | Sub-100ms latency instead of up to 3s delay |
| Session body rendered with `whiteSpace: pre-wrap` | react-markdown with GFM | Tables, checkboxes, formatted lists work |
| Ship status in slide-out panel | Inline in BridgeView main area | Permanent visibility without opening a panel |

## Open Questions

1. **Should StatusSection subscribe via GMConsole or independently?**
   - What we know: GMConsole already has an `useSSE` call; extending it with `onShipStatusEvent` reuses the connection but requires prop drilling ship data down to StatusSection via BridgeView.
   - What's unclear: Whether StatusSection is also rendered in player SharedConsole (it is — `src/components/domain/dashboard/sections/StatusSection.tsx`) and whether that instance also needs SSE.
   - Recommendation: SharedConsole's StatusSection keeps polling (player side, unchanged). Only the GM BridgeView context needs SSE. Since BridgeView already receives `activeView` and other props from GMConsole, adding `shipData` and `onShipStatusEvent` to the GMConsole SSE call is the right approach.

2. **Map mirror when player is not on BRIDGE view**
   - What we know: `activeView.view_type` could be `ENCOUNTER`, `STANDBY`, etc. even when GM is on BRIDGE view in the GM console.
   - What's unclear: What should the left panel show when the player is not on BRIDGE?
   - Recommendation: Show "PLAYER NOT ON BRIDGE" placeholder text or the last-known map state frozen. CONTEXT.md doesn't address this; planner should decide.

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — no automated test framework installed |
| Config file | none |
| Quick run command | `npm run typecheck` |
| Full suite command | `npm run typecheck && npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RTMA-01 | StatusSection receives ship_status SSE event and updates without polling | manual | `npm run typecheck` (type safety) | N/A — no test files |
| PORT-03 | NPC name tooltip shows portrait image on hover | manual-only | visual verification in browser | N/A |
| LOGS-02 | Session body renders markdown (headers, bold, tables) | manual-only | visual verification in browser | N/A |

**Justification for manual-only:** No test framework is installed in the project. All three requirements are UI/SSE behavior that would require browser automation or a test harness that doesn't exist. TypeScript type checking (`npm run typecheck`) catches structural errors; full `npm run build` catches import/compilation issues.

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run typecheck && npm run build`
- **Phase gate:** Full build green + manual browser verification of each requirement before `/gsd:verify-work`

### Wave 0 Gaps
None — no new test files needed. TypeScript compilation is the automated safety net.

## Sources

### Primary (HIGH confidence)
- Live source read: `src/hooks/useSSE.ts` — SSE hook structure, single `activeview` listener
- Live source read: `terminal/sse_broadcaster.py` — broadcaster pattern, `format_sse()`, `announce()` method
- Live source read: `terminal/views.py` lines 1650-1702 — `api_ship_toggle_system` already calls `broadcaster.announce()`
- Live source read: `terminal/views.py` lines 188-220 — `build_active_view_payload` includes `ship_system_overrides` (not full ship data)
- Live source read: `src/components/domain/dashboard/sections/StatusSection.tsx` — full polling implementation
- Live source read: `src/components/domain/dashboard/sections/LogsSection.tsx` — react-markdown component pattern
- Live source read: `src/components/gm/panels/NpcPortraitsPanel.tsx` — current 40-line structure
- Live source read: `src/components/gm/views/BridgeView.tsx` — current state (empty main area, ship-status slide-out exists)
- Live source read: `src/components/gm/ShipStatusPanel.tsx` — toggle controls component to be inlined
- Live source read: `src/entries/GMConsole.tsx` — SSE subscription pattern, `useCallback(fn, [])` pattern
- Live source read: `package.json` — react-markdown@^10.1.0 and remark-gfm@^4.0.1 already installed
- Live source read: `src/types/gmConsole.ts` — `ActiveView` type, `NpcPortraitData.portrait` field

### Secondary (MEDIUM confidence)
- Live source read: `src/entries/SharedConsole.tsx` — GalaxyMap/SystemMap/OrbitMap component API (children pattern, props)

## Metadata

**Confidence breakdown:**
- SSE extension pattern: HIGH — broadcaster and hook source fully read; pattern is straightforward extension
- react-markdown pattern: HIGH — already used in same codebase in LogsSection.tsx
- NpcPortraitsPanel tooltip: HIGH — component is 40 lines, NpcPortraitData type confirmed
- BridgeView layout structure: HIGH — Phase 8 CSS patterns confirmed; map component APIs confirmed from SharedConsole
- Map mirror architecture decision: MEDIUM — two valid options; recommendation given but planner must decide

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable — all findings from live source code, not external APIs)
