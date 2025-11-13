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
3. **Universe Map**: Interactive visualization of the universe/sector the players are exploring, showing systems, stations, points of interest, and travel routes
4. **Session Management**: Track sessions, notes, and story developments

The goal is to create an engaging, atmospheric tool that enhances the tension and immersion of Mothership's sci-fi horror gameplay.

# Architecture & Patterns

## Current Structure
```
charon/
├── .claude/                     # Claude Code configuration
├── data/                        # Campaign data (file-based)
│   └── locations/               # Location hierarchy (NESTED STRUCTURE)
│       └── {location_slug}/
│           ├── location.yaml    # Location metadata
│           ├── map/             # Single map per location (singular!)
│           │   ├── {map_name}.yaml
│           │   └── {map_name}.png
│           ├── comms/           # Communication terminals
│           │   └── {terminal_slug}/
│           │       ├── terminal.yaml
│           │       ├── inbox/   # Received messages (by sender)
│           │       └── sent/    # Sent messages (by recipient)
│           └── {child_location}/ # Child locations (unlimited nesting)
├── mothership_gm/              # Django project settings
├── terminal/                   # Main Django app
│   ├── models.py              # Message, ActiveView
│   ├── views.py               # Terminal displays, API endpoints
│   ├── data_loader.py         # File-based data loading
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

## Implemented Architecture

This is a Django-based web application implementing a multi-view terminal system:

### Multi-View Terminal System (Implemented)

The application supports multiple view types that can be displayed on a shared terminal:

**View Types:**
1. **Broadcast Messages** (`MESSAGES`) - Traditional broadcast message system
2. **Communication Terminals** (`COMM_TERMINAL`) - NPC terminal message logs with inbox/sent
3. **Encounter Maps** (`ENCOUNTER_MAP`) - Tactical maps for combat scenarios
4. **Ship Dashboard** (`SHIP_DASHBOARD`) - Ship status and systems display

**Key Design Decisions:**
- **File-based data storage**: Campaign data stored as markdown files with YAML frontmatter
- **Nested directory hierarchy**: Locations organized as nested directories (unlimited depth)
- **On-demand loading**: Data loaded from disk when needed (no DB sync required)
- **Recursive data loading**: `load_location_recursive()` walks nested directory structure
- **Conversation threading**: Messages linked via `conversation_id` and `in_reply_to`
- **Inbox/Sent structure**: Terminals organize messages by direction and contact
- **ActiveView singleton**: Database tracks only which view is currently displayed
- **Auto-refresh terminal**: Polls `/api/active-view/` every 2 seconds for view changes

### Data Loading System

**DataLoader** (`terminal/data_loader.py`):
- Parses location hierarchy from `data/locations/`
- Loads terminal messages with YAML frontmatter
- Groups messages by conversation
- Builds conversation threads
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

### Technical Stack
- **Web Framework**: Django 5.2.7
- **Database**: SQLite (stores ActiveView state and broadcast Messages only)
- **Data Storage**: File-based (YAML + Markdown)
- **Dependencies**: PyYAML for data parsing, Pillow for image generation
- **Frontend**: HTML/CSS with muted multi-color styling, JavaScript for real-time updates
- **Package Management**: pip + requirements.txt

### UI Color Scheme (V2-1: Muted Multi-Color)
**Design Philosophy**: Inspired by Alien Romulus (2024) - realistic, muted CRT aesthetic with multiple harmonious colors

**Color Palette** (defined as CSS variables in `base.html`):
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

**Implementation**:
- Colors defined in [terminal/templates/terminal/base.html](terminal/templates/terminal/base.html)
- Applied across [gm_console.html](terminal/templates/terminal/gm_console.html) and [shared_console.html](terminal/templates/terminal/shared_console.html)
- Angular panel helper classes available for new components

### UI Layout Standards

**Top Navigation Bar** (`terminal-header`):
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

**Content Layout Spacing**:
- **Content padding**: Remove default padding, controlled by page-specific CSS
- **GM Console spacing**: 30px from left edge, 30px below header
- **Panel gaps**: 20px between major UI components

**Angular Panel Styling** (all chamfered panels):
- **Chamfer size**: 12px (top-left and bottom-right corners)
- **Border method**: Use `box-shadow` inset (not `border` property) to prevent clipping
  - Syntax: `inset 0 2px 0 0 var(--color-border-main)` (for 2px borders)
- **Diagonal corner lines**:
  - Size: 12px × 12px pseudo-elements
  - Thickness: 4px diagonal line (`calc(50% ± 2px)`)
  - Method: Linear gradient `to bottom right`
  - Position: `top: 0; left: 0` (top-left), `bottom: 0; right: 0` (bottom-right)

**Standard Panel Template** (default for all new panels):

This is the standard layout pattern for panels in the application. See the Locations panel in [gm_console.html](terminal/templates/terminal/gm_console.html:56-185) as the reference implementation.

**Outer Wrapper** (`.panel-wrapper`):
- Chamfered angular panel with 12px corners
- Background: `var(--color-bg-panel)` (#1a2525)
- Borders: 2px inset box-shadow in teal (`var(--color-border-main)`)
- Diagonal corner lines at chamfered corners
- Flexbox container with `display: flex; flex-direction: column`

**Fixed Header** (`.panel-header`):
- Padding: `12px 2px 0 2px` (extends title underline to edges)
- Non-scrolling header with `flex-shrink: 0`
- Title styling can vary by panel (color, size, letter-spacing)
- Underline: `border-bottom: 1px solid var(--color-border-subtle)`
- Title padding: `0 10px 5px 10px` (inset from panel edges)

**Scrollable Content Area** (`.panel-content`):
- Flex: `flex: 1` (fills remaining space)
- Overflow: `overflow-y: auto; overflow-x: hidden`
- Padding: `12px 12px 12px 12px`
- Margins: `margin-bottom: 2px; margin-left: 2px; margin-right: 5px`
  - Right margin creates 3px gap between content and right panel border
- Background: Scanline pattern on dark background
  - Base: `#171717`
  - Scanlines: `repeating-linear-gradient(to bottom, transparent, transparent 2px, #1a1a1a 2px, #1a1a1a 3px)`

**Panel Scrollbar Styling** (floating style):
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
    border: none;  /* Override global styles */
    margin-top: 2px;
    margin-bottom: 2px;
}

.panel-content::-webkit-scrollbar-thumb {
    background: #0f1515;
    border: 1px solid #4a6b6b;
}

.panel-content::-webkit-scrollbar-thumb:hover {
    background: #1a2525;
}

.panel-content::-webkit-scrollbar-button {
    display: none;
}
```

**Key Features:**
- **Floating scrollbar**: Track has no borders, blends with scanline background
- **Bordered thumb**: Only the scrollbar thumb has teal border
- **3px spacing**: Scrollbar is inset 3px from panel's right edge
- **Matching background**: Track background matches content area scanlines
- **No left track border**: `border: none` overrides global scrollbar styles

**Scrollbar Styling** (global fallback):
- **Width**: 10px
- **Track**: Background #1a2525, border-left 1px solid #4a6b6b
- **Thumb**: Background #0f1515, border 1px solid #4a6b6b
- **Thumb hover**: Background #1a2525
- **Arrows**: Hidden (`display: none`)
- **Implementation**: Use webkit pseudo-elements, avoid `scrollbar-width` and `scrollbar-color` (Chrome 121+ conflict)
- **Note**: Individual panels should override these with the floating scrollbar style above

### Implemented Features
✓ **Broadcast Messaging**: GM sends messages to all players via `/gmconsole/`
✓ **Shared Terminal**: Public display at `/terminal/` (no login)
✓ **Personal Messages**: Player-specific messages at `/messages/` (login required)
✓ **File-based Campaigns**: Location/terminal data loaded from disk
✓ **Nested Location Hierarchy**: Unlimited depth location nesting (Planet → Base → Deck → Section)
✓ **Conversation Threading**: Messages organized into conversational threads
✓ **CHARON Integration**: Station AI system for automated notifications
✓ **Multi-terminal Support**: Each location can have multiple terminals
✓ **Tree View GM Console**: Expandable/collapsible location tree with touch-friendly controls
✓ **View Switching**: DISPLAY button shows location maps, SHOW button displays terminal overlays
✓ **Encounter Map Display**: Terminal automatically shows maps when GM clicks DISPLAY
✓ **Auto-refresh Terminal**: Polls for view changes every 2 seconds and auto-reloads
✓ **Map Image Generation**: Python script to generate retro sci-fi themed deck layouts
✓ **Static File Serving**: Django serves map images from `data/` directory in development
✓ **V2-1 UI Theme**: Muted multi-color design with teal/amber palette and angular panels

### Features To Implement
- [ ] Terminal overlay display (SHOW button functionality)
- [ ] Terminal conversation view renderer
- [ ] Ship dashboard display
- [ ] Player character management
- [ ] Session tracking
- [ ] Combat/encounter tracking on maps

## Development Environment
- Python virtual environments (`.venv/`, `env/`, `venv/`)
- IDE support for VS Code, Cursor IDE, and PyCharm
- CI/CD ready with comprehensive ignore patterns

# Stack Best Practices

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
- Choose one primary package manager (pip, pipenv, poetry, pdm, or UV) and document the choice
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

# Anti-Patterns

## Avoid
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

## Security
- Never commit secrets, tokens, or credentials
- Use environment variables for sensitive configuration
- Keep `.env` files out of version control
- Review `.gitignore` before committing new file types

# Data Models

## Implemented Models (Database)

### ActiveView (Singleton)
Tracks which view the shared terminal is currently displaying.

```python
class ActiveView(models.Model):
    location_slug = CharField  # e.g., "research_base_alpha"
    view_type = CharField       # MESSAGES, COMM_TERMINAL, ENCOUNTER_MAP, SHIP_DASHBOARD
    view_slug = CharField       # e.g., "commanders_terminal"
    updated_at = DateTimeField
    updated_by = ForeignKey(User)
```

### Message (Broadcast System)
Traditional broadcast messages sent by GM to all players.

```python
class Message(models.Model):
    sender = CharField          # e.g., "CHARON"
    content = TextField
    priority = CharField        # LOW, NORMAL, HIGH, CRITICAL
    created_at = DateTimeField
    created_by = ForeignKey(User)
    recipients = ManyToManyField(User)  # Empty = all players
    is_read = BooleanField
```

## File-Based Data Models

Campaign data is stored as files, not in the database. The structure is:

### Location (YAML File)
`data/locations/{location_slug}/location.yaml`

```yaml
name: "Research Base Alpha"
type: "station"  # station, ship, planet, asteroid, derelict
description: "Remote research facility"
coordinates: "39.47.36 N / 116.23.40 W"
status: "OPERATIONAL"
```

### Terminal (YAML File)
`data/locations/{location_slug}/comms/{terminal_slug}/terminal.yaml`

```yaml
owner: "Commander Drake"
terminal_id: "CMD-001"
access_level: "CLASSIFIED"  # PUBLIC, RESTRICTED, CLASSIFIED
description: "Command center main terminal"
```

### Terminal Messages (Markdown Files)
`data/locations/{location_slug}/comms/{terminal_slug}/inbox|sent/{contact_slug}/{filename}.md`

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

### Encounter Maps (IMPLEMENTED)
`data/locations/{location_slug}/map/{map_slug}.yaml` (singular `map/` directory!)

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
- Images are served via `/data/locations/.../map/image.png` in development

## Data Access Pattern

**Load on demand, don't sync to database:**

```python
from terminal.data_loader import load_location, build_conversation_thread

# Load location data from disk
location = load_location('research_base_alpha')

# Access terminals
for terminal in location['terminals']:
    # terminal has 'inbox', 'sent', and 'messages' (combined)

# Build conversation thread
thread = build_conversation_thread(
    terminal['messages'],
    'conv_lab_incident_001'
)
```

## GM Console & Terminal Display

### GM Console (`/gmconsole/`)
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
- Boxed items with dark green borders (#004400)
- Active display has bright green border (#00ff00)
- Shaded right side for buttons (#001100 background)
- Tree connectors and indentation for hierarchy
- LocalStorage persistence for expanded/collapsed state

### Terminal Display (`/terminal/`)
**Auto-switching Display:**
- Polls `/api/active-view/` every 2 seconds
- Automatically reloads when GM changes view
- Shows encounter map when `view_type == 'ENCOUNTER_MAP'`
- Falls back to message inbox mode otherwise

**Map Display Mode:**
- Full-screen map image display
- Location name, coordinates, and status in header
- Green border and glow effect on image
- Fallback message if no image available

**Message Inbox Mode:**
- Sidebar with sender list
- Message area with conversations
- Real-time polling for new messages

### API Endpoints

**`/api/active-view/`** (Public, no login)
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

**`/api/messages/`** (Public, no login)
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

## Future Models (Database)

When implementing character/campaign tracking:

### Campaign Management
- **Campaign**: Campaign name, description, current date/time, active status
- **Session**: Session number, date, notes, GM summary

### Characters & Crew
- **Character**: Name, class, stats (strength, speed, intellect, combat), stress, health, saves, skills, loadout
- **NPC**: Similar to Character but with GM-only notes and relationship tracking

### Ships & Locations (if DB-backed)
- **Ship**: Name, class, hull points, systems status, crew capacity, cargo

# Configuration, Security, and Authentication

## Configuration
- Use environment variables for configuration (`.env` files)
- Keep environment-specific settings separate from code
- Never commit sensitive configuration to version control
- Django: Use `local_settings.py` for development overrides (excluded from git)
- Flask: Use instance folders for configuration (excluded from git)

## Security Best Practices
- Store secrets in environment variables
- Use secure credential management for API keys and tokens
- Keep `.pypirc` out of version control
- Use HTTPS for all external API calls
- Implement proper input validation and sanitization
- Follow OWASP security guidelines for web applications

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

## Claude Code Integration
This repository includes `.claude/settings.local.json` which restricts bash permissions to git-related commands only. When working with this repository through Claude Code, be aware of these restrictions and use appropriate tools for file operations.

## Development URLs
- **GM Console**: http://127.0.0.1:8000/gmconsole/
- **Terminal Display**: http://127.0.0.1:8000/terminal/
- **Player Messages**: http://127.0.0.1:8000/messages/
- **Admin**: http://127.0.0.1:8000/admin/
- **API - Active View**: http://127.0.0.1:8000/api/active-view/
- **API - Messages**: http://127.0.0.1:8000/api/messages/
