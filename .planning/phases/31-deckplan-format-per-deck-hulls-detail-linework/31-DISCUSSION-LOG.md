# Phase 31: Deckplan Format — Per-Deck Hulls & Detail Linework - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 31-deckplan-format-per-deck-hulls-detail-linework
**Areas discussed:** Hull YAML shape, Detail data model, Visual treatment, Reveal & GM view

---

## Hull YAML shape

### Multi-polygon expression

| Option | Description | Selected |
|--------|-------------|----------|
| Add polygons: key | Optional plural `polygons:` alongside existing `polygon:`; both normalize internally; no migration | ✓ |
| hull becomes a list | `hull:` as list of polygon entries; cleaner but breaks existing deckplans | |
| polygon accepts both | Detect nesting depth on single key; ambiguous to author | |

**User's choice:** Add polygons: key
**Notes:** First response accidentally selected "polygon accepts both"; user interrupted and re-asked, then chose the recommended option.

### Deck vs location hull interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Full replace | Deck hull replaces top-level hull on that deck (roadmap wording) | |
| Additive merge | Deck polygons drawn in addition to location hull | ✓ |
| Deck-only, no fallback | Any deck hull disables the location hull everywhere | |

**User's choice:** Freeform: "each deck having an optional hull with polygons but if hull is defined outside a deck then that hull is rendered no matter what deck" → clarified to **Both/additive** — deck hull adds to the always-rendered top-level silhouette.
**Notes:** This refines the roadmap's "overrides" wording; noted in CONTEXT.md domain section.

### Multi-polygon scope

| Option | Description | Selected |
|--------|-------------|----------|
| Both levels | Top-level and deck hulls share the exact same HullDef shape | ✓ |
| Deck-level only | Top-level stays single-polygon | |

**User's choice:** Both levels

### Hull holes

| Option | Description | Selected |
|--------|-------------|----------|
| No holes | Solid filled polygons only | |
| Support holes | Optional `holes:` list subtracted from fill | ✓ |

**User's choice:** Support holes

### Hole attachment

| Option | Description | Selected |
|--------|-------------|----------|
| Hull-level holes: | One flat `holes:` list, evenodd fill-rule, no pairing | ✓ |
| Per-polygon pairing | `{polygon:, holes:}` entries | |

**User's choice:** Hull-level holes:

### Testbed ship

| Option | Description | Selected |
|--------|-------------|----------|
| Patrol gunboat | Multi-deck, Inkscape-converted; realistic HULL-01/02 exercise | ✓ |
| Somnus | Single deck, weak for per-deck testing | |
| New fixture ship | Synthetic test-only deckplan | |

**User's choice:** Patrol gunboat

---

## Detail data model

### Primitives

| Option | Description | Selected |
|--------|-------------|----------|
| Polylines + circles | `points:` (optional `closed:`) or `circle: {cx,cy,r}` | ✓ |
| Polylines only | Everything as point lists; circles become noisy approximations | |
| SVG path strings | Raw `d:` strings; max fidelity but hard to author/edit | |

**User's choice:** Polylines + circles

### Room attachment

| Option | Description | Selected |
|--------|-------------|----------|
| Deck-level list + room ref | One `details:` list per deck, optional `room: <id>` (mirrors poi:) | ✓ |
| Nested inside each room | Per-room `details:` lists | |

**User's choice:** Deck-level list + room ref

### Exterior details

| Option | Description | Selected |
|--------|-------------|----------|
| Same list, no room ref | Absent `room:` = exterior/always visible; ref presence IS the gate | ✓ |
| Separate exterior key | Distinct `exterior_details:` list | |

**User's choice:** Same list, no room ref

### Detail ids

| Option | Description | Selected |
|--------|-------------|----------|
| Optional id | Allowed, not required; converter emits only from Inkscape labels | ✓ |
| No ids | Anonymous decoration | |
| Required id | Auto-generated detail_N everywhere | |

**User's choice:** Optional id

---

## Visual treatment

### Styling

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed renderer style | One baked-in style: thin (~1/4 wall), dimmer teal | ✓ |
| Optional per-detail overrides | Default + `color:`/`width:` fields | |
| Type-based styles | `type:` tag → palette mapping | |

**User's choice:** Fixed renderer style

### Fill

| Option | Description | Selected |
|--------|-------------|----------|
| Stroke-only | Pure linework | |
| Optional filled: flag | Closed shapes may set `filled: true` for faint fill | ✓ |

**User's choice:** Optional filled: flag

### Reveal animation

| Option | Description | Selected |
|--------|-------------|----------|
| Join the flicker | Details inherit the room's CRT flicker-in cascade | ✓ |
| Instant appear | Unanimated pop-in | |

**User's choice:** Join the flicker

---

## Reveal & GM view

### GM visibility of unrevealed-room details

| Option | Description | Selected |
|--------|-------------|----------|
| Match room treatment | Details live in the room's SVG group; GM sees them as they see the room | ✓ |
| Dimmed like hidden vents | Reduced opacity cue for GM | |

**User's choice:** Match room treatment

### Dangling room ref

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden + console warn | Players see nothing (fail-safe), dev warning, GM still sees it | ✓ |
| Treat as exterior | Fall back to always-visible (spoiler risk) | |
| Strict: skip entirely | Invisible to everyone including GM | |

**User's choice:** Hidden + console warn

---

## Claude's Discretion

- Layer stacking order (details under tokens/labels/doors)
- Normalization home (backend loader vs frontend normalizer module)
- Player payload gating pattern (stays client-side, consistent with rooms)
- Editor preview scope (render-only via shared renderer)
- Somnus adoption of new fields (optional; patrol_gunboat is required testbed)
- Hull-hole rendering technique, detail stroke color token, filled-shape opacity

(Four additional gray areas — normalization home, payload gating, editor preview
scope, somnus adoption — were offered for discussion; user chose to proceed to
context, so they resolved to discretion/defaults above.)

## Deferred Ideas

- Editor click-to-jump / drag for detail and hull entries
- MCP find/edit_map_element support for detail entries
- Per-detail styling / type-based palettes
- Server-side payload filtering of unrevealed content
