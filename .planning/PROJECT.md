# Mothership GM Terminal

## What This Is

A retro-futuristic game master tool for running Mothership RPG campaigns. Full-stack web app (Django + React/TypeScript) that serves as an interactive command center with atmospheric CRT-styled interfaces, 3D galaxy maps, grid-based encounter maps with token tracking, CHARON AI terminal, NPC portrait overlays, real-time SSE state push, and a structured campaign data system.

## Core Value

Give the GM a single tool that enhances the tabletop experience with atmospheric digital interfaces — maps, messaging, and information displays — without interrupting gameplay flow.

## Current State

**Shipped:** v1.0 MVP (2026-05-07) · v2.0 AI Tooling (2026-06-12) · **Active:** between milestones (Phase 30 shipped ad-interim; Phase 29 context gathered)

- 30 phases complete (Phase 29 pending) · v2.0 archived 2026-06-12
- ~40k LOC first-party source (TypeScript + Python) + standalone `janus-skills` repo (10 Claude Code skills, schema resources, install.sh)
- Tech stack: Django 5.2.7, React 19, TypeScript, Vite 5.4, React Three Fiber 9.0, Zustand, GSAP, Ant Design 6.1
- Data: YAML/Markdown files, flat location directory, per-entity character files
- Deployed: Docker image on GHCR, docker-compose homelab deploy (icarium), MCP server on port 8001

Key systems shipped in v2.0:
- Encounter renderer deepening — four-module geometry stack, canonical Door model, reveal-cascade scheduler, interaction hooks; Vitest infrastructure
- Containerization — multi-stage Docker image, external data mount, GHCR CI publish
- JANUS MCP server (FastMCP HTTP) — campaign read/write tools delegating to Django REST, plus image upload and targeted map-element editing (Phase 30)
- janus-skills repo — Claude Code skills for AI-driven campaign data management
- Map playback controls (Chronoscope) + map polish on 3D views
- GM Console file editor — Monaco-based data-directory editing with `data-changed` SSE auto-refresh on player terminals

Key systems shipped in v1.0:
- Grid-based encounter maps with wall-segment rendering and room reveal
- GM Console redesigned as view-driven architecture (ViewRail/ToolRail/SlideOutPanel)
- Real-time SSE push replacing 2s polling; ActiveView in-memory store
- Atmospheric CRT animations across all player-facing transitions
- Ship STATUS tab with dual terminal panels, reactor, and consumable resource tracking
- Encounter token system (placement, movement, status indicators)
- NPC portrait overlays on player terminal
- Flat location hierarchy with orbit map self-registration

## Requirements

### Validated

- ✓ Multi-view terminal system (STANDBY, BRIDGE, MESSAGES, COMM_TERMINAL, ENCOUNTER, SHIP_DASHBOARD, CHARON_TERMINAL) — existing
- ✓ 3D galaxy map with star systems, nebulae, and travel routes (React Three Fiber) — existing
- ✓ 3D system map with orbiting planets, drill-down navigation — existing
- ✓ 3D orbit map with moons, orbital stations, surface markers — existing
- ✓ CHARON AI terminal with typewriter effect, inline query input — existing
- ✓ Broadcast messaging system with priority levels (LOW/NORMAL/HIGH/CRITICAL) — existing
- ✓ Communication terminals with inbox/sent, central message store — existing
- ✓ Bridge view with tabbed interface (MAP, LOGS, STATUS, CREW, CONTACTS) — existing + v1.0
- ✓ Personnel tab with crew roster and NPC directory — existing
- ✓ Retro CRT aesthetic (teal/amber palette, chamfered panels, scanline effects) — existing
- ✓ Network access for players on local network — existing
- ✓ Campaign LOGS tab — session logs with Markdown rendering — v1.0
- ✓ Ship STATUS tab — dual terminal panels over deck map, reactor + resource tracking — v1.0
- ✓ Encounter tokens — GM placement/movement, type/status indicators, SSE live updates — v1.0
- ✓ NPC portrait overlays — typewriter reveal, multi-portrait, fade-in — v1.0 (player terminal)
- ✓ Real-time SSE architecture — in-memory ActiveView store, named events, instant push — v1.0
- ✓ Grid-based encounter maps — wall-segment renderer, doors, room reveal, scanline texture — v1.0
- ✓ GM Console redesign — ViewRail/ToolRail/SlideOutPanel, full-screen maps, DISPLAY button — v1.0
- ✓ Atmospheric CRT animations — glitch transitions, overlay entrances, room reveal flicker, bridge stagger — v1.0
- ✓ Player ship deck map in BRIDGE mode + GM set-ship-location — v1.0
- ✓ Flat location hierarchy with orbit map self-registration — v1.0
- ✓ Per-entity character files (crew + NPCs) — v1.0
- ✓ DATA_DIRECTORY_GUIDE.md — documented data structure — v1.0
- ✓ Encounter renderer deepening — geometry modules, canonical Door model, reveal scheduler, interaction hooks, Vitest — v2.0
- ✓ Containerized deployment — Docker image on GHCR, external data mount, compose deploy — v2.0
- ✓ JANUS MCP server — AI read/write access to campaign YAML over HTTP — v2.0
- ✓ janus-skills — Claude Code skill library for campaign data management — v2.0
- ✓ Map playback controls (Chronoscope) + map polish — v2.0
- ✓ MCP image upload — portraits/logos/maps with conversion — v2.0
- ✓ GM Console file editor — Monaco editor + data-changed SSE refresh — v2.0
- ✓ AI targeted map editing — element resolver + find/edit_map_element MCP tools — post-v2.0 (Phase 30)

### Active

- [ ] UI audio — click sounds, transition effects, ambient atmosphere (AUDI-01..03, deferred from v1.0)
- [ ] Interactive deckplan map editor — live preview, YAML sync, POI placement (Phase 29, context gathered 2026-06-05)

### Out of Scope

- Mobile native app — web-first, mobile responsive is enough
- Player character sheet editing — read-only for now
- Player-controlled token movement — GM-controlled paradigm; Mothership is theater-of-mind
- Animated token movement — unnecessary visual complexity for CRT aesthetic
- AI-generated NPC portraits — GM curates portrait assets

## Context

- Developed collaboratively between GM and Claude Code
- Tech stack: Django 5.2.7, React 19, TypeScript, Vite 5.4, React Three Fiber 9.0, Zustand, GSAP, Ant Design 6.1
- Data stored as YAML + Markdown files in structured directory hierarchy (git-friendly)
- SQLite stores only broadcast Messages (persistent); all ephemeral GM state in in-memory ActiveView store
- Campaign data: `data/` directory — `data/galaxy/` for celestial bodies, `data/locations/` for non-celestial, `data/campaign/` for session/crew/NPC files
- Codebase map exists at `.planning/codebase/`
- UI follows Alien Romulus (2024) aesthetic — muted multi-color palette, monospaced fonts, angular panels
- Players access from phones/tablets at the gaming table
- SSE broadcaster uses named events: `activeview`, `shipstatus`, `bridge` — each with dedicated `useSSE` listeners

## Constraints

- **Tech stack**: Must stay Django + React/TypeScript + R3F — significant existing investment
- **File-based data**: Campaign data must remain YAML/Markdown files, not migrated to DB
- **CRT aesthetic**: All new UI must follow the established teal/amber design system (STYLE_GUIDE.md)
- **Performance**: 3D scenes must maintain smooth framerates; new features should not compete with RAF loop
- **Mobile-friendly**: All player-facing views must work on phones/tablets

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| File-based data over DB | Git-friendly, no sync required, easy to edit manually | ✓ Good |
| React Three Fiber over imperative Three.js | Declarative, less code, unified RAF loop | ✓ Good |
| Zustand for 3D scene state | Single source of truth, no prop drilling, performant selectors | ✓ Good |
| SSE over WebSockets | Named-event fan-out, simpler than WS, sufficient for tabletop pace | ✓ Good |
| In-memory ActiveView store | Eliminates DB write bottleneck; ephemeral state doesn't need persistence | ✓ Good |
| Wall-segment algorithm for grid maps | Edge-count exclusion naturally handles L/T/U shapes; no explicit interior-edge config | ✓ Good |
| View-driven GM Console (GMViewType local state) | DISPLAY button is the only action that reaches server; no API chatter | ✓ Good |
| Flat location directory | Self-registration into orbit maps eliminates galaxy tree traversal | ✓ Good |
| Per-entity character files | Glob-based loading; better for manual editing and AI token cost | ✓ Good |
| Ant Design for layout/forms | Rapid development, consistent components | ✓ Good |
| PORT-03 design revert | NPCPortraitOverlay not needed on GM screen; toggle controls in NPC Portraits panel are sufficient | ✓ Accepted |
| api_bridge_selection intentionally public | Player terminal is the caller; player auth not yet implemented; ephemeral write-only, low risk | ✓ Accepted |
| MCP server delegates to Django REST (no direct file access) | Single write path with traversal guard + atomic YAML write; SSE broadcast for free | ✓ Good |
| janus-skills as standalone repo with symlink installer | Skills versioned independently; schema docs synced from main repo via CI | ✓ Good |
| Monaco editor for GM file editing | Full YAML/MD editing in browser; eliminates SSH round-trips during play | ✓ Good |
| Generic `data-changed` SSE event | One event covers all AI/GM data writes; player terminals re-fetch active view | ✓ Good |
| Targeted map-element edit endpoint (resolver + verbs) | AI edits one room/door/POI without rewriting deckplan.yaml; 404/409 return suggestions instead of failing | ✓ Good |
| Phase 26 shipped ad-hoc without plans | Small polish pass; formal planning overhead not justified | ✓ Accepted |

---
*Last updated: 2026-06-12 after v2.0 milestone (AI Tooling) archived*
