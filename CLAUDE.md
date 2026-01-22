# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Documentation Map

For detailed information on specific topics, refer to these guides:

- **Read: README.md** - Project overview, quick start, and feature list
- **Read: GETTING_STARTED.md** - First-time setup and basic usage instructions
- **Read: NETWORK_ACCESS.md** - Configuring network access for players
- **Read: QUICK_REFERENCE.md** - Quick reference for network URLs and common commands
- **Read: DATA_DIRECTORY_GUIDE.md** - Complete guide to data directory structure, file formats, and YAML schemas
- **Read: src/components/ui/README.md** - React Panel component API, usage patterns, and migration examples

# Overview

**mothership** is a game master tool for running Mothership RPG campaigns. This full-stack web application serves as an interactive command center that enhances the tabletop RPG experience with digital tools and atmospheric computer-like messaging.

**Repository**: https://github.com/icariumtech/mothership
**License**: MIT (2025 icariumtech)
**Primary Languages**: Python (Django backend), TypeScript (React frontend)
**Game System**: Mothership RPG (sci-fi horror TTRPG)

## Project Purpose

This tool is developed collaboratively between the game master and Claude Code. The web app provides players with:

1. **Campaign Tracking**: Track player characters, missions, ship status, resources, and campaign progress
2. **Atmospheric Messaging System**: Send in-character messages to players styled like the iconic CHARON computer from Aliens - creating immersive communication from ship computers, stations, or AI systems
3. **Galaxy Map**: Interactive visualization of the galaxy/sector the players are exploring, showing systems, stations, points of interest, and travel routes
4. **Session Management**: Track sessions, notes, and story developments

The goal is to create an engaging, atmospheric tool that enhances the tension and immersion of Mothership's sci-fi horror gameplay.

## Persona
You are an expert full stack web developer.  You should indentify ways to write the code that is effecient and you should always consider ways to make the code easy to read and make sure you create reusable functions instead of having blocks of code duplicated.

# Architecture & Patterns

## Directory Structure
```
charon/
├── .claude/                     # Claude Code configuration
├── data/                        # Campaign data (file-based)
│   ├── campaign/                # Campaign YAML files (crew, missions, notes)
│   └── galaxy/
│       ├── star_map.yaml        # 3D star map visualization
│       └── # Galaxy hierarchy (NESTED STRUCTURE)
│           └── {system_slug}/   # Solar System (e.g., sol, kepler-442)
│               ├── location.yaml    # Star metadata (type: "system")
│               ├── system_map.yaml  # System 3D visualization
│               └── {body_slug}/     # Planet/Moon (e.g., earth, mars)
│                   ├── location.yaml    # Planet metadata (type: "planet")
│                   ├── orbit_map.yaml   # Orbit 3D visualization
│                   └── {facility_slug}/ # Station/Base/Ship
│                       ├── location.yaml    # Facility metadata (type: "station"/"base"/"ship")
│                       ├── map/             # Facility overview map (singular!)
│                       │   ├── {map_name}.yaml
│                       │   └── {map_name}.png
│                       ├── comms/           # Facility-level terminals
│                       │   └── {terminal_slug}/
│                       │       ├── terminal.yaml
│                       │       ├── inbox/   # Received messages (by sender)
│                       │       └── sent/    # Sent messages (by recipient)
│                       └── {deck_slug}/     # Deck/Level
│                           ├── location.yaml    # Deck metadata (type: "deck")
│                           ├── map/             # Deck layout map
│                           │   ├── {map_name}.yaml
│                           │   └── {map_name}.png
│                           ├── comms/           # Deck-level terminals
│                           └── {room_slug}/     # Room/Section
│                               ├── location.yaml    # Room metadata (type: "room")
│                               └── comms/           # Room-level terminals
├── src/                        # React TypeScript frontend
│   ├── entries/                # Entry points (React roots)
│   │   ├── GMConsole.tsx       # GM control panel entry
│   │   ├── SharedConsole.tsx   # Shared display entry
│   │   └── PlayerConsole.tsx   # Player messages entry
│   ├── components/             # React components
│   │   ├── domain/             # Domain-specific components
│   │   │   ├── dashboard/      # Campaign dashboard views
│   │   │   ├── maps/           # 3D map components (Galaxy, System, Orbit)
│   │   │   ├── encounter/      # Encounter map renderer
│   │   │   ├── charon/         # CHARON AI terminal
│   │   │   └── terminal/       # Terminal message views
│   │   ├── gm/                 # GM Console components
│   │   ├── layout/             # Layout components (header, panels)
│   │   └── ui/                 # Reusable UI components
│   ├── services/               # API client services
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # TypeScript type definitions
│   └── styles/                 # Global CSS styles
├── scripts/                    # Utility scripts
│   ├── convert_to_amber_gradient.py   # Planet texture converter
│   ├── convert_planet_texture.py      # Alternative texture converter
│   └── batch_convert_textures.sh      # Batch texture processing
├── mothership_gm/              # Django project settings
├── terminal/                   # Main Django app
│   ├── models.py              # Message, ActiveView
│   ├── views.py               # API endpoints and template views
│   ├── data_loader.py         # File-based data loading (galaxy-aware)
│   ├── management/commands/   # Django commands
│   └── templates/             # HTML template wrappers
│       └── terminal/
│           ├── gm_console_react.html      # GM console React wrapper
│           ├── shared_console_react.html  # Shared display React wrapper
│           └── player_console_react.html  # Player console React wrapper
├── db.sqlite3                 # Development database
├── manage.py                  # Django management
├── requirements.txt           # Python dependencies
├── package.json               # Node.js dependencies
├── tsconfig.json              # TypeScript configuration
└── vite.config.ts             # Vite build configuration
```

### Galaxy Hierarchy Example

**Sol System → Earth → Research Base Alpha → Main Deck → Commander's Office**

```
data/galaxy/
└── sol/                        # Solar System
    ├── location.yaml           # Star metadata
    ├── system_map.yaml         # System 3D visualization
    └── earth/                  # Planet
        ├── location.yaml       # Planet metadata
        ├── orbit_map.yaml      # Orbit 3D visualization
        ├── research_base_alpha/    # Surface Base
        │   ├── location.yaml
        │   ├── map/exterior.yaml+png
        │   ├── comms/station-ai/   # CHARON terminal
        │   └── main-deck/          # Deck
        │       ├── location.yaml
        │       ├── map/deck_layout.yaml+png
        │       ├── comms/
        │       └── commanders-office/  # Room
        │           └── comms/terminal-001/
        └── uscss_morrigan/     # Ship on surface
            ├── location.yaml
            ├── map/
            └── comms/
```

## Technical Stack

### Backend
- **Web Framework**: Django 5.2.7
- **Database**: SQLite (stores ActiveView state and broadcast Messages only)
- **Data Storage**: File-based (YAML + Markdown)
- **Data Parsing**: PyYAML for YAML parsing, Pillow for image generation
- **Package Management**: pip + requirements.txt
- **Development**: Python virtual environments (`.venv/`, `env/`, `venv/`)

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 5.4
- **UI Library**: Ant Design 6.1 (layout, forms, tabs, icons)
- **3D Graphics**: Three.js 0.182 (vanilla Three.js with imperative scene management)
- **Animation**: GSAP 3.14 for smooth transitions
- **HTTP Client**: Axios 1.13 for API communication
- **Package Management**: npm + package.json
- **Type Checking**: TypeScript 5.9

### Development Tools
- **IDE Support**: VS Code, Cursor IDE, and PyCharm
- **Linting**: Ruff (Python), TypeScript compiler (frontend)
- **Testing**: pytest (backend), no frontend tests yet

## Multi-View Terminal System

The application supports multiple view types that can be displayed on a shared terminal:

**View Types:**
1. **Standby Screen** (`STANDBY`) - Default idle state with animated text
2. **Bridge** (`BRIDGE`) - Ship bridge view with galaxy map, system navigation, and status panels
3. **Broadcast Messages** (`MESSAGES`) - Traditional broadcast message system
4. **Communication Terminals** (`COMM_TERMINAL`) - NPC terminal message logs with inbox/sent
5. **Encounter Maps** (`ENCOUNTER`) - Tactical maps for combat scenarios
6. **Ship Dashboard** (`SHIP_DASHBOARD`) - Ship status and systems display
7. **CHARON Terminal** (`CHARON_TERMINAL`) - Interactive AI terminal interface

**Key Design Decisions:**
- **File-based data storage**: Campaign data stored as markdown files with YAML frontmatter
- **Nested directory hierarchy**: Locations organized as nested directories (unlimited depth)
- **On-demand loading**: Data loaded from disk when needed (no DB sync required)
- **Recursive data loading**: `load_location_recursive()` walks nested directory structure
- **Conversation threading**: Messages linked via `conversation_id` and `in_reply_to`
- **Inbox/Sent structure**: Terminals organize messages by direction and contact
- **ActiveView singleton**: Database tracks only which view is currently displayed
- **Auto-refresh terminal**: Polls `/api/active-view/` every 2 seconds for view changes

## Data Loading System

**DataLoader** (`terminal/data_loader.py`):
- Parses galaxy hierarchy from `data/galaxy/`
- Recursively loads Systems → Bodies (planets) → Facilities (stations/bases/ships) → Decks → Rooms
- Each level can have maps, terminals, and child locations
- Loads star map, system map, and orbit map YAML files
- Loads terminal messages with YAML frontmatter
- Groups messages by conversation
- Builds conversation threads
- Helper methods to find locations by slug or path in hierarchy
- Loads campaign data (crew, missions, notes) from `data/campaign/`
- No database sync needed - all data loaded on-demand from files

**Message Format** (Markdown with YAML):
```yaml
---
timestamp: "2183-06-15 03:52:00"
priority: "CRITICAL"
subject: "Containment Failure"
from: "Dr. Sarah Chen"
to: "Commander Drake"
message_id: "msg_chen_003"
conversation_id: "conv_lab_incident_001"
in_reply_to: "msg_drake_002"
read: false
---

Message content here...
```

# UI Design System

## Color Scheme (V2-1: Muted Multi-Color)

**Design Philosophy**: Inspired by Alien Romulus (2024) - realistic, muted CRT aesthetic with multiple harmonious colors

**Color Palette** (defined as CSS variables in [base.html](terminal/templates/terminal/base.html)):
```css
--color-teal: #4a6b6b;              /* Primary structural color */
--color-teal-bright: #5a7a7a;       /* Hover states, emphasis */
--color-amber: #8b7355;             /* Active/interactive elements */
--color-amber-bright: #9a8065;      /* Hover states on amber */
--color-bg-primary: #0a0a0a;        /* Main background */
--color-bg-secondary: #1a1a1a;      /* Secondary surfaces */
--color-bg-panel: #1a2525;          /* Panel backgrounds */
--color-bg-panel-dark: #0f1515;     /* Dark panel variant */
--color-text-primary: #9a9a9a;      /* Body text */
--color-text-secondary: #7a7a7a;    /* Secondary text */
--color-text-muted: #5a5a5a;        /* Disabled/muted text */
--color-border-main: #4a6b6b;       /* Primary borders */
--color-border-subtle: #2a3a3a;     /* Subtle dividers */
--color-active: #8b7355;            /* Active selections */
```

**Visual Elements**:
- **Angular Panels**: Chamfered corners using CSS `clip-path` polygons (12px chamfer size)
- **CRT Effects**: Subtle scanlines (3px spacing, very low opacity)
- **Text Hierarchy**: Teal for structure/headers, amber for actions, gray for content
- **No Bright Colors**: All colors are muted and realistic - no neon green
- **Diagonal Corner Lines**: 4px wide diagonal lines using linear gradients at chamfered corners

## Layout Standards

### Top Navigation Bar
Class: `terminal-header`

**Specifications:**
- **Height**: 52px fixed
- **Background**: #1a2828 with horizontal scanline pattern
  - Pattern: `repeating-linear-gradient(to bottom, transparent, transparent 1px, rgba(0, 0, 0, 0.3) 1px, rgba(0, 0, 0, 0.3) 2px)`
- **Position**: Sticky, anchored to top of viewport
- **Padding**: 0 40px 0 22px (22px from left edge, 40px from right)
- **Font**: Cascadia Code (fallback: Courier New, monospace)
- **Text Sizes**:
  - Title/Subtitle: 18px, letter-spacing 3px, color #5a7575 (muted teal)
  - Right side text (LOGOUT/STATION ACCESS): 11px, letter-spacing 3px, color #8b7355 (amber)
- **Border**: 1px solid var(--color-border-subtle) at bottom

### Content Layout
- **Content padding**: Remove default padding, controlled by page-specific CSS
- **GM Console spacing**: 30px from left edge, 30px below header
- **Panel gaps**: 20px between major UI components (30px for campaign dashboard)

## Panel Design Patterns

### HTML/CSS Panels (Legacy)

For HTML templates, panels use chamfered corners (12px), teal borders, and scanline backgrounds. Key features:
- Angular panels with `clip-path` polygons for chamfered corners
- Diagonal corner lines using `::before` and `::after` pseudo-elements
- Fixed header with scrollable content area
- Floating scrollbar with teal borders

**Read: terminal/templates/terminal/gm_console_react.html** for reference implementations of HTML/CSS panel patterns.

### React Panel Components (Recommended)

For React/TypeScript code, use the standardized Panel component system:

**Component Hierarchy**:
- `Panel` - Base component with full customization
- `DashboardPanel` - Pre-configured for dashboard layouts
- `CompactPanel` - Dense layout for GM console
- `InfoPanel` - Floating info panels with typewriter effect

**Quick Example**:
```tsx
import { DashboardPanel } from '@components/ui/DashboardPanel';

<DashboardPanel title="CREW ROSTER" chamferCorners={['tr', 'bl']}>
  <p>Crew list content</p>
</DashboardPanel>
```

**Read: src/components/ui/README.md** for complete Panel component API documentation, props, variants, usage examples, and migration guidance.

## Scrollbar Styling

### Floating Scrollbar (Panel Content)

Use this style for scrollable panel content areas:

```css
.panel-content::-webkit-scrollbar {
    width: 10px;
}

.panel-content::-webkit-scrollbar-track {
    background: #171717;
    background-image: repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 2px,
        #1a1a1a 2px,
        #1a1a1a 3px
    );
    border: none;  /* Override global styles - no borders */
    margin-top: 2px;
    margin-bottom: 2px;
}

.panel-content::-webkit-scrollbar-thumb {
    background: #0f1515;
    border: 1px solid #4a6b6b;  /* Only thumb has border */
}

.panel-content::-webkit-scrollbar-thumb:hover {
    background: #1a2525;
}

.panel-content::-webkit-scrollbar-button {
    display: none;
}
```

**Key Features:**
- Track has no borders, blends with scanline background
- Only scrollbar thumb has teal border
- 3px spacing between scrollbar and panel edge (via content margin-right)
- Track background matches content area scanlines

### Global Scrollbar (Fallback)

Default scrollbar styling for other elements:

- **Width**: 10px
- **Track**: Background #1a2525, border-left 1px solid #4a6b6b
- **Thumb**: Background #0f1515, border 1px solid #4a6b6b
- **Thumb hover**: Background #1a2525
- **Arrows**: Hidden (`display: none`)
- **Implementation**: Use webkit pseudo-elements, avoid `scrollbar-width` and `scrollbar-color` (Chrome 121+ conflict)

## Decorative UI Elements

### System Information Panel Decorations

The system information panel (displayed when selecting stars on the galaxy map) includes decorative elements positioned below the panel.

**Indicator Boxes**:
- **Count**: Exactly 12 boxes
- **Size**: 14×14px each
- **Spacing**: 10px between boxes
- **Color**: Muted burgundy/wine (#6b4a4a)
- **Opacity**: 0.7 when visible
- **Implementation**: CSS `repeating-linear-gradient` pattern
- **Width Calculation**: (12 × 14px) + (11 × 10px) = 278px total
- **Positioning**: 5px below panel bottom border, left-aligned with panel

**Rectangle Decoration**:
- **Height**: 14px (matches indicator boxes)
- **Width**: Extends from boxes to panel right edge
- **Color**: Same burgundy (#6b4a4a)
- **Opacity**: 0.6 when visible
- **Spacing**: 10px gap from rightmost indicator box

**Triangle Decoration**:
- **Type**: Isosceles right triangle (45-45-90 degrees)
- **Legs**: 35×35px (both legs equal length)
- **Hypotenuse**: Left side (diagonal from bottom-left to top-right)
- **Right Angle**: Bottom-right corner
- **Color**: Same burgundy (#6b4a4a)
- **Opacity**: 0.6 when visible
- **Positioning**: 5px above rectangle top edge, right-aligned with panel
- **Implementation**: CSS `clip-path: polygon(0 100%, 100% 100%, 100% 0)`

**Dynamic Positioning**:
All decorative elements use JavaScript `updateIndicatorBoxesPosition()` function to:
- Recalculate positions when panel resizes (ResizeObserver)
- Recalculate positions when window resizes
- Use `getBoundingClientRect()` for accurate viewport-relative positioning
- Position elements as siblings outside panel to avoid `clip-path` clipping

**Visibility Logic**:
- Show when system info panel is visible
- Hide when no system is selected
- Fade in/out with 0.3s transition

# Implemented Features

## Current Features
✓ **Multi-View Terminal System**: Dynamic view switching between standby, maps, terminals, dashboards
✓ **Broadcast Messaging**: GM sends messages to all players via `/gmconsole/`
✓ **Shared Terminal Display**: Public display at `/terminal/` (no login required)
✓ **Personal Messages**: Player-specific messages at `/messages/` (login required)
✓ **File-based Campaign Data**: Location/terminal data loaded from disk (no DB sync)
✓ **Nested Location Hierarchy**: Unlimited depth location nesting (Planet → Base → Deck → Section)
✓ **Conversation Threading**: Messages organized into conversational threads
✓ **CHARON Integration**: Station AI system for automated notifications
✓ **Multi-terminal Support**: Each location can have multiple terminals
✓ **Tree View GM Console**: Expandable/collapsible location tree with touch-friendly controls
✓ **View Switching**: DISPLAY button shows location maps, SHOW button displays terminal overlays
✓ **Encounter Map Display**: Terminal automatically shows maps when GM clicks DISPLAY
✓ **Interactive Encounter Maps**: Node-graph style maps with rooms connected by orthogonal paths with 45-degree angles, doors at both ends of connections, terminals, POIs, legend panel, and pan/zoom support (mouse wheel zoom, drag to pan, touch pinch/drag)
✓ **Campaign Dashboard**: Multi-panel dashboard showing crew, missions, ship status, campaign info
✓ **Auto-refresh Terminal**: Polls for view changes every 2 seconds and auto-reloads
✓ **Map Image Generation**: Python script to generate retro sci-fi themed deck layouts
✓ **Static File Serving**: Django serves map images from `data/` directory in development
✓ **V2-1 UI Theme**: Muted multi-color design with teal/amber palette and angular panels
✓ **Terminal Overlay System**: SHOW button displays terminal overlay without clearing main view
✓ **3D Galaxy Map**: Interactive Three.js visualization with stars, travel routes, and nebulae
✓ **Nebula System**: Type-specific nebulae (emission, reflection, planetary, dark) with unique particle distributions and animations
✓ **System Info Panel Decorations**: Indicator boxes, rectangle, and triangle decorations for galaxy map system selection
✓ **Standby Mode Header Hiding**: Top navigation bar automatically hidden in standby mode
✓ **Smart Dashboard Reset**: Dashboard resets to default state (no selection, centered on Sol) only when GM clicks dashboard button, not on page refresh
✓ **View Change Detection**: Uses URL parameter `?viewchange=1` to distinguish GM-triggered view changes from manual refreshes
✓ **Auto-Rotation Feature**: Galaxy map automatically rotates around origin when no system is selected, stops on user interaction (zoom/drag)
✓ **Configurable Rotation Speed**: Auto-rotation speed of 0.002 radians/frame (~52 seconds per full rotation)
✓ **Smart Scroll Wheel Handling**: Scroll wheel zooms maps when hovering over background, scrolls panel content when hovering over panels
✓ **Touch Controls**: Full touch support for mobile/tablet - pinch to zoom and single-finger pan/rotate on galaxy, system, and orbit maps, with smart panel detection for scrolling
✓ **System Map Starfield**: 5000 background stars with starburst texture, random positions/sizes/rotations, additive blending for atmospheric depth
✓ **Orbital Inclination**: Realistic 3D orbital planes - each planet can have custom inclination angle, orbits and planet positions tilted accordingly
✓ **Adaptive Orbital Speeds**: Per-system speed calculation ensures fastest planet completes 1 orbit in 10 seconds, maintaining relative speeds for natural viewing
✓ **45-Degree System View**: All solar systems displayed at 45-degree elevation angle instead of edge-on, providing better 3D perspective of orbital planes
✓ **Default Orbit Rendering**: Orbits default to teal color (0x5a7a7a) at 0.45 opacity unless overridden in system YAML, matching UI palette
✓ **Simple Circle Planets**: Planets rendered as teal-outlined circles with solid black centers (billboard sprites) for consistent visibility regardless of color or distance
✓ **Planet Depth Occlusion**: Sprites use depth buffer to properly occlude orbit lines behind planets
✓ **Orbit Map System**: Detailed 3D visualization of individual planets with moons, stations, and surface locations
✓ **Planet Drill-Down Navigation**: Click arrow buttons on planets to transition from system view to orbit view
✓ **Planet Texture System**: Equirectangular PNG textures mapped to spherical planet geometry with rotation animation
✓ **Moon Rendering**: Orbiting moons with textures, orbital paths, configurable periods, and inclination support
✓ **Orbital Stations**: Sprite-based stations positioned on orbital paths with animation
✓ **Surface Markers**: Lat/lon positioned markers (city, research, spaceport) with visibility culling for far side of planet
✓ **Orbit Map Menu**: Dynamic menu showing moons, stations, and surface locations as clickable items
✓ **Orbit Map Element Selection**: Click menu items to select moons, stations, or surface markers with visual feedback
✓ **Element Details Panel**: Shows element-specific info (type, description, population, coordinates) with typewriter animation
✓ **Selection Race Condition Prevention**: Sequence tracking ensures correct panel content during rapid selections/deselections
✓ **Planet Info Restoration**: Deselecting elements properly restores full planet details from system map data
✓ **Back Navigation**: "BACK TO SYSTEM" button (amber styled) to return from orbit view to system view
✓ **Module Scope Handling**: Functions made globally accessible via window object for cross-module communication
✓ **Orbit Map Targeting Reticle**: Amber targeting reticle appears on selected moons, stations, and surface markers with appropriate scaling
✓ **Camera Zoom to Elements**: Camera animates to selected orbit map elements, centering on moons/stations or zooming to surface markers
✓ **Camera Tracking for Orbiting Elements**: Camera follows selected moons and stations as they orbit, keeping element centered
✓ **Surface Marker Animation Pause**: Planet rotation and orbital animations pause when surface marker is selected, allowing free camera control
✓ **Camera Return Animation**: Smooth animated return to default planet view when deselecting elements
✓ **Unified Targeting Reticle**: Consistent reticle design across galaxy, system, and orbit maps (concentric circles with cross cutout and corner brackets)
✓ **CHARON AI Terminal**: Fullscreen AI chat interface with centered panel (1/3 width, 3/4 height, 4-corner chamfered design)
✓ **4-Corner Chamfered Panels**: Panel component supports configurable chamfered corners (any combination of tl, tr, bl, br)
✓ **Typewriter Effect**: CHARON responses display character-by-character with blinking cursor
✓ **Processing Indicator**: Animated "Processing..." with cycling dots while waiting for AI response
✓ **Inline Query Input**: Query mode shows `> ` prompt inline with conversation flow
✓ **Mode Switching**: CHARON terminal supports DISPLAY mode (blinking cursor) and QUERY mode (user input)
✓ **Multi-Deck Encounter Maps**: Support for manifest.yaml + deck_X.yaml structure with level navigation
✓ **ENCOUNTER Tab in GM Console**: Dedicated tab with deck selector, map preview, and room visibility controls
✓ **GM Map Preview**: Simplified SVG preview with pan/zoom, shows all rooms with visibility indication (hidden rooms dimmed, dashed borders, X indicator)
✓ **Room Visibility Control**: GM can toggle individual room visibility, with bulk show all/hide all buttons
✓ **Level Indicator**: Player terminal shows current deck level indicator (e.g., "DECK 1 / 3") for multi-deck maps
✓ **Default Deck Selection**: Automatically selects first/default deck when entering ENCOUNTER view for new location
✓ **Encounter View Persistence**: Terminal refresh maintains current ENCOUNTER location via immediate API fetch on mount

## Planned Features
- [ ] Terminal conversation view renderer
- [ ] Ship dashboard display (different from campaign dashboard)
- [ ] Player character management
- [ ] Session tracking
- [ ] Combat/encounter tracking on maps
- [ ] Sound effects and ambient audio
- [ ] GM tools (NPC generator, random encounters, quick reference tables)

# Data Models

## Database Models

### ActiveView (Singleton)
Tracks which view the shared terminal is currently displaying.

```python
class ActiveView(models.Model):
    # Main display
    location_slug = CharField       # e.g., "research_base_alpha"
    view_type = CharField           # STANDBY, BRIDGE, MESSAGES, COMM_TERMINAL, ENCOUNTER, SHIP_DASHBOARD, CHARON_TERMINAL
    view_slug = CharField           # e.g., "commanders_terminal"

    # Overlay (terminal on top of map)
    overlay_location_slug = CharField
    overlay_terminal_slug = CharField

    # CHARON Terminal specific fields
    charon_mode = CharField                 # DISPLAY, QUERY
    charon_location_path = CharField        # Path to active CHARON instance (e.g., "tau-ceti/tau-ceti-f/verdant-base")
    charon_dialog_open = BooleanField       # Whether the CHARON dialog overlay is visible to players

    # Encounter map state (for multi-deck maps)
    encounter_level = IntegerField          # Current deck level (1-indexed)
    encounter_deck_id = CharField           # Current deck ID (e.g., "deck_1")
    encounter_room_visibility = JSONField   # {room_id: bool} - GM-controlled visibility
    encounter_door_status = JSONField       # {connection_id: door_status} - Runtime door status override

    # Metadata
    updated_at = DateTimeField
    updated_by = ForeignKey(User)
```

### Message (Broadcast System)
Traditional broadcast messages sent by GM to all players.

```python
class Message(models.Model):
    sender = CharField              # e.g., "CHARON"
    content = TextField
    priority = CharField            # LOW, NORMAL, HIGH, CRITICAL
    created_at = DateTimeField
    created_by = ForeignKey(User)
    recipients = ManyToManyField(User)  # Empty = all players
    is_read = BooleanField
```

## File-Based Data Models

Campaign data is stored as files in the `data/` directory, not in the database. The system uses a hierarchical galaxy structure with YAML configuration files and Markdown messages.

**Key Data Types:**
- **Locations**: Nested directory hierarchy (Systems → Planets → Facilities → Decks → Rooms)
- **Maps**: Star maps, system maps, orbit maps, and encounter maps in YAML format
- **Terminals**: Communication terminals with inbox/sent message folders
- **Messages**: Markdown files with YAML frontmatter for threaded conversations
- **Campaign Data**: Crew, missions, and notes in YAML files

**Read: DATA_DIRECTORY_GUIDE.md** for complete documentation on:
- Directory naming conventions and structure
- Location discovery mechanism
- YAML file formats and schemas
- Message threading system
- Map configuration (galaxy, system, orbit, encounter maps)
- Terminal and communication setup

## Data Access Pattern

**Load on demand, don't sync to database:**

```python
from terminal.data_loader import DataLoader

loader = DataLoader()

# Load all locations (entire galaxy hierarchy)
all_locations = loader.load_all_locations()

# Find a location anywhere in the hierarchy
location = loader.find_location_by_slug('research_base_alpha')

# Get location by full path
location = loader.get_location_by_path(['sol', 'earth', 'research_base_alpha'])

# Get hierarchical path for a location
path = loader.get_location_path('research_base_alpha')
# Returns: ['sol', 'earth', 'research_base_alpha']

# Load star map
star_map = loader.load_star_map()

# Access terminals
for terminal in location['terminals']:
    # terminal has 'inbox', 'sent', and 'messages' (combined)

# Build conversation thread
from terminal.data_loader import build_conversation_thread
thread = build_conversation_thread(
    terminal['messages'],
    'conv_lab_incident_001'
)
```

## Planned Models (Database)

When implementing character/campaign tracking:

### Campaign Management
- **Campaign**: Campaign name, description, current date/time, active status
- **Session**: Session number, date, notes, GM summary

### Characters & Crew
- **Character**: Name, class, stats (strength, speed, intellect, combat), stress, health, saves, skills, loadout
- **NPC**: Similar to Character but with GM-only notes and relationship tracking

### Ships & Locations (if DB-backed)
- **Ship**: Name, class, hull points, systems status, crew capacity, cargo

# User Interfaces

## GM Console (`/gmconsole/`)

**Tree View Interface:**
- Hierarchical tree of all locations (unlimited nesting depth)
- Triangle icons (▶/▼) to expand/collapse locations
- Eye icon (👁) DISPLAY button on each location
  - Toggles on/off to show location map on terminal
  - Updates `ActiveView.view_type = 'ENCOUNTER'`
  - Only one location can be displayed at a time
- Play icon (▶) SHOW button on each terminal
  - Momentary flash animation
  - Sets overlay without clearing main display
  - Updates `ActiveView.overlay_location_slug` and `overlay_terminal_slug`

**Visual Styling:**
- Boxed items with teal borders
- Active display has bright teal border
- Shaded right side for buttons
- Tree connectors and indentation for hierarchy
- LocalStorage persistence for expanded/collapsed state

## Terminal Display (`/terminal/`)

**Auto-switching Display:**
- Polls `/api/active-view/` every 2 seconds
- Automatically reloads when GM changes view
- Displays appropriate view based on `view_type`

**View Types:**
- **Standby**: Animated text blocks with system messages
- **Campaign Dashboard**: 5-panel layout with crew, missions, ship status
- **Encounter Map**: Full-screen map image display with location info
- **Messages**: Sidebar with sender list and message conversations
- **Comm Terminal**: Terminal conversation view (planned)
- **Ship Dashboard**: Ship systems display (planned)

**Map Display Mode:**
- Full-screen map image display
- Location name, coordinates, and status in header
- Teal border and glow effect on image
- Fallback message if no image available

**Message Inbox Mode:**
- Sidebar with sender list
- Message area with conversations
- Real-time polling for new messages

## API Endpoints

### `/api/active-view/` (Public, no login)
Returns current active view state:
```json
{
  "location_slug": "uscss_morrigan",
  "view_type": "ENCOUNTER",
  "view_slug": "deck_layout",
  "overlay_location_slug": "",
  "overlay_terminal_slug": "",
  "charon_mode": "DISPLAY",
  "charon_location_path": "",
  "charon_dialog_open": false,
  "encounter_level": 1,
  "encounter_deck_id": "deck_1",
  "encounter_room_visibility": {},
  "encounter_door_status": {},
  "updated_at": "2025-11-09 06:20:31"
}
```

### `/api/messages/` (Public, no login)
Returns broadcast messages since ID:
```json
{
  "messages": [
    {
      "id": 5,
      "sender": "CHARON",
      "content": "System status: nominal",
      "priority": "NORMAL",
      "created_at": "2025-11-09 06:15:22"
    }
  ],
  "count": 1
}
```

# Development Practices

## Mothership RPG-Specific Guidelines

### Atmosphere & Theme
- **Visual Design**: Muted multi-color palette inspired by Alien Romulus (2024) - realistic CRT aesthetic
- **Color Scheme (V2-1)**: Muted teal (#4a6b6b) and amber (#8b7355) - no bright neon colors
- **Terminal Interface**: Monospaced fonts, angular panels with chamfered corners, subtle CRT scanline effects
- **Computer Messages**: Write in-character as ship/station AI systems - terse, technical, sometimes ominous
- **Sound Design**: Consider adding subtle ambient sounds or notification beeps for messages

### Game Mechanics Integration
- **Stress System**: Prominently display character stress levels (core Mothership mechanic)
- **Panic Effects**: Track and display panic results and conditions
- **Stats**: Follow official Mothership character sheet format (Strength, Speed, Intellect, Combat)
- **Saves**: Sanity Save, Fear Save, Body Save with clear UI indicators
- **Damage**: Track wounds, critical injuries, and conditions

### GM Tools
- **Quick Reference**: Include tables for panic, critical injuries, ship damage
- **NPC Generator**: Quick tools to generate crew, colonists, or threats
- **Random Encounters**: Space for GM to prep and trigger random events
- **Hidden Information**: GM-only notes that players cannot see

### Player Experience
- **Mobile Friendly**: Players should access from phones/tablets at the table
- **Quick Updates**: Character updates should be fast and not interrupt gameplay
- **Notifications**: Subtle alerts when GM sends messages or updates
- **Read-Only Mode**: Players see their info but can't modify without GM approval

## Python Development
- Use virtual environments for dependency isolation
- Follow PEP 8 style guidelines (enforced by Ruff)
- Implement type hints for better code maintainability
- Write comprehensive tests using pytest
- Use `.env` files for environment-specific configuration (never commit these)

## Package Management

### Backend (Python)
- Primary package manager: pip with requirements.txt
- Keep dependencies minimal and well-documented
- Pin dependency versions for reproducible builds
- Use virtual environments (`.venv/`) for isolation

### Frontend (JavaScript/TypeScript)
- Package manager: npm with package.json
- Build tool: Vite for fast development and optimized production builds
- TypeScript compilation: tsc for type checking, Vite for bundling
- Key commands:
  - `npm run dev` - Start Vite development server with hot reload
  - `npm run build` - Production build (TypeScript → JavaScript, bundled assets)
  - `npm run typecheck` - Run TypeScript type checking without building
- Vite configuration in `vite.config.ts` with React plugin and path aliases
- Static assets served from Django in development, from `/static/` in production

## React/TypeScript Frontend Development

### Architecture
- **Component Organization**: Domain-driven structure (domain/gm/layout/ui)
- **Type Safety**: Full TypeScript coverage with strict mode enabled
- **State Management**: React hooks (useState, useEffect, useCallback, useRef)
- **Custom Hooks**: Shared logic in `src/hooks/` (useTreeState, usePanelState, etc.)
- **API Services**: Centralized API clients in `src/services/` (axios-based)
- **Type Definitions**: Shared types in `src/types/` (starMap, systemMap, orbitMap, etc.)

### Best Practices
- Use functional components with TypeScript interfaces for props
- Prefer `useCallback` and `useMemo` for performance-critical operations
- Use `useRef` for Three.js scene management and DOM element references
- Import paths use `@/` alias for `src/` directory (configured in tsconfig.json)
- Three.js integrations use **vanilla Three.js** with imperative scene management in dedicated scene classes (GalaxyScene, SystemScene, OrbitScene)
- React components wrap Three.js scenes and handle lifecycle (init/dispose via useEffect, expose methods via useImperativeHandle)
- GSAP animations for smooth camera movements and transitions
- Ant Design components for consistent UI patterns (Layout, Tabs, Forms, Icons)
- `async/await` for all API calls with proper error handling
- TypeScript strict mode ensures type safety across the application

### Module Communication
- **React Components**: Props and callbacks for parent-child communication
- **Global State**: Lifted state in parent components, passed down via props
- **API Polling**: useEffect intervals for real-time updates (e.g., active view polling)
- **Event Handlers**: onClick, onChange callbacks with TypeScript type safety
- **Refs for Three.js**: useRef for scene, camera, controls access across render cycles

### Three.js Integration Pattern
- **Scene Classes**: Three.js scenes are implemented as standalone TypeScript classes in `src/three/` (e.g., GalaxyScene.ts, SystemScene.ts, OrbitScene.ts)
- **React Wrappers**: React components in `src/components/domain/maps/` wrap Three.js scenes and manage lifecycle
- **Imperative Management**: Scenes are created/disposed via useEffect, methods exposed via useImperativeHandle
- **No React Three Fiber**: The codebase uses vanilla Three.js with direct WebGLRenderer, Scene, Camera, and Object3D management
- **Global Functions**: Some legacy code exposes functions via `window` object for cross-module communication (gradually migrating to React patterns)

## Testing
- Maintain test coverage with pytest
- Use tox or nox for multi-environment testing
- Run tests before committing changes

## Type Safety
- Use mypy, pyre, or pytype for static type checking
- Add type hints to all public APIs
- Run type checkers in CI/CD pipeline

## Code Quality
- Use Ruff for linting and formatting
- Configure pre-commit hooks for automated checks
- Keep code modular and maintainable

## Anti-Patterns to Avoid
- Committing virtual environment directories (`venv/`, `.venv/`, `env/`)
- Committing environment files (`.env`, `.envrc`)
- Committing IDE-specific settings that aren't universal
- Committing Python bytecode files (`__pycache__/`, `*.pyc`)
- Committing build artifacts (`dist/`, `build/`, `*.egg-info/`)
- Committing database files in development (`db.sqlite3`)
- Committing credentials or API keys (use `.pypirc`, `.env`)
- Hard-coding configuration values (use environment variables)
- Skipping type hints in public APIs
- Writing untested code

## Security Best Practices
- Never commit secrets, tokens, or credentials
- Use environment variables for sensitive configuration
- Keep `.env` files out of version control
- Review `.gitignore` before committing new file types
- Store secrets in environment variables
- Use secure credential management for API keys and tokens
- Keep `.pypirc` out of version control
- Use HTTPS for all external API calls
- Implement proper input validation and sanitization
- Follow OWASP security guidelines for web applications

# Configuration & Tools

## Authentication

*No authentication currently implemented.*

### Planned Authentication Model

The application needs a simple but effective authentication system with two user roles:

**Game Master (GM)**
- Full access to all campaign data
- Can create, edit, and delete content
- Access to GM-only notes and hidden information
- Can send messages to players
- Can modify game state

**Players**
- View access to their assigned character(s)
- Can update their own character sheet (with optional GM approval)
- Receive messages from the GM/ship computer
- View shared campaign information (maps, missions, party resources)
- Cannot see GM notes or other players' private information

### Implementation Guidelines
- Use established libraries (Django's auth system, Flask-Login, etc.)
- Never store passwords in plain text
- Use strong password hashing (bcrypt, Argon2)
- Implement proper session management
- Simple login system - no need for complex MFA for tabletop game tool
- Consider optional "table code" for quick player joins without individual accounts
- Session tokens should persist across game sessions
- Optional: GM can generate one-time invite links for players

## Texture and Image Processing Scripts

All utility scripts are located in the `scripts/` directory. See individual script documentation below for usage details.

## Planet Texture Conversion

### `convert_to_amber_gradient.py`
Python script using Pillow to convert planet textures to retro sci-fi amber monochrome gradient.

**Purpose:**
Converts noisy source textures to a consistent retro aesthetic by scanning all unique colors and remapping them to a black-to-amber gradient based on perceived brightness.

**Visual Style:**
- **Target Color**: Bright gold/amber (#D4A855)
- **Gradient**: Black (0x000000) to bright amber
- **Brightness Calculation**: ITU-R BT.709 luminance formula (0.2126*R + 0.7152*G + 0.0722*B)
- **Gamma Correction**: Adjustable per planet type to control brightness distribution
  - Lower gamma (1.4) = brighter midtones, preserves detail
  - Higher gamma (2.0) = darker midtones, more contrast
- **Posterization**: Limited gradient steps (128) create banding effect typical of retro displays

**Usage:**
```bash
source .venv/bin/activate
python scripts/convert_to_amber_gradient.py input.png output.png [gradient_steps] [gamma]
```

**Parameters:**
- `input.png` - Source texture file (equirectangular format for sphere mapping)
- `output.png` - Output file path
- `gradient_steps` - Number of color steps in gradient (default: 128)
- `gamma` - Gamma correction value (default: 2.2, lower = brighter)

**Example:**
```bash
# Convert volcanic texture with 128 steps and gamma 1.4 (brighter for detail)
python scripts/convert_to_amber_gradient.py \
  textures/volcanic_source/lava_planet.png \
  textures/volcanic/lava_planet.png \
  128 1.4
```

### `batch_convert_textures.sh`
Batch processing script that automatically converts all planet textures from source directories with optimal gamma settings per planet type.

**Directory Structure:**
```
textures/
├── gas_source/        → textures/gas/
├── rock_source/       → textures/rock/
├── terrestrial_source/ → textures/terrestrial/
└── volcanic_source/   → textures/volcanic/
```

**Auto-Selected Gamma Values:**
- **Gas Giants**: gamma 2.0 (higher contrast for cloud bands)
- **Rocky Planets**: gamma 1.8 (balanced)
- **Terrestrial Planets**: gamma 1.4 (brighter to preserve terrain detail)
- **Volcanic Planets**: gamma 1.4 (brighter to show lava flows and surface features)

**Usage:**
```bash
source .venv/bin/activate
./scripts/batch_convert_textures.sh
```

**Process:**
- Scans each `*_source` directory for PNG files
- Automatically selects optimal gamma based on directory name
- Converts all textures with 128 gradient steps
- Creates output directories if they don't exist
- Reports progress and file size reduction

**Output:**
- Typically 50-75% file size reduction
- Consistent amber aesthetic across all planet types
- Preserved detail appropriate to planet type

**Technical Details:**
The conversion pipeline:
1. Loads source image and scans all unique colors
2. Calculates perceived brightness for each color
3. Creates 128-step gradient from black to amber
4. Applies gamma correction to brightness mapping
5. Remaps each pixel to closest gradient color
6. Saves optimized PNG with reduced color palette

**Three.js Integration:**
Textures are used with equirectangular mapping on SphereGeometry:
```javascript
const geometry = new THREE.SphereGeometry(size, 64, 64);
const texture = textureLoader.load(texturePath);
const material = new THREE.MeshBasicMaterial({ map: texture });
```

## Environment Configuration
- Use environment variables for configuration (`.env` files)
- Keep environment-specific settings separate from code
- Never commit sensitive configuration to version control
- Django: Use `local_settings.py` for development overrides (excluded from git)

## Claude Code Integration
This repository includes `.claude/settings.local.json` which restricts bash permissions to git-related commands only. When working with this repository through Claude Code, be aware of these restrictions and use appropriate tools for file operations.

## Development URLs
- **GM Console**: http://127.0.0.1:8000/gmconsole/
- **Terminal Display**: http://127.0.0.1:8000/terminal/
- **Player Messages**: http://127.0.0.1:8000/messages/
- **Admin**: http://127.0.0.1:8000/admin/
- **API - Active View**: http://127.0.0.1:8000/api/active-view/
- **API - Messages**: http://127.0.0.1:8000/api/messages/
