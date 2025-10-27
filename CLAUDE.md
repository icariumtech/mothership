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
mothership/
├── .claude/                 # Claude Code configuration
│   └── settings.local.json  # Local settings (git-restricted bash)
├── .gitignore              # Comprehensive Python project patterns
├── LICENSE                 # MIT License
└── README.md              # Project documentation
```

## Intended Architecture

This is a Python web application for game masters and players of Mothership RPG. The architecture should support:

### Frontend
- Interactive universe map visualization
- Atmospheric computer terminal-style messaging interface (Aliens CHARON inspired)
- Campaign dashboard for tracking characters, missions, and resources
- Real-time updates for player notifications

### Backend
- **Web Framework**: Django or Flask for serving the application
- RESTful API for game state management
- Database for storing campaigns, characters, ships, locations, and sessions
- WebSocket support for real-time messaging to players

### Key Features to Implement
1. **Player Character Management**: Stats, stress, inventory, conditions
2. **Ship/Base Tracking**: Ship systems, crew, resources, damage
3. **Mission/Quest Log**: Active missions, objectives, completed tasks
4. **Computer Messaging System**: Styled terminal messages with retro-futuristic aesthetic
5. **Universe Map**: Star systems, stations, travel routes, points of interest
6. **Session Notes**: GM notes, important events, NPC tracking
7. **Dice Roller**: Quick reference for Mothership dice mechanics

### Technical Stack
- **Web Framework**: Django and/or Flask applications
- **Package Management**: Support for pip, pipenv, poetry, pdm, and UV
- **Testing Infrastructure**: pytest, tox, nox
- **Type Checking**: mypy, pyre, pytype
- **Linting**: Ruff
- **Frontend**: HTML/CSS/JavaScript (potentially with HTMX for dynamic updates)
- **Database**: SQLite for development, PostgreSQL for production

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

*No data models currently implemented.*

## Planned Data Models for Mothership RPG

The application will need the following core models:

### Campaign Management
- **Campaign**: Campaign name, description, current date/time, active status
- **Session**: Session number, date, notes, GM summary

### Characters & Crew
- **Character**: Name, class, stats (strength, speed, intellect, combat), stress, health, saves, skills, loadout
- **NPC**: Similar to Character but with GM-only notes and relationship tracking

### Ships & Locations
- **Ship**: Name, class, hull points, systems status, crew capacity, cargo
- **Location**: Star system, station, planet, or POI with description and coordinates
- **UniverseMap**: Visual map data, connections between locations, travel times

### Missions & Story
- **Mission**: Title, description, objectives, status, rewards
- **Objective**: Individual mission goals, completion status
- **Event**: Story events, encounters, discoveries with timestamps

### Messaging System
- **Message**: Computer-generated message content, sender (ship/station AI), recipients (players/crew), timestamp, priority level, read status
- **MessageTemplate**: Reusable message formats for common ship/station communications

### Best Practices
- **Django**: Define models in `models.py` with clear field types and relationships
- **Flask**: Use SQLAlchemy ORM for database interactions
- Follow database normalization principles
- Add appropriate indexes for query performance (especially for Campaign and Session lookups)
- Use foreign keys to link Characters to Campaigns, Messages to Recipients, etc.
- Document model relationships and constraints
- Include created_at/updated_at timestamps for audit trails

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
