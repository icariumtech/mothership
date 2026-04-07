# Phase 14: Bridge STATUS Tab Rework — Context

**Gathered:** 2026-04-07 (updated 2026-04-07)
**Status:** Ready for planning
**Source:** Design session — layout mockups reviewed and approved; color palette updated to V2-2; animation + GM controls decisions added

<domain>
## Phase Boundary

Rework the player-facing Bridge STATUS tab from the current floating card-panel layout to a new dual terminal-readout panel design floating over the full-screen deck map. Also extends the ship data model with a reactor system and resource tracking fields (fuel, food, O2, cryopods, escape pods).

No new views, no new routes. This phase touches only the STATUS tab and the ship data layer beneath it.

</domain>

<decisions>

## Implementation Decisions

### D-01: Layout — Two terminal-readout panels over full-screen map
The new STATUS tab layout is:
- **Background**: Full-screen deck map (existing `EncounterMapDisplay` + grid background) — unchanged
- **Left panel**: Floating terminal-readout panel — structural integrity (Hull, Armor) + ship systems
- **Right panel**: Floating terminal-readout panel — consumable resources
- Both panels use semi-transparent backgrounds with `backdrop-filter: blur` so the map texture bleeds through
- The approved reference design is `sample_ui/status-tab-hybrid.html`

### D-02: Left panel content — Systems
Order top to bottom:
1. **HULL** — `current/max` with condition bar (integrity header, always first)
2. **ARMOR** — `current/max` with condition bar (integrity, kept — sits below hull)
3. **REACTOR** — new system, `status/condition/info` (SystemData shape)
4. **LIFE SUPPORT** — existing system
5. **ENGINES** — existing system
6. **WEAPONS** — existing system
7. **COMMS** — existing system
8. Footer: `X/5 OPERATIONAL` summary + warning count

### D-03: Right panel content — Resources
Order top to bottom:
1. **FUEL** — `current/max` with bar
2. **FOOD** — `current/max` with bar (galley stock)
3. **O2** — percentage with bar (oxygen remaining)
4. **CRYOPODS** — `occupied/total` with bar
5. **ESCAPE PODS** — `available/total` with bar
6. Footer pinned to bottom: **CREW** `current / capacity`

### D-04: Terminal readout visual style
Each row in both panels follows this structure:
- System/resource name (left, small caps, muted teal)
- Status label or value (right, bold)
- Thin 3–4px condition/resource bar below the name row
- One-line info text beneath the bar (small, muted)

No card frames, no DashboardPanel wrappers inside the panels. Pure text + bars.

Panels themselves use the project's chamfered corner `clip-path` convention:
- Left panel: chamfer on bottom-right corner only (points inward toward map)
- Right panel: chamfer on bottom-left corner only

### D-05: Color system — follow STYLE_GUIDE.md exactly
Use project CSS variables from `src/styles/variables.css` (V2-2 palette):
- Teal `#4a8b8b` / `var(--color-teal)` — structure, ONLINE status, hull bars
- Amber `#c9a050` / `var(--color-amber)` — resources, STRESSED, interactive
- Damage states: `#9a6045` (DAMAGED), `#8b5555` (CRITICAL)
- Offline: `#3a3a3a` with `opacity: 0.5` on the row
- Resource bars: amber at >50%, `#9a6045` at 25–50%, `#8b5555` at <25%
- Panel background: `rgba(13, 22, 22, 0.88)` with `backdrop-filter: blur(6px)`
- Scanline overlay: `repeating-linear-gradient` at 3px spacing, very low opacity
- Text: `var(--color-text-primary)` = `#7ab8b8` (teal-tinted), not neutral gray

### D-06: Reactor — new system, same SystemData shape
```yaml
# ship.yaml addition
systems:
  reactor:
    condition: 87
    info: 'Power output nominal'
    status: ONLINE
```
TypeScript: add `reactor: SystemData` to the `systems` block in `ShipStatusData`.

### D-07: Resource fields — new top-level ship.yaml block
```yaml
# ship.yaml addition
resources:
  fuel:
    current: 8
    max: 12
  food:
    current: 14
    max: 20
  o2:
    current: 94
    max: 100
  cryopods:
    occupied: 4
    total: 8
  escape_pods:
    available: 2
    total: 2
```
TypeScript: add `ShipResources` interface to `shipStatus.ts`, add `resources: ShipResources` to `ShipStatusData.ship`.

### D-08: Armor stays — not removed
Earlier discussion proposed removing armor. Decision reversed: armor is kept as an integrity field (`current/max`) displayed in the left panel below Hull.

### D-09: GM controls must match new data model
`ShipStatusPanel.tsx` (GM bridge inline controls) and any GM tool panel references must:
- Add reactor status/condition controls
- Add resource current-value controls (fuel, food, O2, cryopods, escape_pods)
- Keep armor controls (not removed)

### D-10: StatusSection.tsx full rewrite
The current `StatusSection.tsx` uses `IntegrityPanel` + `SystemStatusPanel` card components in left/right columns. These are replaced entirely by two `TerminalPanel` components (new component) with text-row internal layout. The old card approach is removed. `IntegrityPanel` and `SystemStatusPanel` sub-components are removed from the file.

### D-11: Change-flash animation on status change
When a system status changes (SSE update), flash the **entire row** with a brief background highlight — same visibility as current card approach but applied to the row `<div>`. Use the existing `state-changing` CSS class pattern; new CSS targets `.terminal-row.state-changing`. Duration: 600ms (matches current timeout).

### D-12: GM resource controls — number spinners
Resource values (fuel, food, O2, cryopods, escape pods) in `ShipStatusPanel.tsx` / GM bridge panel use **Ant Design `InputNumber`** components — same control type as numeric fields already used in the panel. One spinner per resource showing `current` value; `max` shown as read-only label beside it.

### D-13: Row stagger-in animation — typewriter scan
When STATUS tab loads, terminal rows appear **top-to-bottom like a terminal printing**: each row fades/slides in sequentially with a short fixed delay (e.g., 80ms between rows). More atmospheric than block-reveal. Extends the existing `stagger-animate` keyframe with a tighter delay increment.

### Claude's Discretion
- Exact panel widths (aim for ~140px each, leaving map visible between them)
- Whether `PreviousStatuses` / `ChangingFlags` change-detection pattern is extended to cover `reactor` or rebuilt more generically
- Exact GSAP/CSS animation for the resource bar fill transitions (keep consistent with existing `transition: width 0.5s ease` pattern)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design contract
- `sample_ui/status-tab-hybrid.html` — Approved layout mockup. Left = systems, right = resources, map behind both panels. Crisis state (right phone frame) shows color degradation behavior for low resources.

### Style system
- `STYLE_GUIDE.md` — Project color palette, panel conventions, chamfer sizes (12px), font (Cascadia Code)
- `src/styles/variables.css` — CSS custom properties to use (do not hardcode hex values)

### Current implementation (read before touching)
- `src/components/domain/dashboard/sections/StatusSection.tsx` — Full rewrite target
- `src/components/domain/dashboard/sections/StatusSection.css` — Full rewrite target
- `src/types/shipStatus.ts` — Extend with reactor + ShipResources
- `data/campaign/ship.yaml` — Add reactor system + resources block
- `terminal/data_loader.py` — Extend ship parsing to include resources
- `terminal/views.py` — Extend ship-status SSE payload
- `src/components/gm/views/BridgeView.tsx` — GmBridgeShipPanel — add reactor + resource controls
- `src/components/gm/ShipStatusPanel.tsx` — Check for armor/system references

### Patterns to follow
- `src/components/domain/dashboard/sections/StatusSection.css` — existing stagger + change-flash animation pattern to preserve
- `src/hooks/useSSE.ts` — SSE data flow (StatusSection receives shipData via this hook)

</canonical_refs>

<specifics>
## Specific Ideas

- **Crisis visual**: When hull < 50% or any resource < 25%, the map background tint shifts slightly warm (subtle red cast) to reinforce atmosphere — matches the crisis mockup variant
- **Crew in header**: The terminal header already shows ship name. Crew count (`7/12`) could move to the header right-side rather than pinned in the right panel footer — keeps the panel cleaner
- **System summary footer**: `4/5 OPERATIONAL · ⚠ 1 WARNING` — plain text, no icons except the ⚠ warning symbol which is already used in the project

</specifics>

<deferred>
## Deferred Ideas

- **Hotspot mode** (Layout 01 from mockup session) — tapping deck map locations to reveal system popups. Spatially compelling but requires mapping system names to deck room positions. Defer to a future polish phase.
- **Animated scanline sweep** on panel reveal — the typewriter/scan-reveal animation from `CommTerminalDialog`. Could be added later as a Phase 13-style animation pass.
- **Resource low alerts** — pulsing border or toast notification when a resource drops below a threshold. Deferred — GM can communicate this verbally for now.

</deferred>

---

*Phase: 14-rework-bridge-status-tab-ship-systems-remove-armor-add-react*
*Context gathered: 2026-04-07 via design session*
