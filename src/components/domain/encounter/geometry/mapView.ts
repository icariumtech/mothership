/**
 * mapView — closure facade combining `roomGeometry` (grid space) with a
 * `Projection` (grid → SVG). The renderer holds *one* `MapView` instance
 * per render and asks it for SVG-space positions.
 *
 * INVARIANT 2 (interface): `mapView` is the ONLY producer of SVG coords
 * inside the encounter map render. The renderer never multiplies by
 * `unitSize` directly — it asks the view.
 *
 * Future iso swap: `makeMapView(isoProjection({ unitSize, tilt, rotation }))`
 * produces a different view with no other module affected.
 */
import {
  Door,
  GridRect,
  GridRoom,
  HullDef,
} from '../../../../types/encounterMap';
import { Polygon } from '../../../../utils/polygon2d';
import {
  GridPoint,
  Projection,
  SvgPoint,
} from './gridProjection';
import {
  doorGridPosition,
  GridEdge,
  GridRectArea,
  roomBBoxGrid,
  roomChamferedPolygon,
  roomLabelGrid,
  roomWallEdges,
} from './roomGeometry';

// -------------------------------------------------------------------
// Public types
// -------------------------------------------------------------------

/** A line segment in SVG-pixel coordinates. */
export interface SvgEdge { from: SvgPoint; to: SvgPoint; }

/**
 * Bounds of a door slot: SVG center, width and height in pixels, and
 * the slot rotation angle (degrees, matching canonical Door.angle).
 *
 * Width and height correspond to the door slot's "long" and "short"
 * dimensions in SVG pixels, scaled by the projection's `unitSize`.
 */
export interface DoorBounds {
  center: SvgPoint;
  width: number;
  height: number;
  angle: number;
}

/** SVG-space bounding box (origin + size in pixels). */
export interface SvgBBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * The renderer-facing facade. Closure-captured projection means there is
 * exactly one source of pixel-scale truth per render pass.
 */
export interface MapView {
  /** SVG-space center of a canonical door. */
  doorPosition(door: Door): SvgPoint;

  /** SVG-space bounds + angle of a canonical door slot. */
  doorBounds(door: Door): DoorBounds;

  /**
   * SVG `<polygon points>` string for a rect (no chamfer).
   * Convenience — the same as projecting `roomChamferedPolygon` for a
   * chamfer-0 rect, but skips the polygon allocation.
   */
  roomPolygonPoints(rect: GridRect): string;

  /**
   * SVG `<polygon points>` string for a chamfered (or plain) rect.
   * 4 points if `rect.chamfer === 0` or absent, 8 points otherwise.
   */
  roomChamferedPolygonPoints(rect: GridRect): string;

  /** SVG-space wall edges for a room's `rects[]` (wall-segment algorithm). */
  wallEdges(rects: GridRect[]): SvgEdge[];

  /** SVG-space label position for a room. */
  labelPosition(room: GridRoom): SvgPoint;

  /**
   * SVG-space bounding box of a room collection (with optional hull
   * and grid-cell padding). Pixel sizes are derived by projecting the
   * grid-space bbox corners through `projection.project`.
   */
  bbox(rooms: GridRoom[], hull?: HullDef, padding?: number): SvgBBox;

  /** Pass-through: project a grid point to SVG. */
  project(p: GridPoint): SvgPoint;

  /** Pass-through: unproject an SVG point to grid. */
  unproject(p: SvgPoint): GridPoint;

  /**
   * Pixel-scale of one grid cell along an axis. Exposed for door slot
   * dimensions and other "size, not position" pixel computations.
   *
   * Defined as the projected length of the unit grid vector (1, 0).
   * For top-down this equals `unitSize`. For an iso projection this is
   * the projected horizontal cell extent (callers that need vertical
   * cell extent should use `project` directly).
   */
  unitSize: number;
}

// -------------------------------------------------------------------
// makeMapView — closure factory
// -------------------------------------------------------------------

/**
 * Build a `MapView` from a `Projection`. Captures the projection in
 * closure so a single instance can be passed around without rethreading
 * the projection through every call site.
 *
 * Idempotent: calling `makeMapView` twice with the same projection
 * yields functionally equivalent views (no shared mutable state).
 */
export function makeMapView(projection: Projection): MapView {
  // Projected length of the unit grid vector along x.
  const origin = projection.project({ gx: 0, gy: 0 });
  const unitX = projection.project({ gx: 1, gy: 0 });
  const unitSize = Math.hypot(unitX.x - origin.x, unitX.y - origin.y);

  const polygonToPointsString = (poly: Polygon): string => {
    return poly
      .map((p) => {
        const sp = projection.project({ gx: p.x, gy: p.y });
        return `${sp.x},${sp.y}`;
      })
      .join(' ');
  };

  const view: MapView = {
    doorPosition(door: Door): SvgPoint {
      const gp = doorGridPosition(door);
      return projection.project({ gx: gp.gx, gy: gp.gy });
    },

    doorBounds(door: Door): DoorBounds {
      const center = view.doorPosition(door);
      // Slot width along the wall = door.width grid cells × unitSize.
      // Slot height across the wall = a small fraction of unitSize so the
      // slot is a thin rectangle. Renderer used 20×12 px at unitSize=40,
      // giving a 0.5 ratio for slot length and 0.3 for slot thickness.
      const slotLength = door.width * unitSize * 0.5;
      const slotThickness = unitSize * 0.3;
      return {
        center,
        width: slotLength,
        height: slotThickness,
        angle: door.angle,
      };
    },

    roomPolygonPoints(rect: GridRect): string {
      // Plain 4-point rect — no chamfer.
      const x  = projection.project({ gx: rect.x, gy: rect.y });
      const x2 = projection.project({ gx: rect.x + rect.w, gy: rect.y + rect.h });
      const tr = projection.project({ gx: rect.x + rect.w, gy: rect.y });
      const bl = projection.project({ gx: rect.x, gy: rect.y + rect.h });
      return `${x.x},${x.y} ${tr.x},${tr.y} ${x2.x},${x2.y} ${bl.x},${bl.y}`;
    },

    roomChamferedPolygonPoints(rect: GridRect): string {
      const poly = roomChamferedPolygon(rect);
      return polygonToPointsString(poly);
    },

    wallEdges(rects: GridRect[]): SvgEdge[] {
      const gridEdges: GridEdge[] = roomWallEdges(rects);
      return gridEdges.map((e) => ({
        from: projection.project({ gx: e.from.gx, gy: e.from.gy }),
        to:   projection.project({ gx: e.to.gx,   gy: e.to.gy }),
      }));
    },

    labelPosition(room: GridRoom): SvgPoint {
      const g = roomLabelGrid(room);
      return projection.project({ gx: g.gx, gy: g.gy });
    },

    bbox(rooms: GridRoom[], hull?: HullDef, padding = 0): SvgBBox {
      const grid: GridRectArea = roomBBoxGrid(rooms, hull, padding);
      const tl = projection.project({ gx: grid.gx, gy: grid.gy });
      const br = projection.project({ gx: grid.gx + grid.gw, gy: grid.gy + grid.gh });
      // For top-down projection tl < br on both axes; for general
      // projections we normalize so width/height are non-negative.
      const originX = Math.min(tl.x, br.x);
      const originY = Math.min(tl.y, br.y);
      const width   = Math.abs(br.x - tl.x);
      const height  = Math.abs(br.y - tl.y);
      return { originX, originY, width, height };
    },

    project(p: GridPoint): SvgPoint {
      return projection.project(p);
    },

    unproject(p: SvgPoint): GridPoint {
      return projection.unproject(p);
    },

    unitSize,
  };

  return view;
}
