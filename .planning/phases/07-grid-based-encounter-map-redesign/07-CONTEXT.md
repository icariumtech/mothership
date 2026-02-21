# Phase 7: Grid-based encounter map redesign - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current encounter map system (rooms positioned freely and connected by path lines) with a proper grid-based layout where rooms are defined by grid coordinates and walls align. Rooms are composed of one or more grid rectangles, share walls with adjacent rooms, and support the same visibility (reveal/hide) and token placement features as the current system.

</domain>

<decisions>
## Implementation Decisions

### Room shape system
- Rooms are defined as a list of grid rectangles: each rect is `{x, y, w, h}` in grid cell units
- This supports irregular shapes: an L-shaped room is two rects that together form the L
- Internal edges between rects of the same room are erased — reads as open floor
- Each grid cell belongs to at most one room (no overlap between different rooms)
- Corridors/hallways are supported as rooms with no label (unnamed rooms follow same visibility rules as named rooms)
- Doors are explicit: defined as `{wall_side, position}` on a room, not implied by adjacency

### Door system
- Keep current door types and statuses: standard, airlock, blast_door, emergency
- Door statuses: OPEN, CLOSED, SEALED, LOCKED
- Door rendering: keep current door icons and visual states (type-colored symbols)
- In the new format, doors are attached to a room's wall edge (instead of being a connection between two room IDs)

### Map canvas
- Map bounding box auto-fits to room coordinates — no fixed canvas size in YAML
- The renderer computes the bounding box from all room rects and sizes accordingly

### Visual style
- **Room interiors (revealed):** Subtle floor texture — light scanline or faint grid pattern inside the room to distinguish floor from void
- **Walls:** Amber tones (#8b7355 range) — blueprint/sci-fi aesthetic matching project palette
- **Room labels:** Centered text inside the room, always-on (not hover-only), only visible when room is revealed
- **Map background (outside rooms):** Dark grid — faint grid lines visible in the void suggesting underlying grid structure
- **GM view — hidden rooms:** Dimmed/darker rendering so GM can see all rooms but clearly distinguish what players see
- **Player view — hidden rooms:** Pure void — hidden rooms are not drawn at all

### Room reveal UX
- **Dual method:** GM can click directly on a room on the map to toggle reveal/hide (GM console only), OR use the sidebar room list toggle buttons
- Map click-to-reveal is exclusive to the GM console — player terminal map never accepts room clicks
- **Bulk actions:** Both "reveal all" and "hide all" buttons available for quick session setup/reset
- Changes save immediately to the API on each toggle — players see updates within the ~2 second poll cycle

### Map data format
- New grid-based format replaces the old encounter map YAML format — clean break, no migration tooling
- Existing maps (deck_1.yaml, deck_2.yaml) to be manually rebuilt in the new format
- A sample encounter_map.yaml is created as part of this phase to demonstrate the format
- Per-room metadata: `name` (required), `rects` (list of `{x, y, w, h}`), `doors` (optional list), `description` (optional), `type` (optional tag, e.g. corridor, bridge, cargo)

### Claude's Discretion
- Grid unit pixel size (how many pixels per cell) — design for readability and token fit
- Grid unit real-world scale (no explicit 5ft/cell requirement — abstract units)
- Exact scanline/floor texture implementation details
- Wall line thickness
- Label font size and truncation for small rooms
- The exact YAML key names and schema structure (within the decisions above)

</decisions>

<specifics>
## Specific Ideas

- Reference image: `sample_ui/example_ship_map.png` — shows dark rooms on dark background, irregular shapes, compact dense layout. This is the visual target aesthetic, but using project theming (teal/amber CRT palette, not the image's colors).
- Irregular shapes matter — the multi-rect approach needs to handle L-shapes, T-shapes, and wide corridors connecting areas
- The current door system's icon vocabulary (standard/airlock/blast_door/emergency with OPEN/CLOSED/SEALED/LOCKED states) is well-established and should carry forward exactly

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-grid-based-encounter-map-redesign*
*Context gathered: 2026-02-21*
