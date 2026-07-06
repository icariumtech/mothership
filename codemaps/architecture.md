# Architecture Overview

**Last Updated**: 2026-07-02

## System Architecture

**janus** is a full-stack GM tool for Mothership RPG campaigns: a multi-view
shared terminal (players watch on phones/tablets and a table display) driven
live by a GM console, with 3D galaxy maps, tactical encounter maps, an
in-fiction AI (JANUS), and an AI-agent-editable data layer.

```
GM Console (React) ──POST──▶ Django views
                              └▶ sync_state(): active_view_store (JSON file)
                                   └▶ PayloadBuilder → SSE broadcast
Shared Console (React) ◀──SSE (activeview / shipstatus / data-changed)──┘
Campaign content: data/ YAML + Markdown (no DB) ◀── DataLoader
AI agents / MCP: mcp_server.py ──HTTP──▶ /api/gm/data/... file CRUD
```

## Technology Stack

- **Backend**: Django 5.2.7 (single `core` app), PyYAML, SQLite only for the
  `Message` model + auth. Runtime view state is a file-persisted module store
  (`core/active_view_store.py` → `var/active_view.json`), **not** a DB model.
  Gunicorn pinned to `workers=1` (in-memory SSE listeners + JANUS sessions).
- **Frontend**: React 19 + TypeScript 5.9, Vite 5.4, Ant Design 6, React Three
  Fiber 9 + drei + postprocessing, GSAP 3.14, Zustand 5, Axios,
  @monaco-editor/react (GM file editor).
- **Real-time**: Server-Sent Events (`/api/active-view/stream/`), with a slow
  polling fallback in the player console. Not WebSockets.
- **Testing**: Django TestCase (`manage.py test core`), vitest (pure-logic
  units). TypeScript + Ruff for linting.

## View State Flow (the core loop)

1. GM acts in GM console → POST to a `/api/gm/...` endpoint
2. View calls `sync_state(**changes)` (core/views/active_view.py)
3. Store updates + persists atomically to `var/active_view.json`
4. `PayloadBuilder.build(state)` enriches (NPCs, deckplan, location data)
5. `sse_broadcaster` pushes `activeview` event to every connected client
6. SharedConsole + GMConsole apply the payload (GM sees a green dot for the
   players' current view)

Data-file edits (by GM editor or AI agents via MCP) broadcast `data-changed`
and invalidate the payload/JANUS caches.

## Multi-View Terminal System

| View Type | Purpose | Data Source |
|-----------|---------|-------------|
| `STANDBY` | Idle animation (+ doc/portrait overlays) | Static |
| `BRIDGE` | Tabbed dashboard: MAP (3D galaxy/system/orbit), STATUS (ship systems), PERSONNEL, LOGS, JANUS | star/system/orbit_map.yaml, ship.yaml, campaign data |
| `MESSAGES` | Broadcast messages | SQLite Message model |
| `COMM_TERMINAL` | NPC terminal message logs | data comms/ dirs |
| `ENCOUNTER` | Tactical deck maps (rooms/doors/vents/tokens) | deckplan.yaml + store state |
| `SHIP_DASHBOARD` | Ship status display | ship.yaml |
| `JANUS_TERMINAL` | Interactive AI terminal | LocMemCache sessions + Claude API |

## Data Storage Strategy

- **File-based campaign data** (`data/`): galaxy hierarchy
  (`data/galaxy/{system}/{body}/{site}/location.yaml`), ships
  (`data/ships/*/deckplan.yaml` — single-file deckplan format; legacy `map/`
  dirs are gone), campaign (`crew/`, `npcs/`, `ship/ship.yaml`, sessions,
  docs), JANUS context (`data/janus/context.yaml`, per-location `janus.yaml`).
  Canonical schema docs: `docs/schemas/` (synced to janus-skills).
- **Runtime state**: `var/active_view.json` (atomic writes, threadsafe).
- **SQLite**: broadcast messages + Django auth only.
- **Rationale**: git-friendly, AI-agent-editable (MCP file CRUD with path
  guards + YAML validation), no migrations for content changes.

## AI Integration (two directions)

1. **JANUS (in-fiction)**: player/GM queries → JanusController → Claude API
   with location lore → responses queue for GM approval before players see
   them. Channels: story / bridge / encounter-<slug>.
2. **AI agents (out-of-fiction)**: `mcp_server.py` exposes read/write/patch/
   map-edit tools proxying `/api/gm/data/...` so a Claude agent can edit
   campaign YAML live during prep; edits broadcast `data-changed` to consoles.

## Performance Notes

- R3F: render-on-demand when tab inactive, procedural textures memoized,
  single RAF loop coordinates GSAP camera moves + typewriter.
- PayloadBuilder caches NPC + ship-deck reads (30s TTL, invalidated on edits);
  DataLoader caches `load_all_locations()` on the instance (deep-copied per
  call, invalidated on any data-file write) so multiple calls per broadcast
  hit the cache instead of re-walking disk.
- Encounter maps are plain SVG (no canvas/WebGL); token drags throttle
  through `encounter_state` mutations.
