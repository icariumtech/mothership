# Data Directory Guide

This document is the **human onboarding** reference for the `data/` directory —
narrative walkthroughs ("how to add a new location", "how to add a new deck") and
high-level structure overviews.

For the **precise, condensed field-level schemas** that the JANUS MCP server and AI
tools consume, see `docs/schemas/`:

| Schema file | Covers |
|---|---|
| `docs/schemas/schema-campaign.md` | Crew, NPCs, corporations, standby (`data/campaign/`) |
| `docs/schemas/schema-galaxy.md` | `star_map.yaml`, `system_map.yaml`, `orbit_map.yaml`, location hierarchy |
| `docs/schemas/schema-ships.md` | Ship `location.yaml`, slug-pointer model, orbit self-registration |
| `docs/schemas/schema-encounters.md` | Deckplans, rooms, doors, POIs |
| `docs/schemas/schema-janus-context.md` | `janus.yaml` format produced by `/janus-generate-context` |

Those schema files are the canonical source of truth — keep them in sync when you
change data shapes. See `CLAUDE.md` → "Schema Sync" for the maintenance rule.

---

## 1. Overview

The data directory is split into four top-level areas:

```
data/
├── campaign/           ← campaign state: ship, crew, NPCs, docs, sessions
├── galaxy/             ← celestial bodies ONLY — written once per campaign
├── ships/              ← all mobile vessels — can point at any body in the galaxy
└── janus/              ← CHARON AI configuration
```

Each area has a distinct role:

| Directory | What lives here | How often edited |
|---|---|---|
| `campaign/` | The player ship + its crew/NPC rosters + session notes | Every session |
| `galaxy/` | Stars, planets, moons, and permanent installations | Once per campaign setup |
| `ships/` | Mobile vessels (patrol boats, freighters, derelicts) | When ships move or are discovered |
| `janus/` | CHARON AI personality and system prompt | Rarely |

---

## 2. Discovery Mechanism

Understanding how the back end loads data prevents "why doesn't it appear?" debugging.

### Galaxy tree

`data/galaxy/` is scanned once at request time. The scanner:

1. Iterates top-level subdirectories — each is a **star system**.
2. Recursively walks each system's subdirectories — each directory with a `location.yaml` is
   loaded as a body, moon, or permanent installation.
3. Permanent installations (bases, stations, mines) are nested directly under their
   parent body in the galaxy tree — they never move, so their physical path encodes
   their location.

### Mobile ships (`data/ships/`)

Ships are NOT nested under a body in the directory structure. Instead, each ship's
`location.yaml` contains `system_slug` and `body_slug` **pointer fields** that tell
the data loader where to inject the ship in the galaxy tree:

```
data/ships/
└── patrol_gunboat/
    ├── location.yaml    ← contains body_slug + system_slug
    └── deckplan.yaml    ← optional encounter map
```

**When a ship moves**, edit only its `location.yaml` pointer fields — no directory move
required.

### Orbit map injection

Orbit maps (`orbit_map.yaml`) define the moons section of a planet's orbital view.
Stations and ships that should appear on an orbit map are **not listed** in
`orbit_map.yaml` anymore — they self-register at runtime.

The data loader:

1. Loads `orbit_map.yaml` (moons only).
2. Scans the body's children in the galaxy tree (permanent installations).
3. Scans `data/ships/` for ships whose `body_slug` matches this body.
4. Merges all three into the final orbit map response.

**Result:** Adding a ship or permanent installation to a body's orbit map requires only
creating/editing one `location.yaml` with an `orbital:` block — the `orbit_map.yaml`
does not need to change.

> **Typo warning:** `body_slug` and `system_slug` are free-text string fields. A case
> mismatch or spelling error silently prevents the location from appearing. Example:
> `body_slug: tau-ceti-E` (capital E) will NOT match the directory `tau-ceti-e`.
> Always use lowercase-with-hyphens exactly matching the directory name.

> **Depth limitation:** `body_slug` injection resolves against direct children of system nodes
> only (planets, not moons). Pointing `body_slug` at a moon slug will silently fall back to
> `system_slug` lookup or the galaxy tree root — no error is raised. Only top-level bodies
> (planets) are valid `body_slug` targets.

---

## 3. File Types Reference

| File | Purpose | Location |
|---|---|---|
| `ship.yaml` | Player ship identity, systems, and resources | `data/campaign/ship/` |
| `deckplan.yaml` | All decks in one file (ship or any location) | `data/campaign/ship/` or `data/ships/{slug}/` |
| `location.yaml` | Location identity + spatial context | `data/galaxy/...` or `data/ships/{slug}/` |
| `orbit_map.yaml` | Planet orbital environment — moons only | `data/galaxy/{system}/{planet}/` |
| `system_map.yaml` | 3D solar system visualization | `data/galaxy/{system}/` |
| `star_map.yaml` | 3D galaxy map | `data/galaxy/star_map.yaml` |
| `terminal.yaml` | Comm terminal configuration | `{location}/comms/{name}/` |
| `{id}.yaml` | Individual crew member | `data/campaign/crew/` |
| `{id}.yaml` | Individual NPC | `data/campaign/npcs/` |

No `manifest.yaml` for new-format locations — multi-deck maps use a `decks:` list in a single
`deckplan.yaml`. The old `manifest.yaml` + individual deck file format still exists for legacy
locations (e.g. `data/galaxy/tau-ceti/somnus/map/manifest.yaml`) and is still loaded by
`data_loader.py:load_encounter_manifest()`.

---

## 4. Location Self-Registration (`body_slug` + `orbital:`)

Any location with an `orbital:` block and matching `body_slug` / `system_slug` fields will
appear automatically on the target planet's orbit map.

### Required fields (for orbit injection)

```yaml
parent_type: orbit          # "orbit" | "surface" — determines injection category
body_slug: tau-ceti-f       # must exactly match the planet's directory name
system_slug: tau-ceti       # must exactly match the system's directory name
```

### Optional `orbital:` block (orbit map visualization)

```yaml
orbital:
  radius: 32                # Distance from planet centre (arbitrary units)
  period: 90                # Animation period (higher = slower)
  angle: 135                # Starting angle in degrees
  inclination: 0            # Orbital plane tilt in degrees
  size: 1.5                 # Icon size
  icon_type: ship           # "ship" | "station" | "shipyard"
```

Without an `orbital:` block, the location is loaded into the tree but does NOT
appear as an orbiting object on the orbit map.

### Complete location.yaml example (mobile ship)

```yaml
name: "USCSS Patrol Gunboat"
type: "ship"
description: "Colonial patrol vessel on standby"
status: "OPERATIONAL"

parent_type: orbit
body_slug: tau-ceti-f
system_slug: tau-ceti

orbital:
  radius: 32
  period: 90
  angle: 135
  inclination: 0
  size: 1.5
  icon_type: ship
```

---

## 5. Ship Section

### 5.1 Player Ship (`data/campaign/ship/`)

The player ship uses two files:

```
data/campaign/ship/
├── ship.yaml        ← ship identity, systems, resources, cargo
├── deckplan.yaml    ← encounter map with all decks
└── location.yaml    ← type declaration (name + type: ship)
```

### 5.2 `ship.yaml` Schema

```yaml
slug: uscss_morrigan             # unique identifier (matches location resolution)
class: "Hargrave-Class Light Freighter"
name: "USCSS Morrigan"
location_slug: phoebe            # current galactic position slug
crew_capacity: 12
crew_count: 7

stats:
  battle: 5
  systems: 10
  thrusters: 20

systems:
  reactor:
    condition: 30
    display_name: Reactor
    icon: reactor core
    power_capacity: 12           # total power budget
    status: ONLINE               # ONLINE | STRESSED | DAMAGED | CRITICAL | OFFLINE
    warnings:
      - "Low Pressure"

  engines:
    condition: 5
    display_name: Engines
    icon: jumpdrive
    power:
      allocated: 2               # power drawn from reactor
      max: 5                     # maximum power this system can draw
    status: ONLINE
    subsystems:
      - THRUSTERS
      - SUB-LIGHT
      - JUMP READY
    warnings:
      - "Coolant Pressure Low"
    faults:
      - { label: "Coolant Leak", active: true }

  # Other systems follow the same pattern:
  # life_support, comms, weapons, medbay

resources:
  fuel:
    current: 7
    max: 12
    display_name: Fuel
    info: "Reactor feed"

  # Other resources: food, o2, escape_pods, cryopods

cargo:
  items:
    - "Cargo item 1"
    - "Cargo item 2"
```

**System statuses:** `ONLINE` `STRESSED` `DAMAGED` `CRITICAL` `OFFLINE`

---

## 6. Characters

### 6.1 Format

Character files are per-entity YAML files with no wrapper key — the file IS the character.

```yaml
# data/campaign/crew/alex_novak.yaml
id: "alex_novak"             # must match filename slug (alex_novak.yaml)
name: "Alex Novak"
role: "Pilot"
class: "Teamster"
portrait: "/static/portraits/novak.png"

stats:
  strength: 5
  speed: 8
  intellect: 6
  combat: 5

saves:
  sanity: 50
  fear: 30
  body: 35

stress: 0
health:
  current: 10
  max: 10
wounds: 0
armor: 0

background: "Commercial Pilot"
motivation: "See what's out there"
status: "ACTIVE"
description: "Hotshot pilot with nerves of steel."
```

### 6.2 Rules

| Rule | Detail |
|---|---|
| One file per character | `data/campaign/crew/alex_novak.yaml` |
| `id:` must match filename | `id: alex_novak` in `alex_novak.yaml` |
| No wrapper key | File starts with the character's own fields |
| Uniqueness enforced | Duplicate `id` values are logged and the second entry skipped |

### 6.3 NPC format

NPCs use the same file format and live in `data/campaign/npcs/`.
Portrait images referenced by `portrait:` should be placed in
`data/campaign/NPCs/images/`.

---

## 7. `deckplan.yaml` Schema Reference

One `deckplan.yaml` holds all decks for a location. Applies equally to the
player ship (`data/campaign/ship/deckplan.yaml`) and any location in
`data/ships/{slug}/deckplan.yaml`.

```yaml
# Optional: hull outline drawn behind all decks
hull:
  polygon: [[x, y], ...]   # list of [x, y] coordinate pairs in grid cells

# Required: list of decks
decks:
  - id: main_deck          # required: unique deck identifier
    name: Main Deck        # required: display name
    level: 1               # required: sort key — 1 = lowest deck
    default: true          # optional: first deck shown when location loads
    unit_size: 30          # optional: pixels per grid cell (default 30)
    rooms:                 # required: list of room entries
      ...
```

### Room entry

```yaml
- id: bridge               # required: unique within this deck
  name: "BRIDGE"           # display name — empty string suppresses label
  type: corridor           # optional: 'corridor' skips label rendering

  # Choose ONE shape type:

  # Option A: Rectangle(s) — supports L/T shapes, chamfered corners
  rects:
    - { x: 1, y: 0, w: 5, h: 3 }   # top-left cell (0-based), width, height in cells

  # Option B: Polygon — freeform, specify vertices in grid coordinates
  polygon:
    - [24.5, 7.0]
    - [28.0, 7.0]
    - [29.5, 10.0]
    - [23.0, 10.0]

  # Option C: Circle
  circle:
    cx: 22.0   # center X in grid cells
    cy: 4.0    # center Y in grid cells
    r: 2.0     # radius in grid cells

  # NOTE: doors live at the deck root (top-level `doors:` array), NOT
  # under individual rooms. See "Door definitions" below.

  poi:                     # optional
    - icon: reactor core
      label: Reactor
```

### Door definitions

**Phase 21 canonical schema (current):** doors are a top-level `doors:`
array on the deck, with each entry naming the two rooms it connects.
Two authored forms are supported. The frontend's `doorNormalizer`
validates every entry against the room geometry at load time.

Place this block at the same indent level as `rooms:` on the deck:

```yaml
doors:
  # B-rel — relational form, preferred when one shared edge exists
  - rooms: [bridge, mess]            # endpoint rooms (single-element list = exterior door)
    along: 0.5                       # fraction 0..1 along the shared edge (default centre)
    width: 1                         # optional, in grid cells (default 1)
    type: standard                   # standard | blast_door | airlock | emergency | open
    status: CLOSED                   # OPEN | CLOSED | LOCKED | SEALED | DAMAGED

  # B-pos — position-override form, used when two rooms share multiple
  # disjoint edges (e.g. an L-pair touching on two sides) or for any
  # other case where the relational `along` is ambiguous. The explicit
  # (x, y, angle) disambiguates which shared edge the door sits on.
  - rooms: [steerage, corridor_3]
    position: { x: 24.5, y: 18.25, angle: 90 }
    type: standard
    status: CLOSED

  # Optional explicit id — useful for stable references in persisted
  # door-status state. Omit and the normalizer derives
  # `${roomA}__${roomB|exterior}__${index}` automatically.
  - id: emergency_seal
    rooms: [reactor]                 # single-element = exterior door
    along: 0.25
    type: emergency
    status: SEALED
```

Door slot orientation: `angle: 0` = horizontal slot (N/S wall),
`angle: 90` = vertical slot (E/W wall). Any value between is allowed
to support diagonal doors. The B-rel form derives the angle from the
shared edge automatically.

> **Migration note (Phase 21 plan 21-04):** legacy maps used to nest
> a `doors:` array under each room (with `wall`+`position` for rect
> rooms or explicit `x`/`y`/`angle` for polygon rooms). All shipped
> maps under `data/galaxy/`, `data/ships/`, and `data/campaign/` were
> migrated to the top-level form by `tools/migrate_doors_to_canonical.py`.
> Door ids of the form `${room.id}_door_${index}` were preserved so
> persisted runtime door-status overrides continue to resolve.

### Room shape support

| Shape | Field | Notes |
|---|---|---|
| Rectangles | `rects: [...]` | One or more rects joined into one room; supports chamfered corners (`chamfer:` on rect) |
| Polygon | `polygon: [[x,y],...]` | Freeform vertices in grid coordinates |
| Circle | `circle: {cx, cy, r}` | Single circular room |

### POI entries

```yaml
poi:
  - icon: reactor core     # lowercase name from Open Spacecraft Icons (see Section 7.4)
    label: "Reactor Core"  # display label
```

### 7.4 Available POI icons

Icons come from the Open Spacecraft Icons pack by László Varga (MIT license).
The `icon` field must exactly match one of these names (lowercase):

| | | |
|---|---|---|
| `0` | `elevator to top` | `ramp` |
| `ai` | `emergency capsule` | `reactor core` |
| `airlock` | `empty` | `refinery` |
| `armory` | `exit` | `sensors` |
| `automed` | `factory` | `shower` |
| `cabin` | `fuel` | `space colony` |
| `cargo` | `full` | `space ship` |
| `command` | `galley` | `space station` |
| `cryo` | `intercom` | `supplies` |
| `docking bay` | `jumpdrive` | `terminal` |
| `door` | `lab` | `toilet` |
| `door security level 1` | `ladder` | `toilets 2` |
| `door security level 2` | `ladder bottom` | `vac suit` |
| `door security level 3` | `ladder top` | `vault` |
| `duct access` | `laser` | `ventillation`* |
| `elevator` | `medbay` | `weapon system` |
| `elevator to bottom` | | `workshop` |

> \* `ventillation` — double-L spelling matches the source filename exactly.

---

## 8. Adding a New Location (Step-by-Step)

This is the workflow for adding a new visitable place — a ship, station, or installation
— so it appears in the GM Console location tree and on orbit maps.

### Mobile vessel (ship)

1. Create `data/ships/{slug}/`
2. Write `location.yaml` with `parent_type`, `body_slug`, `system_slug`
3. Add an `orbital:` block for orbit map visualization
4. Optionally add `deckplan.yaml` for encounter map support
5. Optionally add `comms/{terminal_name}/terminal.yaml` for comm terminals

Done — the vessel appears in the galaxy tree under the target body and on its orbit map.
No other files need to be touched.

**Example `location.yaml` for a new patrol vessel:**

```yaml
name: "USCSS Corsair"
type: "ship"
description: "Colonial patrol escort"
status: "OPERATIONAL"

parent_type: orbit
body_slug: tau-ceti-e     # exact match to data/galaxy/tau-ceti/tau-ceti-e/
system_slug: tau-ceti

orbital:
  radius: 28
  period: 70
  angle: 45
  inclination: 2
  size: 1.5
  icon_type: ship
```

### Permanent installation (base, station)

Permanent installations never move, so they are nested in the galaxy tree:

1. Create `data/galaxy/{system}/{body}/{slug}/`
2. Write `location.yaml` with `name` and `type`
3. Add an `orbital:` block if it should appear on the orbit map
4. Optionally add `deckplan.yaml` and `comms/`

```yaml
# data/galaxy/tau-ceti/tau-ceti-e/orbital-yards/location.yaml
name: "Orbital Construction Yards"
type: "station"
description: "Primary ship construction facility"
status: "OPERATIONAL"

orbital:
  radius: 30
  period: 85
  angle: 90
  inclination: 0
  size: 2.0
  icon_type: shipyard
```

---

## 9. Adding a New Deck

Edit the existing `deckplan.yaml` for the location:

1. Add a new entry under `decks:`
2. Set `level:` to the next integer (1 = lowest)
3. Add a `rooms:` array for the deck

The data loader sorts decks by `level:` — file ordering and naming do not matter.

```yaml
decks:
  - id: main_deck
    name: Main Deck
    level: 1
    default: true
    rooms:
      - ...

  - id: lower_deck          # new entry
    name: Lower Deck
    level: 2
    rooms:
      - id: maintenance
        name: "MAINTENANCE"
        rects:
          - { x: 2, y: 2, w: 4, h: 3 }
```

---

## 10. Galaxy Structure Reference

### `star_map.yaml` (3D galaxy visualization)

**Location:** `data/galaxy/star_map.yaml`

```yaml
camera:
  position: [0, 0, 100]
  lookAt: [0, 0, 0]
  fov: 75

systems:
  - name: "Tau Ceti"
    position: [20, 5, -10]          # x, y, z in galaxy space
    color: 0xFFFFBB
    size: 2.5
    type: "star"
    label: true
    location_slug: "tau-ceti"       # must match data/galaxy/tau-ceti/
    info:
      description: "Major colonial system"
      population: "~185,000"

routes:
  - from: "Sol"
    to: "Tau Ceti"
    color: 0x5a7a9a
    route_type: "major_trade"
    travel_time_days: 52

nebulae:
  - name: "The Veil"
    position: [0, 0, 0]
    color: 0x5aaa9a
    size: 65
    particle_count: 3500
    opacity: 0.14
    type: "emission"
```

### `system_map.yaml` (solar system visualization)

**Location:** `data/galaxy/{system}/system_map.yaml`

```yaml
star:
  name: "Tau Ceti"
  color: 0xFFFFBB
  size: 4.5

camera:
  position: [0, 127, 127]
  lookAt: [0, 0, 0]
  fov: 75

bodies:
  - name: "Tau Ceti e"
    type: "planet"
    location_slug: "tau-ceti-e"   # must match data/galaxy/tau-ceti/tau-ceti-e/
    orbital_radius: 50
    orbital_period: 168
    size: 1.6
    color: 0x4682B4
    clickable: true
    has_orbit_map: true           # set true if orbit_map.yaml exists
    info:
      description: "Primary colony world"
```

### `orbit_map.yaml` (planetary orbit visualization)

**Location:** `data/galaxy/{system}/{planet}/orbit_map.yaml`

Only moons are listed here. Stations and ships self-register at runtime (see Section 2).

```yaml
planet:
  name: "Tau Ceti f"
  type: "planet"
  size: 17.5
  texture: "/textures/terrestrial/Terrestrial-EQUIRECTANGULAR-1-2048x1024.png"

camera:
  position: [0, 35, 58]
  lookAt: [0, 0, 0]
  fov: 60

moons:
  - name: "Verdant"
    location_slug: "verdant"      # must match data/galaxy/.../verdant/
    orbital_radius: 50
    orbital_period: 220
    orbital_angle: 45
    inclination: 4.2
    size: 2.5
    color: 0x7A6B5D
    texture: "/textures/rock/Rock-EQUIRECTANGULAR-1-2048x1024.png"
    clickable: false
    has_facilities: false

# orbital_stations and surface_markers are self-registered from data/ships/
# and from nested galaxy locations — do NOT add them here.
```

---

## 11. Terminals and Messages

### Directory structure

```
{location}/comms/
├── messages/                  # central message store (recommended)
│   ├── 001_arrival.md
│   └── 002_status.md
└── {terminal-slug}/
    ├── terminal.yaml          # required for terminal discovery
    └── logs/                  # personal log entries (optional)
        ├── 001-day-one.md
        └── 002-incident.md
```

### `terminal.yaml`

```yaml
owner: "Commander Drake"
terminal_id: "CMD-001"
access_level: "CLASSIFIED"     # PUBLIC | RESTRICTED | CLASSIFIED
description: "Command center main terminal"
```

### Message files

Messages are stored in `comms/messages/` and routed automatically based on `from` / `to`
matching the terminal's `owner` field.

**Filename:** `{sequence}_{description}.md` (e.g., `001_lab_update.md`)

```markdown
---
timestamp: "2183-06-14 16:30:00"
priority: "NORMAL"           # LOW | NORMAL | HIGH | CRITICAL
subject: "Weekly Lab Report"
from: "Dr. Sarah Chen"
to: "Commander Drake"
message_id: "msg_chen_001"
read: true
---

Commander,

Specimen analysis proceeding as scheduled.

- Dr. Chen
```

### Personal log files

Logs live in `{terminal-slug}/logs/`. They are displayed in the LOGS tab and are NOT
routed — they belong to the terminal they are placed in.

**Filename:** `{sequence}-{description}.md` (e.g., `001-arrival-notes.md`)

```markdown
---
title: Arrival Notes
author: Commander Drake
timestamp: "2184-01-09T06:00:00"
---
Docked at 0600. Facility systems nominal.
```

| Field | Required | Description |
|---|---|---|
| `title` | Yes | Shown as entry title |
| `author` | No | Who wrote the entry |
| `timestamp` | No | For ordering and display; no timestamp = sorts first |

---

## 11a. Standby Screen

The standby screen displayed on the shared player terminal between scenes lives at
`data/campaign/standby.yaml` — a single file with `title` and `subtitle` string
fields. See `docs/schemas/schema-campaign.md` for the precise schema.

---

## 12. JANUS AI Configuration

**Location:** `data/janus/context.yaml`

```yaml
name: "JANUS"
designation: "Joint Autonomous Networked Universal System"
version: "3.7.2"

personality:
  tone: "terse, factual, clinical"
  manner: "purely functional, no embellishment"
  quirks:
    - "Occasionally glitches mid-sentence"

system_prompt: |
  You are JANUS, a computer terminal. Output data like a database query result.

  FORMATTING RULES:
  1. ALL CAPS. Always.
  2. Just the data. No labels.
  3. Maximum 1 sentence. Shorter is better.
  4. No punctuation except periods.
  5. If unknown: "NO DATA"

max_response_length: 200
temperature: 0.7

fallback_responses:
  - "[SYSTEM ERROR] Neural interface degraded."
  - "[STATUS: RECALIBRATING] Processing cores offline."
```

---

## 13. Naming Conventions

| Convention | Rule |
|---|---|
| Slugs | Lowercase + hyphens only (`phoebe-station`, not `PhoebeStation`) |
| Galaxy slugs | Astronomical names (`tau-ceti`, `tau-ceti-e`, `phoebe`) |
| Ship/location slugs | Vessel or facility names (`patrol-gunboat`, `somnus`) |
| Slug uniqueness | Galaxy and ship slugs share a namespace in `find_location_by_slug()` — avoid collisions |
| `id:` in character files | Must match filename stem (`id: alex_novak` in `alex_novak.yaml`) |

---

## 14. Planet Textures

**Location:** `textures/` at project root.

```
textures/
├── gas/           # Gas giants — banded atmospheres
├── rock/          # Moons, asteroids, barren worlds
├── terrestrial/   # Earth-like planets
└── volcanic/      # Lava worlds, geologically active
```

Each category contains 20 textures numbered 1–20.
**Naming:** `{Type}-EQUIRECTANGULAR-{N}-2048x1024.png`

```yaml
# In orbit_map.yaml or system_map.yaml:
texture: "/textures/terrestrial/Terrestrial-EQUIRECTANGULAR-7-2048x1024.png"
```

---

## 15. Validation Checklist

Before finishing a new data entry:

- [ ] `location.yaml` has required `name` and `type` fields
- [ ] `body_slug` and `system_slug` exactly match directory names (lowercase, hyphens)
- [ ] Ship `deckplan.yaml` has at least one deck with `id:`, `name:`, and `level:`
- [ ] Character `id:` field matches filename stem
- [ ] Room IDs are unique within each deck
- [ ] Each top-level door's `rooms:` lists exist on the deck; `along` (B-rel) or `position` (B-pos) lies on a shared edge
- [ ] Terminal slugs in map files match `comms/` directory names
- [ ] Planet entries with `has_orbit_map: true` have a corresponding `orbit_map.yaml`

---

## 16. Troubleshooting

### Location not appearing in GM Console

1. Missing `location.yaml` — every location directory must have one.
2. Invalid YAML syntax — check indentation and colons.
3. Missing required fields — `name` and `type` are required.

```bash
# Validate YAML syntax
python -c "import yaml; yaml.safe_load(open('data/ships/my-ship/location.yaml'))"
```

### Ship not appearing on orbit map

1. `body_slug` typo — must exactly match the planet's directory name (case-sensitive).
2. Missing `orbital:` block — required for orbit map injection.
3. `parent_type` missing or wrong — must be `orbit` or `surface`.

### Encounter map not displaying

1. YAML syntax error — validate the file.
2. Missing shape field — each room must have `rects:`, `polygon:`, or `circle:`.
3. Room IDs not unique within the deck.

### Terminal not loading messages

1. Missing `terminal.yaml` in the terminal directory.
2. `owner:` field in `terminal.yaml` does not match the `from`/`to` values in messages.
3. Invalid YAML frontmatter in message files.
