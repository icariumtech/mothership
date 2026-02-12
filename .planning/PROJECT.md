# Mothership GM Terminal

## What This Is

A retro-futuristic game master tool for running Mothership RPG campaigns. Full-stack web app (Django + React/TypeScript) that serves as an interactive command center with atmospheric CRT-styled interfaces, 3D galaxy maps, encounter maps, CHARON AI terminal, and a messaging system. Players connect from phones/tablets on the local network.

## Core Value

Give the GM a single tool that enhances the tabletop experience with atmospheric digital interfaces — maps, messaging, and information displays — without interrupting gameplay flow.

## Requirements

### Validated

- ✓ Multi-view terminal system (STANDBY, BRIDGE, MESSAGES, COMM_TERMINAL, ENCOUNTER, SHIP_DASHBOARD, CHARON_TERMINAL) — existing
- ✓ 3D galaxy map with star systems, nebulae, and travel routes (React Three Fiber) — existing
- ✓ 3D system map with orbiting planets, drill-down navigation — existing
- ✓ 3D orbit map with moons, orbital stations, surface markers — existing
- ✓ Encounter maps with rooms, doors, connections, POIs, multi-deck support — existing
- ✓ CHARON AI terminal with typewriter effect, inline query input — existing
- ✓ Broadcast messaging system with priority levels (LOW/NORMAL/HIGH/CRITICAL) — existing
- ✓ Communication terminals with inbox/sent, central message store — existing
- ✓ GM Console with hierarchical location tree, DISPLAY/SHOW controls — existing
- ✓ File-based campaign data (YAML + Markdown, nested directory hierarchy) — existing
- ✓ Bridge view with tabbed interface and MAP tab functional — existing
- ✓ Personnel tab with crew roster and NPC directory — existing
- ✓ Retro CRT aesthetic (teal/amber palette, chamfered panels, scanline effects) — existing
- ✓ Network access for players on local network — existing
- ✓ Selection reticle with animated indicators for 3D objects — existing
- ✓ RAF-driven typewriter effect synchronized with 3D scene — existing
- ✓ Camera transition system with GSAP easing — existing

### Active

- [ ] Bridge tab: LOGS — campaign logs and session notes (rename existing NOTES tab)
- [ ] Bridge tab: STATUS — ship status, systems, and resource tracking (repurpose existing STATUS tab placeholder)
- [ ] Encounter tokens — movable tokens on encounter maps for players, NPCs, and creatures
- [ ] NPC portrait display — show NPC portraits during encounter interactions
- [ ] UI audio — click sounds, transition effects, ambient atmosphere for immersion
- [ ] Real-time architecture — replace polling/SQLite with push-based cross-client state (SSE or WebSockets), move ephemeral state (ActiveView) out of DB, keep DB for persistent data (Messages) and future auth/credentials

### Out of Scope

- Mobile native app — web-first, mobile responsive is enough
- Player character sheet editing — read-only for now

## Context

- Developed collaboratively between GM and Claude Code
- Tech stack: Django 5.2.7, React 19, TypeScript, Vite 5.4, React Three Fiber 9.0, Zustand, GSAP, Ant Design 6.1
- Data stored as YAML + Markdown files in nested directory hierarchy (git-friendly)
- SQLite currently stores ActiveView singleton and broadcast Messages (architecture under review)
- Codebase map exists at `.planning/codebase/`
- UI follows Alien Romulus (2024) aesthetic — muted multi-color palette, monospaced fonts, angular panels
- Players access from phones/tablets at the gaming table
- Bridge view currently has MAP and PERSONNEL tabs functional; NOTES and STATUS tabs are placeholders

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
| Polling over WebSockets | Simpler architecture, 2s interval sufficient for tabletop pace | ⟳ Revisiting — exploring SSE/WebSocket push model |
| Ant Design for layout/forms | Rapid development, consistent components | — Pending |

---
*Last updated: 2026-02-11 — added UI audio requirement, real-time architecture exploration*
