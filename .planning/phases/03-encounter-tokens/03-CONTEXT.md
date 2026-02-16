# Phase 3: Encounter Tokens - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

GM can place and move tokens on encounter maps with live player updates. Tokens represent players, NPCs, creatures, and objects on the grid-based SVG encounter map. Players see token positions update via polling. GM controls all token placement, movement, and status from the GM Console.

</domain>

<decisions>
## Implementation Decisions

### Token appearance
- Tokens are circular, clipped to round shape (classic VTT token style)
- Token image sourced from entity's images/ directory (any entity with images/ subdirectory — NPCs, players, creatures)
- Image displayed as circular clip filling 80% of the grid cell
- Type distinction via colored glow/shadow behind the token (amber=player, teal=NPC, burgundy=creature, gray=object)
- Label: initial shown by default, full name appears on hover/select
- GM selects token image from a gallery of available images when creating/placing tokens

### Placement workflow
- Drag from palette to map — GM drags a token from the GM palette panel directly onto a target grid cell
- Palette shows both pre-configured templates (auto-populated from crew roster + NPCs in current location) and a custom token option for ad-hoc entries
- Token template stays selected in palette after placement — GM can drag again for duplicates (e.g., "3 marines")
- "Clear All Tokens" button with confirmation prompt for resetting encounters

### Map interaction
- Clicking a placed token opens a small inline popup near the token with name, status toggles, and remove button
- Overlap prevention — two tokens cannot occupy the same grid cell
- Tokens can only be placed in revealed rooms (not on unrevealed grid areas)
- Players only see tokens in revealed rooms — tokens in unrevealed rooms are hidden from player view (GM can pre-stage encounters)
- Drag-to-move with snap-to-grid behavior for repositioning tokens

### Claude's Discretion
- Fallback appearance for tokens without images (colored circle with initial, icon by type, etc.)
- Exact glow/shadow implementation for type indicators
- Gallery UI layout and image thumbnail sizing
- Debounce timing for drag-move API calls

</decisions>

<specifics>
## Specific Ideas

- Token images come from existing campaign data directories (e.g., data/campaign/NPCs/images/) — the same image assets that will be used for the NPC Portrait System in Phase 4
- Pre-configured templates auto-populate from campaign data, making encounter setup fast during live gameplay
- The "revealed rooms only" constraint ties token visibility to the existing room visibility system in EncounterMapRenderer

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-encounter-tokens*
*Context gathered: 2026-02-15*
