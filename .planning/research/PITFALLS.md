# Pitfalls Research: Mothership GM Tool — Milestone 2

## Pitfall 1: Token Drag Performance on Mobile

**Risk:** HIGH
**Phase:** Encounter Tokens

Draggable elements on touch devices are notoriously tricky. Touch events have different behavior than mouse events (300ms delay, scroll interference, no hover state). If tokens don't respond smoothly on phones/tablets, the feature is unusable at the gaming table.

**Warning Signs:**
- Token drag feels "sticky" or delayed on mobile
- Dragging a token scrolls the page instead
- Touch target too small on phone screens

**Prevention:**
- Use `touch-action: none` CSS on the token layer to prevent scroll interference
- Use pointer events API (works for both mouse and touch) instead of separate mouse/touch handlers
- Make token touch targets larger than visual size (44px minimum per Apple HIG)
- Test on actual phone early — don't wait until the end
- Consider: GM moves tokens on laptop, players just view — may not need mobile drag at all

## Pitfall 2: Polling Latency for Token Movement

**Risk:** MEDIUM
**Phase:** Encounter Tokens

Current 2-second polling is fine for view switching and messages, but token movement during combat needs faster feedback. If GM drags a token and players don't see it move for 2 seconds, it breaks the tactical flow.

**Warning Signs:**
- Players report "laggy" token movement
- GM has to announce moves verbally because screen hasn't updated

**Prevention:**
- Consider reducing poll interval to 500ms during active encounters only
- Or: accept 2s delay as adequate — Mothership combat is theater-of-mind with occasional positioning, not real-time tactics
- Don't prematurely add WebSockets — evaluate if 2s is actually a problem in play first
- Fallback: GM announces move, map catches up visually

## Pitfall 3: YAML Schema Sprawl

**Risk:** MEDIUM
**Phase:** All phases

Adding crew, contacts, logs, ship status, and token data means several new YAML schemas. If these aren't designed consistently, the data directory becomes confusing and the DataLoader grows organically into a mess.

**Warning Signs:**
- Each new data type has slightly different field naming conventions
- DataLoader has many one-off loading methods
- Unclear where to put new data (campaign/ vs galaxy/ vs location-specific)

**Prevention:**
- Design all new YAML schemas before building any — consistency review upfront
- Follow existing patterns: `name` and `type` as standard required fields
- Keep campaign-wide data in `data/campaign/` (crew, contacts, notes)
- Keep location-specific data in location directories (ship status, tokens)
- Add schema examples to DATA_DIRECTORY_GUIDE.md as you go

## Pitfall 4: Encounter View Complexity Explosion

**Risk:** HIGH
**Phase:** Encounter Tokens + NPC Portraits

The encounter view currently renders rooms, doors, connections, POIs, and terminals. Adding tokens AND portrait overlays could make this component unwieldy. Layering features onto an existing complex view without refactoring leads to a God component.

**Warning Signs:**
- EncounterMap component exceeds 400 lines
- Props list grows beyond 10-15 props
- Multiple features fighting for screen space on mobile
- Hard to reason about which state controls which visual

**Prevention:**
- Decompose encounter view into clear layers: MapLayer, TokenLayer, PortraitOverlay
- Each layer has its own component with isolated state
- Use composition pattern — layers rendered as siblings, not nested
- Define clear z-index strategy for overlapping elements
- Portrait should be a separate panel/overlay, not embedded in map

## Pitfall 5: Bridge Tab Data Loading Waterfall

**Risk:** LOW
**Phase:** Bridge Tabs

If each tab makes its own API call when activated, and the API calls are slow (loading from disk), tab switching feels sluggish. Users click CREW tab, wait, see loading, then content appears.

**Warning Signs:**
- Visible loading spinner when switching tabs
- Tab content "pops in" after a delay
- Multiple sequential API calls on tab switch

**Prevention:**
- Prefetch all tab data when bridge view loads (parallel API calls)
- Data is small (YAML files) — loading all upfront is cheap
- Cache in component state — data doesn't change during a session unless GM edits files
- Use optimistic rendering — show cached data immediately, refresh in background

## Pitfall 6: CRT Aesthetic Inconsistency

**Risk:** LOW
**Phase:** All phases

New components (ship dashboard, token controls, portrait panels) might subtly deviate from the established CRT aesthetic. Different border styles, slightly off colors, inconsistent spacing.

**Warning Signs:**
- New panels look "cleaner" or "flatter" than existing ones
- Colors don't match STYLE_GUIDE.md palette
- Missing chamfered corners or scanline effects

**Prevention:**
- Use existing Panel/DashboardPanel/CompactPanel components for ALL new panels
- Reference STYLE_GUIDE.md color palette for every new color used
- Visual review after each phase — compare new components next to existing ones
- Don't introduce new UI primitives without updating the shared component library

## Pitfall 7: Ship Dashboard vs Bridge View Confusion

**Risk:** MEDIUM
**Phase:** Ship Dashboard

SHIP_DASHBOARD already exists as a view type separate from BRIDGE. But the bridge also shows ship information (it IS the ship's bridge). Users (and developers) may get confused about which view shows what.

**Warning Signs:**
- Duplicate information shown in both views
- Unclear when to use BRIDGE vs SHIP_DASHBOARD
- GM doesn't know which view to activate

**Prevention:**
- Clear distinction: BRIDGE = tabbed interface for exploration/navigation (galaxy map, crew, contacts, logs). SHIP_DASHBOARD = focused system status display (hull, engines, life support — what you'd see on a damage control screen)
- SHIP_DASHBOARD is what GM shows during emergencies/combat. BRIDGE is the default exploration view
- Document the distinction in CLAUDE.md and GM Console UI
