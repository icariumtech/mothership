# CLAUDE.md

# Documentation Map (load dynamically — only load what you need for your task)

- **README.md** - Project overview, quick start, setup instructions
- **DATA_DIRECTORY_GUIDE.md** - Data directory structure, file formats, YAML schemas
- **src/components/ui/README.md** - Panel component API, usage patterns
- **STYLE_GUIDE.md** - UI design system, color palette, visual specifications
- **src/components/domain/maps/r3f/shared/POST_PROCESSING.md** - Post-processing effects guide

## Codemaps (load dynamically — only load what you need for your task)

- **codemaps/architecture.md** — system architecture, data flow, multi-view terminal, tech stack decisions
- **codemaps/backend.md** — Django models, views, API endpoints, DataLoader, URL routing, JANUS AI
- **codemaps/frontend.md** — React components, R3F scenes, Zustand store, hooks, state management, patterns
- **codemaps/data.md** — data directory structure, YAML schemas, location hierarchy, file formats

# Overview

**janus** — GM tool for Mothership RPG campaigns. Full-stack web app serving as an interactive command center with atmospheric JANUS computer messaging, 3D galaxy maps, and encounter tracking.

**Persona**: Expert full-stack developer. Write efficient, readable code. Create reusable functions, avoid duplication.

**Languages**: Python (Django backend), TypeScript (React frontend)

# Technical Stack

- **Backend**: Django 5.2.7, SQLite (ActiveView + Messages only), file-based YAML/Markdown data, PyYAML
- **Frontend**: React 19 + TypeScript, Vite 5.4, Ant Design 6.1, React Three Fiber 9.0, GSAP 3.14, Axios 1.13
- **Linting**: Ruff (Python), TypeScript compiler

# Quick Reference

```bash
./setup.sh && ./start_server.sh   # Setup + run
pnpm run dev                       # Vite dev server with hot reload
pnpm run build                     # Production build
pnpm run typecheck                 # TypeScript type checking
docker compose up -d               # Run via container (requires .env with SECRET_KEY)
```

**URLs**: GM Console `/gmconsole/` · Terminal `/terminal/` · Admin `/admin/` · API `/api/active-view/` `/api/messages/`

# View Types

| View | Description |
|------|-------------|
| `STANDBY` | Default idle with animated text |
| `BRIDGE` | Tabbed interface: MAP (3D galaxy/system/orbit) + CREW, CONTACTS, NOTES, STATUS |
| `MESSAGES` | Broadcast message system |
| `COMM_TERMINAL` | NPC terminal message logs |
| `ENCOUNTER` | Tactical maps for combat |
| `SHIP_DASHBOARD` | Ship status display |
| `JANUS_TERMINAL` | Interactive AI terminal |

# UI Design System

- **Colors**: Teal `#4a6b6b` (structure), Amber `#8b7355` (actions/highlights)
- **Panels**: Use `DashboardPanel` or `CompactPanel` from `@/components/ui/`
- **Chamfer**: 12px angular corners. **Font**: Cascadia Code (monospace)
- **Import alias**: `@/` → `src/`
- See **STYLE_GUIDE.md** for complete specifications

# Mothership RPG Guidelines

- Muted multi-color CRT aesthetic inspired by Alien Romulus (2024)
- Computer messages: terse, technical, in-character as ship/station AI — sometimes ominous
- Mobile friendly — players use phones/tablets at the table
- Stress system prominent; stats: Strength/Speed/Intellect/Combat; saves: Sanity/Fear/Body
- Players: read-only access (no modifying without GM approval)
