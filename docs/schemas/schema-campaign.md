# Campaign Schema Reference

All MCP paths are relative to `data/`. Slash convention: forward-slash only, no leading slash.

---

## MCP Path Conventions

| Directory | Contents |
|---|---|
| `campaign/crew/` | Crew member YAML files — one per character |
| `campaign/npcs/` | NPC YAML files — one per NPC |
| `campaign/ship/` | Player ship files (`ship.yaml`, `location.yaml`, `deckplan.yaml`) |
| `campaign/corporation/` | Corporation YAML files |
| `campaign/standby.yaml` | Standby screen config (single file, not a directory) |

MCP read: `read_file("campaign/crew/alex_novak.yaml")`
MCP list: `list_files("campaign/npcs")`

---

## NPC YAML (data/campaign/npcs/<id>.yaml)

### Background NPC (minimal — 6 required fields)

| Field | Type | Note |
|---|---|---|
| `id` | string | Must match filename stem exactly — see Pitfall P2 |
| `name` | string | Display name |
| `role` | string | In-world role (e.g., "Salvage Operator") |
| `faction` | string | Organizational affiliation |
| `status` | enum | `ACTIVE \| INACTIVE \| DECEASED \| UNKNOWN` |
| `description` | string | One-paragraph narrative description |

Optional fields (background NPCs): `location` (string — in-world location name), `portrait` (path string)

### Combatant / Significant NPC (full)

Includes all 6 required fields above, plus:

| Field | Type | Note |
|---|---|---|
| `class` | enum | `Teamster \| Scientist \| Marine \| Android` |
| `portrait` | string | Path to portrait image |
| `stats` | mapping | See stats block below |
| `saves` | mapping | See saves block below |
| `stress` | integer | Current stress level |
| `health` | mapping | `current:` and `max:` values |
| `wounds` | integer | Wound count |
| `armor` | integer | Armor rating |
| `background` | string | Background occupation |
| `motivation` | string | Character motivation |

**Stats block** (integer, range 2–10, average 5):

```yaml
stats:
  strength: 5
  speed: 6
  intellect: 8
  combat: 4
```

**Saves block** (integer, range 0–99, percentage):

```yaml
saves:
  sanity: 45
  fear: 35
  body: 30
```

**Status enum:** `ACTIVE | INACTIVE | DECEASED | UNKNOWN`

---

## Crew YAML (`data/campaign/crew/<id>.yaml`)

Same schema as full NPC above. The `id` field must match the filename stem.

All crew files use the same flat format — no wrapper key. File begins directly with `id:`.

---

## Corporation YAML (`data/campaign/corporation/`)

One YAML file per corporation. Minimal documented fields:

| Field | Type | Note |
|---|---|---|
| `id` | string | Must match filename stem |
| `name` | string | Full corporation name |
| `description` | string | Narrative description |
| `status` | enum | `ACTIVE \| INACTIVE \| UNKNOWN` |
| `type` | string | Corporation type/sector (optional) |
| `headquarters` | string | Location name (optional) |
| `notable_personnel` | list | List of name strings (optional) |

---

## Standby YAML (`data/campaign/standby.yaml`)

The standby screen displayed on the shared player terminal between scenes. **Single file**, not a directory of messages. Served by `/api/standby/` and rendered by the STANDBY view.

| Field | Type | Note |
|---|---|---|
| `title` | string | Large title text (e.g., `"MOTHERSHIP"`) |
| `subtitle` | string | Smaller subtitle text below the title (e.g., `"The Outer Veil"`) |

To update: write the entire file with both keys present. There is no per-message list and no `id` field.

Example:

```yaml
title: "MOTHERSHIP"
subtitle: "The Outer Veil"
```

MCP path: `read_file("campaign/standby.yaml")` / `write_file("campaign/standby.yaml", content)`.

---

## Common Pitfalls

- **P2 — id/filename mismatch:** The `id:` field value must exactly match the YAML filename stem.
  `id: captain_harrow` must live in `captain_harrow.yaml`. A mismatch causes the character to be skipped on load with a logged error. Slug rule: lowercase + underscores for character ids.

---

## Examples

### Background NPC (minimal)

```yaml
id: "captain_harrow"
name: "Captain Dex Harrow"
role: "Salvage Operator"
faction: "Independent"
location: "The Outer Veil"
status: "ACTIVE"
description: "Freelance salvage captain operating a retrofitted mining vessel."
```

### Full NPC / Crew Member

```yaml
id: "elena_vasquez"
name: "Dr. Elena Vasquez"
role: "Science Officer"
faction: "Weyland-Yutani"
class: "Scientist"
portrait: "/static/portraits/vasquez.png"

stats:
  strength: 5
  speed: 6
  intellect: 9
  combat: 4

saves:
  sanity: 45
  fear: 35
  body: 30

stress: 2
health:
  current: 8
  max: 8
wounds: 0
armor: 0

background: "Research Scientist"
motivation: "Discover the unknown"
status: "ACTIVE"
description: "Brilliant biologist specializing in xenobiology."
```
