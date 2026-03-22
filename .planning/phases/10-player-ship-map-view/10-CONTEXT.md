# Phase 10: Player Ship Map View - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Integrate the player ship as a first-class location with grid deck maps. The ship's deck map renders in BRIDGE mode (player STATUS tab + GM right panel) as a read-only orientation tool — zoomable/panable, all rooms visible, no tokens, no door controls. The ship can separately be used as a full ENCOUNTER location (tokens, doors, room reveal) via the existing encounter system. A `location_slug` field in campaign ship data tracks the ship's current galactic position, settable by the GM mid-session via the Locations panel.

No new top-level view type. No separate SHIP_DASHBOARD push. All ship map work integrates into existing BRIDGE view.

</domain>

<decisions>
## Implementation Decisions

### Ship Data Location
- Campaign ship lives at `data/campaign/ship/` — a proper location directory with `location.yaml`, `map/manifest.yaml`, and grid deck YAML files (same format as `patrol_gunboat` in `data/galaxy/tau-ceti/`)
- The existing `data/campaign/ship.yaml` (ship status/systems) gains a `location_slug` field — galactic slug like `tau-ceti/tau-ceti-f` — indicating where in the galaxy the ship currently is
- Ship deck maps follow the same multi-deck manifest format used by patrol_gunboat: `map/manifest.yaml` + `map/deck_N.yaml` per deck (polygon rooms, explicit door positions)
- A `Morrigan` deck YAML needs to be created with at least one proper grid map (can be minimal but must be a real grid map, not the current stub)

### Ship Location Slug (Galactic Position)
- New `location_slug` field added to `data/campaign/ship.yaml`
- New write-back API endpoint updates this field in the YAML file (persists across server restarts)
- New `save_ship_location(slug)` method in DataLoader writes the field back to the file
- SSE push after save so all connected clients see the updated position immediately
- GM sets it via the Locations panel in BridgeView — clicking a location node shows a "Set as ship location" action (button or context action)

### Campaign Ship Slug for Encounter System
- The campaign ship has a fixed slug `campaign_ship` regardless of galactic position
- DataLoader adds a resolver: `location_slug == "campaign_ship"` loads from `data/campaign/ship/` instead of galaxy
- This lets the existing encounter system work with the ship: GM sets encounter location to `campaign_ship`, all token/door/reveal state is tracked under that slug
- The `location_slug` in `ship.yaml` is a SEPARATE field (galactic position) — not the same as the encounter slug

### Bridge Mode: Player STATUS Tab
- Ship deck map renders BELOW the existing hull/armor/system status boxes in the player's STATUS bridge tab
- All rooms always visible in bridge mode — no fog of war (crew knows their own ship)
- No tokens rendered in bridge mode
- No door open/close controls in bridge mode
- Zoomable and panable (same SVG pan/zoom as encounter maps)
- Multi-deck: `LevelIndicator` deck selector if ship has more than one deck (local state only — no API call)
- If no ship deck map data available: show `DECK MAP UNAVAILABLE` placeholder

### Bridge Mode: GM Right Panel (GmBridgeStatusPanel replacement)
- The existing `GmBridgeStatusPanel` is replaced by a new component that stacks ship deck map BELOW the ship status toggles
- Same read-only bridge mode behavior: all rooms visible, no tokens, no door controls
- Width stays 280px fixed (same footprint as current panel)
- GM does NOT get room reveal in bridge mode — that's encounter-only
- Deck selector (LevelIndicator) if multi-deck — local state only

### Encounter Mode (No New Work Required)
- The ship works as a standard encounter location via the existing encounter system
- GM sets encounter location to `campaign_ship` from the Locations panel (same mechanism as any other encounter location)
- Full encounter features: tokens, door states, room reveal — no special treatment
- The only new work needed: DataLoader must resolve `campaign_ship` slug to `data/campaign/ship/`

### What Phase 10 Does NOT Include
- No separate `SHIP_DASHBOARD` view type — the UI-SPEC researcher proposed this but user confirmed ship map lives inside BRIDGE mode only
- No animated token movement (existing requirement)
- No player-side room reveal or door controls (players are read-only in bridge mode)
- No GM room reveal in bridge mode (encounter mode is the right tool for that)

### Claude's Discretion
- Exact SVG pan/zoom implementation for bridge mode (reuse encounter map pan/zoom pattern if it exists, otherwise standard SVG transform)
- Whether `LevelIndicator` needs changes to support the bridge mode (no room toggle callbacks)
- Exact shape of the write-back API response and whether ship data is re-broadcast via SSE on location change

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Ship Map Rendering
- `src/components/domain/encounter/EncounterMapRenderer.tsx` — grid map renderer; reused for ship deck in bridge mode
- `src/components/domain/encounter/EncounterMapDisplay.tsx` — multi-deck routing; reused for ship deck
- `src/components/domain/encounter/LevelIndicator.tsx` — deck selector; reused for ship multi-deck

### Ship Status (existing)
- `src/components/gm/views/BridgeView.tsx` — contains `GmBridgeStatusPanel` (to be replaced) and `GmBridgeDashboard` layout
- `src/components/gm/views/BridgeView.css` — `.gm-bridge-status-panel`, `.gm-bridge-content` styles
- `src/components/domain/dashboard/sections/StatusSection.tsx` — player STATUS tab (ship map goes below this)
- `src/types/shipStatus.ts` — `ShipStatusData` type

### Data Layer
- `terminal/data_loader.py` — `DataLoader` class; needs `load_campaign_ship_maps()` and `save_ship_location()` methods; `find_location_by_slug` / encounter loading must handle `campaign_ship` slug
- `data/campaign/ship.yaml` — gains `location_slug` field; existing ship status fields preserved
- `data/galaxy/tau-ceti/tau-ceti-f/patrol_gunboat/map/main_deck.yaml` — reference for correct grid map YAML format (polygon rooms, explicit door x/y/angle)
- `data/galaxy/tau-ceti/tau-ceti-f/patrol_gunboat/map/manifest.yaml` — reference for multi-deck manifest format

### GM Locations Panel (ship location setter)
- `src/components/gm/panels/LocationTreePanel.tsx` — Locations panel; needs "Set as ship location" action on location nodes
- `src/services/gmConsoleApi.ts` — API client; needs `setShipLocation(slug)` method
- `terminal/views.py` — new `api_set_ship_location` endpoint needed

### CSS Collision Warning
- `MEMORY.md` (project memory) — `.encounter-view` and `.bridge-view` are `position:fixed` in player terminal; bridge mode ship components must use `ship-dashboard-*` or `gm-bridge-*` class prefixes, never bare `encounter-view` or `bridge-view`

### Real-Time Architecture
- `terminal/sse_broadcaster.py` — after ship location change, broadcast updated ship data via SSE
- `src/hooks/useSSE.ts` — SSE hook already handles `activeview` and `ship_status` events; ship location update may need a field added to `ship_status` event payload

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EncounterMapRenderer` + `EncounterMapDisplay` — already handles multi-deck routing, polygon rooms, door rendering; reuse directly for bridge mode (pass `isGM={false}`, no `onRoomToggle` callback)
- `LevelIndicator` — deck selector already built; reuse with local state only (no API callback needed in bridge mode)
- `GmBridgeStatusPanel` in `BridgeView.tsx` — existing ship identity + toggle UI becomes the top half of the new combined component
- `DataLoader.load_encounter_manifest` / `load_deck_map` — already loads multi-deck manifest format; extend to accept `data/campaign/ship/` path
- `DataLoader.load_ship_status()` — already reads `data/campaign/ship.yaml`; add `location_slug` field support here

### Established Patterns
- Multi-deck manifest format: `map/manifest.yaml` with `decks[].id` + `decks[].file` → `map/deck_N.yaml`; patrol_gunboat is the reference implementation
- Encounter location slug resolution: `terminal/views.py` uses `loader.find_location_by_slug(slug)` to load encounter data; `campaign_ship` slug must be handled here
- SSE write-back pattern: after any state write, call `broadcaster.announce(build_active_view_payload(new_state))`; ship location write should do the same for ship status event
- `LocationTreePanel` uses Ant Design Tree; existing node click/select pattern can be extended with a secondary action button

### Integration Points
- `src/components/domain/dashboard/sections/StatusSection.tsx` — player STATUS tab; ship deck map renders below existing status boxes; needs `shipDeckData` prop or fetches independently
- `src/components/gm/views/BridgeView.tsx` → `GmBridgeDashboard` → `GmBridgeStatusPanel` — replace `GmBridgeStatusPanel` with new combined component
- `terminal/views.py` → `api_active_view` — the active view response must include ship deck map data (manifest + current deck) so frontend doesn't need a separate API call on bridge load
- `terminal/views.py` → new `api_set_ship_location` endpoint — CSRF exempt POST, writes to ship.yaml, broadcasts updated ship_status SSE event
- Ship status SSE event (`ship_status`) — currently only broadcasts system toggles; may need `location_slug` field added to payload for bridge location tree highlighting

</code_context>

<specifics>
## Specific Ideas

- Ship deck map in STATUS tab: render below the hull/armor progress bars and system status rows — no separate tab, no modal, just appended below in the same scrollable column
- GM bridge right panel: the `GmBridgeStatusPanel` stacking order becomes: ship identity + crew/hull/armor → system toggles → separator → deck map (zoomable) → deck selector if multi-deck
- Patrol Gunboat map at `data/galaxy/tau-ceti/tau-ceti-f/patrol_gunboat/map/main_deck.yaml` is the template — the Morrigan deck YAML should follow the same polygon room + explicit door format
- "Set as ship location" in Locations panel: a small button that appears on hover/select of a location node — clicking it calls the write-back API and shows a brief confirmation

</specifics>

<deferred>
## Deferred Ideas

- Animated ship position indicator on galaxy/system map (showing where the ship currently is as a moving icon) — future phase
- Ship-specific token types (crew assigned to rooms) vs encounter-placed tokens — current phase just reuses encounter tokens
- Ship damage overlaying specific rooms (Engineering room highlighted when engines are DAMAGED) — future phase

</deferred>

---

*Phase: 10-player-ship-map-view*
*Context gathered: 2026-03-22*
