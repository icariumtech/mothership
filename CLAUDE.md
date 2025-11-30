# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Overview

**mothership** is a game master tool for running Mothership RPG campaigns. This Python-based web application serves as an interactive command center that enhances the tabletop RPG experience with digital tools and atmospheric computer-like messaging.

**Repository**: https://github.com/icariumtech/mothership
**License**: MIT (2025 icariumtech)
**Primary Language**: Python
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
│   └── galaxy/
│       ├── star_map.yaml        # 3D star map visualization
│       └── # Galaxy hierarchy (NESTED STRUCTURE)
│           └── {system_slug}/   # Solar System (e.g., sol, kepler-442)
│               ├── location.yaml    # Star metadata (type: "system")
│               └── {body_slug}/     # Planet/Moon (e.g., earth, mars)
│                   ├── location.yaml    # Planet metadata (type: "planet")
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
├── mothership_gm/              # Django project settings
├── terminal/                   # Main Django app
│   ├── models.py              # Message, ActiveView
│   ├── views.py               # Terminal displays, API endpoints
│   ├── data_loader.py         # File-based data loading (galaxy-aware)
│   ├── management/commands/   # Django commands
│   └── templates/             # HTML templates
│       └── terminal/
│           ├── gm_console.html      # GM control panel
│           ├── tree_location.html   # Recursive tree view item
│           ├── shared_console.html  # Shared display (auto-switches views)
│           └── player_console.html  # Player message inbox (login required)
├── db.sqlite3                 # Development database
├── manage.py                  # Django management
├── requirements.txt           # Python dependencies
└── generate_deck_layout.py    # Script to generate map images
```

### Galaxy Hierarchy Example

**Sol System → Earth → Research Base Alpha → Main Deck → Commander's Office**

```
data/galaxy/locations/
└── sol/                        # Solar System
    ├── location.yaml           # Star metadata
    └── earth/                  # Planet
        ├── location.yaml       # Planet metadata
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
- **Web Framework**: Django 5.2.7
- **Database**: SQLite (stores ActiveView state and broadcast Messages only)
- **Data Storage**: File-based (YAML + Markdown)
- **Dependencies**: PyYAML for data parsing, Pillow for image generation
- **Frontend**: HTML/CSS with muted multi-color styling, JavaScript for real-time updates
- **Package Management**: pip + requirements.txt
- **Development**: Python virtual environments (`.venv/`, `env/`, `venv/`)
- **IDE Support**: VS Code, Cursor IDE, and PyCharm

## Multi-View Terminal System

The application supports multiple view types that can be displayed on a shared terminal:

**View Types:**
1. **Standby Screen** (`STANDBY`) - Default idle state with animated text
2. **Campaign Dashboard** (`CAMPAIGN_DASHBOARD`) - Campaign overview with crew, missions, ship status
3. **Broadcast Messages** (`MESSAGES`) - Traditional broadcast message system
4. **Communication Terminals** (`COMM_TERMINAL`) - NPC terminal message logs with inbox/sent
5. **Encounter Maps** (`ENCOUNTER_MAP`) - Tactical maps for combat scenarios
6. **Ship Dashboard** (`SHIP_DASHBOARD`) - Ship status and systems display

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
- Parses galaxy hierarchy from `data/galaxy/locations/`
- Recursively loads Systems → Bodies (planets) → Facilities (stations/bases/ships) → Decks → Rooms
- Each level can have maps, terminals, and child locations
- Loads terminal messages with YAML frontmatter
- Groups messages by conversation
- Builds conversation threads
- Helper methods to find locations by slug or path in hierarchy
- Loads star map data and links to location hierarchy
- No database sync needed

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

### Standard Panel Template

**Usage**: Default layout pattern for all new panels

**Reference Implementation**: Locations panel in [gm_console.html](terminal/templates/terminal/gm_console.html:56-185)

**HTML Structure**:
```html
<div class="panel-wrapper">
    <div class="panel-header">
        <h3>PANEL TITLE</h3>
    </div>
    <div class="panel-content">
        <!-- Panel content here -->
    </div>
</div>
```

**CSS Pattern**:
```css
/* Outer Wrapper */
.panel-wrapper {
    background-color: var(--color-bg-panel);
    position: relative;
    display: flex;
    flex-direction: column;

    /* Chamfered corners (top-left and bottom-right) */
    clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);

    /* Borders using box-shadow (prevents clipping) */
    box-shadow:
        inset 0 2px 0 0 var(--color-border-main),
        inset -2px 0 0 0 var(--color-border-main),
        inset 0 -2px 0 0 var(--color-border-main),
        inset 2px 0 0 0 var(--color-border-main);
}

/* Diagonal corner lines */
.panel-wrapper::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 12px;
    height: 12px;
    background: linear-gradient(
        to bottom right,
        transparent calc(50% - 2px),
        var(--color-border-main) calc(50% - 2px),
        var(--color-border-main) calc(50% + 2px),
        transparent calc(50% + 2px)
    );
}

.panel-wrapper::after {
    content: '';
    position: absolute;
    bottom: 0;
    right: 0;
    width: 12px;
    height: 12px;
    background: linear-gradient(
        to bottom right,
        transparent calc(50% - 2px),
        var(--color-border-main) calc(50% - 2px),
        var(--color-border-main) calc(50% + 2px),
        transparent calc(50% + 2px)
    );
}

/* Fixed Header */
.panel-header {
    padding: 12px 2px 0 2px;
    flex-shrink: 0;
}

.panel-header h3 {
    color: var(--color-teal);
    font-size: 13px;
    letter-spacing: 2px;
    margin: 0;
    padding: 0 10px 5px 10px;
    border-bottom: 1px solid var(--color-border-subtle);
}

/* Scrollable Content Area */
.panel-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px;
    margin: 2px 5px 2px 2px;  /* 3px gap on right for scrollbar */
    background-color: #171717;
    background-image: repeating-linear-gradient(
        to bottom,
        transparent,
        transparent 2px,
        #1a1a1a 2px,
        #1a1a1a 3px
    );
    color: var(--color-text-primary);
    font-size: 12px;
    line-height: 1.6;
}
```

### Custom Chamfered Panels

**Usage**: "Create a panel with [corners] chamfered and title '[TITLE]'"

**Corner Options**: `top-left`, `top-right`, `bottom-left`, `bottom-right`

**Diagonal Line Direction Reference**:

| Corner Position | Gradient Direction |
|----------------|-------------------|
| `top-left`     | `to bottom right` |
| `top-right`    | `to bottom left`  |
| `bottom-left`  | `to bottom left`  |
| `bottom-right` | `to bottom right` |

**Clip-Path Patterns** (12px chamfer size):

**Top-left corner only**:
```css
clip-path: polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px);
```

**Top-right corner only**:
```css
clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
```

**Bottom-left corner only**:
```css
clip-path: polygon(0 0, 100% 0, 100% 100%, 12px 100%, 0 calc(100% - 12px));
```

**Bottom-right corner only**:
```css
clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
```

**Top-left and bottom-right (default)**:
```css
clip-path: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);
```

**Top-right and bottom-left**:
```css
clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
```

**All four corners**:
```css
clip-path: polygon(
    12px 0, calc(100% - 12px) 0,
    100% 12px, 100% calc(100% - 12px),
    calc(100% - 12px) 100%, 12px 100%,
    0 calc(100% - 12px), 0 12px
);
```
*Note: For 4 corners, you'll need additional HTML elements for top-right and bottom-left diagonal lines (see campaign dashboard center panel example in [shared_console.html](terminal/templates/terminal/shared_console.html:574-578)).*

**Header Border Adjustments** (to avoid diagonal corners):

Add extra padding (12px) to the h3 element on sides with chamfered top corners:

- Top-left chamfered: `padding-left: 22px` (10px base + 12px)
- Top-right chamfered: `padding-right: 22px` (10px base + 12px)
- Both top corners: Both left and right padding

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
✓ **Touch Controls**: Full touch support for mobile/tablet - pinch to zoom and single-finger pan/rotate on both galaxy and system maps, with smart panel detection for scrolling
✓ **System Map Starfield**: 5000 background stars with starburst texture, random positions/sizes/rotations, additive blending for atmospheric depth
✓ **Orbital Inclination**: Realistic 3D orbital planes - each planet can have custom inclination angle, orbits and planet positions tilted accordingly
✓ **Adaptive Orbital Speeds**: Per-system speed calculation ensures fastest planet completes 1 orbit in 10 seconds, maintaining relative speeds for natural viewing
✓ **45-Degree System View**: All solar systems displayed at 45-degree elevation angle instead of edge-on, providing better 3D perspective of orbital planes
✓ **Default Orbit Rendering**: Orbits default to teal color (0x5a7a7a) at 0.45 opacity unless overridden in system YAML, matching UI palette
✓ **Simple Circle Planets**: Planets rendered as teal-outlined circles with solid black centers (billboard sprites) for consistent visibility regardless of color or distance
✓ **Planet Depth Occlusion**: Sprites use depth buffer to properly occlude orbit lines behind planets

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
    view_type = CharField           # STANDBY, CAMPAIGN_DASHBOARD, MESSAGES, COMM_TERMINAL, ENCOUNTER_MAP, SHIP_DASHBOARD
    view_slug = CharField           # e.g., "commanders_terminal"

    # Overlay (terminal on top of map)
    overlay_location_slug = CharField
    overlay_terminal_slug = CharField

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

Campaign data is stored as files, not in the database.

### Location (YAML File)

Locations form a hierarchical galaxy structure. Each level has different metadata based on type.

**Solar System** - `data/galaxy/locations/{system_slug}/location.yaml`
```yaml
name: "Sol System"
type: "system"
star_type: "G-type main-sequence (G2V)"
galactic_coordinates: [0, 0, 0]
status: "INHABITED"
description: "Humanity's home star system"
```

**Planet/Moon** - `data/galaxy/locations/{system_slug}/{body_slug}/location.yaml`
```yaml
name: "Earth"
type: "planet"  # or "moon"
parent_system: "sol"
orbital_position: 3
mass: "5.972 × 10^24 kg"
gravity: "1.0 G"
atmosphere: "Nitrogen-Oxygen (breathable)"
status: "INHABITED"
population: "8.2 billion"
```

**Facility** - `data/galaxy/locations/{system}/{body}/{facility_slug}/location.yaml`
```yaml
name: "Research Base Alpha"
type: "base"  # or "station" or "ship"
parent_body: "earth"
coordinates: "39.47.36 N / 116.23.40 W"
status: "OPERATIONAL"
crew_capacity: 50
description: "Remote research facility"
```

**Deck/Level** - `data/galaxy/locations/{...}/{deck_slug}/location.yaml`
```yaml
name: "Main Deck"
type: "deck"
level: 1
description: "Primary operations level"
```

**Room/Section** - `data/galaxy/locations/{...}/{room_slug}/location.yaml`
```yaml
name: "Commander's Office"
type: "room"
description: "Command center"
```

**Location Types**: `system`, `planet`, `moon`, `station`, `base`, `ship`, `deck`, `level`, `room`, `section`

### Star Map (YAML File)
`data/galaxy/star_map.yaml`

Defines the 3D visualization of the galaxy with systems, stations, and routes.

```yaml
camera:
  position: [0, 0, 100]
  lookAt: [0, 0, 0]
  fov: 75

systems:
  - name: "Sol"
    position: [0, 0, 0]
    color: 0xFFFFAA
    size: 2.5
    type: "star"
    label: true
    location_slug: "sol"  # Links to location hierarchy

routes:
  - from: "Sol"
    to: "Alpha Centauri"
    from_slug: "sol"
    to_slug: "alpha-centauri"
    color: 0x5a7a9a
    route_type: "trade_route"

nebulae:
  - name: "Azure Expanse"
    position: [-50, 35, -25]
    color: 0x5a7a9a
    size: 30
    particle_count: 600
    opacity: 0.05
    type: "reflection"
```

**Nebula Types and Behaviors:**

Nebulae add atmospheric depth to the galaxy map with type-specific visual characteristics:

- **`emission`** - Ionized gas nebulae (typically red/maroon/amber colors)
  - Particle distribution: Concentrated toward center (denser core)
  - Animation: Gentle pulsing (15% opacity variation, slow)
  - Use case: Star-forming regions, ionized hydrogen clouds

- **`reflection`** - Nebulae reflecting starlight (typically blue/teal colors)
  - Particle distribution: Uniform throughout volume
  - Animation: Very subtle shimmer (8% opacity variation)
  - Use case: Dust clouds illuminated by nearby stars

- **`planetary`** - Ring nebulae from dying stars (any color)
  - Particle distribution: Ring/torus shape (hollow center, flattened disk)
  - Animation: Slow rotation around center axis
  - Use case: Planetary nebulae, supernova remnants

- **`dark`** - Obscuring dust clouds (very dark colors)
  - Particle distribution: Standard spherical
  - Material: Uses NormalBlending (doesn't glow)
  - Animation: None (static)
  - Use case: Dust clouds, molecular clouds

**Nebula Color Guidelines:**
Use muted colors that match the terminal UI palette (teal #5a7a9a, amber #8b7355, muted purples/reds). Opacity should typically be 0.04-0.08 for subtle atmospheric effect.

### Terminal (YAML File)
`data/galaxy/locations/{path...}/comms/{terminal_slug}/terminal.yaml`

Terminals can exist at any level (facility, deck, room).

```yaml
owner: "Commander Drake"
terminal_id: "CMD-001"
access_level: "CLASSIFIED"  # PUBLIC, RESTRICTED, CLASSIFIED
description: "Command center main terminal"
```

### Terminal Messages (Markdown Files)
`data/galaxy/locations/{path...}/comms/{terminal_slug}/inbox|sent/{contact_slug}/{filename}.md`

Messages use markdown with YAML frontmatter:
```markdown
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

Message content in markdown...
```

**Key Fields:**
- `message_id`: Unique identifier for this message
- `conversation_id`: Groups related messages into threads
- `in_reply_to`: Links to previous message in conversation
- `from`/`to`: Sender and recipient
- `folder` (auto-added): `inbox` or `sent`
- `contact` (auto-added): Directory name (who the message is from/to)

### Encounter Maps
`data/galaxy/locations/{path...}/map/{map_slug}.yaml` (singular `map/` directory!)

Maps can exist at system, facility, or deck levels.

```yaml
name: "Main Facility"
location_name: "Research Base Alpha - Main Level"
description: "Main deck layout showing bridge, engineering, and crew quarters"
grid_size_x: 20
grid_size_y: 15
```

**Map Images:**
- Place image with same name as YAML file in same directory
- Supported formats: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`
- Example: `deck_layout.yaml` + `deck_layout.png`
- Images are served via `/data/galaxy/locations/.../map/image.png` in development

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
  - Updates `ActiveView.view_type = 'ENCOUNTER_MAP'`
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
  "view_type": "ENCOUNTER_MAP",
  "view_slug": "deck_layout",
  "overlay_location_slug": "",
  "overlay_terminal_slug": "",
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
- Primary package manager: pip with requirements.txt
- Keep dependencies minimal and well-documented
- Pin dependency versions for reproducible builds

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

## Map Image Generation

### `generate_deck_layout.py`
Python script using Pillow to create retro sci-fi themed deck layouts:

**Visual Style:**
- Black background (#000000)
- Dark green grid overlay (#004400) - 20px grid
- Bright green lines and text (#00ff00)
- Very dark green room fills (#002200)
- Monospaced DejaVu Sans Mono font
- CRT scanline effect (every 4px)

**Usage:**
```bash
source .venv/bin/activate
python generate_deck_layout.py
```

**Output:**
- Creates PNG image in `data/locations/{location}/map/`
- 1200x800 resolution by default
- Includes room labels, connection corridors, and technical info
- Can be customized for different ship/station layouts

**Example Rooms:**
- Bridge, Engineering, Crew Quarters
- Cargo Bay, Medical, Life Support
- Connection corridors and hatches

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
