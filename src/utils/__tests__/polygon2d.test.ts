import { describe, expect, it } from 'vitest';
import {
  octagonFromRect,
  pointInPolygon,
  polygonAreaCentroid,
  polygonBoundaryFromRay,
  type Point,
  type Polygon,
} from '../polygon2d';

const EPS = 1e-9;

const closeTo = (actual: number, expected: number, eps = EPS) =>
  expect(Math.abs(actual - expected)).toBeLessThan(eps);

const closeToPoint = (actual: Point, expected: Point, eps = EPS) => {
  closeTo(actual.x, expected.x, eps);
  closeTo(actual.y, expected.y, eps);
};

// -------------------- pointInPolygon --------------------

describe('pointInPolygon', () => {
  const unitSquare: Polygon = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  it('returns true for a point clearly inside the unit square', () => {
    expect(pointInPolygon({ x: 0.5, y: 0.5 }, unitSquare)).toBe(true);
  });

  it('returns false for a point clearly outside the unit square', () => {
    expect(pointInPolygon({ x: -0.1, y: 0.5 }, unitSquare)).toBe(false);
    expect(pointInPolygon({ x: 1.5, y: 0.5 }, unitSquare)).toBe(false);
    expect(pointInPolygon({ x: 0.5, y: 2 }, unitSquare)).toBe(false);
  });

  it('pins the boundary convention (ray-cast with strict < / !==)', () => {
    // Ray-casting with the standard `(yi > py) !== (yj > py)` test plus
    // `px < ...` puts boundary points in an undefined state — whether a given
    // edge counts depends on which side it lies on at the tie. The renderer
    // never queries boundary points (tokens live on cell centers), so callers
    // must NOT depend on a specific answer here. We pin the OBSERVED behavior
    // so accidental algorithm changes are caught:
    //   - bottom-left corner (0,0): returns true  (left/right edges flip parity once)
    //   - top-right corner (1,1):   returns false (no edge satisfies the strict < at yi==py)
    //   - left edge (0, 0.5):       returns true  (the right edge flips once)
    //   - bottom edge (0.5, 0):     returns true  (left edge flips, right doesn't)
    expect(pointInPolygon({ x: 0, y: 0 }, unitSquare)).toBe(true);
    expect(pointInPolygon({ x: 1, y: 1 }, unitSquare)).toBe(false);
    expect(pointInPolygon({ x: 0, y: 0.5 }, unitSquare)).toBe(true);
    expect(pointInPolygon({ x: 0.5, y: 0 }, unitSquare)).toBe(true);
  });

  // L-shape: square (0..2 by 0..2) with the upper-right (1..2 by 1..2) quadrant
  // removed. Vertices walk CCW.
  //
  //   (0,0)─(2,0)
  //     │     │
  //     │     │
  //   (0,1)  (2,1)
  //     │     │
  //     │   (1,1)─(1,2)
  //   (0,2)─(?)
  //
  // Actual vertex sequence used: (0,0), (2,0), (2,1), (1,1), (1,2), (0,2).
  const lShape: Polygon = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 0, y: 2 },
  ];

  it('returns true for a point in the populated arm of an L-shape', () => {
    expect(pointInPolygon({ x: 0.5, y: 0.5 }, lShape)).toBe(true); // bottom-left arm
    expect(pointInPolygon({ x: 1.5, y: 0.5 }, lShape)).toBe(true); // bottom-right arm
    expect(pointInPolygon({ x: 0.5, y: 1.5 }, lShape)).toBe(true); // top-left arm
  });

  it('returns false for a point in the concave notch of an L-shape', () => {
    expect(pointInPolygon({ x: 1.5, y: 1.5 }, lShape)).toBe(false); // missing quadrant
  });
});

// -------------------- polygonAreaCentroid --------------------

describe('polygonAreaCentroid', () => {
  it('returns the geometric center of a unit square', () => {
    const sq: Polygon = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    closeToPoint(polygonAreaCentroid(sq), { x: 0.5, y: 0.5 });
  });

  it('returns the centroid of a right triangle at (1, 1)', () => {
    // Right triangle (0,0)-(3,0)-(0,3). Centroid is at the average of
    // vertices = (1, 1) which the shoelace formula must also produce.
    const tri: Polygon = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: 3 },
    ];
    closeToPoint(polygonAreaCentroid(tri), { x: 1, y: 1 });
  });

  it('returns the hand-derived centroid of an irregular hexagon', () => {
    // Hexagon (0,0), (2,0), (3,1), (2,2), (0,2), (-1,1).
    // Shoelace gives signed area = 6 and centroid = (1, 1) (worked through
    // by hand; symmetric about (1, 1) so the answer is also obvious by
    // visual inspection).
    const hex: Polygon = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 1 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
      { x: -1, y: 1 },
    ];
    closeToPoint(polygonAreaCentroid(hex), { x: 1, y: 1 });
  });

  it('returns the centroid of a concave L-shape (≈ 5/6, 5/6)', () => {
    const lShape: Polygon = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
    ];
    // Hand-derived: signed area = 3, centroid = (15/18, 15/18) = (5/6, 5/6).
    closeToPoint(polygonAreaCentroid(lShape), { x: 5 / 6, y: 5 / 6 });
  });

  it('falls back to the vertex average for a degenerate (zero-area) polygon', () => {
    // Three collinear points.
    const collinear: Polygon = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    closeToPoint(polygonAreaCentroid(collinear), { x: 1, y: 0 });
  });

  it('handles an empty polygon without throwing or returning NaN', () => {
    closeToPoint(polygonAreaCentroid([]), { x: 0, y: 0 });
  });
});

// -------------------- polygonBoundaryFromRay --------------------

describe('polygonBoundaryFromRay', () => {
  const unitSquare: Polygon = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  it('hits the east wall at angle 0 from the center of a unit square', () => {
    const hit = polygonBoundaryFromRay(unitSquare, { x: 0.5, y: 0.5 }, 0);
    closeToPoint(hit, { x: 1, y: 0.5 });
  });

  it('hits the south wall at angle π/2 (SVG Y-down) from the center', () => {
    const hit = polygonBoundaryFromRay(unitSquare, { x: 0.5, y: 0.5 }, Math.PI / 2);
    closeToPoint(hit, { x: 0.5, y: 1 });
  });

  it('hits the west wall at angle π from the center', () => {
    const hit = polygonBoundaryFromRay(unitSquare, { x: 0.5, y: 0.5 }, Math.PI);
    closeToPoint(hit, { x: 0, y: 0.5 });
  });

  it('hits the north wall at angle -π/2 from the center', () => {
    const hit = polygonBoundaryFromRay(unitSquare, { x: 0.5, y: 0.5 }, -Math.PI / 2);
    closeToPoint(hit, { x: 0.5, y: 0 });
  });

  it('returns a known intersection from an off-centre origin', () => {
    // Ray east from (0.25, 0.5) hits the east edge x=1 at y=0.5.
    const hit = polygonBoundaryFromRay(unitSquare, { x: 0.25, y: 0.5 }, 0);
    closeToPoint(hit, { x: 1, y: 0.5 });
  });

  it('hits the diagonal wall of a triangle', () => {
    // Right triangle with hypotenuse from (1,0) to (0,1).
    const tri: Polygon = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    // Ray from (0.1, 0.1) at angle π/4 (toward south-east): direction
    // (cos π/4, sin π/4). Parametrically the hypotenuse is x+y=1, so the
    // hit point (0.1 + t·cos π/4, 0.1 + t·sin π/4) satisfies
    // 0.2 + t·√2 = 1  ⇒  t = 0.8/√2 ⇒ hit ≈ (0.5, 0.5).
    const hit = polygonBoundaryFromRay(tri, { x: 0.1, y: 0.1 }, Math.PI / 4);
    closeToPoint(hit, { x: 0.5, y: 0.5 });
  });
});

// -------------------- octagonFromRect --------------------

describe('octagonFromRect', () => {
  it('returns a 4-point plain rectangle when chamfer is 0', () => {
    const poly = octagonFromRect({ x: 0, y: 0, w: 4, h: 3 }, 0);
    expect(poly).toHaveLength(4);
    expect(poly).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ]);
  });

  it('returns a 4-point plain rectangle when chamfer is negative', () => {
    const poly = octagonFromRect({ x: 0, y: 0, w: 4, h: 3 }, -1);
    expect(poly).toHaveLength(4);
  });

  it('produces an 8-point octagon with exact coordinates for a 4x4 rect with chamfer 1', () => {
    const poly = octagonFromRect({ x: 0, y: 0, w: 4, h: 4 }, 1);
    expect(poly).toHaveLength(8);
    expect(poly).toEqual([
      { x: 1, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 1, y: 4 },
      { x: 0, y: 3 },
      { x: 0, y: 1 },
    ]);
  });

  it('honours the rect origin (non-zero x, y)', () => {
    const poly = octagonFromRect({ x: 10, y: 20, w: 4, h: 4 }, 1);
    expect(poly).toEqual([
      { x: 11, y: 20 },
      { x: 13, y: 20 },
      { x: 14, y: 21 },
      { x: 14, y: 23 },
      { x: 13, y: 24 },
      { x: 11, y: 24 },
      { x: 10, y: 23 },
      { x: 10, y: 21 },
    ]);
  });

  it('clamps an over-large chamfer to ≈ min(w, h) / 2 (still produces 8 valid points)', () => {
    // 4x6 rect, chamfer 99 must be clamped to min(4/2, 6/2) - epsilon = 1.99.
    const poly = octagonFromRect({ x: 0, y: 0, w: 4, h: 6 }, 99);
    expect(poly).toHaveLength(8);
    // The clamp is min(w, h) / 2 - 0.01 = 1.99 (the smaller dimension wins).
    const expectedC = Math.min(4 / 2 - 0.01, 6 / 2 - 0.01);
    expect(expectedC).toBeCloseTo(1.99, 10);
    closeToPoint(poly[0], { x: expectedC, y: 0 }, 1e-6);
    closeToPoint(poly[1], { x: 4 - expectedC, y: 0 }, 1e-6);
    closeToPoint(poly[2], { x: 4, y: expectedC }, 1e-6);
    closeToPoint(poly[3], { x: 4, y: 6 - expectedC }, 1e-6);
    closeToPoint(poly[4], { x: 4 - expectedC, y: 6 }, 1e-6);
    closeToPoint(poly[5], { x: expectedC, y: 6 }, 1e-6);
    closeToPoint(poly[6], { x: 0, y: 6 - expectedC }, 1e-6);
    closeToPoint(poly[7], { x: 0, y: expectedC }, 1e-6);
    // Resulting polygon must remain non-self-intersecting: the two top points
    // must not have crossed.
    expect(poly[0].x).toBeLessThan(poly[1].x);
  });

  it('round-trips through pointInPolygon (octagon center is inside)', () => {
    const poly = octagonFromRect({ x: 0, y: 0, w: 4, h: 4 }, 1);
    expect(pointInPolygon({ x: 2, y: 2 }, poly)).toBe(true);
    expect(pointInPolygon({ x: -1, y: 2 }, poly)).toBe(false);
  });
});
