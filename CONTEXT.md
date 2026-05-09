# Encounter Map

The grid-based tactical floor-plan system used during combat encounters. One **Encounter map** is one deck — a set of **Rooms**, **Doors**, an optional **Hull**, and POIs authored in **Grid space** and projected to **SVG space** for rendering.

## Language

**Encounter map**:
A grid-based tactical floor plan for one deck of a location.
_Avoid_: tactical map, combat map, map (collides with galaxy / system / orbit / campaign map)

**Room**:
A bounded floor area defined by one or more rectangles, a circle, or a freeform polygon; a room with empty `name` is a corridor (no label rendered).
_Avoid_: area, region, zone

**Door**:
A passage between two **Rooms**, or between one **Room** and the exterior, carrying position, angle, width, and two room references (second null for exterior).
_Avoid_: passage, opening, portal

**Hull**:
The optional outer-frame polygon for a deck — the ship or structure outline shown on every level of a multi-deck map.

**Wall segment**:
A line of exterior room wall in **Grid space**, derived (never authored) by the wall-segment algorithm: cell edges that appear on exactly one rect are exterior; shared edges are interior.
_Avoid_: wall, edge

**Adjacent cell**:
The grid cell on the far side of a door — a relic of the legacy door model, kept only as a transitional rendering helper.

**Grid space**:
Coordinates in grid cells — the currency of authoring, validation, geometry, and visibility logic.

**SVG space**:
Pixel coordinates inside the rendered SVG viewBox; produced only by a **Projection**.

**Projection**:
A function mapping **Grid space** ↔ **SVG space** — top-down today (parameterized by `unitSize`), isometric / rotation later.
_Avoid_: transform, view

**Map view** (`mapView`):
The renderer-facing facade composing room/door geometry with a **Projection**, so the renderer never handles pixel math directly.

**Reveal cascade**:
The staggered animation that plays for players when room visibility changes — rooms appear or vanish in sequence (Y-ascending today) rather than all at once, building tension during exploration. Disabled for the GM, who sees instant state changes.
_Avoid_: fade-in, animation (too generic)

## Relationships

- An **Encounter map** has many **Rooms**, many **Doors**, an optional **Hull**.
- A **Door** references one or two **Rooms**; a single-room reference means an exterior door (e.g. airlock to space).
- **Wall segments** are derived from a **Room**'s rects, never authored.
- A **Projection** maps **Grid space** ↔ **SVG space**.
- A **Map view** holds one **Projection** and exposes geometry in **SVG space**.

## Example dialogue

> **Dev**: "Where does a door's `(x, y, angle)` get set?"
> **Domain**: "Not in YAML directly — YAML says which two **Rooms** it connects and how far along their shared boundary (`along: 0..1`). A loader normalizes to the canonical `{x, y, angle, width, roomA, roomB}` that `roomGeometry` and `mapView` consume."

> **Dev**: "What does the renderer hold?"
> **Domain**: "One **Map view**, built with a **Projection**. Every door, room, wall, hull, and POI position goes through it — that's why switching to isometric is a one-line projection swap."

## Flagged ambiguities

- **Map** alone is ambiguous (galaxy / system / orbit / encounter / campaign). Use the qualified term outside narrow scopes.
- Legacy door model: doors nested under one **Room** with synthetic ids `${room.id}_door_${index}` and adjacent-cell inferred geometrically. Replaced by top-level `doors` with explicit `roomA` / `roomB`. **Adjacent cell** is a relic of that model.
