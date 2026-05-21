# Ship Schema Reference

All MCP paths are relative to `data/`. Slash convention: forward-slash only, no leading slash.

---

## MCP Path Conventions

| File | MCP Path |
|---|---|
| Mobile ship location | `ships/<ship-slug>/location.yaml` |
| Ship deckplan | `ships/<ship-slug>/deckplan.yaml` |
| Deck within ship | `ships/<ship-slug>/<deck-name>/location.yaml` (optional) |
| Ship map directory | `ships/<ship-slug>/map/` |
| Player ship location | `campaign/ship/location.yaml` |
| Player ship identity | `campaign/ship/ship.yaml` |
| Player ship deckplan | `campaign/ship/deckplan.yaml` |

MCP read:  `read_file("ships/patrol_gunboat/location.yaml")`
MCP list:  `list_files("ships")`

---

## Slug-Pointer Model

Ships live under `data/ships/` — they are NOT nested under a galaxy body.
Instead, each ship's `location.yaml` contains `system_slug` and `body_slug` pointer fields
that tell the data loader where to inject the ship in the galaxy tree.

The data loader:
1. Loads `orbit_map.yaml` (moons only) for the target planet.
2. Scans the planet's direct children (permanent installations).
3. Scans `data/ships/` for ships whose `body_slug` matches this planet.
4. Merges all three into the final orbit map response.

**To move a ship:** Edit only its `location.yaml` pointer fields — no directory move required.

---

## location.yaml (mobile ship — orbit-injected)

Located at `data/ships/<ship-slug>/location.yaml`.

| Field | Type | Required | Note |
|---|---|---|---|
| `name` | string | yes | Display name |
| `type` | string | yes | Must be `"ship"` |
| `description` | string | no | Narrative description |
| `status` | enum | no | `OPERATIONAL \| ACTIVE \| INACTIVE \| UNKNOWN` |
| `parent_type` | enum | yes (orbit) | `orbit \| surface` — determines injection category |
| `body_slug` | string | yes (orbit) | Lowercase-hyphenated, exact match to planet directory |
| `system_slug` | string | yes (orbit) | Exact match to system directory name |
| `orbital` | mapping | no | Orbit map visualization block (see below) |

Without an `orbital:` block the ship is loaded into the tree but does NOT appear as an
orbiting object on the orbit map.

### `orbital` block

| Field | Type | Note |
|---|---|---|
| `radius` | float | Distance from planet centre (arbitrary units) |
| `period` | float | Animation period (higher = slower) |
| `angle` | float | Starting angle in degrees |
| `inclination` | float | Orbital plane tilt in degrees |
| `size` | float | Icon size |
| `icon_type` | enum | `ship \| station \| shipyard` |

---

## location.yaml (player ship — `campaign/ship/`)

Minimal required fields for the campaign player ship:

| Field | Type | Note |
|---|---|---|
| `name` | string | Ship display name |
| `type` | string | `"ship"` |
| `slug` | string | Unique identifier slug |
| `status` | string | Operational status |

The player ship identity and systems live in `campaign/ship/ship.yaml` (not documented here —
see `get_data_schema()` for the full `ship.yaml` field set).

---

## Common Pitfalls

- **P1 — Slug case:** `body_slug` and `system_slug` are free-text strings. A case mismatch
  or spelling error silently prevents the ship from appearing on the orbit map.
  `body_slug: tau-ceti-F` will NOT match directory `tau-ceti-f`. Always lowercase with hyphens.
- **P5 — body_slug planet only:** `body_slug` resolves against direct children of system nodes
  (planets only — NOT moons). If the user provides a moon slug, warn them: the injection will
  silently fail. Only top-level bodies (planets, direct system children) are valid `body_slug`
  targets. Example: use `tau-ceti-f` (planet), not `verdant` (moon orbiting tau-ceti-f).

---

## Example

Based on `data/ships/patrol_gunboat/location.yaml`:

```yaml
name: "USCSS Patrol Gunboat"
type: "ship"
description: "Colonial patrol vessel on standby"
status: "OPERATIONAL"

parent_type: orbit
body_slug: tau-ceti-f
system_slug: tau-ceti

orbital:
  radius: 32
  period: 90
  angle: 135
  inclination: 0
  size: 1.5
  icon_type: ship
```
