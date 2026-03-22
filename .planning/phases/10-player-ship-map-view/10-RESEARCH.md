# Phase 10: Player Ship Map View - Research

**Researched:** 2026-03-22
**Domain:** Ship deck map integration into BRIDGE mode — Django data layer + React rendering
**Confidence:** HIGH

---

## Summary

Phase 10 integrates the campaign ship as a first-class location with a real grid deck map. The work is almost entirely plumbing and wiring: the rendering engine (`EncounterMapRenderer` + `EncounterMapDisplay`) already handles everything needed for bridge mode (read-only, all rooms visible, multi-deck). The ship data layer (`DataLoader`, `views.py`, SSE broadcaster) already handles all the patterns needed for the new write-back API. The primary risk is not technical complexity but careful surgical integration into existing components without breaking the encounter system.

Phase 10 has four distinct tracks that can be executed largely in parallel:
1. **Data layer** — create `data/campaign/ship/` directory with YAML deck files; extend `DataLoader` with `load_campaign_ship_maps()` and `save_ship_location()`; add `campaign_ship` slug resolver; add `location_slug` field to `ship.yaml`.
2. **Backend API** — new `api_set_ship_location` endpoint; include ship deck map data in `build_active_view_payload` for BRIDGE view; add URL routing.
3. **Player STATUS tab** — extend `StatusSection.tsx` to render `EncounterMapDisplay` below existing status panels, using ship deck data from the SSE payload.
4. **GM bridge panel** — replace `GmBridgeStatusPanel` with `GmBridgeShipPanel` that stacks deck map below the existing ship toggles; add "Set as ship location" action to `LocationTree`.

The existing `SHIP_DASHBOARD` view type in `SharedConsole.tsx` is already defined as a string literal but has no implementation. It should NOT be used — all ship map work lives inside BRIDGE mode per locked decisions. The currently-displayed `ShipSchematic` SVG in `StatusSection.tsx` (a hand-drawn blueprint) will be replaced or pushed below by the real deck map.

**Primary recommendation:** Execute in waves — data+API first (no UI risk), then player STATUS tab, then GM bridge panel replacement. Morrigan deck YAML should be authored before UI tasks begin so rendering can be tested immediately.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Campaign ship lives at `data/campaign/ship/` with `location.yaml`, `map/manifest.yaml`, and grid deck YAML files
- `data/campaign/ship.yaml` gains a `location_slug` field (galactic position slug like `tau-ceti/tau-ceti-f`)
- Ship deck maps follow multi-deck manifest format (same as `patrol_gunboat`)
- A Morrigan deck YAML must be created as a real grid map (not a stub)
- New `location_slug` field in `ship.yaml` written back by new `save_ship_location()` DataLoader method
- New `api_set_ship_location` endpoint writes to YAML and broadcasts SSE
- GM sets ship galactic position via Locations panel "Set as ship location" action
- Campaign ship has fixed slug `campaign_ship` regardless of galactic position
- DataLoader adds resolver: `campaign_ship` slug loads from `data/campaign/ship/`
- Ship deck map renders BELOW existing hull/armor/system status boxes in player STATUS tab
- All rooms always visible in bridge mode (no fog of war)
- No tokens in bridge mode
- No door open/close controls in bridge mode
- Zoomable and panable
- Multi-deck: `LevelIndicator` deck selector if >1 deck — local state only
- If no ship deck map: show `DECK MAP UNAVAILABLE` placeholder
- Existing `GmBridgeStatusPanel` replaced by new component stacking deck map BELOW ship status toggles
- Width stays 280px fixed
- GM does NOT get room reveal in bridge mode — encounter mode only
- No new view type (`SHIP_DASHBOARD` is NOT used)
- No animated token movement
- No player-side room reveal or door controls
- No GM room reveal in bridge mode

### Claude's Discretion

- Exact SVG pan/zoom implementation for bridge mode (reuse encounter map pan/zoom pattern if it exists, otherwise standard SVG transform)
- Whether `LevelIndicator` needs changes to support bridge mode (no room toggle callbacks)
- Exact shape of write-back API response and whether ship data is re-broadcast via SSE on location change

### Deferred Ideas (OUT OF SCOPE)

- Animated ship position indicator on galaxy/system map
- Ship-specific token types (crew assigned to rooms) vs encounter-placed tokens
- Ship damage overlaying specific rooms
</user_constraints>

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 19 / latest | UI components | Project standard |
| Ant Design | 6.1 | Tree, Select, message, Progress | Project standard |
| Django 5.2.7 | 5.2.7 | API endpoints, YAML write-back | Project standard |
| PyYAML | latest | YAML read/write for ship.yaml | Already used everywhere |
| `EncounterMapRenderer` | in-project | SVG grid map rendering | Already handles all bridge mode requirements |
| `EncounterMapDisplay` | in-project | Multi-deck routing | Already routes correctly |
| `LevelIndicator` | in-project | Deck selector widget | Already built; display-only already works |

### No New Dependencies
Phase 10 requires zero new npm packages or pip packages. All rendering, state management, and SSE infrastructure is already in place.

---

## Architecture Patterns

### Pattern 1: campaign_ship Slug Resolution (DataLoader)

`find_location_by_slug` searches the galaxy tree recursively. The `campaign_ship` slug will never be found there. Add a special-case check at the top of `find_location_by_slug` (or in any caller that needs to load location data for encounter/bridge purposes):

```python
# In DataLoader.find_location_by_slug or a wrapper:
if slug == 'campaign_ship':
    return self.load_location_recursive(self.data_dir / "campaign" / "ship")
```

The same pattern applies in `build_active_view_payload` in `views.py` — when `location_slug == 'campaign_ship'`, skip `loader.find_location_by_slug` and load directly from `data/campaign/ship/`.

**Confidence:** HIGH — directly mirrors existing `load_location_recursive` call pattern.

### Pattern 2: Ship Deck Data in BRIDGE Payload

Currently `build_active_view_payload` only includes `location_data` for ENCOUNTER view. For BRIDGE view, ship deck data needs to be included so the frontend can render the deck map without a second API call.

Add a BRIDGE branch in `build_active_view_payload`:

```python
# After existing ENCOUNTER block:
if state.get('view_type') == 'BRIDGE':
    loader = DataLoader()
    ship_dir = loader.data_dir / "campaign" / "ship"
    if ship_dir.exists():
        manifest = loader.load_encounter_manifest(ship_dir)
        if manifest:
            current_deck_id = manifest['decks'][0]['id']  # always first for bridge
            deck_data = loader.load_deck_map(ship_dir, current_deck_id)
            response['ship_deck_data'] = {
                'is_multi_deck': True,
                'manifest': manifest,
                'current_deck': deck_data,
                'current_deck_id': current_deck_id,
            }
            response['ship_deck_total_decks'] = manifest.get('total_decks', 1)
```

**Confidence:** HIGH — `load_encounter_manifest` and `load_deck_map` are exactly the same functions used for encounter multi-deck loading.

### Pattern 3: save_ship_location Write-Back

Follow the existing pattern from `load_ship_status` but write instead of read. YAML write-back already exists conceptually in this project (the `DataLoader` reads YAML but the `api_ship_toggle_system` endpoint uses in-memory overrides; this is the first true YAML write-back):

```python
def save_ship_location(self, location_slug: str) -> None:
    ship_file = self.data_dir / "campaign" / "ship.yaml"
    with open(ship_file, 'r') as f:
        ship_data = yaml.safe_load(f) or {}
    ship_data['location_slug'] = location_slug
    with open(ship_file, 'w') as f:
        yaml.dump(ship_data, f, default_flow_style=False, allow_unicode=True)
```

**Confidence:** HIGH — PyYAML round-trip is established project pattern.

### Pattern 4: api_set_ship_location Endpoint

Model after `api_bridge_selection` (CSRF exempt, POST, updates state + announces SSE):

```python
@csrf_exempt
def api_set_ship_location(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    data = json.loads(request.body)
    slug = data.get('location_slug', '')
    loader = DataLoader()
    loader.save_ship_location(slug)
    # Broadcast updated ship status so all clients see the new location_slug
    try:
        ship_data = loader.load_ship_status()
        if ship_data:
            broadcaster.announce_ship_status(ship_data)
    except Exception:
        pass
    return JsonResponse({'success': True, 'location_slug': slug})
```

URL: `path('api/gm/ship/set-location/', views.api_set_ship_location, name='api_set_ship_location')`

**Confidence:** HIGH — mirrors existing endpoint patterns exactly.

### Pattern 5: "Set as ship location" in LocationTree

`LocationTree.tsx` builds Ant Design Tree nodes. Each node's `title` is JSX. Add a small button that appears on hover, similar to the existing terminal "Show" button pattern:

```tsx
// In convertToTreeData, for location nodes:
title: (
  <Space>
    <span style={{ fontWeight: 500 }}>{location.name}</span>
    <Tag color="blue">{location.type}</Tag>
    <Button
      size="small"
      type="text"
      style={{ fontSize: 10, opacity: 0.6 }}
      onClick={(e) => {
        e.stopPropagation();
        onSetShipLocation?.(location.slug);
      }}
    >
      Set Ship Here
    </Button>
  </Space>
),
```

`LocationTreePanel` and `LocationTreePanelProps` need an optional `onSetShipLocation?: (slug: string) => void` prop threaded from `BridgeView.tsx` down.

**Confidence:** HIGH — exact same prop-threading + Ant Design Button pattern used for `onShowTerminal`.

### Pattern 6: Player STATUS Tab — Ship Deck Map Addition

`StatusSection.tsx` returns `<div className="section-status">` with a fixed layout. The deck map goes below:

```tsx
export function StatusSection({ shipData, shipDeckData, shipDeckTotalDecks }: StatusSectionProps) {
  const [currentDeckIndex, setCurrentDeckIndex] = useState(0);
  // ... existing code ...
  return (
    <div className="section-status">
      {/* existing ship identity + status layout unchanged */}
      ...
      {/* Ship deck map — below status panels */}
      <div className="section-status__deck-map">
        {shipDeckData ? (
          <EncounterMapDisplay
            locationData={{ slug: 'campaign_ship', name: ship.name, type: 'ship', map: shipDeckData }}
            isGM={false}
            currentLevel={currentDeckIndex + 1}
            totalLevels={shipDeckTotalDecks || 1}
            roomVisibility={allRoomsVisible}  // {} means all rooms visible in bridge mode
          />
        ) : (
          <div className="section-status__deck-map--unavailable">DECK MAP UNAVAILABLE</div>
        )}
      </div>
    </div>
  );
}
```

**Confidence:** HIGH — `EncounterMapDisplay` already accepts `locationData` with a `map` field and `isGM={false}`.

### Pattern 7: GmBridgeShipPanel (replaces GmBridgeStatusPanel)

The new component keeps all existing `GmBridgeStatusPanel` content (ship identity + system toggles) and adds the deck map below it. The existing component is defined inline in `BridgeView.tsx` (GM), so the replacement happens in the same file.

```tsx
function GmBridgeShipPanel({ shipData, shipDeckData, shipDeckTotalDecks }: GmBridgeShipPanelProps) {
  const [currentLevel, setCurrentLevel] = useState(1);
  // ... existing messageApi, handleSystemChange logic unchanged ...
  return (
    <div className="gm-bridge-status-panel">
      {/* Ship identity — UNCHANGED */}
      <div className="gm-bridge-status-identity"> ... </div>
      {/* System toggles — UNCHANGED */}
      <div className="gm-bridge-status-systems"> ... </div>
      {/* Deck map — NEW */}
      <div className="gm-bridge-ship-deck-map">
        {shipDeckData ? (
          <EncounterMapDisplay
            locationData={{ slug: 'campaign_ship', name: ship.name, type: 'ship', map: shipDeckData }}
            isGM={false}   // bridge mode = no room reveal
            currentLevel={currentLevel}
            totalLevels={shipDeckTotalDecks || 1}
          />
        ) : (
          <div style={{ color: '#444', fontSize: 11, padding: 12 }}>DECK MAP UNAVAILABLE</div>
        )}
        {(shipDeckTotalDecks || 0) > 1 && (
          <LevelIndicator currentLevel={currentLevel} totalLevels={shipDeckTotalDecks!} />
        )}
      </div>
    </div>
  );
}
```

**Confidence:** HIGH — direct replacement of existing inline component; same prop threading pattern.

### Recommended File Creation Order

```
data/campaign/ship/              # New directory
├── location.yaml                # type: ship, name: USCSS Morrigan
└── map/
    ├── manifest.yaml            # same format as patrol_gunboat
    └── morrigan_main.yaml       # real polygon room grid map
data/campaign/ship.yaml          # MODIFIED: add location_slug field
```

### Anti-Patterns to Avoid

- **Using `SHIP_DASHBOARD` view type:** The string literal exists in `SharedConsole.tsx` line 36 but leads to the "not yet implemented" fallback. Do not route ship map through this. All ship map work is BRIDGE mode only.
- **Separate API call for ship deck data:** The design calls for ship deck data to be included in the SSE/active-view payload for BRIDGE view. Do not add a separate fetch in the frontend.
- **Using `position: fixed` CSS class:** The encounter CSS class `.encounter-view` is `position: fixed`. New ship map components must use `ship-dashboard-view__*` or `gm-bridge-*` prefixes (see MEMORY.md CSS collision warning).
- **Modifying encounter room visibility for bridge mode:** In bridge mode, pass an empty `roomVisibility` dict `{}` — the renderer treats absent rooms as visible by default. Do NOT set all rooms to `true` via the encounter state system; that would pollute the encounter state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG grid map rendering | Custom renderer | `EncounterMapRenderer` | Already handles polygon rooms, walls, doors, pan/zoom |
| Multi-deck routing | Custom switcher | `EncounterMapDisplay` | Already routes grid vs legacy, handles manifest |
| Deck selector widget | Custom buttons | `LevelIndicator` | Already built, returns null for single-deck |
| SSE broadcast | New broadcaster | `broadcaster.announce_ship_status()` | Pattern established in Phase 09 |
| YAML read/write | Custom file I/O | PyYAML via DataLoader pattern | Consistent with all other data loading |

---

## Common Pitfalls

### Pitfall 1: Room Visibility in Bridge Mode
**What goes wrong:** Passing `roomVisibility` from the encounter state (which sets all rooms `false` on encounter switch) into the bridge mode ship deck render. This makes all rooms invisible.
**Why it happens:** The encounter system initializes room visibility to hidden (`false`) on new encounter location switch. Ship deck in bridge mode is a separate concern — all rooms should always be visible.
**How to avoid:** Pass `roomVisibility={}` (empty object) to `EncounterMapDisplay` in bridge mode contexts. The renderer's default behavior for absent keys is visible.
**Warning signs:** Deck map renders but shows no rooms (all black void).

### Pitfall 2: campaign_ship Slug in find_location_by_slug
**What goes wrong:** `find_location_by_slug('campaign_ship')` returns `None` because it only searches `data/galaxy/`.
**Why it happens:** The function iterates `self.systems_dir` which is `data/galaxy/`. The campaign ship is at `data/campaign/ship/` — a completely different path.
**How to avoid:** Add an early return in `find_location_by_slug` (or in `build_active_view_payload`) for the literal string `'campaign_ship'`, loading from `data/campaign/ship/` instead.
**Warning signs:** Encounter mode with `location_slug='campaign_ship'` shows "no map data" even though files exist.

### Pitfall 3: YAML Write-Back Formatting
**What goes wrong:** `yaml.dump()` rewrites the entire ship.yaml with unexpected formatting — field order changes, string quoting changes, comments are stripped.
**Why it happens:** PyYAML `dump()` does not preserve source formatting or comments.
**How to avoid:** Accept that comments will be stripped (ship.yaml is simple data, no comments currently). Use `default_flow_style=False` and `allow_unicode=True`. Document that ship.yaml should not have hand-authored comments. Alternatively, use a read-modify-write that only changes the `location_slug` key using string manipulation — but the simple yaml.dump approach is fine given ship.yaml's minimal structure.
**Warning signs:** ship.yaml fields lose their quoted strings or get reordered oddly after first save.

### Pitfall 4: LevelIndicator in Bridge Mode
**What goes wrong:** `LevelIndicator` is a display-only widget (no deck-switch callbacks). The deck switching needs to be managed by local state in the parent component.
**Why it happens:** `LevelIndicator` just shows `currentLevel / totalLevels`. It does not have any click/switch buttons — it's informational only.
**How to avoid:** For multi-deck switching in bridge mode, add simple prev/next buttons or a Select dropdown at the parent level (in `GmBridgeShipPanel` or `StatusSection`). Do NOT try to add callbacks to `LevelIndicator` — it's the wrong component for interaction.
**Warning signs:** Trying to add an `onLevelChange` prop to `LevelIndicator` — this is the wrong approach.

### Pitfall 5: EncounterMapDisplay fill prop in 280px panel
**What goes wrong:** The deck map in `GmBridgeShipPanel` (280px fixed width) doesn't fill correctly because it expects a full-screen layout.
**Why it happens:** `EncounterMapDisplay` wraps in `.encounter-map-display` which defaults to `width: 100%; height: 100%`. Parent needs explicit height.
**How to avoid:** Set an explicit height on the `.gm-bridge-ship-deck-map` container (e.g., `height: 300px` or `flex: 1; min-height: 200px`). The `fill={true}` pattern documented in MEMORY.md applies to `MapPreview`, not `EncounterMapDisplay` directly.
**Warning signs:** Map renders at 0px height or overflows the panel.

### Pitfall 6: ship_deck_data missing from BRIDGE SSE payload
**What goes wrong:** Frontend renders "DECK MAP UNAVAILABLE" even though files exist — because `build_active_view_payload` only enriches with location data for ENCOUNTER view, not BRIDGE.
**Why it happens:** The BRIDGE condition is new — it's not in the current code.
**How to avoid:** Add the BRIDGE branch in `build_active_view_payload` that loads ship deck manifest and current deck. Verify by checking the SSE stream in browser devtools.
**Warning signs:** `shipDeckData` prop is always `null` or `undefined` in browser React devtools.

---

## Code Examples

### Patrol Gunboat manifest.yaml (reference format)
```yaml
# Source: data/galaxy/tau-ceti/tau-ceti-f/patrol_gunboat/map/manifest.yaml
name: "USCSS Patrol Gunboat"
facility_type: "ship"
total_decks: 1
hull:
  polygon: [[39.5, 20.75], ...]
decks:
  - id: "main_deck"
    name: "Main Deck"
    file: "main_deck.yaml"
    level: 1
    default: true
```

### Polygon room deck YAML (reference format from patrol gunboat)
```yaml
# Source: data/galaxy/tau-ceti/tau-ceti-f/patrol_gunboat/map/main_deck.yaml
deck_id: "main_deck"
name: "USCSS Patrol Gunboat — Main Deck"
unit_size: 30

rooms:
  - id: engineering
    name: "ENGINEERING"
    polygon: [[20.5,20.75], [30.5,20.75], [30.5,29.75], [20.5,29.75]]
    doors:
      - {x: 25.5, y: 20.75, angle: 0, type: standard, status: CLOSED}
```

### Morrigan location.yaml (to be created)
```yaml
name: "USCSS Morrigan"
type: "ship"
description: "Hargrave-Class Light Freighter"
```

### ship.yaml addition
```yaml
# Added field to existing data/campaign/ship.yaml:
location_slug: "tau-ceti/tau-ceti-f"  # galactic position — set by GM
```

### EncounterMapDisplay bridge mode call (all rooms visible)
```tsx
// Source: EncounterMapDisplay.tsx interface — roomVisibility omitted = all rooms visible
<EncounterMapDisplay
  locationData={{
    slug: 'campaign_ship',
    name: ship.name,
    type: 'ship',
    map: shipDeckData   // { is_multi_deck: true, manifest: ..., current_deck: ..., current_deck_id: ... }
  }}
  isGM={false}
  currentLevel={currentLevel}
  totalLevels={shipDeckTotalDecks}
  // roomVisibility intentionally omitted — default is all rooms visible
/>
```

### gmConsoleApi.ts addition
```typescript
async function setShipLocation(locationSlug: string): Promise<void> {
  await api.post('/gm/ship/set-location/', { location_slug: locationSlug });
}
// Add to gmConsoleApi export object
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ShipSchematic SVG (hand-drawn blueprint) | Real `EncounterMapRenderer` deck map | Phase 10 | StatusSection.tsx needs update |
| GmBridgeStatusPanel (ship identity + toggles only) | GmBridgeShipPanel (adds deck map below) | Phase 10 | Inline replacement in BridgeView.tsx (GM) |
| No campaign ship directory | `data/campaign/ship/` with real YAML | Phase 10 | DataLoader needs campaign_ship resolver |

**Deprecated/outdated:**
- `ShipSchematic` component in `StatusSection.tsx`: replaced by real deck map. Can be removed or kept as fallback — decision is Claude's discretion. Removing it simplifies the layout.
- `GmBridgeStatusPanel` function name: will be replaced by `GmBridgeShipPanel`. The CSS class `.gm-bridge-status-panel` can be reused or a new class introduced.

---

## Integration Map

This section maps each integration point to the specific file and change required.

| File | Change | Notes |
|------|--------|-------|
| `data/campaign/ship.yaml` | Add `location_slug` field | Simple YAML addition |
| `data/campaign/ship/location.yaml` | CREATE | `name`, `type: ship`, `description` |
| `data/campaign/ship/map/manifest.yaml` | CREATE | Patrol gunboat format |
| `data/campaign/ship/map/morrigan_main.yaml` | CREATE | Real polygon rooms for Morrigan |
| `terminal/data_loader.py` | Add `load_campaign_ship_maps()`, `save_ship_location()`, and `campaign_ship` resolver in `find_location_by_slug` | Pure additions, no breaking changes |
| `terminal/views.py` | Add `api_set_ship_location`, add BRIDGE branch in `build_active_view_payload`, add `ship_deck_data` fields | `build_active_view_payload` is critical path |
| `terminal/urls.py` | Add `path('api/gm/ship/set-location/', ...)` | Simple addition |
| `terminal/active_view_store.py` | NO CHANGES needed | ship deck data is loaded on each payload build |
| `src/services/gmConsoleApi.ts` | Add `setShipLocation(slug)` | Simple addition |
| `src/components/gm/LocationTree.tsx` | Add optional `onSetShipLocation` prop, "Set Ship Here" button on nodes | Follow `onShowTerminal` pattern |
| `src/components/gm/panels/LocationTreePanel.tsx` | Thread `onSetShipLocation` prop through | Simple passthrough |
| `src/components/gm/views/BridgeView.tsx` | Replace `GmBridgeStatusPanel` with `GmBridgeShipPanel`, accept `shipDeckData` prop, wire `onSetShipLocation` | Main GM UI work |
| `src/components/gm/views/BridgeView.css` | Add `.gm-bridge-ship-deck-map` styles | Height constraint for deck map container |
| `src/components/domain/dashboard/sections/StatusSection.tsx` | Add deck map below existing status panels, accept `shipDeckData` prop | Player STATUS tab |
| `src/types/gmConsole.ts` | Add `ship_deck_data` and `ship_deck_total_decks` fields to `ActiveView` | Type update |
| `src/entries/GMConsole.tsx` | Pass `shipDeckData` from activeView to BridgeView | Thread prop |
| `src/entries/SharedConsole.tsx` | Pass `shipDeckData` from activeView to StatusSection via BridgeView | Thread prop |

---

## Open Questions

1. **LevelIndicator interaction for multi-deck**
   - What we know: `LevelIndicator` is display-only (no buttons). Multi-deck bridge mode needs some UI to switch decks.
   - What's unclear: Whether the Morrigan will have multiple decks at all (could start single-deck, making this moot for Phase 10).
   - Recommendation: Author Morrigan as single-deck initially. If multi-deck is needed, add simple prev/next buttons or Ant Design Segmented above the deck map in the parent component. Do not modify `LevelIndicator`.

2. **Where ship deck data flows in the STATUS tab**
   - What we know: `StatusSection` receives `shipData` from parent via props. The deck data would come from `activeView.ship_deck_data`.
   - What's unclear: Whether to pass `shipDeckData` as a prop to `StatusSection` or have it read from a context.
   - Recommendation: Pass as props — consistent with `shipData` pattern. `SharedConsole` → `BridgeView` → `StatusSection`.

3. **ShipSchematic fate**
   - What we know: `StatusSection.tsx` renders `ShipSchematic` (hand-drawn SVG). The deck map replaces its purpose.
   - What's unclear: Whether to keep it as a fallback when no deck data is available, or remove it entirely.
   - Recommendation: Remove `ShipSchematic` and replace with the real deck map. Use `DECK MAP UNAVAILABLE` placeholder when no data. Keeps code clean.

4. **campaign_ship encounter encounter_room_visibility collision**
   - What we know: When GM sets encounter location to `campaign_ship`, the encounter system initializes all rooms to `false` (hidden). Bridge mode must show all rooms regardless.
   - What's unclear: None — this is already solved: bridge mode passes empty `roomVisibility` dict independently of encounter state.
   - Recommendation: Bridge mode ship rendering reads ship deck data from `activeView.ship_deck_data` (a new field), NOT from `activeView.location_data` (which is only populated for ENCOUNTER view). The two rendering contexts are completely independent.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` (absent = treat as enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (`npm run typecheck`) + manual browser verification |
| Config file | `tsconfig.json` at project root |
| Quick run command | `npm run typecheck` |
| Full suite command | `npm run typecheck && npm run build` |

### Phase Requirements → Test Map

Phase 10 has no formal requirement IDs in REQUIREMENTS.md (it was added to the roadmap after v1 requirements were defined). Mapping to behaviors:

| Behavior | Test Type | Automated Command | Notes |
|----------|-----------|-------------------|-------|
| TypeScript types compile (new fields in ActiveView, gmConsole.ts) | type-check | `npm run typecheck` | Must be clean before wave merge |
| Ship deck YAML loads via DataLoader | manual | Run server + check API response in browser | Python: no test framework in project |
| `api_set_ship_location` writes to file and broadcasts | manual | POST via curl/browser devtools | Verify file change + SSE event |
| Player STATUS tab renders deck map | manual browser | Load `/terminal/` on BRIDGE view STATUS tab | Visual verification |
| GM bridge right panel shows deck map | manual browser | GM console BRIDGE view | Visual verification |
| All rooms visible in bridge mode (no fog) | manual browser | Compare with encounter mode | All rooms rendered amber |
| "Set ship location" action writes to ship.yaml | manual browser | Click button in Locations panel, check file | location_slug field updated |
| campaign_ship slug resolves in encounter mode | manual browser | GM sets encounter location to campaign_ship | Full encounter features work |
| Build passes (no TS errors, no webpack errors) | build | `npm run build` | Final gate |

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run typecheck && npm run build`
- **Phase gate:** Build passing + manual browser verification of all 4 integration points before `/gsd:verify-work`

### Wave 0 Gaps
None — no new test framework needed. All verification is TypeScript compiler + manual browser checks, which is the established pattern for this project.

---

## Sources

### Primary (HIGH confidence)
- Direct source code reading: `terminal/data_loader.py`, `terminal/views.py`, `terminal/active_view_store.py`, `terminal/sse_broadcaster.py`
- Direct source code reading: `src/components/domain/encounter/EncounterMapRenderer.tsx`, `EncounterMapDisplay.tsx`, `LevelIndicator.tsx`
- Direct source code reading: `src/components/gm/views/BridgeView.tsx`, `src/components/domain/dashboard/sections/StatusSection.tsx`
- Direct source code reading: `src/entries/SharedConsole.tsx`, `src/hooks/useSSE.ts`, `src/services/gmConsoleApi.ts`
- Direct source code reading: `src/components/gm/LocationTree.tsx`, `LocationTreePanel.tsx`
- Reference data: `data/galaxy/tau-ceti/tau-ceti-f/patrol_gunboat/map/manifest.yaml`, `main_deck.yaml`
- Project decisions: `.planning/STATE.md` (accumulated decisions log), `MEMORY.md` (CSS collision warnings, architectural decisions)

### Secondary (MEDIUM confidence)
- UI design contract: `10-UI-SPEC.md` — layout and visual contracts
- CONTEXT.md locked decisions

### Tertiary (LOW confidence)
- None needed — all findings grounded in direct code reading.

---

## Metadata

**Confidence breakdown:**
- Data layer (DataLoader + API + YAML): HIGH — all patterns directly observable in existing code
- Frontend integration (StatusSection, GmBridgeShipPanel): HIGH — reusing identical component APIs
- LocationTree "Set ship location" action: HIGH — exact same pattern as existing terminal actions
- Morrigan YAML authoring: HIGH — patrol_gunboat is a complete working template
- Multi-deck handling: HIGH — already fully implemented in EncounterMapDisplay

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable codebase, 30-day validity)
