/**
 * roomGeometry — grid-space, domain-aware geometry for encounter maps.
 *
 * Lifted from `EncounterMapRenderer.tsx`. All return types are grid-space:
 * fractional cell coordinates, never pixel/SVG coordinates.
 *
 * INVARIANT 1 (interface): this module never returns SVG coords. All numbers
 * are in grid-cell units. The `mapView` module is the ONLY producer of SVG
 * coordinates — it composes this module's output with a `Projection`.
 *
 * Allowed imports: `polygon2d`, `encounterMap` types.
 * Forbidden imports: `gridProjection` (would invert the dependency), pixel
 * concepts (ratios are fine; pixel ratios are not).
 */
import { Door, GridRect, GridRoom, HullDef } from '../../../../types/encounterMap';
import {
  octagonFromRect,
  Point,
  Polygon,
  polygonAreaCentroid as polyAreaCentroid,
} from '../../../../utils/polygon2d';

// ---- Grid-space coordinate types --------------------------------------

/** A fractional grid-space point. */
export interface GridPoint { gx: number; gy: number; }

/** A grid cell — integer grid coordinates of a single cell's origin. */
export interface GridCell { gx: number; gy: number; }

/** A grid-space line segment. */
export interface GridEdge { from: GridPoint; to: GridPoint; }

/** A grid-space axis-aligned rectangle. */
export interface GridRectArea { gx: number; gy: number; gw: number; gh: number; }

// ---- Pass-through helpers ---------------------------------------------

/**
 * Area-weighted centroid of a polygon expressed as `[number, number][]`
 * (the `GridRoom.polygon` shape). Wraps `polygon2d.polygonAreaCentroid`
 * after converting tuples to `Point` objects.
 *
 * Provided as a `roomGeometry`-namespace export so callers don't need to
 * convert tuple polygons themselves.
 */
export function polygonAreaCentroid(poly: [number, number][]): GridPoint {
  const pts: Polygon = poly.map(([x, y]) => ({ x, y }));
  const c = polyAreaCentroid(pts);
  return { gx: c.x, gy: c.y };
}

// ---- roomLabelGrid ----------------------------------------------------

/**
 * Visual center of a room in grid space — used for the room-name label.
 *
 * - Rect rooms: bbox centroid of all rects.
 * - Circle rooms: the circle center.
 * - Polygon rooms: area-weighted centroid (shoelace) — correct for
 *   irregular / concave shapes where the vertex average is misleading.
 */
export function roomLabelGrid(room: GridRoom): GridPoint {
  if ((room.rects ?? []).length > 0) {
    const minX = Math.min(...room.rects.map((r) => r.x));
    const minY = Math.min(...room.rects.map((r) => r.y));
    const maxX = Math.max(...room.rects.map((r) => r.x + r.w));
    const maxY = Math.max(...room.rects.map((r) => r.y + r.h));
    return { gx: (minX + maxX) / 2, gy: (minY + maxY) / 2 };
  }
  if (room.circle) {
    return { gx: room.circle.cx, gy: room.circle.cy };
  }
  if (room.polygon && room.polygon.length > 0) {
    return polygonAreaCentroid(room.polygon);
  }
  return { gx: 0, gy: 0 };
}

// ---- roomBBoxGrid -----------------------------------------------------

/**
 * Bounding box of an entire collection of rooms (with optional hull),
 * in grid space, with optional grid-cell padding.
 *
 * Always computed from ALL supplied rooms — visibility filtering is the
 * caller's concern. The hull (if present) is included so the resulting
 * canvas never clips the ship outline.
 *
 * Falls back to a `(0,0)–(10,10)` box for empty inputs to give callers a
 * sensible default rather than `Infinity`.
 */
export function roomBBoxGrid(
  rooms: GridRoom[],
  hull?: HullDef,
  padding = 0,
): GridRectArea {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const room of rooms) {
    for (const rect of room.rects ?? []) {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.w);
      maxY = Math.max(maxY, rect.y + rect.h);
    }
    if (room.circle) {
      const { cx, cy, r } = room.circle;
      minX = Math.min(minX, cx - r);
      minY = Math.min(minY, cy - r);
      maxX = Math.max(maxX, cx + r);
      maxY = Math.max(maxY, cy + r);
    }
    if (room.polygon) {
      for (const [px, py] of room.polygon) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
    }
  }
  if (hull) {
    for (const [px, py] of hull.polygon) {
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }
  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 10;
    maxY = 10;
  }
  return {
    gx: minX - padding,
    gy: minY - padding,
    gw: (maxX - minX) + padding * 2,
    gh: (maxY - minY) + padding * 2,
  };
}

// ---- roomWallEdges ----------------------------------------------------

/**
 * Compute the exterior wall edges of a rect-only room using the
 * wall-segment algorithm: cell edges that appear in exactly one rect of
 * the room are exterior; shared interior edges (count >= 2) cancel.
 *
 * Returns grid-space edges (each edge spans one cell unit). Callers
 * project to SVG via `mapView.wallEdges()` / `projection.project()`.
 */
export function roomWallEdges(rects: GridRect[]): GridEdge[] {
  const edgeCounts = new Map<string, number>();
  const addEdges = (rect: GridRect) => {
    for (let cx = rect.x; cx < rect.x + rect.w; cx++) {
      const top = `H:${cx}:${rect.y}`;
      const bot = `H:${cx}:${rect.y + rect.h}`;
      edgeCounts.set(top, (edgeCounts.get(top) || 0) + 1);
      edgeCounts.set(bot, (edgeCounts.get(bot) || 0) + 1);
    }
    for (let cy = rect.y; cy < rect.y + rect.h; cy++) {
      const left = `V:${rect.x}:${cy}`;
      const right = `V:${rect.x + rect.w}:${cy}`;
      edgeCounts.set(left, (edgeCounts.get(left) || 0) + 1);
      edgeCounts.set(right, (edgeCounts.get(right) || 0) + 1);
    }
  };
  for (const rect of rects) addEdges(rect);

  const edges: GridEdge[] = [];
  for (const [key, count] of edgeCounts) {
    if (count !== 1) continue;
    const [orient, gxStr, gyStr] = key.split(':');
    const gx = parseInt(gxStr, 10);
    const gy = parseInt(gyStr, 10);
    if (orient === 'H') {
      edges.push({ from: { gx, gy }, to: { gx: gx + 1, gy } });
    } else {
      edges.push({ from: { gx, gy }, to: { gx, gy: gy + 1 } });
    }
  }
  return edges;
}

// ---- roomChamferedPolygon --------------------------------------------

/**
 * Build the polygon for a single rect with optional diagonal chamfer.
 * Returns 4 points if `chamfer === 0` or omitted, 8 points otherwise.
 *
 * Delegates to `polygon2d.octagonFromRect`. Output points are grid-space
 * `Point` objects (`{x, y}`), matching `polygon2d`'s convention.
 */
export function roomChamferedPolygon(rect: GridRect): Polygon {
  return octagonFromRect(
    { x: rect.x, y: rect.y, w: rect.w, h: rect.h },
    rect.chamfer ?? 0,
  );
}

// ---- doorGridPosition -------------------------------------------------

/**
 * Trivial accessor returning the door's grid-space center as a
 * `GridPoint`. Kept for parallelism with future iso-aware variants where
 * the door's spatial position may be projection-dependent.
 *
 * Accepts the canonical `Door` only — legacy `DoorDef` is normalized to
 * `Door` at load time by `doorNormalizer` before reaching this function.
 */
export function doorGridPosition(door: Door): GridPoint {
  return { gx: door.x, gy: door.y };
}

// ---- doorWallAxis ----------------------------------------------------

/** The axis a door's wall is aligned to (deduced from canonical angle). */
export type DoorWallAxis = 'EW' | 'NS' | 'diagonal';

/**
 * Derive the wall axis from a door's canonical `angle` (degrees).
 *
 * Convention (matches the renderer's existing slot dimensions):
 *   - `angle ≈ 0` (mod 180)   → 'EW'  (door slot is horizontal — sits on N/S wall)
 *   - `angle ≈ 90` (mod 180)  → 'NS'  (door slot is vertical   — sits on E/W wall)
 *   - anything else           → 'diagonal'
 */
export function doorWallAxis(door: Door): DoorWallAxis {
  // Normalize to [0, 180) since slot orientation is mod 180.
  const a = ((door.angle % 180) + 180) % 180;
  const EPS = 1; // ±1 degree tolerance for floating-point input
  if (a < EPS || a > 180 - EPS) return 'EW';
  if (Math.abs(a - 90) < EPS) return 'NS';
  return 'diagonal';
}

// ---- doorEndpoints ---------------------------------------------------

/**
 * The two grid cells the door connects, one per side. The cells are
 * derived from the door's canonical `(x, y, angle, roomA, roomB)` and
 * are useful for door-visibility logic ("is the room on the *other* side
 * of this door visible?") and for legacy migration heuristics.
 *
 * - First cell sits inside `roomA`-side of the door slot.
 * - Second cell is `roomB`'s side, or `null` for exterior doors.
 *
 * Strategy:
 *   - For axis-aligned doors (angle ≈ 0 or 90), step half a cell in the
 *     direction normal to the door slot, then floor to integer cell.
 *   - For diagonal doors, step half a cell along the angle's normal in
 *     each direction.
 *
 * The `rooms` array is unused in the simple axis-aligned case but
 * accepted for parity with future shape-aware variants (e.g. polygon
 * rooms that need a containment test to choose which cell is `roomA`'s).
 *
 * Returns `[roomACell, roomBCell | null]` where the first cell is on
 * `roomA`'s side of the door slot.
 */
export function doorEndpoints(
  door: Door,
  rooms: GridRoom[],
): [GridCell, GridCell | null] {
  const axis = doorWallAxis(door);
  // Compute the two candidate adjacent cells centered on the door.
  let candA: GridCell;
  let candB: GridCell;
  if (axis === 'EW') {
    // Horizontal slot: door sits on a horizontal cell-edge (constant y).
    // The two adjacent cells are above and below.
    const wallY = Math.round(door.y);
    const cellX = Math.floor(door.x);
    candA = { gx: cellX, gy: wallY - 1 };
    candB = { gx: cellX, gy: wallY };
  } else if (axis === 'NS') {
    // Vertical slot: door sits on a vertical cell-edge (constant x).
    // The two adjacent cells are left and right.
    const wallX = Math.round(door.x);
    const cellY = Math.floor(door.y);
    candA = { gx: wallX - 1, gy: cellY };
    candB = { gx: wallX,     gy: cellY };
  } else {
    // Diagonal door: step half a cell along the wall normal.
    const angRad = (door.angle * Math.PI) / 180;
    const nx = Math.cos(angRad);
    const ny = Math.sin(angRad);
    candA = { gx: Math.floor(door.x - nx * 0.5), gy: Math.floor(door.y - ny * 0.5) };
    candB = { gx: Math.floor(door.x + nx * 0.5), gy: Math.floor(door.y + ny * 0.5) };
  }

  // Pick which candidate belongs to roomA, using room containment for
  // shape-aware rooms; fall back to candidate order for ambiguous cases.
  const roomA = rooms.find((r) => r.id === door.roomA);
  const aIsCandA = roomA ? cellInRoom(candA, roomA) : true;
  const aIsCandB = roomA ? cellInRoom(candB, roomA) : false;

  let aCell: GridCell;
  let otherCell: GridCell | null;
  if (aIsCandA && !aIsCandB) {
    aCell = candA;
    otherCell = candB;
  } else if (aIsCandB && !aIsCandA) {
    aCell = candB;
    otherCell = candA;
  } else {
    // Either both candidates are in roomA (degenerate; shouldn't happen
    // for a valid door), or neither is (room shape doesn't include the
    // adjacent cell exactly — common for polygon rooms whose shapes
    // don't snap to integer cells). Default: candA is roomA-side.
    aCell = candA;
    otherCell = candB;
  }

  if (door.roomB === null) return [aCell, null];
  return [aCell, otherCell];
}

// ---- internal: cell containment --------------------------------------

/** Test whether a grid cell's center lies inside a room. */
function cellInRoom(cell: GridCell, room: GridRoom): boolean {
  const cx = cell.gx + 0.5;
  const cy = cell.gy + 0.5;
  if (room.circle) {
    const { cx: rcx, cy: rcy, r } = room.circle;
    return (cx - rcx) ** 2 + (cy - rcy) ** 2 <= r * r;
  }
  if (room.polygon && room.polygon.length > 0) {
    const poly: Polygon = room.polygon.map(([x, y]) => ({ x, y }));
    return pointInPolygonLocal({ x: cx, y: cy }, poly);
  }
  return (room.rects ?? []).some(
    (r) => cell.gx >= r.x && cell.gx < r.x + r.w && cell.gy >= r.y && cell.gy < r.y + r.h,
  );
}

/**
 * Local point-in-polygon — duplicated trivially to avoid a circular
 * import path through `polygon2d`'s `pointInPolygon` re-export. In
 * practice this is fine: `polygon2d` is the source of truth and this
 * mirror is identical.
 */
function pointInPolygonLocal(p: Point, poly: Polygon): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const { x: xi, y: yi } = poly[i];
    const { x: xj, y: yj } = poly[j];
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Legacy adapter removed in plan 21-04: maps now ship top-level canonical
// `doors:` directly. See `src/components/domain/encounter/doors/doorNormalizer.ts`
// for the authored-shape → canonical-Door pipeline.
