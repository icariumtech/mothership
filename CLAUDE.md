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
- **Read: STYLE_GUIDE.md** - UI design system, color palette, panel patterns, and visual specifications

# Overview

**mothership** is a game master tool for running Mothership RPG campaigns. This full-stack web application serves as an interactive command center that enhances the tabletop RPG experience with digital tools and atmospheric computer-like messaging.

**Repository**: https://github.com/icariumtech/mothership
**License**: MIT (2025 icariumtech)
**Primary Languages**: Python (Django backend), TypeScript (React frontend)
**Game System**: Mothership RPG (sci-fi horror TTRPG)

## Project Purpose

This tool is developed collaboratively between the game master and Claude Code. The web app provides players with:

1. **Campaign Tracking**: Track player characters, missions, ship status, resources, and campaign progress
2. **Atmospheric Messaging System**: Send in-character messages to players styled like the iconic CHARON computer from Aliens
3. **Galaxy Map**: Interactive visualization of the galaxy/sector the players are exploring
4. **Session Management**: Track sessions, notes, and story developments

## Persona

You are an expert full stack web developer. You should identify ways to write code that is efficient and easy to read. Create reusable functions instead of duplicating code blocks.

# Technical Stack

## Backend
- **Web Framework**: Django 5.2.7
- **Database**: SQLite (stores ActiveView state and broadcast Messages only)
- **Data Storage**: File-based (YAML + Markdown)
- **Data Parsing**: PyYAML for YAML parsing, Pillow for image generation

## Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 5.4
- **UI Library**: Ant Design 6.1 (layout, forms, tabs, icons)
- **3D Graphics**: Three.js 0.182 (vanilla Three.js with imperative scene management)
- **Animation**: GSAP 3.14 for smooth transitions
- **HTTP Client**: Axios 1.13 for API communication

## Development Tools
- **Linting**: Ruff (Python), TypeScript compiler (frontend)
- **Testing**: pytest (backend)

# Quick Reference

## Key Commands
```bash
npm run dev              # Start Vite dev server with hot reload
npm run build            # Production build
npm run typecheck        # TypeScript type checking
python manage.py runserver  # Start Django server
```

## Development URLs
- **GM Console**: http://127.0.0.1:8000/gmconsole/
- **Terminal Display**: http://127.0.0.1:8000/terminal/
- **Player Messages**: http://127.0.0.1:8000/messages/
- **Admin**: http://127.0.0.1:8000/admin/
- **API - Active View**: http://127.0.0.1:8000/api/active-view/
- **API - Messages**: http://127.0.0.1:8000/api/messages/

# Architecture

## Directory Structure
```
charon/
├── data/                        # Campaign data (file-based)
│   ├── campaign/                # Campaign YAML files (crew, missions, notes)
│   └── galaxy/                  # Galaxy hierarchy (nested directories)
│       ├── star_map.yaml        # 3D star map visualization
│       └── {system_slug}/       # Solar System (e.g., sol, kepler-442)
│           ├── location.yaml
│           ├── system_map.yaml
│           └── {body_slug}/     # Planet/Moon
│               ├── location.yaml
│               ├── orbit_map.yaml
│               └── {facility_slug}/  # Station/Base/Ship
│                   ├── location.yaml
│                   ├── map/          # Facility map (yaml + png)
│                   ├── comms/        # Communication terminals
│                   └── {deck_slug}/  # Deck/Level (can nest rooms)
├── src/                         # React TypeScript frontend
│   ├── entries/                 # Entry points (GMConsole, SharedConsole, PlayerConsole)
│   ├── components/
│   │   ├── domain/              # Dashboard, maps, encounter, charon, terminal
│   │   ├── gm/                  # GM Console components
│   │   ├── layout/              # Layout components
│   │   └── ui/                  # Reusable UI components
│   ├── services/                # API client services
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript type definitions
│   └── styles/                  # Global CSS styles
├── scripts/                     # Utility scripts
├── mothership_gm/               # Django project settings
├── terminal/                    # Main Django app
│   ├── models.py                # Message, ActiveView
│   ├── views.py                 # API endpoints and template views
│   ├── data_loader.py           # File-based data loading
│   └── templates/               # HTML template wrappers
└── vite.config.ts               # Vite build configuration
```

## Multi-View Terminal System

The application supports multiple view types displayed on a shared terminal:

| View Type | Description |
|-----------|-------------|
| `STANDBY` | Default idle state with animated text |
| `BRIDGE` | Ship bridge view with galaxy map and status panels |
| `MESSAGES` | Traditional broadcast message system |
| `COMM_TERMINAL` | NPC terminal message logs with inbox/sent |
| `ENCOUNTER` | Tactical maps for combat scenarios |
| `SHIP_DASHBOARD` | Ship status and systems display |
| `CHARON_TERMINAL` | Interactive AI terminal interface |

**Key Design Decisions:**
- File-based data storage (markdown with YAML frontmatter)
- Nested directory hierarchy for locations (unlimited depth)
- On-demand loading from disk (no DB sync required)
- ActiveView singleton tracks current display state
- Auto-refresh terminal polls every 2 seconds

## Data Models

### Database Models

**ActiveView** (Singleton) - Tracks which view the shared terminal is displaying:
```python
class ActiveView(models.Model):
    location_slug = CharField       # e.g., "research_base_alpha"
    view_type = CharField           # STANDBY, BRIDGE, ENCOUNTER, etc.
    view_slug = CharField           # e.g., "commanders_terminal"
    overlay_location_slug = CharField
    overlay_terminal_slug = CharField
    charon_mode = CharField         # DISPLAY, QUERY
    encounter_level = IntegerField
    encounter_room_visibility = JSONField
```

**Message** - Broadcast messages sent by GM:
```python
class Message(models.Model):
    sender = CharField              # e.g., "CHARON"
    content = TextField
    priority = CharField            # LOW, NORMAL, HIGH, CRITICAL
    created_at = DateTimeField
```

### File-Based Data

Campaign data stored in `data/` directory:
- **Locations**: Nested directory hierarchy (Systems → Planets → Facilities → Decks → Rooms)
- **Maps**: Star maps, system maps, orbit maps, encounter maps (YAML format)
- **Terminals**: Communication terminals with inbox/sent message folders
- **Messages**: Markdown files with YAML frontmatter

**Read: DATA_DIRECTORY_GUIDE.md** for complete documentation.

### Data Access Pattern

```python
from terminal.data_loader import DataLoader

loader = DataLoader()
all_locations = loader.load_all_locations()
location = loader.find_location_by_slug('research_base_alpha')
star_map = loader.load_star_map()
```

# User Interfaces

## GM Console (`/gmconsole/`)

**Tree View Interface:**
- Hierarchical tree of all locations (unlimited nesting depth)
- Triangle icons (▶/▼) to expand/collapse locations
- Eye icon DISPLAY button - shows location map on terminal
- Play icon SHOW button - sets terminal overlay without clearing main display
- LocalStorage persistence for expanded/collapsed state

## Terminal Display (`/terminal/`)

**Auto-switching Display:**
- Polls `/api/active-view/` every 2 seconds
- Automatically reloads when GM changes view
- Displays appropriate view based on `view_type`

## API Endpoints

### `/api/active-view/` (Public)
```json
{
  "location_slug": "uscss_morrigan",
  "view_type": "ENCOUNTER",
  "encounter_level": 1,
  "encounter_room_visibility": {},
  "updated_at": "2025-11-09 06:20:31"
}
```

### `/api/messages/` (Public)
```json
{
  "messages": [
    {"id": 5, "sender": "CHARON", "content": "System status: nominal", "priority": "NORMAL"}
  ],
  "count": 1
}
```

# UI Design System

**Read: STYLE_GUIDE.md** for complete UI specifications.

**Quick Reference:**
- **Primary colors**: Teal (#4a6b6b) for structure, Amber (#8b7355) for actions
- **Panels**: Use `DashboardPanel` or `CompactPanel` from `@components/ui/`
- **Chamfer size**: 12px on angular corners
- **Font**: Cascadia Code (monospace)

# Development Practices

## Mothership RPG Guidelines

### Atmosphere & Theme
- Muted multi-color palette inspired by Alien Romulus (2024) - realistic CRT aesthetic
- Write computer messages in-character as ship/station AI systems - terse, technical, sometimes ominous
- Monospaced fonts, angular panels with chamfered corners, subtle CRT scanline effects

### Game Mechanics Integration
- **Stress System**: Prominently display character stress levels (core Mothership mechanic)
- **Stats**: Follow official format (Strength, Speed, Intellect, Combat)
- **Saves**: Sanity Save, Fear Save, Body Save with clear UI indicators

### Player Experience
- Mobile friendly - players access from phones/tablets at the table
- Quick updates that don't interrupt gameplay
- Read-only mode - players see info but can't modify without GM approval

## React/TypeScript Patterns

### Architecture
- **Component Organization**: Domain-driven structure (domain/gm/layout/ui)
- **State Management**: React hooks (useState, useEffect, useCallback, useRef)
- **Custom Hooks**: Shared logic in `src/hooks/`
- **API Services**: Centralized axios-based clients in `src/services/`
- **Type Definitions**: Shared types in `src/types/`

### Three.js Integration
- **Scene Classes**: Standalone TypeScript classes in `src/three/` (GalaxyScene, SystemScene, OrbitScene)
- **React Wrappers**: Components in `src/components/domain/maps/` wrap scenes and manage lifecycle
- **Imperative Management**: Scenes created/disposed via useEffect, methods exposed via useImperativeHandle
- **No React Three Fiber**: Uses vanilla Three.js with direct WebGLRenderer, Scene, Camera management
- **GSAP animations** for smooth camera movements and transitions

### Best Practices
- Use `@/` alias for `src/` directory imports
- Prefer `useCallback` and `useMemo` for performance-critical operations
- Use `useRef` for Three.js scene management and DOM references
- `async/await` for all API calls with proper error handling

# Configuration & Tools

## Authentication

*No authentication currently implemented.*

**Planned roles:**
- **Game Master (GM)**: Full access, can edit content and send messages
- **Players**: View-only access to their character and shared campaign info

## Utility Scripts

Scripts in `scripts/` directory:
- `convert_to_amber_gradient.py` - Convert textures to retro amber gradient
- `convert_npc_portraits.py` - Convert NPC portraits to amber gradient style
- `batch_convert_textures.sh` - Batch convert planet textures

# Planned Features

- [ ] Terminal conversation view renderer
- [ ] Ship dashboard display (different from campaign dashboard)
- [ ] Player character management
- [ ] Session tracking
- [ ] Combat/encounter tracking on maps
- [ ] Sound effects and ambient audio
- [ ] GM tools (NPC generator, random encounters, quick reference tables)
