---
phase: 10-player-ship-map-view
plan: "02"
subsystem: ui
tags: [react, typescript, encounter-map, ship-deck, bridge-view, status-section]

requires:
  - phase: 10-01
    provides: ShipDeckData type, ship_deck_data in ActiveView, load_map() SSE payload eager-loading

provides:
  - Player STATUS tab renders EncounterMapDisplay below hull/armor/system rows using shipDeckData from SSE
  - GM BridgeView right panel (GmBridgeShipPanel) renders deck map below system toggles
  - DECK MAP UNAVAILABLE placeholder when ship_deck_data absent
  - ship_deck_data/ship_deck_total_decks threaded from SharedConsole -> player BridgeView -> StatusSection
  - ship_deck_data/ship_deck_total_decks threaded from GMConsole -> GM BridgeView -> GmBridgeShipPanel
  - ShipSchematic SVG placeholder removed from StatusSection

affects: [future phases adding deck-level switching, any work touching StatusSection or GmBridgeStatusPanel]

tech-stack:
  added: []
  patterns:
    - EncounterMapDisplay used in bridge-mode (isGM=false, no roomVisibility, no token callbacks) for static deck display
    - Prop-threading pattern: activeView.ship_deck_data flows from SSE payload down through entry point -> view -> section
    - ShipDeckData imported in both player and GM paths — same type, same call pattern

key-files:
  created: []
  modified:
    - src/components/domain/dashboard/sections/StatusSection.tsx
    - src/components/domain/dashboard/sections/StatusSection.css
    - src/components/domain/dashboard/BridgeView.tsx
    - src/entries/SharedConsole.tsx
    - src/components/gm/views/BridgeView.tsx
    - src/components/gm/views/BridgeView.css
    - src/entries/GMConsole.tsx

key-decisions:
  - "ShipSchematic SVG placeholder removed entirely — replaced by real EncounterMapDisplay deck map"
  - "status-layout changed from 3-column (with schematic) to 2-column — left/right panels only"
  - "GmBridgeStatusPanel renamed to GmBridgeShipPanel to reflect expanded role (system toggles + deck map)"
  - "currentDeckLevel is useState(1) with no setter in player STATUS tab — no deck switcher UI for players yet"
  - "EncounterMapDisplay called with isGM=false in both views — bridge mode shows all rooms, no click handlers"

patterns-established:
  - "Bridge-mode EncounterMapDisplay: omit roomVisibility (all rooms visible), isGM=false, slug='campaign_ship'"
  - "Deck map containers use position:relative + min-height (not position:absolute/fixed) to avoid collision"

requirements-completed: [SHIP-01]

duration: 9min
completed: 2026-03-22
---

# Phase 10 Plan 02: Player Ship Map View Summary

**Ship deck map integrated into player STATUS tab (EncounterMapDisplay below hull/armor/systems) and GM BridgeView right panel (GmBridgeShipPanel with system toggles + deck map stacked)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-22T19:19:35Z
- **Completed:** 2026-03-22T19:28:51Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Removed hand-drawn ShipSchematic SVG from player STATUS tab; replaced with real EncounterMapDisplay deck map
- Threaded shipDeckData/shipDeckTotalDecks from SharedConsole -> player BridgeView -> StatusSection
- Renamed GmBridgeStatusPanel to GmBridgeShipPanel; added deck map section below system toggles
- Threaded shipDeckData/shipDeckTotalDecks from GMConsole -> GM BridgeView -> GmBridgeShipPanel
- Both views show DECK MAP UNAVAILABLE placeholder when ship_deck_data is absent
- TypeScript clean, build passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ship deck map to player STATUS tab** - `dcbee30` (feat)
2. **Task 2: Replace GmBridgeStatusPanel with GmBridgeShipPanel in GM BridgeView** - `7792527` (feat)

**Plan metadata:** _(committed with state updates)_

## Files Created/Modified

- `src/components/domain/dashboard/sections/StatusSection.tsx` - Removed ShipSchematic; added shipDeckData/shipDeckTotalDecks props; renders EncounterMapDisplay below status panels
- `src/components/domain/dashboard/sections/StatusSection.css` - Changed status-layout to 2-column; added .section-status__deck-map; removed .status-schematic-container and .ship-schematic
- `src/components/domain/dashboard/BridgeView.tsx` - Added shipDeckData/shipDeckTotalDecks to BridgeViewProps; threads to StatusSection
- `src/entries/SharedConsole.tsx` - Added ship_deck_data/ship_deck_total_decks to local ActiveView interface; passes to BridgeView
- `src/components/gm/views/BridgeView.tsx` - Renamed GmBridgeStatusPanel -> GmBridgeShipPanel; added deck map section; threaded new props through BridgeViewProps and GmBridgeDashboardProps
- `src/components/gm/views/BridgeView.css` - Added .gm-bridge-ship-deck-map with min-height: 220px
- `src/entries/GMConsole.tsx` - Passes shipDeckData/shipDeckTotalDecks from activeView to BridgeView

## Decisions Made

- ShipSchematic SVG removed entirely — it was a placeholder; the real deck map (EncounterMapDisplay) replaces it
- status-layout changed from 3-column grid to 2-column — center schematic column dropped, panels now share equal width
- GmBridgeStatusPanel renamed GmBridgeShipPanel to signal its expanded role (ship status toggles + deck map together)
- `currentDeckLevel` uses `useState(1)` with no setter in player STATUS tab — deck switching UI is out of scope for this plan
- EncounterMapDisplay called with `isGM={false}` in both views — all rooms visible, no click handlers, no token layer

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Suppressed unused setCurrentDeckLevel declaration**
- **Found during:** Task 1 (StatusSection typecheck)
- **Issue:** Plan specified `const [currentDeckLevel, setCurrentDeckLevel] = useState(1)` but no UI calls setCurrentDeckLevel — TypeScript TS6133 error
- **Fix:** Changed to `const [currentDeckLevel] = useState(1)` (destructure without setter)
- **Files modified:** src/components/domain/dashboard/sections/StatusSection.tsx
- **Verification:** npm run typecheck exits 0
- **Committed in:** dcbee30 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - TypeScript error)
**Impact on plan:** Trivial fix — setter not needed since no deck switcher UI in player STATUS tab. No scope change.

## Issues Encountered

None beyond the TypeScript unused variable above.

## Next Phase Readiness

- Both player and GM bridge views now render the ship deck map from SSE-pushed ship_deck_data
- Deck level switching (for multi-deck ships) not yet wired — currentDeckLevel is hardcoded to 1 in both views
- Phase 10 complete — all plans executed

---
*Phase: 10-player-ship-map-view*
*Completed: 2026-03-22*
