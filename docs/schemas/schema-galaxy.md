# Galaxy Schema Reference

All MCP paths are relative to `data/`. Slash convention: forward-slash only, no leading slash.

---

## MCP Path Conventions

| File | MCP Path |
|---|---|
| Galaxy map | `galaxy/star_map.yaml` |
| System map | `galaxy/<system>/system_map.yaml` |
| System location | `galaxy/<system>/location.yaml` |
| Orbit map | `galaxy/<system>/<planet>/orbit_map.yaml` |
| Body location | `galaxy/<system>/<body>/location.yaml` |
| Sub-location | `galaxy/<system>/<body>/<slug>/location.yaml` |
| JANUS context | `galaxy/<system>/<body>/janus.yaml` (sibling to location.yaml) |

MCP read: `read_file("galaxy/star_map.yaml")`
MCP list: `list_files("galaxy/tau-ceti")`

---

## Slug Rules

- Lowercase + hyphens only — e.g., `tau-ceti`, `tau-ceti-f`, `veil-station`
- **Must match directory name exactly** — case mismatch silently breaks orbit injection
- **P1 — Slug case:** `body_slug: tau-ceti-F` will NOT match directory `tau-ceti-f`. Always lowercase.
- Galaxy slugs and ship slugs share the `find_location_by_slug()` namespace — avoid collisions

---

## star_map.yaml (`data/galaxy/star_map.yaml`)

Top-level 3D galaxy visualization file. One per campaign.

### `camera` block

| Field | Type | Note |
|---|---|---|
| `position` | [x, y, z] | Camera position in galaxy space |
| `lookAt` | [x, y, z] | Camera target point |
| `fov` | integer | Field of view in degrees |

### `systems[]` array

| Field | Type | Required | Note |
|---|---|---|---|
| `name` | string | yes | Display name |
| `position` | [x, y, z] | yes | Coordinates in galaxy space |
| `color` | hex | yes | Star color (e.g., `0xFFFFBB`) |
| `size` | float | yes | Star visual size |
| `type` | string | yes | e.g., `"star"` |
| `label` | boolean | no | Whether to show name label |
| `location_slug` | string | yes | Must match `data/galaxy/<slug>/` directory |
| `info.description` | string | no | Short description |
| `info.population` | string | no | Population string |

### `routes[]` array

| Field | Type | Note |
|---|---|---|
| `from` | string | System name |
| `to` | string | System name |
| `color` | hex | Route line color |
| `route_type` | string | e.g., `"major_trade"`, `"minor_route"` |
| `travel_time_days` | integer | Travel time in days |

### `nebulae[]` array

| Field | Type | Note |
|---|---|---|
| `name` | string | Display name |
| `position` | [x, y, z] | Position in galaxy space |
| `color` | hex | Nebula color |
| `size` | float | Visual size |
| `particle_count` | integer | Particle density |
| `opacity` | float | Transparency (0.0–1.0) |
| `type` | string | e.g., `"emission"` |

---

## system_map.yaml (`data/galaxy/<system>/system_map.yaml`)

3D solar system visualization. One per star system.

### `star` block

| Field | Type | Note |
|---|---|---|
| `name` | string | Star name |
| `color` | hex | Star color |
| `size` | float | Visual size |

### `camera` block

Same fields as star_map camera: `position`, `lookAt`, `fov`.

### `bodies[]` array

| Field | Type | Required | Note |
|---|---|---|---|
| `name` | string | yes | Display name |
| `type` | string | yes | `planet \| moon \| asteroid_belt` |
| `location_slug` | string | yes | Must match `data/galaxy/<system>/<slug>/` directory |
| `orbital_radius` | float | yes | Distance from star (arbitrary units) |
| `orbital_period` | float | yes | Animation period (higher = slower) |
| `size` | float | yes | Visual size |
| `color` | hex | no | Body color |
| `texture` | string | no | Path to texture: `/textures/<category>/<filename>` |
| `clickable` | boolean | no | Whether body is clickable in UI |
| `has_orbit_map` | boolean | no | Set `true` if `orbit_map.yaml` exists |
| `info.description` | string | no | Short description |

`location_slug` must match the subdirectory name exactly — lowercase, hyphens.

---

## orbit_map.yaml (`data/galaxy/<system>/<planet>/orbit_map.yaml`)

Planetary orbit visualization. Only moons are listed here. Stations and ships
self-register at runtime via `body_slug` pointer — do NOT add them here.

### `planet` block

| Field | Type | Note |
|---|---|---|
| `name` | string | Planet display name |
| `type` | string | e.g., `"planet"` |
| `size` | float | Planet visual size |
| `texture` | string | Path to texture |

### `camera` block

Same fields as star_map camera: `position`, `lookAt`, `fov`.

### `moons[]` array

| Field | Type | Required | Note |
|---|---|---|---|
| `name` | string | yes | Display name |
| `location_slug` | string | yes | Must match `data/galaxy/.../verdant/` directory |
| `orbital_radius` | float | yes | Distance from planet |
| `orbital_period` | float | yes | Animation period |
| `orbital_angle` | float | no | Starting angle in degrees |
| `inclination` | float | no | Orbital plane tilt |
| `size` | float | yes | Visual size |
| `color` | hex | no | Moon color |
| `texture` | string | no | Path to texture |
| `clickable` | boolean | no | Whether moon is clickable |
| `has_facilities` | boolean | no | Whether the moon has installations |

---

## location.yaml (permanent installation — station/planet/moon)

Located at `data/galaxy/<system>/<body>/location.yaml` or nested sub-location.

| Field | Type | Required | Note |
|---|---|---|---|
| `name` | string | yes | Display name |
| `type` | enum | yes | `ship \| station \| planet \| moon \| system` |
| `parent_system` | string | no | Parent system slug |
| `orbital_body` | string | no | Orbital body name |
| `orbital_position` | string | no | Position description |
| `status` | enum | no | `OPERATIONAL \| ACTIVE \| INACTIVE \| UNKNOWN` |
| `population` | string | no | Population string |
| `crew_capacity` | integer | no | Maximum capacity |
| `established` | string | no | Founding year or date |
| `description` | string | no | Narrative description |
| `lore` | mapping | no | Lore note reference (see below) |
| `janus` | mapping | no | JANUS AI instance config (see below) |
| `orbital` | mapping | no | Orbit map visualization block (see below) |

For stations/installations that should appear on an orbit map, add an `orbital:` block
(same format as the ship orbit injection block — see schema-ships.md).

### `lore` block (optional)

| Field | Type | Note |
|---|---|---|
| `note` | string | Path to Obsidian vault note |
| `janus_sections` | list | Section headings to include |
| `exclude_patterns` | list | Regex patterns to exclude |

### `janus` block (optional, inside location.yaml)

| Field | Type | Note |
|---|---|---|
| `instance_id` | string | JANUS instance identifier |
| `clearance_level` | string | e.g., `"INTERNAL"` |
| `designation` | string | AI role name |

---

## location.yaml (system-level — `data/galaxy/<system>/location.yaml`)

Minimal required fields for a system root:

| Field | Type | Note |
|---|---|---|
| `name` | string | System display name |
| `type` | string | `"system"` |

---

## Body Type Enum

`ship | station | planet | moon | system`

---

## Common Pitfalls

- **P1 — Slug case:** `body_slug` and `system_slug` are free-text. A case mismatch silently
  prevents the location from appearing. `tau-ceti-E` will NOT match directory `tau-ceti-e`.
  Always match the directory name exactly (lowercase, hyphens).
- **P5 — body_slug planet only:** `body_slug` resolves against direct children of system nodes
  (planets only). Pointing at a moon slug silently falls back or fails. Only top-level bodies
  (planets) are valid `body_slug` targets.
- **has_orbit_map:** Must be `true` in `system_map.yaml` if `orbit_map.yaml` exists for that body.

---

## Examples

### star_map.yaml system entry

```yaml
systems:
  - name: "Anchor System"
    position: [0, 0, 0]
    color: 0xFFE8B0
    size: 2.2
    type: "star"
    label: true
    location_slug: "anchor-system"
    info:
      description: "Outer Veil gateway system"
      population: "~50,000"
```

### location.yaml (station, permanent installation)

```yaml
name: "Veil Station"
type: "station"
parent_system: "anchor-system"
orbital_body: "Anchor-3"
orbital_position: "L2 Lagrange Point"
status: "OPERATIONAL"
population: "~12,000"
crew_capacity: 15000
established: "2167"
description: "Primary orbital station in the Anchor System."
```
