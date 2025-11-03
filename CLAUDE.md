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
│   └── locations/               # Location hierarchy
│       └── {location_slug}/
│           ├── location.yaml    # Location metadata
│           ├── maps/            # Encounter maps
│           └── comms/           # Communication terminals
│               └── {terminal_slug}/
│                   ├── terminal.yaml
│                   ├── inbox/   # Received messages (by sender)
│                   └── sent/    # Sent messages (by recipient)
├── mothership_gm/              # Django project settings
├── terminal/                   # Main Django app
│   ├── models.py              # Message, ActiveView
│   ├── views.py               # Terminal displays
│   ├── data_loader.py         # File-based data loading
│   ├── management/commands/   # Django commands
│   └── templates/             # HTML templates
├── db.sqlite3                 # Development database
├── manage.py                  # Django management
└── requirements.txt           # Python dependencies
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
- **On-demand loading**: Data loaded from disk when needed (no DB sync required)
- **Conversation threading**: Messages linked via `conversation_id` and `in_reply_to`
- **Inbox/Sent structure**: Terminals organize messages by direction and contact
- **ActiveView singleton**: Database tracks only which view is currently displayed

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
- **Dependencies**: PyYAML for data parsing
- **Frontend**: HTML/CSS with retro terminal styling
- **Package Management**: pip + requirements.txt

### Implemented Features
✓ **Broadcast Messaging**: GM sends messages to all players via `/gmconsole/`
✓ **Shared Terminal**: Public display at `/terminal/` (no login)
✓ **Personal Messages**: Player-specific messages at `/messages/` (login required)
✓ **File-based Campaigns**: Location/terminal data loaded from disk
✓ **Conversation Threading**: Messages organized into conversational threads
✓ **CHARON Integration**: Station AI system for automated notifications
✓ **Multi-terminal Support**: Each location can have multiple terminals

### Features To Implement
- [ ] View switching UI in GM console
- [ ] Terminal display renderer (conversation view)
- [ ] Encounter map renderer
- [ ] Ship dashboard display
- [ ] API endpoints for real-time view updates
- [ ] Player character management
- [ ] Session tracking

## Development Environment
- Python virtual environments (`.venv/`, `env/`, `venv/`)
- IDE support for VS Code, Cursor IDE, and PyCharm
- CI/CD ready with comprehensive ignore patterns

# Stack Best Practices

## Mothership RPG-Specific Guidelines

### Atmosphere & Theme
- **Visual Design**: Embrace retro-futuristic, 1970s-80s sci-fi aesthetic (Alien, Aliens inspiration)
- **Terminal Interface**: Monospaced fonts, green/amber text on dark backgrounds, CRT scanline effects
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

### Encounter Maps (Future)
`data/locations/{location_slug}/maps/{map_slug}.yaml`

```yaml
name: "Main Facility"
location_name: "Research Base Alpha - Main Level"
image_path: "maps/main_facility.png"
grid_size_x: 20
grid_size_y: 20
```

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

## Claude Code Integration
This repository includes `.claude/settings.local.json` which restricts bash permissions to git-related commands only. When working with this repository through Claude Code, be aware of these restrictions and use appropriate tools for file operations.
