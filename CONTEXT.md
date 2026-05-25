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

# Map Playback

The per-viewer play/pause and time-scrub overlay on galaxy, system, and orbit maps. Lets a GM or player freeze celestial motion and shuttle it forward/backward without affecting other viewers.

## Language

**Chronoscope**:
The iPod-style click-wheel overlay on a map view: a thick amber **Ring** with a circular play/pause **Toggle** at its center. Anchored in the lower-right of the map (right edge with **InfoPanel**, bottom edge with the BridgeView TabBar), at 50% opacity. Each viewer has their own — never synced across clients. Shown on galaxy, system, and orbit maps.
_Avoid_: scrubber, dial, time wheel, playback widget

**Ring**:
The thick amber donut around the **Toggle**. Dragging it (when scrub is enabled and the view is paused) emits signed angular deltas in radians (positive = clockwise = forward time). On the galaxy map the ring is decorative — no scrub callback wired, drag is a no-op. On system and orbit maps the ring is functional while paused.

**Toggle**:
The round play/pause button at the center of the **Chronoscope**, sized to fit inside the **Ring**'s hole. Writes only `userPaused` (galaxy) or the local `isOrbiting` flag (system/orbit) — never `autoRotate`.

**User pause** (`userPaused`):
The viewer's explicit pause intent. Sticky: survives transient camera/selection state changes. Always wins over `autoRotate`.
_Avoid_: paused (ambiguous with render-pause and autoRotate)

**Scrub**:
Dragging the **Thumb** to advance or rewind orbital time while paused. Each body advances proportional to its own orbital period — so configurations recur but exact alignment requires commensurate periods.

**Scrub offset** (`scrubOffsetRef`):
Accumulated scrub expressed in **seconds of visualization time**, not radians. Added to elapsed seconds in every body's frame math so periods scale naturally.

**Re-anchor**:
On resume, `startTimeRef` is reset to `Date.now() - (frozenElapsed + scrubOffset) * 1000` so live playback continues smoothly from the scrubbed position with no snap-back.

## Relationships

- A **Chronoscope** contains one **Ring** and one **Toggle**.
- The **Toggle** writes **User pause** (galaxy) or local pause (system/orbit); pause gates every body's frame math.
- A **Ring** drag emits angular deltas → **Scrub offset** (converted via `secondsPerRadian`).
- **Scrub offset** + frozen elapsed → body position while paused; **Re-anchor** absorbs both on resume.

## Flagged ambiguities

- "Paused" is overloaded: distinguish **User pause** (viewer intent), `autoRotate` (transient camera-driven), and the global Zustand render-pause (`useIsPaused`).
- One full **Ring** rotation ≠ one orbit for every body — it equals the shortest orbital period in the current view, so outer bodies move less per revolution.
