# Phase 7: Grid-based Encounter Map Redesign - Research

**Researched:** 2026-02-21
**Domain:** SVG-based 2D grid renderer, YAML schema design, React component architecture
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Room shape system:**
- Rooms are defined as a list of grid rectangles: each rect is `{x, y, w, h}` in grid cell units
- This supports irregular shapes: an L-shaped room is two rects that together form the L
- Internal edges between rects of the same room are erased — reads as open floor
- Each grid cell belongs to at most one room (no overlap between different rooms)
- Corridors/hallways are supported as rooms with no label (unnamed rooms follow same visibility rules as named rooms)
- Doors are explicit: defined as `{wall_side, position}` on a room, not implied by adjacency

**Door system:**
- Keep current door types and statuses: standard, airlock, blast_door, emergency
- Door statuses: OPEN, CLOSED, SEALED, LOCKED
- Door rendering: keep current door icons and visual states (type-colored symbols)
- In the new format, doors are attached to a room's wall edge (instead of being a connection between two room IDs)

**Map canvas:**
- Map bounding box auto-fits to room coordinates — no fixed canvas size in YAML
- The renderer computes the bounding box from all room rects and sizes accordingly

**Visual style:**
- Room interiors (revealed): Subtle floor texture — light scanline or faint grid pattern inside the room to distinguish floor from void
- Walls: Amber tones (#8b7355 range) — blueprint/sci-fi aesthetic matching project palette
- Room labels: Centered text inside the room, always-on (not hover-only), only visible when room is revealed
- Map background (outside rooms): Dark grid — faint grid lines visible in the void suggesting underlying grid structure
- GM view — hidden rooms: Dimmed/darker rendering so GM can see all rooms but clearly distinguish what players see
- Player view — hidden rooms: Pure void — hidden rooms are not drawn at all

**Room reveal UX:**
- Dual method: GM can click directly on a room on the map to toggle reveal/hide (GM console only), OR use the sidebar room list toggle buttons
- Map click-to-reveal is exclusive to the GM console — player terminal map never accepts room clicks
- Bulk actions: Both "reveal all" and "hide all" buttons available for quick session setup/reset
- Changes save immediately to the API on each toggle — players see updates within the ~2 second poll cycle

**Map data format:**
- New grid-based format replaces the old encounter map YAML format — clean break, no migration tooling
- Existing maps (deck_1.yaml, deck_2.yaml) to be manually rebuilt in the new format
- A sample encounter_map.yaml is created as part of this phase to demonstrate the format
- Per-room metadata: `name` (required), `rects` (list of `{x, y, w, h}`), `doors` (optional list), `description` (optional), `type` (optional tag, e.g. corridor, bridge, cargo)

### Claude's Discretion

- Grid unit pixel size (how many pixels per cell) — design for readability and token fit
- Grid unit real-world scale (no explicit 5ft/cell requirement — abstract units)
- Exact scanline/floor texture implementation details
- Wall line thickness
- Label font size and truncation for small rooms
- The exact YAML key names and schema structure (within the decisions above)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

This phase redesigns the encounter map system from a node-graph approach (floating room boxes connected by path lines) to a true grid-based layout where rooms are defined by their grid coordinates, walls align to the grid, and adjacent rooms share walls. The fundamental architectural shift is from `connections` between named rooms to `doors` attached to specific wall edges of individual rooms. Rooms can be composed of multiple rectangles, enabling L-shapes, T-shapes, and wide corridors without special-casing.

The existing SVG rendering infrastructure is the correct foundation: the project already uses inline SVG inside a React component (`EncounterMapRenderer.tsx`) with pan/zoom, the `TokenLayer` component, and CSS-based styling — all of which carry forward. The work is primarily: (1) a new YAML schema, (2) a new rendering algorithm that draws walls from rect edges instead of floating room outlines, (3) erasing shared interior edges between rects of the same room, (4) positioning doors on wall segments by wall edge + position offset, and (5) updating all TypeScript types to match the new schema.

The biggest algorithmic challenge is wall rendering: the renderer must union the rects of a room to produce its wall outline, suppress internal edges shared between rects of the same room, and render only the exterior perimeter as walls. This is well-solved by a "shared-edge exclusion" algorithm on grid-aligned rectangles — no polygon boolean library needed.

**Primary recommendation:** Keep the SVG-in-React approach. Replace room rendering from `<rect>` outlines to wall segments computed from rect edge sets. The new YAML schema is the primary design artifact that drives everything else.

---

## Standard Stack

### Core

The phase uses only what is already installed. No new dependencies are needed.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 + TypeScript | Installed | Component architecture, type safety | Already used everywhere |
| Inline SVG | Browser native | Grid map rendering | Already used in EncounterMapRenderer |
| PyYAML | Installed | Load new YAML schema | Already used in data_loader.py |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zustand sceneStore | Installed | Not used for encounter map; tokens/visibility stay in React state | Only if map state needs cross-component sharing |
| Ant Design | Installed | GM panel controls (buttons, switches) | Already used in EncounterPanel |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom wall-segment algorithm | A polygon clipper library (e.g., `polygon-clipping`) | Library is overkill — axis-aligned rectangles on integer grids need only edge-set subtraction, no floating point polygon math |
| SVG `<path>` for room outlines | Canvas 2D API | SVG keeps the existing interaction model (click events on elements), no reason to switch |
| SVG `<defs>` `<pattern>` for floor texture | CSS `repeating-linear-gradient` on background | SVG patterns work directly on SVG fill, simpler to keep everything in SVG |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

The new files slot into the existing structure:

```
src/
├── types/
│   └── encounterMap.ts          # Replace old types with new grid schema types
├── components/domain/encounter/
│   ├── EncounterMapRenderer.tsx # Full rewrite of renderer (new algorithm)
│   ├── EncounterMapRenderer.css # Update visual rules (wall color, floor texture)
│   ├── MapPreview.tsx           # Update to use new schema (same concept, new types)
│   └── TokenLayer.tsx           # Update findRoomAtCell for multi-rect rooms
├── components/gm/
│   └── EncounterPanel.tsx       # Update room list rendering (no status field)
data/
├── galaxy/sol/earth/uscss_morrigan/map/
│   ├── deck_1.yaml              # Manual rebuild in new format
│   └── deck_2.yaml              # Manual rebuild in new format
└── galaxy/kepler-442/.../map/
    └── main_facility.yaml       # Manual rebuild or replace with sample
```

### Pattern 1: New YAML Schema

**What:** Rooms as multi-rect definitions with wall-attached doors.

**Proposed YAML structure:**

```yaml
# encounter_map.yaml — new grid-based format
name: "USCSS Morrigan - Main Deck"
deck_id: "deck_1"

# Claude's discretion: 40px/cell (existing default, matches token sizing)
unit_size: 40

rooms:
  - id: bridge
    name: "BRIDGE"
    rects:
      - { x: 0, y: 0, w: 5, h: 3 }    # primary bridge area
    doors:
      - { wall: north, position: 2, type: standard, status: CLOSED }
      - { wall: east,  position: 1, type: blast_door, status: CLOSED }
    description: "Primary flight control"
    type: bridge

  - id: corridor_main
    name: ""                              # unnamed = corridor (no label rendered)
    rects:
      - { x: 5, y: 1, w: 4, h: 1 }      # east-west corridor
    doors: []
    type: corridor

  - id: cargo_bay
    name: "CARGO BAY"
    rects:
      - { x: 4, y: 3, w: 6, h: 3 }      # main area
      - { x: 4, y: 6, w: 3, h: 2 }      # alcove (L-shape)
    doors:
      - { wall: north, position: 1, type: standard, status: OPEN }
    type: cargo
```

**Key schema decisions (Claude's discretion):**

- `unit_size` is top-level (not nested in `grid`). The renderer computes `svgWidth` and `svgHeight` from the bounding box of all room rects plus padding.
- `wall` uses cardinal directions: `north`, `south`, `east`, `west` (not `top/bottom/left/right` — cardinal reads more naturally in a map context).
- `position` is a zero-based cell index along the wall. For a room with a 5-cell-wide north wall, `position: 2` places the door at the third cell from the left. This is absolute within the wall, not relative to any other room.
- `type` on a room is optional metadata for GM reference (rendered nowhere on the player view).
- No `grid.width` / `grid.height` — bounding box is computed, not declared.
- No `connections` array — doors are on rooms, not between rooms.
- No `status` field on rooms — room condition was used by the old renderer for color coding but is not in the new visual spec.
- `terminals` and `poi` arrays remain supported but now use room-relative cell coordinates (or absolute grid coords — see Open Questions).

### Pattern 2: Wall Rendering Algorithm

**What:** Draw only the exterior perimeter of each room (multi-rect union), suppressing internal shared edges.

**When to use:** Every room render call.

**Algorithm (grid-aligned, integer coordinates, no polygon library):**

```typescript
// For a room with rects: [{x, y, w, h}, ...]
// Build the set of all "exposed edges" — edges that belong to only one rect.

type Edge = { x1: number; y1: number; x2: number; y2: number };

function computeRoomWalls(rects: Rect[]): Edge[] {
  // Each rect contributes 4 * (perimeter in grid units) edges.
  // An edge shared by two rects of the same room is internal — exclude it.

  // Represent each unit edge as a canonical string key for set operations.
  // Horizontal edge from (x,y) to (x+1,y): key = "H:x:y"
  // Vertical edge from (x,y) to (x,y+1): key = "V:x:y"

  const edgeCounts = new Map<string, number>();

  const addEdges = (rect: Rect) => {
    // Top edge (north wall): y-row = rect.y, cells x=rect.x..rect.x+rect.w-1
    for (let cx = rect.x; cx < rect.x + rect.w; cx++) {
      const key = `H:${cx}:${rect.y}`;
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    }
    // Bottom edge (south wall): y-row = rect.y + rect.h
    for (let cx = rect.x; cx < rect.x + rect.w; cx++) {
      const key = `H:${cx}:${rect.y + rect.h}`;
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    }
    // Left edge (west wall): x-col = rect.x, cells y=rect.y..rect.y+rect.h-1
    for (let cy = rect.y; cy < rect.y + rect.h; cy++) {
      const key = `V:${rect.x}:${cy}`;
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    }
    // Right edge (east wall): x-col = rect.x + rect.w
    for (let cy = rect.y; cy < rect.y + rect.h; cy++) {
      const key = `V:${rect.x + rect.w}:${cy}`;
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    }
  };

  for (const rect of rects) addEdges(rect);

  // Keep only edges with count === 1 (exterior edges)
  const walls: Edge[] = [];
  for (const [key, count] of edgeCounts) {
    if (count !== 1) continue;
    const parts = key.split(':');
    const orientation = parts[0];
    const gx = parseInt(parts[1]);
    const gy = parseInt(parts[2]);
    if (orientation === 'H') {
      walls.push({ x1: gx * unitSize, y1: gy * unitSize, x2: (gx + 1) * unitSize, y2: gy * unitSize });
    } else {
      walls.push({ x1: gx * unitSize, y1: gy * unitSize, x2: gx * unitSize, y2: (gy + 1) * unitSize });
    }
  }
  return walls;
}
```

This is O(n) in total rect perimeter cells — fast enough for any map the GM would create.

**Adjacent rooms sharing a wall:** When rooms `A` and `B` both have a wall segment at the same grid edge, each room's wall-rendering independently produces that edge (they are both exterior to their respective room). Rendered on top of each other, they merge visually. This is correct — the wall between rooms is still a solid wall. A door on either room's wall side punches through it.

### Pattern 3: Floor Fill and Background Grid

**What:** Fill room interiors with a floor texture SVG pattern; fill the entire background with a dark grid.

**Background grid:**
```tsx
// SVG defs — render once
<defs>
  <pattern id="bgGrid" width={unitSize} height={unitSize} patternUnits="userSpaceOnUse">
    <path
      d={`M ${unitSize} 0 L 0 0 0 ${unitSize}`}
      fill="none"
      stroke="#1a2020"   // very faint teal-dark
      strokeWidth={0.5}
    />
  </pattern>

  <pattern id="floorTexture" width={unitSize} height={unitSize} patternUnits="userSpaceOnUse">
    {/* Scanline: one thin horizontal line per cell */}
    <line x1={0} y1={unitSize / 2} x2={unitSize} y2={unitSize / 2}
      stroke="#1a2525" strokeWidth={0.5} />
  </pattern>
</defs>

{/* Full-canvas background with grid */}
<rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#bgGrid)" />
```

**Floor fill (per room rect):**
```tsx
// Each rect in a room gets a filled rect with floor texture + clipped to perimeter
// (Alternatively: fill each rect individually since rects are axis-aligned rectangles)
<rect
  x={rect.x * unitSize}
  y={rect.y * unitSize}
  width={rect.w * unitSize}
  height={rect.h * unitSize}
  fill="url(#floorTexture)"
/>
```

Using individual `<rect>` fills per rect is simpler than building a clip path for the full room outline.

### Pattern 4: Door Rendering (Wall-Attached)

**What:** Doors are positioned on a room's wall edge by `{wall, position}`. The door symbol is rendered as a small gap + door block on that wall segment.

**Door coordinate computation:**
```typescript
function getDoorSVGPosition(
  roomRects: Rect[],
  door: DoorDef,
  unitSize: number
): { x: number; y: number; orientation: 'horizontal' | 'vertical' } {
  // Find the bounding box for the specific wall side
  // For north/south: x spans from min(rect.x) to max(rect.x + rect.w) of rects on that edge
  // For east/west: y spans similarly
  // 'position' is the cell index along that wall

  // Simplified: find the leftmost/topmost valid cell along the requested wall
  // and offset by 'position' cells

  if (door.wall === 'north' || door.wall === 'south') {
    const wallY = door.wall === 'north'
      ? Math.min(...roomRects.map(r => r.y)) * unitSize
      : Math.max(...roomRects.map(r => r.y + r.h)) * unitSize;
    // X position: find the leftmost rect touching this wall, add position offset
    const minX = Math.min(...roomRects
      .filter(r => door.wall === 'north' ? r.y === Math.min(...roomRects.map(r2 => r2.y)) : r.y + r.h === Math.max(...roomRects.map(r2 => r2.y + r2.h)))
      .map(r => r.x));
    const wallX = (minX + door.position + 0.5) * unitSize;
    return { x: wallX, y: wallY, orientation: 'horizontal' };
  } else {
    const wallX = door.wall === 'west'
      ? Math.min(...roomRects.map(r => r.x)) * unitSize
      : Math.max(...roomRects.map(r => r.x + r.w)) * unitSize;
    const minY = Math.min(...roomRects
      .filter(r => door.wall === 'west' ? r.x === Math.min(...roomRects.map(r2 => r2.x)) : r.x + r.w === Math.max(...roomRects.map(r2 => r2.x + r2.w)))
      .map(r => r.y));
    const wallY = (minY + door.position + 0.5) * unitSize;
    return { x: wallX, y: wallY, orientation: 'vertical' };
  }
}
```

The existing `renderDoorSymbol()` function in `EncounterMapRenderer.tsx` already handles the visual rendering of door types and statuses — it takes `(x, y, doorType, doorStatus, style, orientation, key)`. This function carries forward with no changes.

**Door gap in wall:** The wall segment at the door position should either be omitted when building wall edges, or the door symbol (which has an opaque background) covers the wall line. The current code uses the second approach — the door symbol has a background rect that covers the path line. This approach carries forward unchanged.

### Pattern 5: Room Visibility — GM vs Player

**What:** GM sees all rooms (hidden ones dimmed); players see nothing for hidden rooms.

**Implementation:**
```tsx
// GM view: render all rooms, dim hidden ones
// Player view: only render revealed rooms

const roomsToRender = isGM
  ? mapData.rooms
  : mapData.rooms.filter(room => isRoomVisible(room.id));

// For GM, dim hidden rooms
const roomOpacity = isGM && !isRoomVisible(room.id) ? 0.25 : 1.0;
```

For the floor fill: render with `opacity={roomOpacity}`. For walls: same opacity. The background grid shows through in the void, which is the desired effect for both views.

**GM click-to-reveal (new behavior in this phase):**
```tsx
// In EncounterMapRenderer — GM only
const handleRoomClick = (room: GridRoom) => {
  if (!isGM || !onRoomToggle) return;
  onRoomToggle(room.id, !isRoomVisible(room.id));
};

// For hit testing: determine which room was clicked
// Since rooms are multi-rect, test each rect:
const getRoomAtPoint = (svgX: number, svgY: number): GridRoom | null => {
  const gridX = Math.floor(svgX / unitSize);
  const gridY = Math.floor(svgY / unitSize);
  return mapData.rooms.find(room =>
    room.rects.some(r =>
      gridX >= r.x && gridX < r.x + r.w &&
      gridY >= r.y && gridY < r.y + r.h
    )
  ) ?? null;
};
```

Note: Click detection on SVG walls (lines) is tricky. Using invisible click-target rects per room rect (transparent `<rect>` with `onClick`) is more reliable than clicking wall `<line>` elements.

### Pattern 6: Bounding Box Auto-fit

**What:** The renderer computes `svgWidth` and `svgHeight` from the union of all room rects, plus a padding margin.

```typescript
function computeBoundingBox(rooms: GridRoom[], unitSize: number, padding = 2) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const room of rooms) {
    for (const rect of room.rects) {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.w);
      maxY = Math.max(maxY, rect.y + rect.h);
    }
  }
  return {
    originX: (minX - padding) * unitSize,
    originY: (minY - padding) * unitSize,
    svgWidth: (maxX - minX + padding * 2) * unitSize,
    svgHeight: (maxY - minY + padding * 2) * unitSize,
  };
}
```

The `viewBox` shifts by `(originX, originY)` so rooms starting at grid cell (0,0) render at the top-left with padding. This replaces the current `grid.width` / `grid.height` / `unit_size` fields in the YAML.

### Pattern 7: Token findRoomAtCell Update

**What:** The existing `findRoomAtCell()` function tests `gridX >= room.x && gridX < room.x + room.width`. With multi-rect rooms, this changes to test each rect.

```typescript
// Old (single rect per room):
function findRoomAtCell(gridX: number, gridY: number): RoomData | null {
  return mapData.rooms.find(room =>
    gridX >= room.x && gridX < room.x + room.width &&
    gridY >= room.y && gridY < room.y + room.height
  ) ?? null;
}

// New (multi-rect rooms):
function findRoomAtCell(gridX: number, gridY: number): GridRoom | null {
  return mapData.rooms.find(room =>
    room.rects.some(r =>
      gridX >= r.x && gridX < r.x + r.w &&
      gridY >= r.y && gridY < r.y + r.h
    )
  ) ?? null;
}
```

This change propagates to `TokenLayer.tsx`, `MapPreview.tsx`, and `EncounterMapRenderer.tsx`.

### Pattern 8: Room Label Rendering

**What:** Centered text inside the room, visible only when revealed, not rendered for unnamed rooms (corridors).

```typescript
function getRoomLabelPosition(rects: Rect[]): { x: number; y: number } {
  // Use centroid of the bounding box of all rects
  const minX = Math.min(...rects.map(r => r.x));
  const minY = Math.min(...rects.map(r => r.y));
  const maxX = Math.max(...rects.map(r => r.x + r.w));
  const maxY = Math.max(...rects.map(r => r.y + r.h));
  return {
    x: ((minX + maxX) / 2) * unitSize,
    y: ((minY + maxY) / 2) * unitSize,
  };
}
```

For small rooms (bounding box width < 2 cells or height < 1 cell): truncate label or skip it.

### Anti-Patterns to Avoid

- **Storing `svgWidth`/`svgHeight` in YAML:** The bounding box is computed, not declared. Declared canvas dimensions become stale when rooms are added/moved.
- **Using `connections` between rooms to position doors:** The new model has no `connections` array. Doors are on rooms. The planner should not attempt to retain connection-based door positioning.
- **Testing click hits on `<line>` elements:** SVG lines have very narrow hit areas. Use transparent `<rect>` overlays per room rect for click detection.
- **Rendering all rects with individual room outlines:** This draws internal edges where rects of the same room touch. Use the wall-segment exclusion algorithm instead.
- **Assuming `room.x`/`room.y`/`room.width`/`room.height` still exist:** The old `RoomData` type has these flat fields. The new `GridRoom` type has `rects: Rect[]`. Every consumer must update.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Polygon union for room outlines | Custom polygon clipper | Edge-set exclusion algorithm | Axis-aligned integer rects need only edge counting, not floating-point polygon math |
| Floor texture | Custom canvas drawing | SVG `<pattern>` element | Native SVG, no new dependencies |
| Background grid | Custom line drawing loop | SVG `<pattern>` element | Same approach, much less code |

**Key insight:** All geometry in this system is axis-aligned and integer-grid-aligned. This eliminates nearly all complexity that makes polygon operations hard in the general case. No floating point, no winding order, no epsilon comparisons.

---

## Common Pitfalls

### Pitfall 1: Door Position Ambiguity on Multi-Rect Walls

**What goes wrong:** A room with an L-shape has a north wall that is not contiguous — there's a "notch". A `position: 3` on the north wall is ambiguous if the north wall has a gap.

**Why it happens:** The `position` field is a single integer, but the wall may not be a single contiguous segment.

**How to avoid:** When computing door position, iterate cells along the wall in order (left to right for north/south, top to bottom for east/west), skipping cells that have no wall segment at that position (i.e., are interior). Position `N` means the Nth exterior wall cell from the start of the wall side.

**Warning signs:** A door appears floating in mid-air rather than on an edge. Test with L-shaped rooms in the sample map.

### Pitfall 2: Adjacent Rooms Sharing a Wall Produce Visual Artifacts

**What goes wrong:** Two rooms share a wall. Both rooms independently render their exterior edges. The shared wall is drawn twice (same pixel), which is fine — but if the floor fill extends to the rect edges, adjacent rooms' floor fills butt up against each other with no wall visible between them.

**Why it happens:** Each room's floor fill covers its rects completely. The wall lines are drawn on top, but if `strokeWidth` is too thin or floor fill color is too close to wall color, the wall is invisible.

**How to avoid:** Render walls after floor fills and with sufficient `strokeWidth` (at least 1.5px). The amber wall color (#8b7355) contrasts well against the dark floor (#0f1515).

### Pitfall 3: TokenLayer findRoomAtCell Mismatch

**What goes wrong:** Tokens snap to grid cells but the old `findRoomAtCell` only tests a single rect. After the schema change, clicking a cell in the alcove of an L-shaped room returns `null` (no room found) even though the cell is validly inside the room.

**Why it happens:** Forgetting to update `TokenLayer.tsx` and `MapPreview.tsx` after changing the room type.

**How to avoid:** The `findRoomAtCell` update (multi-rect test) must be applied to both `TokenLayer.tsx` and `MapPreview.tsx` in the same plan that changes the types.

### Pitfall 4: GM Click-to-Reveal Conflicts with Pan/Drag

**What goes wrong:** GM attempts to click a room to reveal it, but the mouse-down starts a pan drag, so the click is never fired.

**Why it happens:** Pan drag captures `mousedown`. If the cursor moves even slightly, it registers as a drag, not a click.

**How to avoid:** Use the existing pattern: pan only activates after a drag threshold or if the click was not on an interactive element. Use the existing `target.closest('.encounter-map__room')` check in `handleMouseDown` to exempt room hits from pan initiation. The new renderer should add rooms to this exemption list.

### Pitfall 5: TypeScript Type Errors at the EncounterPanel Room List

**What goes wrong:** `EncounterPanel.tsx` builds `allRooms` from `deck.rooms` (a `RoomData[]`). `RoomData` currently has `x`, `y`, `width`, `height`, `status`. After the schema change, `GridRoom` has `rects`, no `status`. The room list rendering accesses `room.status` for the status badge.

**Why it happens:** The backend `getAllDecks` endpoint returns room data. If the Python serializer strips `status` (which is no longer in the YAML), the TypeScript type and the component rendering both need updating.

**How to avoid:** When updating `encounterMap.ts` types, check every consumer of `RoomData`. The room list in `EncounterPanel.tsx` must drop the status badge (or use `type` field instead if desired).

### Pitfall 6: Bounding Box Computed from Hidden Rooms Only

**What goes wrong:** On the player view, hidden rooms are not rendered. If the bounding box is computed only from visible rooms, the map shifts/resizes each time a room is revealed.

**Why it happens:** Computing viewBox from filtered rooms rather than all rooms.

**How to avoid:** Always compute the bounding box from ALL rooms in `mapData.rooms`, regardless of visibility. Only the rendering of individual rooms is visibility-filtered.

---

## Code Examples

### New TypeScript Types (replacing encounterMap.ts room types)

```typescript
// Source: project-specific (no external library)

export interface GridRect {
  x: number;  // grid cell X (left edge)
  y: number;  // grid cell Y (top edge)
  w: number;  // width in cells
  h: number;  // height in cells
}

export type WallSide = 'north' | 'south' | 'east' | 'west';

export interface DoorDef {
  wall: WallSide;
  position: number;     // cell index along the wall (0-based)
  type: DoorType;       // standard | airlock | blast_door | emergency
  status: DoorStatus;   // OPEN | CLOSED | LOCKED | SEALED
}

export interface GridRoom {
  id: string;
  name: string;         // empty string = corridor (no label)
  rects: GridRect[];
  doors?: DoorDef[];
  description?: string;
  type?: string;        // corridor | bridge | cargo | etc. (optional tag)
}

export interface GridEncounterMapData {
  name: string;
  deck_id?: string;
  location_name?: string;
  description?: string;
  unit_size?: number;   // pixels per cell, default 40
  rooms: GridRoom[];
  metadata?: MapMetadata;
}

// Type guard: identifies new grid-based format vs old format
export function isGridEncounterMap(mapData: any): mapData is GridEncounterMapData {
  return mapData &&
    Array.isArray(mapData.rooms) &&
    mapData.rooms.length > 0 &&
    Array.isArray(mapData.rooms[0].rects);
}
```

### SVG Background Grid Pattern

```tsx
// Source: SVG specification (patternUnits="userSpaceOnUse")
<defs>
  <pattern
    id="map-bg-grid"
    width={unitSize}
    height={unitSize}
    patternUnits="userSpaceOnUse"
    x={originX}
    y={originY}
  >
    <path
      d={`M ${unitSize} 0 L 0 0 0 ${unitSize}`}
      fill="none"
      stroke="#141e1e"
      strokeWidth={0.5}
    />
  </pattern>

  <pattern
    id="floor-scanline"
    width={unitSize}
    height={unitSize}
    patternUnits="userSpaceOnUse"
    x={originX}
    y={originY}
  >
    <line
      x1={0} y1={Math.floor(unitSize / 2)}
      x2={unitSize} y2={Math.floor(unitSize / 2)}
      stroke="#182020"
      strokeWidth={0.5}
    />
  </pattern>
</defs>

<rect
  x={originX} y={originY}
  width={svgWidth} height={svgHeight}
  fill="url(#map-bg-grid)"
/>
```

### Wall Segment Rendering

```tsx
// After computing walls via computeRoomWalls(room.rects):
const walls = computeRoomWalls(room.rects, unitSize);

return (
  <g key={room.id} className="encounter-map__room-group" opacity={roomOpacity}>
    {/* Floor fill — one rect per room rect */}
    {room.rects.map((rect, i) => (
      <rect
        key={`floor-${i}`}
        x={rect.x * unitSize}
        y={rect.y * unitSize}
        width={rect.w * unitSize}
        height={rect.h * unitSize}
        fill="url(#floor-scanline)"
        className="encounter-map__floor"
      />
    ))}

    {/* Walls — exterior perimeter only */}
    {walls.map((wall, i) => (
      <line
        key={`wall-${i}`}
        x1={wall.x1} y1={wall.y1}
        x2={wall.x2} y2={wall.y2}
        stroke="#8b7355"
        strokeWidth={1.5}
        strokeLinecap="square"
      />
    ))}

    {/* Click target — invisible rects for hit detection */}
    {isGM && room.rects.map((rect, i) => (
      <rect
        key={`hit-${i}`}
        x={rect.x * unitSize}
        y={rect.y * unitSize}
        width={rect.w * unitSize}
        height={rect.h * unitSize}
        fill="transparent"
        style={{ cursor: 'pointer' }}
        onClick={() => handleRoomClick(room)}
      />
    ))}

    {/* Room label — centered in bounding box, only if name is non-empty */}
    {room.name && (() => {
      const label = getRoomLabelPosition(room.rects, unitSize);
      return (
        <text
          x={label.x}
          y={label.y}
          className="encounter-map__room-label"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {room.name}
        </text>
      );
    })()}
  </g>
);
```

---

## Existing Code to Replace vs Reuse

This section maps each current file to its fate in Phase 7.

| File | Action | Reason |
|------|--------|--------|
| `src/types/encounterMap.ts` | Extend: add new types alongside old | Old types needed until all consumers updated; use `isGridEncounterMap()` guard |
| `src/components/domain/encounter/EncounterMapRenderer.tsx` | Rewrite render logic | New algorithm; keep pan/zoom, door symbol renderer, token layer wiring |
| `src/components/domain/encounter/EncounterMapRenderer.css` | Update | Amber wall color, floor texture, grid background classes |
| `src/components/domain/encounter/EncounterMapDisplay.tsx` | Small update | Add `isGridEncounterMap` branch alongside `isEncounterMap` |
| `src/components/domain/encounter/TokenLayer.tsx` | Update `findRoomAtCell` | Multi-rect room test |
| `src/components/gm/MapPreview.tsx` | Partial rewrite | New schema rendering; keep pan/zoom, door popup, token layer |
| `src/components/gm/EncounterPanel.tsx` | Update room list | `GridRoom` has no `status` field; drop status badge |
| `terminal/data_loader.py` | No change needed | Already loads YAML and returns dict; new schema loads transparently |
| `terminal/views.py` | No change needed | Passes map data as-is to frontend; schema change is transparent |
| `data/.../deck_1.yaml` | Manual rebuild | New format, clean break |
| `data/.../deck_2.yaml` | Manual rebuild | New format, clean break |

### What Carries Forward Unchanged

- **Pan/zoom implementation** (`handleWheel`, `handleMouseDown`, `handleMouseMove`, touch handlers) — identical logic
- **`renderDoorSymbol()`** — the door visual rendering function is independent of how door position is computed; it takes `(x, y, type, status, style, orientation, key)` and produces SVG
- **`TokenLayer.tsx` drag logic** — only `findRoomAtCell` changes; all drag/drop/ghost/pointer logic is unchanged
- **`EncounterPanel.tsx` room toggle sidebar** — the `handleRoomToggle` callback and API calls are unchanged; only the room list rendering (status badge) changes
- **All API endpoints** — `/gm/encounter/toggle-room/`, `/gm/encounter/switch-level/`, token CRUD — all unchanged
- **`ActiveView.encounter_room_visibility`** — keyed by room ID; room IDs are still strings; no backend change needed
- **Manifest/multi-deck system** — unchanged; each deck YAML is just in the new format

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Node-graph rooms (float freely, connected by path lines) | Grid rooms (coordinates define position, walls share grid edges) | Rooms align to a grid; adjacent rooms touch and share walls — compact, readable maps |
| `connections[]` array defines room topology | `doors[]` on each room defines openings | No need to define connections at all for layout; doors are self-contained on rooms |
| `grid.width` / `grid.height` declares canvas size | `svgWidth`/`svgHeight` computed from room bounding box | No canvas size drift; map auto-sizes to content |
| `RoomData.x`, `.y`, `.width`, `.height` (single rect) | `GridRoom.rects[]` (multiple rects) | Irregular shapes (L, T, U) without special-casing |

---

## Open Questions

1. **Door position on complex multi-rect walls**
   - What we know: `position` is a cell index along the wall side
   - What's unclear: For an L-shaped room, the "north" wall may consist of two separate segments. Does `position: 3` count from the leftmost segment including the gap, or only through contiguous cells?
   - Recommendation: Count position only through cells that have an actual wall segment on that side (i.e., cells where `computeRoomWalls` produced an edge on that side). Skip cells that are interior to the room. This way, position 0 is always the first exterior cell on that wall — deterministic regardless of shape.

2. **Terminal and POI positions in the new schema**
   - What we know: The old schema had `terminal.position.x` and `terminal.position.y` as absolute grid coordinates matching the old room coordinate system
   - What's unclear: Should terminals/POIs be kept in the new format, and if so, as absolute grid coordinates or room-relative?
   - Recommendation: Keep as absolute grid coordinates to match the token coordinate system. The existing `TerminalData` and `PoiData` types need only minor updates if any. However, if the CONTEXT.md does not mention keeping terminals/POIs, they can be safely dropped from the sample map and addressed in a later plan.

3. **Deck switching with new schema**
   - What we know: Multi-deck maps use `manifest.yaml` + per-deck YAML files. The backend `load_deck_map()` loads by deck ID unchanged.
   - What's unclear: The sample map — should it be single-deck or multi-deck?
   - Recommendation: The sample map should be single-deck for simplicity. The rebuilt Morrigan decks retain multi-deck structure (same manifest.yaml, two new-format deck YAMLs).

4. **`isGM` prop wiring for click-to-reveal**
   - What we know: `EncounterMapRenderer` receives `isGM` prop. `MapPreview` also receives `isGM`. The `onRoomToggle` callback needs to be threaded from `EncounterPanel` → `MapPreview` → `EncounterMapRenderer`.
   - What's unclear: Should `EncounterMapRenderer` (the player terminal renderer) also receive `onRoomToggle`? If so, it must be a no-op when `isGM` is false.
   - Recommendation: Add `onRoomToggle?: (roomId: string, visible: boolean) => void` to `EncounterMapRenderer` props. Guard it behind `isGM` check inside the renderer. On the player terminal, `isGM` is false and `onRoomToggle` is not provided — no change in player behavior.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection of `/home/gjohnson/mothership/charon/src/components/domain/encounter/EncounterMapRenderer.tsx` — existing render architecture and door symbol function
- Direct codebase inspection of `/home/gjohnson/mothership/charon/src/types/encounterMap.ts` — current type definitions
- Direct codebase inspection of `/home/gjohnson/mothership/charon/src/components/gm/MapPreview.tsx` — GM preview renderer
- Direct codebase inspection of `/home/gjohnson/mothership/charon/src/components/gm/EncounterPanel.tsx` — GM panel architecture
- Direct codebase inspection of `/home/gjohnson/mothership/charon/src/components/domain/encounter/TokenLayer.tsx` — token drag system
- Direct codebase inspection of `/home/gjohnson/mothership/charon/terminal/data_loader.py` — YAML loading pipeline
- Direct codebase inspection of `/home/gjohnson/mothership/charon/data/galaxy/sol/earth/uscss_morrigan/map/deck_1.yaml` — current map schema
- SVG specification: `patternUnits="userSpaceOnUse"` for background grid (browser native, HIGH confidence)
- Edge-set exclusion algorithm: standard computer graphics technique for axis-aligned rectangle union (HIGH confidence — no library needed)

### Secondary (MEDIUM confidence)

- Visual reference: `/home/gjohnson/mothership/charon/sample_ui/example_ship_map.png` — dark rooms on dark background, dense compact layout, irregular shapes, blueprint aesthetic

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; everything uses existing libraries
- Architecture: HIGH — SVG edge-set algorithm is well-understood for axis-aligned geometry; existing patterns confirmed by code inspection
- Pitfalls: HIGH — derived from direct inspection of consumers that will break (TokenLayer, EncounterPanel room list), and from known SVG interaction gotchas in existing code

**Research date:** 2026-02-21
**Valid until:** Stable — this research references no external libraries with active release cycles. Valid indefinitely unless project stack changes.
