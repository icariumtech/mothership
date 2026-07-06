# Data Architecture

**Last Updated**: 2026-07-02

> Field-level YAML schemas are NOT duplicated here — the canonical, maintained
> references live in **`docs/schemas/`** (schema-galaxy, schema-ships,
> schema-encounters, schema-campaign, schema-janus-context). This file covers
> layout, storage strategy, and loading flow only.

## Storage Strategy

- **File-based (YAML + Markdown)**: all campaign content under `data/`.
  Git-friendly, editable live by the GM file editor and by AI agents through
  the MCP `/api/gm/data/...` CRUD API (path-guarded, YAML-validated,
  atomic writes, `data-changed` SSE on every edit).
- **Runtime view state**: `var/active_view.json` via `core/active_view_store.py`
  (threadsafe module store, atomic writes). **There is no ActiveView DB table.**
- **SQLite**: only the `Message` broadcast model + Django auth.

## Directory Structure

```
data/
├── campaign/
│   ├── crew/                  # One YAML per crew member (stats, saves, stress)
│   ├── npcs/                  # One YAML per NPC (portrait, met flag)
│   ├── ship/ship.yaml         # Player ship: systems, integrity, resources,
│   │                          #   cargo, stats, power — read/written by
│   │                          #   ship endpoints (locked atomic writes)
│   ├── ship/deckplan.yaml     # Player ship deckplan
│   ├── sessions/*.md          # Session logs (frontmatter + markdown)
│   └── docs/*.md              # Campaign documents (shown via overlay)
│
├── janus/context.yaml         # Global JANUS AI config + fallback responses
│
├── ships/{ship_slug}/         # Mobile ships (injected into galaxy tree)
│   ├── location.yaml
│   ├── deckplan.yaml          # ★ Single-file deckplan (decks/rooms/doors/
│   │                          #   vents/poi/terminals/hull). The legacy
│   │                          #   map/ + manifest.yaml format is REMOVED.
│   └── comms/{terminal}/      # Terminal + messages
│
└── galaxy/
    ├── star_map.yaml          # Galaxy 3D visualization
    └── {system}/
        ├── location.yaml
        ├── system_map.yaml
        ├── janus.yaml         # Optional per-location JANUS lore
        └── {body}/
            ├── location.yaml
            ├── orbit_map.yaml
            └── {site}/        # Station/base/ship — unlimited nesting
                ├── location.yaml
                ├── deckplan.yaml
                ├── janus.yaml
                └── comms/
                    ├── messages/*.md       # Central store (frontmatter:
                    │                       #   from/to/subject/timestamp/...)
                    └── {terminal}/terminal.yaml
```

## Key Formats (pointers)

- **deckplan.yaml** → `docs/schemas/schema-encounters.md`. Rooms are
  `rects` (optional, w/ chamfer) / `circle` / `polygon` (+holes); doors are a
  top-level `doors:` array (explicit x/y/angle format preferred); `vents:`,
  `poi:` (icon names from Open Spacecraft Icons), `hull:` polygon.
- **location.yaml, star/system/orbit_map.yaml** → `schema-galaxy.md` /
  `schema-ships.md`.
- **crew / npcs / ship.yaml / sessions / docs** → `schema-campaign.md`.
- **janus.yaml / context.yaml** → `schema-janus-context.md`.

## Loading Flow

```
DataLoader (core/data_loader.py, get_loader() singleton)
├── load_all_locations(): walk data/galaxy/ recursively, inject data/ships/*
│     and the campaign ship into the tree. Re-reads disk every call.
├── load_deckplan(dir): deckplan.yaml → {decks (level-sorted), hull, total_decks}
├── load_star_map / load_system_map / load_orbit_map: augment YAML with
│     has_*_map flags and facility counts
├── Terminals: central comms/messages/*.md filtered by owner into inbox/sent
│     (legacy per-terminal inbox|sent/ dirs still supported)
└── Ship: load_ship_status / save_ship_* (locked + atomic via _mutate_ship_yaml)
```

Enrichment/caching happens in `PayloadBuilder` (NPCs + ship deck, 30s TTL,
invalidated on gm_data edits) — not in DataLoader.

## Conventions

- Slugs: lowercase-hyphenated, unique among siblings; directory name = slug.
- Deployed data dir: `ssh gjohnson@icarium` → `/opt/stacks/janus/data`
  (see CLAUDE.md).
- Tooling: `tools/svg_to_map.py` converts Inkscape SVGs (Hull/Rooms/Corridors
  layers) into deckplan decks (`--grid-scale` matters for fine grids).
- Validation: `yaml.safe_load` everywhere; gm_data write path validates YAML
  and markdown frontmatter before writing; some legacy loaders still lack
  guards (a malformed file can raise into the SSE path).
