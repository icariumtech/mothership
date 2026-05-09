/**
 * polygon2d — pure 2D polygon math.
 *
 * Domain-free utility module: imports nothing from the encounter-map types
 * (or any other domain). Operates only on the local `Point` and `Polygon`
 * type aliases so this code can be reused for tokens, hulls, POIs, terminals,
 * or any other polygon-like surface in the project.
 *
 * INVARIANT: this file must NOT import from `src/types/encounterMap.ts`
 * (or any other domain module). Keep it deletion-resistant: if you add a
 * helper that needs domain types, put it in `roomGeometry` instead.
 *
 * Implementations are lifted from `EncounterMapRenderer.tsx` (the original
 * helpers stay in place until plan 21-03 wires the renderer to this module);
 * behavior parity is enforced by the test suite.
 */

// ---- Local types --------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export type Polygon = Point[];

/**
 * Local mirror of `GridRect` shape used by `octagonFromRect`. Kept domain-free
 * (no import from `encounterMap.ts`) so this module has no domain coupling.
 */
export interface GridRectShape {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---- pointInPolygon ----------------------------------------------

/**
 * Ray-casting point-in-polygon test.
 *
 * Convention for boundary points: the strict `<` / `!==` comparison in the
 * crossing test gives the standard "half-open" rule — a point exactly on the
 * boundary may return either `true` or `false` depending on which edges it
 * touches. Callers that need a robust on-edge classification should
 * pre-test for edge membership themselves; for the encounter-map use case
 * this is sufficient because tokens live on cell centers, not edges.
 *
 * @param p   The query point in the same coordinate space as the polygon.
 * @param poly Closed polygon as a list of vertices (do NOT repeat the first
 *             vertex at the end — the algorithm wraps internally).
 * @returns `true` if `p` lies inside `poly`.
 */
export function pointInPolygon(p: Point, poly: Polygon): boolean {
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

// ---- polygonAreaCentroid -----------------------------------------

/**
 * Area-weighted centroid of a polygon via the shoelace formula.
 *
 * More accurate than the vertex average for irregular / concave polygons.
 * Returns the vertex average as a fall-back when the signed area is zero
 * (degenerate / collinear polygon) so callers never get NaN.
 *
 * @param pts Closed polygon (do NOT repeat the first vertex).
 * @returns The centroid as a `Point`.
 */
export function polygonAreaCentroid(pts: Polygon): Point {
  const n = pts.length;
  if (n === 0) return { x: 0, y: 0 };
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const { x: x0, y: y0 } = pts[i];
    const { x: x1, y: y1 } = pts[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-12) {
    // Degenerate polygon — fall back to vertex average.
    let vx = 0;
    let vy = 0;
    for (const p of pts) {
      vx += p.x;
      vy += p.y;
    }
    return { x: vx / n, y: vy / n };
  }
  cx /= 6 * area;
  cy /= 6 * area;
  return { x: cx, y: cy };
}

// ---- polygonBoundaryFromRay --------------------------------------

/**
 * Cast a ray from `origin` at `angle` (radians) and return the first
 * intersection with `poly`'s boundary.
 *
 * Generalised version of the renderer's `getPolygonBoundaryPoint`: the
 * original ray was always cast from the polygon's centroid; here the origin
 * is an explicit parameter so callers can shoot rays from arbitrary points
 * (e.g. a door midpoint, a reveal-cascade origin, a player position).
 *
 * Angle convention: 0 = east, π/2 = south (SVG Y-down), π = west,
 * −π/2 = north.
 *
 * If the ray is parallel to every polygon edge (impossible for a non-degenerate
 * polygon but defensive), the function returns `origin + 2·direction` as a
 * sentinel — matches the renderer's existing behavior and keeps callers from
 * crashing on bad input.
 *
 * @param poly   Closed polygon (do NOT repeat the first vertex).
 * @param origin Ray origin in the same coordinate space as `poly`.
 * @param angle  Ray direction in radians (see convention above).
 * @returns The intersection `Point` on the polygon boundary.
 */
export function polygonBoundaryFromRay(poly: Polygon, origin: Point, angle: number): Point {
  const n = poly.length;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let minT = Infinity;
  for (let i = 0; i < n; i++) {
    const { x: x1, y: y1 } = poly[i];
    const { x: x2, y: y2 } = poly[(i + 1) % n];
    const ex = x2 - x1;
    const ey = y2 - y1;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-10) continue;
    const t = ((x1 - origin.x) * ey - (y1 - origin.y) * ex) / denom;
    const s = ((x1 - origin.x) * dy - (y1 - origin.y) * dx) / denom;
    if (t >= 0 && s >= -1e-10 && s <= 1 + 1e-10) {
      if (t < minT) minT = t;
    }
  }
  if (!isFinite(minT)) minT = 2;
  return { x: origin.x + minT * dx, y: origin.y + minT * dy };
}

// ---- octagonFromRect ---------------------------------------------

/**
 * Produce an octagonal (8-point) polygon from a rectangle with chamfered
 * corners. When `chamfer ≤ 0` returns a 4-point plain rectangle.
 *
 * Chamfer is clamped to `min(w, h) / 2 − ε` so the result is always a valid,
 * non-self-intersecting polygon even for absurd inputs.
 *
 * Output coordinates are in the SAME UNITS as the input rect (no pixel scaling
 * here — that's the projection layer's job).
 *
 * @param rect    The source rectangle (`x`, `y` is the top-left corner).
 * @param chamfer Diagonal-cut size in the same units as the rectangle.
 * @returns A `Polygon` (4 or 8 points) ready for SVG / hit-testing / centroid.
 */
export function octagonFromRect(rect: GridRectShape, chamfer: number): Polygon {
  // Clamp: chamfer can be at most half the smaller dimension (leaving a flat
  // face). Subtracting epsilon keeps the polygon strictly non-degenerate.
  const c = Math.min(chamfer, rect.w / 2 - 0.01, rect.h / 2 - 0.01);
  const x = rect.x;
  const y = rect.y;
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;

  if (c <= 0) {
    return [
      { x, y },
      { x: x2, y },
      { x: x2, y: y2 },
      { x, y: y2 },
    ];
  }
  return [
    { x: x + c, y },        // top edge — left of top-right chamfer
    { x: x2 - c, y },       // top edge — right of top-left chamfer
    { x: x2, y: y + c },    // right edge — below top-right chamfer
    { x: x2, y: y2 - c },   // right edge — above bottom-right chamfer
    { x: x2 - c, y: y2 },   // bottom edge — right of bottom-right chamfer
    { x: x + c, y: y2 },    // bottom edge — left of bottom-left chamfer
    { x, y: y2 - c },       // left edge — above bottom-left chamfer
    { x, y: y + c },        // left edge — below top-left chamfer
  ];
}
