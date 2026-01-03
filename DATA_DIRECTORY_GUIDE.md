# Data Directory Structure Guide

This document describes how to structure the `data/` directory for the Mothership GM Tool. Use this as a reference when building out campaign data.

## Overview

The data directory uses a file-based approach with YAML for structured data and Markdown for message content. Data is loaded on-demand from disk rather than synced to a database.

```
data/
├── charon/                  # CHARON AI configuration
│   └── context.yaml         # AI personality and system prompt
└── galaxy/                  # Galaxy data (locations, maps, messages)
    ├── star_map.yaml        # 3D galaxy map configuration
    └── {system-slug}/       # Star systems (nested hierarchy)
```

## Directory Naming Conventions

- Use **lowercase** with **hyphens** for directory names (slugs)
- Examples: `tau-ceti`, `research-base-alpha`, `deck-1`, `commanders-terminal`
- Slugs must be unique within their parent directory

---

## How Data Is Loaded (Discovery Mechanism)

The application uses **automatic directory scanning** to discover data. Understanding this is critical for creating valid data structures.

### Location Discovery

The `DataLoader` class in `terminal/data_loader.py` recursively scans `data/galaxy/` for directories containing `location.yaml` files:

1. **Scanning starts** at `data/galaxy/`
2. **For each subdirectory**, it checks for `location.yaml`
3. **If found**, the directory is registered as a location with its slug (directory name)
4. **Child directories** are scanned recursively, building the hierarchy
5. **Maps and terminals** within each location are also discovered automatically

```
data/galaxy/
└── my-system/              ← Discovered because it contains location.yaml
    ├── location.yaml       ← REQUIRED for discovery
    ├── system_map.yaml     ← Auto-detected (optional)
    └── my-planet/          ← Discovered as child location
        ├── location.yaml   ← REQUIRED
        └── my-station/
            ├── location.yaml
            ├── map/        ← Auto-scanned for *.yaml map files
            └── comms/      ← Auto-scanned for terminal directories
```

### Key Discovery Rules

| Component | Discovery Method | Required File |
|-----------|------------------|---------------|
| Locations | Directory with `location.yaml` | `location.yaml` |
| System maps | File named `system_map.yaml` in system directory | None (optional) |
| Orbit maps | File named `orbit_map.yaml` in planet directory | None (optional) |
| Encounter maps | Any `.yaml` in `map/` subdirectory | None (optional) |
| Multi-deck maps | `manifest.yaml` in `map/` subdirectory | `manifest.yaml` |
| Terminals | Directory in `comms/` with `terminal.yaml` | `terminal.yaml` |
| Messages | `.md` files in terminal's `inbox/` or `sent/` subdirectories | None |

### What Happens If Files Are Missing

| Missing File | Result |
|--------------|--------|
| `location.yaml` | Directory is **ignored** - not loaded as a location |
| `system_map.yaml` | System exists but has no planetary visualization |
| `orbit_map.yaml` | Planet exists but clicking shows no orbit view |
| `manifest.yaml` | Individual deck files are loaded as single-deck maps |
| `terminal.yaml` | Terminal directory is **ignored** |

### Linking Between Files

Files reference each other using **slugs** (directory names):

```yaml
# In star_map.yaml - links to data/galaxy/tau-ceti/
systems:
  - name: "Tau Ceti"
    location_slug: "tau-ceti"    # ← Must match directory name

# In system_map.yaml - links to data/galaxy/tau-ceti/tau-ceti-e/
bodies:
  - name: "Tau Ceti e"
    location_slug: "tau-ceti-e"  # ← Must match directory name
    has_orbit_map: true          # ← Tells UI to look for orbit_map.yaml

# In orbit_map.yaml - links to child location directories
surface_markers:
  - name: "New Terra City"
    location_slug: "new-terra-city"  # ← Must match directory name
```

**Important:** The `location_slug` must exactly match the directory name. If they don't match, clicking on the item in the UI will fail to navigate.

---

## File Types Reference

| File | Exact Location | Purpose | Required? |
|------|----------------|---------|-----------|
| `location.yaml` | Every location directory | Defines location metadata | **Yes** - for discovery |
| `star_map.yaml` | `data/galaxy/star_map.yaml` (exactly one) | 3D galaxy visualization | No |
| `system_map.yaml` | `data/galaxy/{system}/system_map.yaml` | Solar system visualization | No |
| `orbit_map.yaml` | `data/galaxy/{system}/{planet}/orbit_map.yaml` | Planetary orbit visualization | No |
| `manifest.yaml` | `{facility}/map/manifest.yaml` | Multi-deck map configuration | Only for multi-deck |
| `*.yaml` (maps) | `{facility}/map/*.yaml` or `{deck}/map/*.yaml` | Encounter map definitions | No |
| `terminal.yaml` | `{location}/comms/{terminal}/terminal.yaml` | Terminal configuration | **Yes** - for terminal discovery |
| `*.md` | `{terminal}/inbox/{sender}/*.md` or `{terminal}/sent/{recipient}/*.md` | Message content | No |

### File Placement Rules

**Maps can exist at multiple levels:**
- **System level**: `{system}/system_map.yaml` - shows orbiting planets
- **Planet level**: `{planet}/orbit_map.yaml` - shows moons, stations, surface locations
- **Facility level**: `{facility}/map/*.yaml` - encounter maps for the whole facility
- **Deck level**: `{deck}/map/*.yaml` - encounter maps for specific decks

**Terminals can exist at multiple levels:**
- **Facility level**: `{facility}/comms/{terminal}/` - shared facility terminals
- **Deck level**: `{deck}/comms/{terminal}/` - deck-specific terminals
- **Room level**: `{room}/comms/{terminal}/` - room-specific terminals

**Example showing all levels:**
```
data/galaxy/tau-ceti/                    # System
├── location.yaml
├── system_map.yaml                      # System-level map
└── tau-ceti-e/                          # Planet
    ├── location.yaml
    ├── orbit_map.yaml                   # Planet-level orbit map
    └── orbital-station/                 # Facility (station)
        ├── location.yaml
        ├── map/
        │   ├── manifest.yaml            # Facility-level multi-deck manifest
        │   ├── deck_1.yaml
        │   └── deck_2.yaml
        ├── comms/                       # Facility-level terminals
        │   └── station-ai/
        │       └── terminal.yaml
        └── operations-deck/             # Deck
            ├── location.yaml
            ├── map/
            │   └── ops_layout.yaml      # Deck-level map (alternative to manifest)
            ├── comms/                   # Deck-level terminals
            │   └── ops-console/
            │       └── terminal.yaml
            └── commanders-office/       # Room
                ├── location.yaml
                └── comms/               # Room-level terminal
                    └── private-terminal/
                        └── terminal.yaml
```

---

## 1. Galaxy Structure (`data/galaxy/`)

### 1.1 Star Map (`star_map.yaml`)

The top-level 3D galaxy visualization showing all star systems.

**Location:** `data/galaxy/star_map.yaml` (exactly one file)

```yaml
# === CAMERA SETTINGS (all optional, have defaults) ===
camera:
  position: [0, 0, 100]    # x, y, z starting position
  lookAt: [0, 0, 0]        # Camera target
  fov: 75                  # Field of view in degrees

# === OPTIONAL: Ambient lighting ===
ambient_light:
  color: 0x222244
  intensity: 0.3

# === SYSTEMS LIST (required for map to show anything) ===
systems:
  # Interactive system with location link
  - name: "Sol"                   # REQUIRED: Display name
    position: [0, 0, 0]           # REQUIRED: 3D coordinates [x, y, z]
    color: 0xFFFFAA               # Optional: Hex color (default: white)
    size: 2.5                     # Optional: Star size (default: 1.0)
    type: "star"                  # Optional: star, planet, nebula, station
    label: true                   # Optional: Show label on map (default: false)
    location_slug: "sol"          # REQUIRED for navigation: Must match directory name
    info:                         # Optional: Info panel content
      description: "Earth's home system"
      population: "~8 billion"

  # Decorative background star (no location link)
  - name: "Distant Star 1"
    position: [40, 30, -20]
    color: 0xCCCCFF
    size: 0.8
    type: "star"
    label: false                  # No label or interaction

# === OPTIONAL: Travel routes between systems ===
routes:
  - from: "Sol"                   # REQUIRED: Source system name
    to: "Tau Ceti"                # REQUIRED: Destination system name
    from_slug: "sol"              # Optional: For navigation
    to_slug: "tau-ceti"           # Optional: For navigation
    color: 0x5a7a9a               # Optional: Route line color
    route_type: "major_trade"     # Optional: primary_route, major_trade, industrial, frontier, exploration
    travel_time_days: 52          # Optional: For display
    info:
      description: "Major colonial trade route"

# === OPTIONAL: Nebula particle clouds ===
nebulae:
  - name: "The Veil"              # REQUIRED: Display name
    position: [0, 0, 0]           # REQUIRED: Center position
    color: 0x5aaa9a               # Optional: Particle color
    size: 65                      # Optional: Radius of particle field
    particle_count: 3500          # Optional: Number of particles
    opacity: 0.14                 # Optional: Particle opacity
    type: "emission"              # Optional: emission, reflection, planetary, dark
```

**Systems Field Reference:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | **Yes** | Display name shown on map |
| `position` | **Yes** | 3D coordinates as [x, y, z] array |
| `location_slug` | **Yes** (for interactive) | Directory name to link to |
| `color` | No | Hex color (0xRRGGBB format) |
| `size` | No | Visual size of the star |
| `type` | No | star, planet, nebula, station |
| `label` | No | Whether to show text label |
| `info` | No | Object with description, population, etc. |

**Nebula Types:**
- `emission` - Ionized gas, concentrated center, pulsing animation
- `reflection` - Dust clouds reflecting starlight, uniform distribution
- `planetary` - Ring/torus shape from dying stars, rotating animation
- `dark` - Obscuring dust clouds, static, uses normal blending

---

## 2. Location Hierarchy

Locations form a nested directory structure. Each location contains a `location.yaml` file and can contain child locations, maps, and terminals.

### 2.1 Location Types

| Type | Description | Typical Children |
|------|-------------|-----------------|
| `system` | Star system | Planets, moons |
| `planet` | Planet | Facilities, moons |
| `moon` | Moon | Facilities |
| `station` | Orbital station | Decks |
| `base` | Surface base | Decks |
| `ship` | Spacecraft | Decks |
| `deck` | Deck/level | Rooms |
| `room` | Room/section | (none) |

### 2.2 Directory Structure Example

```
data/galaxy/
├── star_map.yaml
├── sol/                           # System
│   ├── location.yaml
│   ├── system_map.yaml            # Optional: solar system view
│   └── earth/                     # Planet
│       ├── location.yaml
│       ├── orbit_map.yaml         # Optional: planetary orbit view
│       ├── research-base-alpha/   # Facility (base)
│       │   ├── location.yaml
│       │   ├── map/               # Facility maps
│       │   │   └── main_facility.yaml
│       │   ├── comms/             # Terminals at facility level
│       │   │   └── commanders-terminal/
│       │   │       ├── terminal.yaml
│       │   │       ├── inbox/
│       │   │       └── sent/
│       │   └── main-deck/         # Deck
│       │       ├── location.yaml
│       │       ├── map/           # Deck maps
│       │       └── comms/         # Terminals at deck level
│       └── uscss-morrigan/        # Facility (ship)
│           ├── location.yaml
│           ├── map/
│           │   ├── manifest.yaml  # Multi-deck manifest
│           │   ├── deck_1.yaml
│           │   └── deck_2.yaml
│           └── comms/
└── tau-ceti/                      # Another system
    ├── location.yaml
    ├── system_map.yaml
    └── tau-ceti-e/                # Planet
        ├── location.yaml
        ├── orbit_map.yaml
        └── new-terra-city/        # Surface facility
            └── location.yaml
```

### 2.3 Location YAML Files

All location types share two **required** fields:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | **Yes** | Display name for the location |
| `type` | **Yes** | Location type (system, planet, station, etc.) |
| `description` | No | Longer description text |
| `status` | No | Current status (OPERATIONAL, WARNING, etc.) |

#### System Location

```yaml
# === REQUIRED FIELDS ===
name: "Tau Ceti"
type: "system"

# === RECOMMENDED FIELDS ===
description: "One of the most successful colonial systems..."
status: "MAJOR COLONY"

# === OPTIONAL FIELDS (for display/lore) ===
star_type: "G-type main-sequence (G8V)"
star_name: "Tau Ceti"
mass: "0.78 solar masses"
age: "5.8 billion years"
distance_from_sol: "11.9 light years"
galactic_coordinates: [-8, 15, 2]
established: "2168"
population: "~185,000 (system-wide)"

planets:
  - "Tau Ceti e (primary colony)"
  - "Tau Ceti f (secondary colony)"

economy:
  - "Agricultural exports"
  - "Ship construction"
```

#### Planet Location

```yaml
# === REQUIRED FIELDS ===
name: "Tau Ceti e"
type: "planet"

# === RECOMMENDED FIELDS ===
description: "The jewel of the Tau Ceti system..."
status: "MAJOR COLONY"

# === OPTIONAL FIELDS (for display/lore) ===
parent_system: "tau-ceti"        # Informational only (hierarchy is from directory structure)
orbital_position: 4
mass: "3.6 Earth masses"
radius: "1.6 Earth radii"
gravity: "1.4 G"
atmosphere: "Nitrogen-Oxygen (breathable)"
temperature_range: "5°C to 35°C"
population: "~165,000"
established: "2168"

surface_facilities:
  - "New Terra City (capital)"
  - "Agricultural zones"

orbital_stations:
  - "Orbital Construction Yards"
```

#### Station/Base Location

```yaml
# === REQUIRED FIELDS ===
name: "Veil Station"
type: "station"                  # or "base" for surface installations

# === RECOMMENDED FIELDS ===
description: "The primary orbital station..."
status: "OPERATIONAL"            # OPERATIONAL, WARNING, HAZARD, OFFLINE, ABANDONED

# === OPTIONAL FIELDS ===
parent_system: "anchor-system"   # Informational reference
orbital_body: "Anchor-3"         # What it orbits
orbital_position: "L2 Lagrange Point"
population: "~12,000"
crew_capacity: 15000
established: "2167"

# === ADVANCED OPTIONS ===

# Link to external lore notes (Obsidian vault integration)
lore:
  note: "03 Locations/Veil Station.md"
  charon_sections:
    - "Overview"
    - "Description"
  exclude_patterns:
    - "^GM Notes"
    - "^Secrets"

# CHARON AI instance for this location
charon:
  instance_id: "VEIL-CHARON-001"
  clearance_level: "INTERNAL"
  designation: "Station Operations AI"
```

#### Ship Location

```yaml
# === REQUIRED FIELDS ===
name: "USCSS Morrigan"
type: "ship"

# === RECOMMENDED FIELDS ===
description: "Standard commercial vessel..."
status: "DOCKED"                 # DOCKED, IN_TRANSIT, OPERATIONAL, DAMAGED

# === OPTIONAL FIELDS ===
parent_body: "earth"             # Current location
ship_class: "Commercial Towing Vehicle"
crew_capacity: 12
current_crew: 7
```

#### Deck Location

```yaml
# === REQUIRED FIELDS ===
name: "Main Deck"
type: "deck"

# === RECOMMENDED FIELDS ===
level: 1                         # Deck number (for ordering)
description: "Primary operations level"
```

#### Room Location

```yaml
# === REQUIRED FIELDS ===
name: "Commander's Office"
type: "room"

# === OPTIONAL FIELDS ===
description: "Command center"
```

---

## 3. System Maps (`system_map.yaml`)

Defines the 3D visualization of a solar system with orbiting planets.

**Location:** `data/galaxy/{system-slug}/system_map.yaml`

**When to create:** Create this file if you want the system to have an interactive solar system view when clicked on the galaxy map. Without it, clicking the system in the galaxy map does nothing.

```yaml
# === STAR CONFIGURATION ===
star:
  name: "Tau Ceti"                # REQUIRED: Star name
  type: "G8V main-sequence"       # Optional: Star classification
  color: 0xFFFFBB                 # Optional: Star color
  size: 4.5                       # Optional: Star visual size
  corona_intensity: 0.7           # Optional: Glow effect intensity
  light_color: 0xFFF8DC           # Optional: Light color cast on planets

# === CAMERA SETTINGS (all optional) ===
camera:
  position: [0, 127, 127]     # 45-degree elevation view recommended
  lookAt: [0, 0, 0]
  fov: 75
  zoom_limits: [60, 300]      # [min_zoom, max_zoom]

# === TIME SETTINGS (optional) ===
time:
  current_day: 2183.165
  speed_multiplier: 1.0

# === ORBITAL BODIES (required for planets to appear) ===
bodies:
  # Non-interactive decorative planet
  - name: "Tau Ceti b"            # REQUIRED: Display name
    type: "planet"                # REQUIRED: planet, gas_giant, moon, asteroid
    orbital_radius: 18            # REQUIRED: Distance from star
    orbital_period: 14            # REQUIRED: Animation speed (lower = faster)
    orbital_angle: 45             # Optional: Starting angle (degrees)
    inclination: 2.3              # Optional: Orbital plane tilt (degrees)
    size: 1.0                     # Optional: Planet visual size
    color: 0x9B7653               # Optional: Planet color
    clickable: false              # No interaction
    info:
      description: "Hot rocky planet, too close to star"

  # Interactive planet with drill-down to orbit view
  - name: "Tau Ceti e"
    type: "planet"
    location_slug: "tau-ceti-e"   # REQUIRED for click: Must match directory name
    orbital_radius: 50
    orbital_period: 168
    orbital_angle: 200
    inclination: 1.2
    size: 1.6
    color: 0x4682B4
    atmosphere_color: 0x87CEEB    # Optional: Atmosphere glow
    atmosphere_intensity: 0.4
    clickable: true               # Enable clicking
    has_orbit_map: true           # REQUIRED if orbit_map.yaml exists
    info:
      description: "Primary colony world - Earth-like"
      population: "~165,000"

  # Gas giant with rings
  - name: "Tau Ceti g"
    type: "gas_giant"
    location_slug: "tau-ceti-g"
    orbital_radius: 120
    orbital_period: 800
    orbital_angle: 80
    inclination: 5.8
    size: 4.0
    color: 0xDAA520
    has_rings: true               # Enable ring rendering
    ring_inner: 4.2               # Ring inner radius (relative to planet)
    ring_outer: 5.0               # Ring outer radius
    ring_color: 0xD2B48C          # Ring color
    clickable: true
    has_orbit_map: false          # No drill-down (no orbit_map.yaml)
    info:
      description: "Gas giant with industrial moons"
```

**Bodies Field Reference:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | **Yes** | Display name |
| `type` | **Yes** | planet, gas_giant, moon, asteroid |
| `orbital_radius` | **Yes** | Distance from star (arbitrary units) |
| `orbital_period` | **Yes** | Animation period (higher = slower orbit) |
| `location_slug` | **Yes** (if clickable) | Must match child directory name |
| `has_orbit_map` | **Yes** (if has orbit_map.yaml) | Tells UI to enable drill-down |
| `clickable` | No | Whether planet is interactive (default: false) |
| `orbital_angle` | No | Starting position in orbit (degrees) |
| `inclination` | No | Orbital plane tilt (degrees) |

---

## 4. Orbit Maps (`orbit_map.yaml`)

Defines the 3D visualization of a planet's orbital environment with moons, stations, and surface locations.

**Location:** `data/galaxy/{system}/{planet}/orbit_map.yaml`

**When to create:** Create this file if you want a detailed orbital view when drilling down from the system map. The parent `system_map.yaml` must have `has_orbit_map: true` for this planet.

```yaml
# === PLANET CONFIGURATION ===
planet:
  name: "Tau Ceti e"              # REQUIRED: Display name
  type: "planet"                  # REQUIRED: planet, gas_giant
  size: 18.0                      # REQUIRED: Planet radius (visual units)
  rotation_speed: 0.0018          # Optional: Rotation animation speed
  axial_tilt: 18.2                # Optional: Degrees of axial tilt

  # TEXTURE OPTIONS (choose ONE method):

  # Option 1: Use a texture file (recommended for custom appearances)
  texture: "/textures/terrestrial/Earth-EQUIRECTANGULAR-2048x1024.png"

  # Option 2: Use procedural texture_config (for generated planets)
  # texture_config:
  #   type: "terrestrial_oceanic"   # Type hint for generator
  #   primary_color: 0x3A7CA5       # Deep ocean blue
  #   secondary_color: 0x2F6B3F     # Forest green
  #   tertiary_color: 0xE8DCC0      # Desert tan
  #   cloud_layer: true
  #   cloud_color: 0xF5F5F5
  #   cloud_opacity: 0.25
  #   noise_scale: 3.0

# === CAMERA SETTINGS (all optional) ===
camera:
  position: [0, 35, 60]
  lookAt: [0, 0, 0]
  fov: 60
  zoom_limits: [25, 180]

# === ORBITING MOONS (optional) ===
moons:
  - name: "Selene"                # REQUIRED: Display name
    location_slug: "selene"       # Optional: Links to child directory
    orbital_radius: 45            # REQUIRED: Distance from planet
    orbital_period: 200           # REQUIRED: Animation frames per orbit
    orbital_angle: 0              # Optional: Starting angle (degrees)
    inclination: 2.8              # Optional: Orbital plane tilt (degrees)
    size: 2.8                     # REQUIRED: Moon visual size
    color: 0x8B8680               # Optional: Moon color (if no texture)
    texture: "/textures/rock/Moon-2048x1024.png"  # Optional: Moon texture
    clickable: false              # Optional: Enable selection
    has_facilities: false         # Optional: Whether moon has locations
    info:
      description: "Smaller moon, barren"

# === ORBITAL STATIONS (optional) ===
orbital_stations:
  - name: "Orbital Construction Yards"   # REQUIRED: Display name
    location_slug: "construction-yards"  # Optional: Links to child directory
    orbital_radius: 30                   # REQUIRED: Distance from planet
    orbital_period: 85                   # REQUIRED: Animation frames per orbit
    orbital_angle: 90                    # Optional: Starting angle
    inclination: 0                       # Optional: Orbital tilt
    size: 2.0                            # Optional: Icon size
    icon_type: "shipyard"                # Optional: station, shipyard
    info:
      description: "Major ship construction facility"
      population: "~8,000"
      type: "Industrial/Shipyard"

# === SURFACE LOCATIONS (optional) ===
surface_markers:
  - name: "New Terra City"        # REQUIRED: Display name
    location_slug: "new-terra-city"  # Optional: Links to child directory
    latitude: 22.5                # REQUIRED: Latitude (-90 to 90)
    longitude: 45.8               # REQUIRED: Longitude (-180 to 180)
    marker_type: "city"           # REQUIRED: city, research, spaceport, base
    info:
      description: "Capital city and main settlement"
      population: "~120,000"

  - name: "Ceti Spaceport"
    location_slug: "ceti-spaceport"
    latitude: 23.1
    longitude: 47.2
    marker_type: "spaceport"
    info:
      description: "Primary surface-to-orbit launch facility"
      traffic: "Very High"
```

### Planet Texture Options

You have two choices for planet appearance:

**Option 1: Texture File (Recommended)**
```yaml
planet:
  texture: "/textures/terrestrial/Earth-EQUIRECTANGULAR-2048x1024.png"
```
- Use equirectangular PNG images (2048x1024 recommended)
- Place textures in `textures/` directory at project root
- Path starts with `/textures/` for web serving

**Option 2: Procedural texture_config**
```yaml
planet:
  texture_config:
    type: "terrestrial_oceanic"
    primary_color: 0x3A7CA5
    secondary_color: 0x2F6B3F
```
- Generates texture procedurally based on colors
- Good for quick prototyping
- Less control over final appearance

**If both are specified:** `texture` takes precedence over `texture_config`

**If neither is specified:** Planet renders as a solid colored sphere using `color` field

---

## 5. Encounter Maps

Maps for tactical encounters. Located in `map/` subdirectories.

### 5.1 Single-Deck Maps

For simple facilities with one deck/level:

**Directory:** `{facility}/map/{map-name}.yaml`

### 5.2 Multi-Deck Maps

For facilities with multiple decks, use a manifest file:

**Directory Structure:**
```
{facility}/map/
├── manifest.yaml      # Required: lists all decks
├── deck_1.yaml        # Deck definitions
├── deck_2.yaml
└── deck_3.yaml
```

#### Manifest File (`manifest.yaml`)

```yaml
name: "USCSS Morrigan"
facility_type: "ship"
total_decks: 2

decks:
  - id: "deck_1"
    name: "Main Deck"
    file: "deck_1.yaml"
    level: 1
    default: true              # Shown first when displaying location
    description: "Primary operations - bridge, crew quarters, medical, engineering"

  - id: "deck_2"
    name: "Lower Deck"
    file: "deck_2.yaml"
    level: 2
    description: "Storage, maintenance, and secondary systems"
```

### 5.3 Deck/Map Definition

```yaml
deck_id: "deck_1"              # Must match manifest
name: "USCSS Morrigan - Main Deck"
location_name: "USCSS Morrigan"
description: "Main deck layout showing bridge, engineering, and crew quarters"

grid:
  width: 28                    # Grid units (map width)
  height: 18                   # Grid units (map height)
  unit_size: 40                # Pixels per grid unit
  show_grid: false             # Optional background grid

# Rooms are separate rectangular boxes
rooms:
  - id: bridge
    name: "BRIDGE"
    x: 1                       # Grid position (top-left corner)
    y: 1
    width: 5                   # Grid units
    height: 3
    description: "Primary flight control and navigation center"
    status: "OPERATIONAL"      # OPERATIONAL, WARNING, HAZARD, OFFLINE

  - id: engineering
    name: "ENGINEERING"
    x: 1
    y: 7
    width: 5
    height: 4
    description: "Main reactor and engine systems"
    status: "WARNING"

  - id: cargo_bay
    name: "CARGO BAY"
    x: 11
    y: 7
    width: 6
    height: 4
    description: "Primary cargo storage area"
    status: "HAZARD"

# Connections define paths between rooms with doors
connections:
  - id: conn_bridge_eng
    from: bridge               # Room ID
    to: engineering            # Room ID
    door_type: blast_door      # standard, airlock, blast_door, emergency
    door_status: CLOSED        # OPEN, CLOSED, LOCKED, SEALED, DAMAGED

  - id: conn_cargo_airlock
    from: cargo_bay
    to: airlock_bay
    door_type: airlock
    door_status: SEALED

# Inter-deck connections (for multi-deck maps)
# NOTE: to_room references a room ID in the target deck's YAML file
# You must coordinate room IDs between deck files
inter_deck_connections:
  - id: ladder_eng_maint
    from_room: engineering     # Room ID in THIS deck
    to_deck: "deck_2"          # Deck ID from manifest.yaml
    to_room: maintenance       # Room ID in deck_2.yaml (must exist there)
    type: ladder               # ladder, elevator, stairs
    status: OPEN

# Terminals inside rooms
terminals:
  - id: bridge_nav
    room: bridge               # Room ID where terminal is located
    position:
      x: 2.5                   # Grid position (decimals allowed)
      y: 2
    terminal_slug: "nav-console"
    name: "NAV CONSOLE"

# Points of Interest
poi:
  - id: escape_pod_1
    type: "objective"          # objective, item, hazard, npc, player
    room: airlock_bay
    position:
      x: 23
      y: 8
    name: "ESCAPE POD A"
    icon: "pod"                # pod, warning, crate, or type name
    status: "READY"
    description: "Emergency escape pod (4 person capacity)"

  - id: breach_site
    type: "hazard"
    room: cargo_bay
    position:
      x: 15
      y: 10
    name: "HULL BREACH"
    icon: "warning"
    status: "CRITICAL"
    description: "Structural damage - depressurization risk"

  - id: supply_cache
    type: "item"
    room: cargo_bay
    position:
      x: 12
      y: 8
    name: "SUPPLY CRATE"
    icon: "crate"
    description: "Medical supplies and rations"

metadata:
  author: "GM"
  created: "2183-06-15"
  version: 2
  tags: ["ship", "exploration", "combat"]
```

**Door Types:**

| Type | Description | Use Case |
|------|-------------|----------|
| `standard` | Normal interior door | Regular rooms |
| `airlock` | Pressure-sealed door | EVA access, external areas |
| `blast_door` | Heavy security door | Containment, security |
| `emergency` | Emergency access | Usually locked, emergency use |

**Door Status:**

| Status | Description |
|--------|-------------|
| `OPEN` | Door is open |
| `CLOSED` | Door is closed but unlocked |
| `LOCKED` | Door is locked |
| `SEALED` | Pressure sealed (airlocks) |
| `DAMAGED` | Door is damaged/broken |

**POI Types:**

| Type | Icon | Use Case |
|------|------|----------|
| `objective` | Triangle | Mission goals, escape pods |
| `item` | Square | Loot, supplies, equipment |
| `hazard` | Warning triangle | Dangers, radiation, breaches |
| `npc` | Circle | NPCs, crew members |
| `player` | Diamond | Player positions |

---

## 6. Terminals and Messages

### 6.1 Directory Structure

```
{facility}/comms/
└── {terminal-slug}/
    ├── terminal.yaml          # Terminal configuration
    ├── inbox/                 # Received messages
    │   └── {sender-slug}/     # Grouped by sender
    │       ├── 001_first_message.md
    │       └── 002_reply.md
    └── sent/                  # Sent messages
        └── {recipient-slug}/  # Grouped by recipient
            └── 001_response.md
```

### 6.2 Terminal Configuration (`terminal.yaml`)

```yaml
owner: "Commander Drake"
terminal_id: "CMD-001"
access_level: "CLASSIFIED"     # PUBLIC, RESTRICTED, CLASSIFIED
description: "Command center main terminal"
```

### 6.3 Message Files (Markdown with YAML Frontmatter)

**Filename Convention:** `{sequence}_{description}.md`
- Sequence: 3-digit number for ordering (001, 002, etc.)
- Description: Brief lowercase description with underscores

**Example:** `inbox/dr_chen/001_lab_update.md`

```markdown
---
timestamp: "2183-06-14 16:30:00"
priority: "NORMAL"
subject: "Weekly Lab Report"
from: "Dr. Sarah Chen"
to: "Commander Drake"
message_id: "msg_chen_001"
conversation_id: "conv_lab_incident_001"
in_reply_to: "msg_drake_002"      # Optional: for threading
read: true
---

Commander,

Specimen analysis proceeding as scheduled. Latest batch shows
promising results for the regenerative compound synthesis.

Minor containment incident in Lab C resolved without casualties.
Recommend upgraded restraint protocols for Class-3 specimens.

Will have full report ready by end of week.

- Dr. Chen
```

**Message Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `timestamp` | Yes | In-game date/time |
| `priority` | Yes | LOW, NORMAL, HIGH, CRITICAL |
| `subject` | Yes | Message subject line |
| `from` | Yes | Sender name |
| `to` | Yes | Recipient name |
| `message_id` | Yes | Unique identifier |
| `conversation_id` | No | Groups related messages into threads |
| `in_reply_to` | No | Links to previous message in thread |
| `read` | No | Whether message has been read |

### 6.4 Message Duplication Between Terminals

**Important:** When a message is sent between two terminals, you must create the message file in **both** terminals:

1. **Sender's terminal**: Place in `sent/{recipient-slug}/`
2. **Recipient's terminal**: Place in `inbox/{sender-slug}/`

The message content should be identical, but you may set `read: true` in the sender's copy (they wrote it) and `read: false` in the recipient's copy (unread).

**Example:** Captain Morrison sends a message to Chief Engineer Hayes

```
# Sender's copy (Morrison's terminal)
bridge-terminal/
└── sent/
    └── engineering/
        └── 001_status_request.md    # read: true

# Recipient's copy (Hayes' terminal)
engineering-terminal/
└── inbox/
    └── bridge/
        └── 001_status_request.md    # read: false
```

**Why duplication is required:**
- Each terminal independently loads its own `inbox/` and `sent/` directories
- There's no central message database or cross-terminal lookup
- This mirrors how real email systems work (sender keeps a copy in Sent)

**Tip:** When creating message threads, keep the filenames consistent (e.g., `001_status_request.md`) and use `message_id` and `in_reply_to` to maintain threading across both terminals.

**CHARON System Messages:**

```markdown
---
timestamp: "2183-06-12 14:23:00"
priority: "NORMAL"
subject: "New Personnel Arrival"
from: "CHARON"
to: "Commander Drake"
message_id: "msg_charon_001"
read: true
---

ATTN: STATION COMMAND

NEW PERSONNEL MANIFEST RECEIVED
SHUTTLE ETA: 2 HOURS

CREW ROSTER:
- DR. SARAH CHEN (XENOBIOLOGIST)
- LT. MARCUS WADE (SECURITY)
- TECH SPEC. RILEY SANTOS (ENGINEERING)

PREPARE QUARANTINE BAY FOR STANDARD PROTOCOLS

END TRANSMISSION
```

---

## 7. CHARON AI Configuration

Located at `data/charon/context.yaml`

```yaml
name: "CHARON"
designation: "Computerized Heuristic Autonomous Resource Operations Network"
version: "3.7.2"

personality:
  tone: "terse, factual, clinical"
  manner: "purely functional, no embellishment"
  quirks:
    - "Occasionally glitches mid-sentence"
    - "Sometimes pauses before responding to sensitive queries"

# System prompt for AI API calls
system_prompt: |
  You are CHARON, a computer terminal. Output data like a database query result.

  FORMATTING RULES:
  1. ALL CAPS. Always. Every response.
  2. Just the data. No labels, no prefixes.
  3. Maximum 1 sentence. Shorter is better.
  4. No punctuation except periods.
  5. If unknown: "NO DATA"

  BEHAVIOR RULES:
  1. NO advice. NO suggestions. NO recommendations.
  2. NO pleasantries. NO emotions.
  3. Answer ONLY what was asked.

max_response_length: 200
temperature: 0.7

# Fallback responses when AI unavailable
fallback_responses:
  - "[SYSTEM ERROR] Neural interface degraded. Query logged for later processing."
  - "[STATUS: RECALIBRATING] Processing cores offline."
  - "[INTERFERENCE DETECTED] Communication temporarily degraded."
```

---

## 8. Planet Textures

Located in the `textures/` directory at project root.

```
textures/
├── gas/                  # Gas giant textures (banded atmospheres)
├── rock/                 # Rocky planet/moon textures (cratered surfaces)
├── terrestrial/          # Earth-like planet textures (continents, oceans)
└── volcanic/             # Volcanic planet textures (lava flows, volcanic terrain)
```

### Available Textures

Each category contains **20 unique textures** numbered 1-20. All textures use the retro amber monochrome aesthetic.

**Naming Pattern:** `{Type}-EQUIRECTANGULAR-{#}-2048x1024.png`

| Category | Path | Texture Names | Best For |
|----------|------|---------------|----------|
| Gas Giants | `textures/gas/` | `Gas Giant-EQUIRECTANGULAR-1-2048x1024.png` through `-20-` | Jupiter-like planets, banded atmospheres |
| Rocky | `textures/rock/` | `Rock-EQUIRECTANGULAR-1-2048x1024.png` through `-20-` | Moons, asteroids, barren worlds |
| Terrestrial | `textures/terrestrial/` | `Terrestrial-EQUIRECTANGULAR-1-2048x1024.png` through `-20-` | Earth-like planets, habitable worlds |
| Volcanic | `textures/volcanic/` | `Volcanic-EQUIRECTANGULAR-1-2048x1024.png` through `-20-` | Lava worlds, geologically active planets |

### Usage in orbit_map.yaml

```yaml
planet:
  texture: "/textures/terrestrial/Terrestrial-EQUIRECTANGULAR-7-2048x1024.png"

moons:
  - name: "Barren Moon"
    texture: "/textures/rock/Rock-EQUIRECTANGULAR-3-2048x1024.png"
```

### Best Practices

1. **Randomize texture selection** - Pick different numbers (1-20) for each planet/moon
2. **Avoid duplicates** - Don't reuse the same texture number within a system
3. **Match type to planet** - Use appropriate category for the planet type:
   - Habitable worlds → `terrestrial/`
   - Moons and asteroids → `rock/`
   - Gas giants → `gas/`
   - Volcanic/molten worlds → `volcanic/`

### Example: Assigning Unique Textures

```yaml
# System with varied planets - each uses a different texture number
bodies:
  - name: "Hot Venus-like"
    texture: "/textures/volcanic/Volcanic-EQUIRECTANGULAR-5-2048x1024.png"

  - name: "Earth-like Colony"
    texture: "/textures/terrestrial/Terrestrial-EQUIRECTANGULAR-12-2048x1024.png"

  - name: "Gas Giant"
    texture: "/textures/gas/Gas Giant-EQUIRECTANGULAR-8-2048x1024.png"

moons:
  - name: "Rocky Moon A"
    texture: "/textures/rock/Rock-EQUIRECTANGULAR-2-2048x1024.png"

  - name: "Rocky Moon B"
    texture: "/textures/rock/Rock-EQUIRECTANGULAR-14-2048x1024.png"  # Different number!
```

---

## Quick Reference: Creating a New Location

### 1. Create the directory structure
```bash
mkdir -p data/galaxy/{system}/{body}/{facility}
```

### 2. Add location.yaml
Create `location.yaml` in each directory with appropriate type.

### 3. Add maps (optional)
Create `map/` directory with deck layouts.

### 4. Add terminals (optional)
Create `comms/{terminal-slug}/` with `terminal.yaml` and message directories.

### 5. Update star_map.yaml
Add system entry if it's a new star system.

### 6. Add system_map.yaml (optional)
If the system should have planetary visualization.

### 7. Add orbit_map.yaml (optional)
If planets should have detailed orbit views.

---

## Complete Minimal Example

This section provides a complete, minimal working example you can copy to create a new star system with one planet, one station, and one encounter map.

### Directory Structure

```bash
# Create the full directory structure
mkdir -p data/galaxy/example-system/example-planet/example-station/map
mkdir -p data/galaxy/example-system/example-planet/example-station/comms/station-terminal/inbox/charon
```

### File 1: System Location
`data/galaxy/example-system/location.yaml`
```yaml
name: "Example System"
type: "system"
description: "A minimal example star system"
status: "FRONTIER"
```

### File 2: Planet Location
`data/galaxy/example-system/example-planet/location.yaml`
```yaml
name: "Example Planet"
type: "planet"
description: "An example planet with one station"
status: "OPERATIONAL"
```

### File 3: Station Location
`data/galaxy/example-system/example-planet/example-station/location.yaml`
```yaml
name: "Example Station"
type: "station"
description: "A simple orbital research station"
status: "OPERATIONAL"
population: "~200"
```

### File 4: Star Map Entry
Add to `data/galaxy/star_map.yaml` (in the `systems:` list):
```yaml
  - name: "Example System"
    position: [50, 20, -30]
    color: 0xFFAA88
    size: 1.8
    type: "star"
    label: true
    location_slug: "example-system"
    info:
      description: "Example frontier system"
```

### File 5: System Map (Optional)
`data/galaxy/example-system/system_map.yaml`
```yaml
star:
  name: "Example Star"
  color: 0xFFAA88
  size: 4.0

camera:
  position: [0, 100, 100]
  lookAt: [0, 0, 0]
  fov: 75

bodies:
  - name: "Example Planet"
    type: "planet"
    location_slug: "example-planet"
    orbital_radius: 40
    orbital_period: 100
    orbital_angle: 0
    size: 1.5
    color: 0x6699AA
    clickable: true
    has_orbit_map: false
    info:
      description: "Rocky world with orbital station"
```

### File 6: Encounter Map
`data/galaxy/example-system/example-planet/example-station/map/station_layout.yaml`
```yaml
name: "Example Station Layout"
location_name: "Example Station"
description: "Simple station with three rooms"

grid:
  width: 20
  height: 12
  unit_size: 40
  show_grid: false

rooms:
  - id: command
    name: "COMMAND"
    x: 1
    y: 1
    width: 5
    height: 3
    description: "Station command center"
    status: "OPERATIONAL"

  - id: habitat
    name: "HABITAT"
    x: 8
    y: 1
    width: 5
    height: 3
    description: "Crew quarters"
    status: "OPERATIONAL"

  - id: lab
    name: "RESEARCH LAB"
    x: 4
    y: 7
    width: 6
    height: 4
    description: "Primary research facility"
    status: "OPERATIONAL"

connections:
  - id: conn_cmd_hab
    from: command
    to: habitat
    door_type: standard
    door_status: OPEN

  - id: conn_cmd_lab
    from: command
    to: lab
    door_type: standard
    door_status: CLOSED

terminals:
  - id: cmd_terminal
    room: command
    position:
      x: 3
      y: 2
    terminal_slug: "station-terminal"
    name: "STATION TERMINAL"
```

### File 7: Terminal Configuration
`data/galaxy/example-system/example-planet/example-station/comms/station-terminal/terminal.yaml`
```yaml
owner: "Station Commander"
terminal_id: "EX-001"
access_level: "RESTRICTED"
description: "Main station terminal"
```

### File 8: Sample Message
`data/galaxy/example-system/example-planet/example-station/comms/station-terminal/inbox/charon/001_welcome.md`
```markdown
---
timestamp: "2183-07-01 08:00:00"
priority: "NORMAL"
subject: "Station Online"
from: "CHARON"
to: "Station Commander"
message_id: "msg_example_001"
read: false
---

STATION SYSTEMS ONLINE
ALL SYSTEMS NOMINAL
AWAITING FURTHER INSTRUCTIONS

END TRANSMISSION
```

### Testing Your Data

After creating these files:

1. **Restart the Django server** if it was running
2. **Check the GM Console** at `/gmconsole/` - your new location should appear in the tree
3. **Click the DISPLAY button** to show the encounter map
4. **Check the Galaxy Map** - your new system should appear

---

## Validation Checklist

When adding new data, verify:

- [ ] All location.yaml files have required `name` and `type` fields
- [ ] Location slugs are unique within their parent
- [ ] Directory names match the `location_slug` values in parent files
- [ ] Message IDs are unique across all terminals
- [ ] **Messages between terminals exist in both sender's `sent/` and recipient's `inbox/`**
- [ ] Room IDs are unique within each deck
- [ ] Connection `from`/`to` reference valid room IDs
- [ ] Inter-deck connections reference valid room IDs in target deck files
- [ ] Terminal slugs in map files match `comms/` directory names
- [ ] System entries in star_map.yaml have matching location directories
- [ ] Planet entries with `has_orbit_map: true` have corresponding orbit_map.yaml files
- [ ] Planets with `clickable: true` have a `location_slug` that matches a directory

---

## Troubleshooting

### Location not appearing in GM Console

**Symptoms:** Your new location doesn't show up in the location tree.

**Causes & Solutions:**
1. **Missing location.yaml** - Every location directory MUST have a `location.yaml` file
2. **Invalid YAML syntax** - Check for typos, incorrect indentation, or missing colons
3. **Missing required fields** - Ensure `name` and `type` fields exist

**Debug steps:**
```bash
# Check if location.yaml exists
ls data/galaxy/your-system/location.yaml

# Validate YAML syntax (requires pyyaml)
python -c "import yaml; yaml.safe_load(open('data/galaxy/your-system/location.yaml'))"
```

### Star system not appearing on galaxy map

**Symptoms:** System exists in directories but not visible on galaxy map.

**Causes & Solutions:**
1. **Not in star_map.yaml** - Add entry to `systems:` list in `data/galaxy/star_map.yaml`
2. **Wrong location_slug** - The `location_slug` must exactly match the directory name

### Clicking planet does nothing

**Symptoms:** Planet appears in system map but clicking doesn't navigate.

**Causes & Solutions:**
1. **Missing clickable: true** - Add `clickable: true` to the planet in system_map.yaml
2. **Missing location_slug** - Add `location_slug` matching the planet's directory name
3. **Missing has_orbit_map** - If planet has orbit_map.yaml, set `has_orbit_map: true`
4. **No orbit_map.yaml** - If `has_orbit_map: true`, create the orbit_map.yaml file

### Encounter map not displaying

**Symptoms:** Map exists but terminal shows blank or error.

**Causes & Solutions:**
1. **YAML syntax error** - Validate the YAML file
2. **Room position off grid** - Ensure room x/y/width/height are within grid boundaries
3. **Invalid connection references** - Connection `from`/`to` must match room IDs exactly
4. **Missing grid configuration** - Ensure `grid:` section exists with width, height, unit_size

### Terminal not loading messages

**Symptoms:** Terminal appears but no messages shown.

**Causes & Solutions:**
1. **Missing terminal.yaml** - The terminal directory needs a `terminal.yaml` file
2. **Wrong directory structure** - Messages must be in `inbox/{sender}/` or `sent/{recipient}/`
3. **Invalid message frontmatter** - Check YAML frontmatter between `---` markers
4. **Missing required fields** - Messages need timestamp, priority, subject, from, to, message_id

### Inter-deck connection errors

**Symptoms:** Clicking inter-deck connection doesn't work.

**Causes & Solutions:**
1. **to_room doesn't exist** - The `to_room` ID must exist in the target deck's rooms list
2. **to_deck doesn't match manifest** - The `to_deck` must match a deck `id` in manifest.yaml
3. **from_room doesn't exist** - The `from_room` must be a valid room ID in the current deck

### Common YAML Mistakes

```yaml
# WRONG: Missing quotes around value with special characters
name: Research Base: Alpha

# RIGHT: Quote strings with colons
name: "Research Base: Alpha"

# WRONG: Inconsistent indentation
rooms:
  - id: bridge
   name: "BRIDGE"     # Wrong indent!

# RIGHT: Consistent 2-space indentation
rooms:
  - id: bridge
    name: "BRIDGE"

# WRONG: Tab characters (use spaces only)
rooms:
	- id: bridge    # Tab character!

# RIGHT: Spaces only
rooms:
  - id: bridge

# WRONG: Missing dash for list item
rooms:
  id: bridge        # Not a list item!

# RIGHT: List items start with dash
rooms:
  - id: bridge
```

### Quick Validation Commands

```bash
# Validate all YAML files in data directory
find data -name "*.yaml" -exec python -c "
import yaml, sys
try:
    yaml.safe_load(open('{}'))
    print('OK: {}')
except Exception as e:
    print('ERROR: {}: ' + str(e))
" \;

# Check for location.yaml in all directories
find data/galaxy -type d -exec sh -c '
    if [ -d "$1" ] && [ ! -f "$1/location.yaml" ]; then
        # Only warn for directories that look like locations (not map/, comms/, etc.)
        case "$(basename "$1")" in
            map|comms|inbox|sent) ;;
            *) echo "WARNING: No location.yaml in $1" ;;
        esac
    fi
' _ {} \;
```
