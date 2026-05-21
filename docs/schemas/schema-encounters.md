# Encounter / Deckplan Schema Reference

All MCP paths are relative to `data/`. Slash convention: forward-slash only, no leading slash.

---

## Purpose

Deckplan YAML describes grid-based interior maps used by `EncounterMapDisplay`. Optional for
any location. When present, the GM Console renders a tactical encounter map with rooms, doors,
and POIs. A single `deckplan.yaml` holds all decks for a location.

---

## MCP Path Conventions

Deckplans live under the location they describe:

| Location type | MCP path |
|---|---|
| Mobile ship | `ships/<ship-slug>/deckplan.yaml` |
| Galaxy location | `galaxy/<system>/<body>/<slug>/deckplan.yaml` |
| Player ship | `campaign/ship/deckplan.yaml` |

Legacy format (old locations): `galaxy/<system>/<body>/map/manifest.yaml` + individual deck files.
New format: single `deckplan.yaml` with a `decks:` list. Skills should write new format only.

MCP write: `write_file("ships/patrol_gunboat/deckplan.yaml", content)`

---

## Top-level Fields

| Field | Type | Required | Note |
|---|---|---|---|
| `hull` | mapping | no | Hull outline: `polygon: [[x,y],...]` in grid cells |
| `decks` | list | yes | List of deck entries |

### Deck entry fields

| Field | Type | Required | Note |
|---|---|---|---|
| `id` | string | yes | Unique deck identifier |
| `name` | string | yes | Display name |
| `level` | integer | yes | Sort key — 1 = lowest deck |
| `default` | boolean | no | First deck shown on load |
| `unit_size` | integer | no | Pixels per grid cell (default 30) |
| `rooms` | list | yes | List of room entries (see GridRoom fields) |
| `doors` | list | no | Top-level door definitions (see Door fields) |

---

## GridRoom Fields

Each room entry in the `rooms:` list.

| Field | Type | Required | Note |
|---|---|---|---|
| `id` | string | yes | Unique within this deck |
| `name` | string | no | Display label — empty string suppresses label |
| `type` | string | no | `"corridor"` skips label rendering |
| `rects` | list | shape | Rectangle(s) — see rect fields |
| `polygon` | list | shape | Freeform vertices: `[[x,y], ...]` in grid cells |
| `circle` | mapping | shape | Circular room: `{cx, cy, r}` in grid cells |
| `poi` | list | no | Points of interest (see POI fields) |

Exactly one of `rects`, `polygon`, or `circle` must be present (shape field).

### Rect entry fields

| Field | Type | Note |
|---|---|---|
| `x` | float | Top-left cell, 0-based |
| `y` | float | Top-left cell, 0-based |
| `w` | float | Width in grid cells |
| `h` | float | Height in grid cells |
| `chamfer` | float | Optional — diagonal corner cut in grid-cell units |

### Circle entry fields

| Field | Type | Note |
|---|---|---|
| `cx` | float | Center X in grid cells |
| `cy` | float | Center Y in grid cells |
| `r` | float | Radius in grid cells |

---

## Door Fields

Doors are a **top-level `doors:` array on the deck** (same indent level as `rooms:`).
Each door names the two rooms it connects.

Two authored forms are supported:

### B-rel (relational form — preferred)

| Field | Type | Required | Note |
|---|---|---|---|
| `rooms` | list | yes | Two room ids sharing an edge; one-element list = exterior door |
| `along` | float | no | Fraction 0..1 along shared edge (default 0.5 = centre) |
| `width` | float | no | Door width in grid cells (default 1) |
| `type` | enum | no | `standard \| blast_door \| airlock \| emergency \| open` |
| `status` | enum | no | `OPEN \| CLOSED \| LOCKED \| SEALED \| DAMAGED \| BROKEN` |
| `id` | string | no | Explicit stable id; auto-derived if omitted |

### B-pos (position-override form)

Use when two rooms share multiple disjoint edges, or for polygon/circle rooms where
the relational form is ambiguous.

| Field | Type | Required | Note |
|---|---|---|---|
| `rooms` | list | yes | Two room ids (or one for exterior) |
| `position` | mapping | yes | `{x, y, angle}` — door center in grid coords |
| `type` | enum | no | Same enum as B-rel |
| `status` | enum | no | Same enum as B-rel |

**Position fields:**

| Field | Note |
|---|---|
| `x` | Door center X in grid cells |
| `y` | Door center Y in grid cells |
| `angle` | `0` = horizontal slot (N/S wall), `90` = vertical slot (E/W wall) |

**Door id format:** Auto-derived as `${room.id}_door_${index}` when no explicit `id:` is given.
Explicit `id:` is recommended for stable runtime door-state references.

**Door status enum:** `OPEN | CLOSED | LOCKED | SEALED | DAMAGED | BROKEN`

> `BROKEN` is a legacy alias for `DAMAGED` preserved from pre-Phase 21 maps. Use `DAMAGED` for new maps.

---

## POI Fields

POIs are entries in a room's `poi:` list.

| Field | Type | Required | Note |
|---|---|---|---|
| `icon` | string | yes | Lowercase name matching SVG filename prefix (see icons below) |
| `label` | string | no | Display label |

### Available POI icon names

`ai`, `airlock`, `armory`, `automed`, `cabin`, `cargo`, `command`, `cryo`, `docking bay`,
`door`, `duct access`, `elevator`, `elevator to bottom`, `elevator to top`, `emergency capsule`,
`exit`, `fuel`, `galley`, `intercom`, `jumpdrive`, `lab`, `ladder`, `ladder bottom`,
`ladder top`, `laser`, `medbay`, `ramp`, `reactor core`, `sensors`, `shower`, `supplies`,
`toilet`, `toilets 2`, `vac suit`, `vault`, `ventillation`, `weapon system`, `workshop`, `empty`, `0`

> Note: `ventillation` has double-L — matches the source SVG filename exactly.

---

## Corridor Fields

Corridors are rooms with `type: corridor`. Define them in the `rooms:` array:

| Field | Type | Note |
|---|---|---|
| `id` | string | Auto-generated `corridor_N` allowed (from svg_to_map.py output) |
| `rects` | list | Same rect format as GridRoom |
| `type` | string | Set to `"corridor"` to suppress label |

Doors connecting corridors to other rooms are defined in the top-level `doors:` array.

---

## Tooling Note

`tools/svg_to_map.py` (in the charon repo) generates deckplan YAML files from Inkscape SVGs.
Key flags: `--detect-doors` (outputs B-pos door entries from shared SVG edges),
`--grid-scale N` (groups N Inkscape grid cells into 1 output cell),
`--unit-size N` (pixels per output cell, default 30).

Skills do NOT run this tool — it is a manual GM workflow for converting hand-drawn maps.

---

## Example

Two-room deckplan with one connecting door:

```yaml
decks:
  - id: main_deck
    name: Main Deck
    level: 1
    default: true
    unit_size: 30
    rooms:
      - id: bridge
        name: "BRIDGE"
        rects:
          - { x: 1, y: 0, w: 5, h: 3 }

      - id: airlock
        name: "AIRLOCK"
        rects:
          - { x: 6, y: 0, w: 2, h: 3 }
        poi:
          - icon: airlock
            label: "Airlock"

    doors:
      - rooms: [bridge, airlock]
        along: 0.5
        type: standard
        status: CLOSED
```
