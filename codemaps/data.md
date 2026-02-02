# Data Architecture

**Last Updated**: 2026-02-02T00:00:00Z

## Data Storage Strategy

### Hybrid Approach
- **SQLite**: Runtime state (ActiveView, Messages)
- **File-based (YAML)**: Campaign content (locations, maps, terminals)
- **No DB sync**: On-demand loading from disk

### Benefits
- **Version control friendly**: YAML files in git
- **Rapid iteration**: Edit file, refresh browser (no migrations)
- **Unlimited nesting**: Hierarchical locations without schema changes
- **Lightweight**: No ORM overhead, minimal DB writes

## Directory Structure

```
data/
├── campaign/                   # Campaign-wide data
│   ├── crew.yaml               # Crew roster
│   ├── missions.yaml           # Mission tracking (planned)
│   └── notes.yaml              # Campaign notes (planned)
│
├── charon/                     # CHARON AI knowledge base
│   └── context.yaml            # Global CHARON context
│
└── galaxy/                     # Galaxy hierarchy (nested locations)
    ├── star_map.yaml           # Galaxy-level visualization
    │
    └── {system_slug}/          # Solar System (e.g., sol, tau-ceti)
        ├── location.yaml       # System metadata
        ├── system_map.yaml     # System-level visualization
        │
        └── {body_slug}/        # Planet/Moon (e.g., earth, tau-ceti-e)
            ├── location.yaml   # Body metadata
            ├── orbit_map.yaml  # Orbital visualization
            │
            ├── comms/          # Communication terminals
            │   ├── messages/   # Central message store (all terminals)
            │   │   └── *.md    # Message files (YAML frontmatter + markdown)
            │   │
            │   └── {terminal_slug}/    # Individual terminal
            │       ├── terminal.yaml   # Terminal metadata
            │       ├── inbox/          # (Legacy) Inbox messages
            │       │   └── {contact}/
            │       │       └── *.md
            │       └── sent/           # (Legacy) Sent messages
            │           └── {contact}/
            │               └── *.md
            │
            ├── map/            # Encounter maps
            │   ├── manifest.yaml       # Multi-deck manifest (optional)
            │   ├── {deck_slug}.yaml    # Deck map data
            │   └── {deck_slug}.png     # Deck map image
            │
            └── {facility_slug}/        # Facility/Station/Ship (unlimited nesting)
                ├── location.yaml
                ├── comms/      # (same structure as body)
                ├── map/        # (same structure as body)
                └── {deck_slug}/        # Decks/Levels (can nest rooms)
                    └── {room_slug}/    # Rooms (can nest further)
```

## YAML Schemas

### location.yaml (Location Metadata)
```yaml
name: "Research Base Alpha"
type: "station" | "base" | "ship" | "planet" | "moon" | "system"
status: "operational" | "abandoned" | "damaged" | "unknown"
description: "Text description"
is_orbital: true  # For stations (orbital vs surface)

# Optional fields
population: "150 personnel"
affiliation: "Weyland-Yutani Corp"
threat_level: "moderate"
```

### star_map.yaml (Galaxy Visualization)
```yaml
camera:
  position: [0, 50, 150]
  lookAt: [0, 0, 0]
  fov: 75

systems:
  - name: "Sol"
    position: [0, 0, 0]
    color: 0xffffaa
    size: 5
    type: "G-type main-sequence"
    label: true
    location_slug: "sol"
    has_system_map: true  # Added by API
    info:
      description: "Humanity's home system"
      population: "12 billion"

  - name: "Proxima Centauri"
    position: [10, -5, 20]
    color: 0xff6666
    size: 3
    type: "M-type red dwarf"
    label: true
    location_slug: "proxima-centauri"

routes:
  - from: "Sol"
    to: "Proxima Centauri"
    route_type: "jump_gate"
    color: 0x4a6b6b

nebulae:
  - name: "Horsehead Nebula"
    position: [-50, 10, -30]
    color: 0x8b7355
    size: 40
    particle_count: 2000
    opacity: 0.3
    type: "dark"
```

### system_map.yaml (Solar System Visualization)
```yaml
star:
  name: "Sol"
  type: "G-type main-sequence"
  color: 0xffffaa
  size: 10
  rotation_speed: 0.001

bodies:
  - name: "Earth"
    type: "terrestrial"
    orbit_radius: 50
    orbit_speed: 0.002
    size: 4
    color: 0x4a90e2
    rotation_speed: 0.01
    location_slug: "earth"
    has_orbit_map: true  # Added by API
    surface_facility_count: 3  # Added by API
    orbital_station_count: 2  # Added by API
    has_rings: false
    texture: "earth"  # Optional texture name

  - name: "Saturn"
    type: "gas_giant"
    orbit_radius: 150
    orbit_speed: 0.0008
    size: 8
    color: 0xf4e8c1
    rotation_speed: 0.02
    has_rings: true
    ring_inner_radius: 9
    ring_outer_radius: 15
    ring_color: 0xe8d8b8
```

### orbit_map.yaml (Orbital Visualization)
```yaml
planet:
  name: "Earth"
  size: 20
  color: 0x4a90e2
  rotation_speed: 0.005
  has_rings: false
  texture: "earth"
  latitude_lines: 8
  longitude_lines: 16

moons:
  - name: "Luna"
    orbit_radius: 40
    orbit_speed: 0.003
    size: 3
    color: 0xcccccc
    rotation_speed: 0.001
    location_slug: "luna"
    has_facilities: true

stations:
  - name: "Gateway Station"
    orbit_radius: 30
    orbit_speed: 0.005
    size: 2
    color: 0x8b7355
    location_slug: "gateway-station"

surface_markers:
  - name: "Research Base Alpha"
    latitude: 45.5
    longitude: -122.6
    marker_type: "research"
    color: 0xff6b35
    location_slug: "research-base-alpha"

  - name: "Mining Colony Beta"
    latitude: -33.8
    longitude: 151.2
    marker_type: "industrial"
    color: 0x4ecdc4
```

### manifest.yaml (Multi-Deck Encounter Map)
```yaml
name: "USCSS Morrigan"
total_decks: 3

decks:
  - id: "deck_1"
    name: "Main Deck"
    level: 1
    file: "deck_1.yaml"
    default: true

  - id: "deck_2"
    name: "Engineering Deck"
    level: 2
    file: "deck_2.yaml"

  - id: "deck_3"
    name: "Cargo Bay"
    level: 3
    file: "deck_3.yaml"
```

### deck_1.yaml (Single Deck Encounter Map)
```yaml
name: "Main Deck"
grid_size: 32
cell_size: 20

rooms:
  - id: "bridge"
    name: "Bridge"
    type: "command"
    x: 100
    y: 100
    width: 200
    height: 150
    color: 0x4a6b6b
    description: "Command center with viewscreens"

  - id: "corridor_1"
    name: "Main Corridor"
    type: "corridor"
    x: 300
    y: 150
    width: 150
    height: 50
    color: 0x2a3b3b

connections:
  - id: "conn_bridge_corridor"
    from: "bridge"
    to: "corridor_1"
    door_type: "standard"
    door_status: "OPEN"  # OPEN, CLOSED, LOCKED, SEALED, DAMAGED
```

### terminal.yaml (Communication Terminal)
```yaml
owner: "Dr. Sarah Chen"
terminal_id: "SCI-TERM-04"
access_level: "PUBLIC" | "RESTRICTED" | "CLASSIFIED"
description: "Science lab terminal"
```

### message.md (Terminal Message)
```yaml
---
message_id: "msg_001"
subject: "Re: Sample anomaly"
from: "Dr. Chen"
to: "Commander Drake"
timestamp: 2185-03-15T14:32:00
priority: "NORMAL" | "HIGH" | "CRITICAL"
read: true
conversation_id: "conv_sample_analysis"
in_reply_to: "msg_000"
---

Commander,

The sample shows unusual bio-signatures. Recommend quarantine protocols.

- Dr. Chen
```

### crew.yaml (Campaign Crew Roster)
```yaml
crew:
  - id: "sarah_chen"
    name: "Dr. Sarah Chen"
    callsign: "Doc"
    role: "Scientist"
    class: "Scientist"
    portrait: "portraits/sarah_chen.png"
    stats:
      strength: 30
      speed: 40
      intellect: 70
      combat: 25
    saves:
      sanity: 45
      fear: 40
      body: 30
    stress: 2
    health:
      current: 32
      max: 34
    wounds: 0
    armor: 0
    background: "Xenobiologist from Earth"
    motivation: "Discover new life forms"
    status: "active"
    description: "Brilliant but reckless researcher"
```

## Data Loading Flow

### Location Hierarchy Loading
```
DataLoader.load_all_locations()
  → Iterate galaxy/ subdirectories
  → For each system directory:
      → load_location_recursive(system_dir)
      → Load location.yaml
      → Load map/ if exists
      → Load comms/ if exists
      → Recursively load subdirectories (planets, facilities)
      → Build children array
  → Return hierarchical structure
```

### Map Data Loading
```
API: /api/system-map/{system_slug}/
  → DataLoader.load_system_map(system_slug)
  → Read galaxy/{system_slug}/system_map.yaml
  → For each body in bodies:
      → Check for orbit_map.yaml (set has_orbit_map)
      → Count subdirectories (surface_facility_count, orbital_station_count)
  → Return JSON
```

### Terminal Message Loading
```
DataLoader.load_terminal(terminal_dir)
  → Check for comms/messages/ directory (central store)
  → If exists:
      → load_central_messages(messages_dir)
      → filter_messages_for_recipient(messages, owner) → inbox
      → filter_messages_for_sender(messages, owner) → sent
  → Else (legacy mode):
      → load_message_folder(inbox/)
      → load_message_folder(sent/)
  → Return terminal data with inbox/sent arrays
```

### Multi-Deck Encounter Loading
```
API: /api/encounter-map/{location_slug}/?deck_id=deck_2
  → DataLoader.find_location_by_slug(location_slug)
  → DataLoader.load_encounter_manifest(location_dir)
  → If manifest exists:
      → DataLoader.load_deck_map(location_dir, 'deck_2')
      → Merge with ActiveView.encounter_room_visibility
      → Return { is_multi_deck: true, manifest, current_deck, room_visibility }
  → Else (single deck):
      → Load single map YAML from map/
      → Return { is_multi_deck: false, rooms, connections, room_visibility }
```

## Runtime State (SQLite)

### ActiveView Table
**Purpose**: Singleton tracking shared terminal state.

**Schema**:
```sql
CREATE TABLE terminal_activeview (
    id INTEGER PRIMARY KEY,
    location_slug VARCHAR(200),
    view_type VARCHAR(50) DEFAULT 'STANDBY',
    view_slug VARCHAR(200),
    overlay_location_slug VARCHAR(200),
    overlay_terminal_slug VARCHAR(200),
    charon_mode VARCHAR(20) DEFAULT 'DISPLAY',
    charon_location_path VARCHAR(500),
    charon_dialog_open BOOLEAN DEFAULT 0,
    encounter_level INTEGER DEFAULT 1,
    encounter_deck_id VARCHAR(100),
    encounter_room_visibility TEXT,  -- JSON
    encounter_door_status TEXT,      -- JSON
    updated_at TIMESTAMP,
    updated_by_id INTEGER REFERENCES auth_user(id)
);
```

**Singleton Pattern**: `save()` method ensures only one record (pk=1).

### Message Table
**Purpose**: Broadcast messages from GM to players.

**Schema**:
```sql
CREATE TABLE terminal_message (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender VARCHAR(100) DEFAULT 'CHARON',
    content TEXT,
    priority VARCHAR(10) DEFAULT 'NORMAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by_id INTEGER REFERENCES auth_user(id),
    is_read BOOLEAN DEFAULT 0
);

CREATE TABLE terminal_message_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER REFERENCES terminal_message(id),
    user_id INTEGER REFERENCES auth_user(id)
);
```

**Ordering**: `-created_at` (newest first).

## File Naming Conventions

### Slugs
- **Lowercase with hyphens**: `tau-ceti`, `gateway-station`, `research-base-alpha`
- **No spaces or special chars**: Filesystem-safe
- **Unique within hierarchy level**: Sibling uniqueness only

### File Types
- **location.yaml**: Location metadata
- **{map_type}_map.yaml**: Visualization data (star_map, system_map, orbit_map)
- **manifest.yaml**: Multi-deck encounter manifest
- **terminal.yaml**: Terminal metadata
- **{message_id}.md**: Message files (YAML frontmatter + markdown)

### Image Files
- **Map images**: `{deck_slug}.png` (same name as YAML)
- **Portraits**: `portraits/{slug}.png`
- **Textures**: `textures/{name}.png`

## Data Validation

### YAML Parsing
- **PyYAML safe_load()**: Prevents code execution
- **Missing files**: Return `None`, handle gracefully
- **Invalid YAML**: Log error, return empty dict

### Type Safety
- **TypeScript types**: Frontend validates API responses
- **Django model validation**: SQLite data integrity
- **Optional fields**: Graceful degradation if missing

## Migration from Imperative to Declarative

### Phase 6 Cleanup (Complete)
- **Removed**: Old Three.js classes (GalaxyMapOld, SystemMapOld, OrbitMapOld)
- **Kept**: R3F components in `src/components/domain/maps/r3f/`
- **Barrel exports**: Centralized exports via `index.ts`
- **Dead code removal**: Unused imports, legacy animation classes

### Data Flow Unchanged
- **API contracts**: Same JSON structure
- **YAML schemas**: No breaking changes
- **Database schema**: ActiveView fields unchanged

## Performance Considerations

### File I/O
- **On-demand loading**: No caching, always fresh from disk
- **Small files**: YAML files typically < 10KB
- **Disk speed**: SSD recommended for production

### Memory
- **No ORM bloat**: Direct YAML parsing
- **Lazy loading**: Only load requested locations
- **Garbage collection**: Python/JS handle cleanup

### Scalability
- **100s of locations**: File-based works well
- **1000s of locations**: Consider DB migration
- **Large maps**: PNG compression (< 1MB per deck)
