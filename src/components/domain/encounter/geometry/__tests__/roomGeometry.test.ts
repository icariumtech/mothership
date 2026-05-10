import { describe, expect, it } from 'vitest';
import {
  Door,
  GridRoom,
  HullDef,
} from '../../../../../types/encounterMap';
import {
  doorEndpoints,
  doorGridPosition,
  doorWallAxis,
  GridEdge,
  GridPoint,
  polygonAreaCentroid,
  roomBBoxGrid,
  roomChamferedPolygon,
  roomLabelGrid,
  roomWallEdges,
} from '../roomGeometry';

const EPS = 1e-9;

const closeToPoint = (a: GridPoint, b: GridPoint, eps = EPS) => {
  expect(Math.abs(a.gx - b.gx)).toBeLessThan(eps);
  expect(Math.abs(a.gy - b.gy)).toBeLessThan(eps);
};

// -- Fixture factories --------------------------------------------------

const rectRoom = (id: string, x: number, y: number, w: number, h: number): GridRoom => ({
  id,
  name: id,
  rects: [{ x, y, w, h }],
});

const multiRectRoom = (
  id: string,
  rects: Array<{ x: number; y: number; w: number; h: number; chamfer?: number }>,
): GridRoom => ({ id, name: id, rects });

const circleRoom = (id: string, cx: number, cy: number, r: number): GridRoom => ({
  id,
  name: id,
  rects: [],
  circle: { cx, cy, r },
});

const polygonRoom = (id: string, poly: [number, number][]): GridRoom => ({
  id,
  name: id,
  rects: [],
  polygon: poly,
});

const door = (over: Partial<Door> = {}): Door => ({
  id: 'd',
  x: 0,
  y: 0,
  angle: 0,
  width: 1,
  roomA: 'a',
  roomB: 'b',
  type: 'standard',
  status: 'CLOSED',
  ...over,
});

// -- roomLabelGrid -----------------------------------------------------

describe('roomLabelGrid', () => {
  it('returns rect bbox center for a single rect', () => {
    const r = rectRoom('a', 2, 4, 6, 4); // x∈[2,8], y∈[4,8]
    closeToPoint(roomLabelGrid(r), { gx: 5, gy: 6 });
  });

  it('returns multi-rect bbox center (not per-rect)', () => {
    // L-shape: horizontal arm x∈[0,4] y∈[0,2]; vertical arm x∈[0,2] y∈[2,6]
    const r = multiRectRoom('L', [
      { x: 0, y: 0, w: 4, h: 2 },
      { x: 0, y: 2, w: 2, h: 4 },
    ]);
    closeToPoint(roomLabelGrid(r), { gx: 2, gy: 3 }); // bbox: x∈[0,4], y∈[0,6]
  });

  it('returns circle center for a circle room', () => {
    const r = circleRoom('c', 7.5, 3.5, 2);
    closeToPoint(roomLabelGrid(r), { gx: 7.5, gy: 3.5 });
  });

  it('returns area-weighted centroid for a square polygon', () => {
    const r = polygonRoom('p', [
      [0, 0], [4, 0], [4, 4], [0, 4],
    ]);
    closeToPoint(roomLabelGrid(r), { gx: 2, gy: 2 });
  });

  it('returns area-weighted centroid for an L-shape polygon (asymmetric)', () => {
    // L-shape: 4x2 horizontal arm + 2x2 vertical arm offset.
    // Vertices: (0,0)-(4,0)-(4,2)-(2,2)-(2,4)-(0,4)-(0,0).
    // Total area=12; piece1 (4x2 lower) area=8 centroid (2,1); piece2 (2x2 upper-left) area=4 centroid (1,3).
    // Combined area-weighted centroid: ((8*2 + 4*1)/12, (8*1 + 4*3)/12) = (20/12, 20/12) = (5/3, 5/3).
    const r = polygonRoom('L', [
      [0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4],
    ]);
    closeToPoint(roomLabelGrid(r), { gx: 5 / 3, gy: 5 / 3 }, 1e-6);
  });

  it('falls back to (0,0) for an empty room', () => {
    const r: GridRoom = { id: 'empty', name: 'empty', rects: [] };
    closeToPoint(roomLabelGrid(r), { gx: 0, gy: 0 });
  });
});

// -- roomBBoxGrid ------------------------------------------------------

describe('roomBBoxGrid', () => {
  it('computes bbox of a single rect room', () => {
    const r = rectRoom('a', 1, 1, 4, 3);
    expect(roomBBoxGrid([r])).toEqual({ gx: 1, gy: 1, gw: 4, gh: 3 });
  });

  it('extends bbox across multiple rooms', () => {
    const a = rectRoom('a', 0, 0, 2, 2);
    const b = rectRoom('b', 5, 5, 2, 2);
    expect(roomBBoxGrid([a, b])).toEqual({ gx: 0, gy: 0, gw: 7, gh: 7 });
  });

  it('includes circle and polygon room extents', () => {
    const c = circleRoom('c', 5, 5, 3); // x∈[2,8] y∈[2,8]
    const p = polygonRoom('p', [[0, 0], [10, 0], [10, 1]]); // x∈[0,10] y∈[0,1]
    const bb = roomBBoxGrid([c, p]);
    expect(bb).toEqual({ gx: 0, gy: 0, gw: 10, gh: 8 });
  });

  it('includes hull polygon when provided (extends bbox)', () => {
    const r = rectRoom('a', 5, 5, 2, 2);
    const hull: HullDef = { polygon: [[0, 0], [20, 0], [20, 20], [0, 20]] };
    expect(roomBBoxGrid([r], hull)).toEqual({ gx: 0, gy: 0, gw: 20, gh: 20 });
  });

  it('applies grid-cell padding evenly on all sides', () => {
    const r = rectRoom('a', 0, 0, 4, 4);
    expect(roomBBoxGrid([r], undefined, 2)).toEqual({ gx: -2, gy: -2, gw: 8, gh: 8 });
  });

  it('falls back to (0,0)–(10,10) for empty input', () => {
    expect(roomBBoxGrid([])).toEqual({ gx: 0, gy: 0, gw: 10, gh: 10 });
  });
});

// -- roomWallEdges -----------------------------------------------------

describe('roomWallEdges', () => {
  it('returns 4×perimeter unit edges for a single rect', () => {
    // 2x3 rect at origin: 2*(2+3) = 10 unit edges
    const edges = roomWallEdges([{ x: 0, y: 0, w: 2, h: 3 }]);
    expect(edges).toHaveLength(10);
  });

  it('drops the shared edge for two adjacent rects', () => {
    // Two 2x2 rects side-by-side share two unit edges (vertical line at x=2, y=0..2).
    // Perimeter = 4*4 - 2*2 = 12 (each shared edge counted twice in raw perim).
    const edges = roomWallEdges([
      { x: 0, y: 0, w: 2, h: 2 },
      { x: 2, y: 0, w: 2, h: 2 },
    ]);
    expect(edges).toHaveLength(12);
    // No edge should sit on the shared line at x=2 (between the two rects)
    const sharedLineEdges = edges.filter(
      (e) => e.from.gx === 2 && e.to.gx === 2 && e.from.gy >= 0 && e.from.gy <= 2,
    );
    expect(sharedLineEdges).toHaveLength(0);
  });

  it('produces an L-shape exterior (correct unit-edge count)', () => {
    // L-shape: horizontal arm (4x2) + vertical arm (2x2).
    // Unit-edge perimeter = 4 + 2 + 2 + 2 + 2 + 4 = 16
    const edges = roomWallEdges([
      { x: 0, y: 0, w: 4, h: 2 },
      { x: 0, y: 2, w: 2, h: 2 },
    ]);
    expect(edges).toHaveLength(16);
  });

  it('returns empty array for empty rect list', () => {
    expect(roomWallEdges([])).toEqual([]);
  });

  it('each edge spans exactly one cell unit', () => {
    const edges: GridEdge[] = roomWallEdges([{ x: 0, y: 0, w: 3, h: 3 }]);
    for (const e of edges) {
      const dx = Math.abs(e.to.gx - e.from.gx);
      const dy = Math.abs(e.to.gy - e.from.gy);
      // Either pure horizontal (dx=1, dy=0) or pure vertical (dx=0, dy=1)
      expect(dx + dy).toBe(1);
    }
  });
});

// -- roomChamferedPolygon ----------------------------------------------

describe('roomChamferedPolygon', () => {
  it('returns 4 points for chamfer = 0', () => {
    const poly = roomChamferedPolygon({ x: 0, y: 0, w: 4, h: 3 });
    expect(poly).toHaveLength(4);
  });

  it('returns 4 points when chamfer is omitted', () => {
    const poly = roomChamferedPolygon({ x: 1, y: 2, w: 3, h: 3 });
    expect(poly).toHaveLength(4);
  });

  it('returns 8 points for chamfer > 0', () => {
    const poly = roomChamferedPolygon({ x: 0, y: 0, w: 4, h: 4, chamfer: 1 });
    expect(poly).toHaveLength(8);
  });

  it('clamps chamfer >= half the smaller dimension', () => {
    // For a 4x4 rect, chamfer=2 would degenerate; polygon2d clamps to 2-eps.
    const poly = roomChamferedPolygon({ x: 0, y: 0, w: 4, h: 4, chamfer: 99 });
    expect(poly).toHaveLength(8);
    // Each point must remain within the rect.
    for (const p of poly) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(4);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(4);
    }
  });
});

// -- doorGridPosition --------------------------------------------------

describe('doorGridPosition', () => {
  it('returns the door (x, y) verbatim as a GridPoint', () => {
    const d = door({ x: 7.5, y: 2 });
    expect(doorGridPosition(d)).toEqual({ gx: 7.5, gy: 2 });
  });
});

// -- doorWallAxis ------------------------------------------------------

describe('doorWallAxis', () => {
  it('classifies angle=0 as EW', () => {
    expect(doorWallAxis(door({ angle: 0 }))).toBe('EW');
  });

  it('classifies angle=90 as NS', () => {
    expect(doorWallAxis(door({ angle: 90 }))).toBe('NS');
  });

  it('classifies angle=180 as EW (mod 180)', () => {
    expect(doorWallAxis(door({ angle: 180 }))).toBe('EW');
  });

  it('classifies angle=270 as NS (mod 180)', () => {
    expect(doorWallAxis(door({ angle: 270 }))).toBe('NS');
  });

  it('classifies angle=45 as diagonal', () => {
    expect(doorWallAxis(door({ angle: 45 }))).toBe('diagonal');
  });

  it('handles negative angles', () => {
    expect(doorWallAxis(door({ angle: -90 }))).toBe('NS');
  });

  it('classifies near-axis angles (within tolerance)', () => {
    expect(doorWallAxis(door({ angle: 0.5 }))).toBe('EW');
    expect(doorWallAxis(door({ angle: 89.5 }))).toBe('NS');
  });
});

// -- doorEndpoints -----------------------------------------------------

describe('doorEndpoints', () => {
  it('axis-aligned EW door between two stacked rect rooms', () => {
    // roomA at y∈[0,3], roomB at y∈[3,6], door at (2.5, 3) angle=0
    const a = rectRoom('a', 0, 0, 5, 3);
    const b = rectRoom('b', 0, 3, 5, 3);
    const d = door({ x: 2.5, y: 3, angle: 0, roomA: 'a', roomB: 'b' });
    const [aCell, bCell] = doorEndpoints(d, [a, b]);
    expect(aCell).toEqual({ gx: 2, gy: 2 }); // cell above wall, inside roomA
    expect(bCell).toEqual({ gx: 2, gy: 3 }); // cell below wall, inside roomB
  });

  it('axis-aligned NS door between two side-by-side rect rooms', () => {
    // roomA at x∈[0,3], roomB at x∈[3,6], door at (3, 1.5) angle=90
    const a = rectRoom('a', 0, 0, 3, 3);
    const b = rectRoom('b', 3, 0, 3, 3);
    const d = door({ x: 3, y: 1.5, angle: 90, roomA: 'a', roomB: 'b' });
    const [aCell, bCell] = doorEndpoints(d, [a, b]);
    expect(aCell).toEqual({ gx: 2, gy: 1 }); // cell left of wall, inside roomA
    expect(bCell).toEqual({ gx: 3, gy: 1 }); // cell right of wall, inside roomB
  });

  it('exterior door returns null for second cell', () => {
    const a = rectRoom('a', 0, 0, 4, 4);
    const d = door({ x: 2.5, y: 4, angle: 0, roomA: 'a', roomB: null });
    const [aCell, bCell] = doorEndpoints(d, [a]);
    expect(bCell).toBeNull();
    expect(aCell.gx).toBe(2);
    // aCell should be inside roomA (above the wall at y=4)
    expect(aCell.gy).toBe(3);
  });

  it('diagonal door returns two distinct cells', () => {
    const a = rectRoom('a', 0, 0, 4, 4);
    const b = rectRoom('b', 4, 0, 4, 4);
    const d = door({ x: 4, y: 2, angle: 45, roomA: 'a', roomB: 'b' });
    const [aCell, bCell] = doorEndpoints(d, [a, b]);
    expect(bCell).not.toBeNull();
    // Cells should be different
    expect(aCell.gx !== bCell!.gx || aCell.gy !== bCell!.gy).toBe(true);
  });

  it('uses room-membership to flip candidates when roomA is on the "second" side', () => {
    // roomA at y∈[3,6] (BELOW the door wall), roomB at y∈[0,3]
    // Door at (2.5, 3) angle=0 — same wall as the first test, but roomA is now below.
    const a = rectRoom('a', 0, 3, 5, 3);
    const b = rectRoom('b', 0, 0, 5, 3);
    const d = door({ x: 2.5, y: 3, angle: 0, roomA: 'a', roomB: 'b' });
    const [aCell, bCell] = doorEndpoints(d, [a, b]);
    // aCell should be in roomA — below the wall
    expect(aCell).toEqual({ gx: 2, gy: 3 });
    expect(bCell).toEqual({ gx: 2, gy: 2 });
  });
});

// -- polygonAreaCentroid (tuple polygon shim) --------------------------

describe('polygonAreaCentroid (roomGeometry export)', () => {
  it('matches polygon2d for a square', () => {
    const c = polygonAreaCentroid([[0, 0], [4, 0], [4, 4], [0, 4]]);
    closeToPoint(c, { gx: 2, gy: 2 });
  });

  it('matches polygon2d for a triangle', () => {
    // Triangle (0,0)-(6,0)-(0,6); centroid = (2, 2)
    const c = polygonAreaCentroid([[0, 0], [6, 0], [0, 6]]);
    closeToPoint(c, { gx: 2, gy: 2 }, 1e-6);
  });
});
