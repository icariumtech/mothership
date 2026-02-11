# Architecture Research: Mothership GM Tool — Milestone 2

## Existing Architecture Summary

```
[YAML Files] → [Django DataLoader] → [API Endpoints] → [React Components] → [Terminal Display]
                                                              ↕
[GM Console] → [ActiveView API] ──────────────────→ [Polling (2s)] → [View Switch]
                                                              ↕
                                                    [Zustand sceneStore]
```

## New Feature Integration

### 1. Encounter Tokens

**Component Boundary:**
- New: `TokenLayer` component rendered inside existing encounter map
- New: `Token` component (draggable, grid-snapped)
- Modified: Encounter map YAML schema (add `tokens:` section)
- Modified: Django API to serve/update token positions
- Modified: GM Console to add token placement controls

**Data Flow:**
```
GM Console → POST /api/encounter/tokens/ → Django → ActiveView (token state)
                                                         ↓
Terminal → GET /api/active-view/ (includes tokens) → React → TokenLayer renders
```

**Key Decision: Where does token state live?**
- Option A: In YAML file (persistent, git-tracked) — for initial setup
- Option B: In ActiveView model (runtime, ephemeral) — for live movement during play
- **Recommendation: Both.** YAML defines initial token setup. ActiveView stores runtime positions. GM can save current positions back to YAML.

**State Management:**
- Token positions in Zustand store (or local component state — tokens are encounter-specific, not shared across views)
- GM actions update via API, terminal polls and receives updates

### 2. NPC Portrait Display

**Component Boundary:**
- New: `NPCPortrait` component (overlay panel)
- New: `NPCPortraitPanel` in encounter view
- Modified: ActiveView model (add `portrait_slug` or `active_npc` field)
- Modified: GM Console (add "Show Portrait" button for NPCs)
- Data: NPC portrait images in location or campaign directories

**Data Flow:**
```
GM Console → "Show NPC" → PATCH /api/active-view/ {active_npc: "dr-chen"}
                                    ↓
Terminal polls → sees active_npc → fetches NPC data → renders portrait overlay
```

**Integration with Encounter View:**
- Portrait panel appears as overlay on encounter map (or alongside it)
- Doesn't replace the map — augments it
- GM controls when portrait shows/hides

### 3. Ship Dashboard

**Component Boundary:**
- New: `ShipDashboard` view component (registered as SHIP_DASHBOARD view type — already exists in ActiveView choices)
- New: Section components: `HullStatus`, `SystemsPanel`, `CrewSummary`, `SupplyStatus`
- New: YAML schema `ship_status.yaml` in ship location directories
- Modified: Django DataLoader (load ship status data)
- Modified: API endpoint to serve ship status

**Data Flow:**
```
data/{ship}/ship_status.yaml → DataLoader → /api/ship-status/{slug}/ → React → ShipDashboard
                                                                              ↕
GM Console → PATCH ship status fields → Updates YAML or runtime state → Polling picks up changes
```

**Key Decision: Mutable vs immutable ship data?**
- Static data (ship class, crew capacity): YAML, read-only
- Dynamic data (hull integrity, system status, fuel): Could be YAML that GM edits, or DB-stored runtime state
- **Recommendation: Keep it YAML.** GM edits `ship_status.yaml` through console or directly. Simpler, git-tracked, consistent with existing patterns.

### 4. Bridge Tabs

**Component Boundary:**
- Modified: `BridgeView.tsx` (wire up new tabs)
- Modified: `TabBar.tsx` (update tab definitions — remove NOTES/STATUS, add LOGS)
- New: `CrewSection.tsx` content (replace placeholder)
- New: `ContactsSection.tsx` content (replace placeholder)
- New: `LogsSection.tsx` (replaces NotesSection + StatusSection)
- Data: `data/campaign/crew.yaml`, `data/campaign/contacts.yaml`, `data/campaign/notes/`

**Data Flow:**
```
data/campaign/crew.yaml → DataLoader → /api/campaign/crew/ → BridgeView → CrewSection
data/campaign/contacts.yaml → DataLoader → /api/campaign/contacts/ → BridgeView → ContactsSection
data/campaign/notes/*.md → DataLoader → /api/campaign/logs/ → BridgeView → LogsSection
```

**State Management:**
- Tab data fetched when tab becomes active (lazy loading)
- Cached in component state or simple Zustand slice
- No need for complex caching — data changes infrequently

## Suggested Build Order

```
Phase 1: Bridge Tabs (CREW, CONTACTS, LOGS)
  ├── Lowest risk — extends existing skeleton
  ├── Validates YAML data patterns and API approach
  └── Depends on: nothing new

Phase 2: Ship Dashboard
  ├── New view type (SHIP_DASHBOARD already defined)
  ├── Builds on data patterns from Phase 1
  └── Depends on: YAML schema design

Phase 3: Encounter Tokens
  ├── Extends existing encounter map
  ├── Needs GM-to-player state sync pattern
  └── Depends on: encounter map working, state sync approach

Phase 4: NPC Portraits
  ├── Extends encounter view
  ├── Depends on: NPC data existing, portrait assets
  └── Can be built in parallel with Phase 3
```

## API Endpoints Needed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/campaign/crew/` | GET | Crew roster data |
| `/api/campaign/contacts/` | GET | NPC/faction directory |
| `/api/campaign/logs/` | GET | Campaign log entries |
| `/api/ship-status/{slug}/` | GET | Ship systems and status |
| `/api/encounter/tokens/` | GET/POST | Token positions for active encounter |
| `/api/active-view/` | PATCH | Add active_npc field for portrait display |

## Zustand Store Considerations

Current sceneStore is focused on 3D map state. Options:
1. **Extend sceneStore** — add encounter/dashboard state alongside map state
2. **New stores** — `encounterStore`, `dashboardStore` for separation of concerns
3. **Recommendation: New stores.** Keep sceneStore focused on 3D. Encounter tokens and ship dashboard have different lifecycles.
