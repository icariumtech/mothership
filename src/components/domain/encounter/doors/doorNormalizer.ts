/**
 * doorNormalizer — convert authored YAML door shapes (B-rel / B-pos) into
 * the canonical `Door` model defined in `types/encounterMap.ts`.
 *
 * The normalizer is the *only* validation gate between authored map data
 * and the renderer. Every YAML mistake — human, AI-generated, or
 * tool-emitted — is caught here with a useful, attributable error.
 *
 * Phase 21 plan 21-02. Pure module; no React; no DOM. Tested in
 * `__tests__/doorNormalizer.test.ts`.
 *
 * High-level contract:
 *
 *   normalizeDoor(authored, rooms, index) → Door
 *   normalizeDoors(authored[], rooms)     → Door[]
 *
 * Both throw `DoorNormalizationError` (with the authored input attached)
 * on any validation failure.
 *
 * Geometry overview:
 *
 * - Each `GridRoom` contributes a list of boundary line segments. Rect
 *   rooms use the wall-segment algorithm: edges that appear on exactly
 *   one rect of the room are exterior. Polygon rooms walk their vertex
 *   list. Circle rooms are approximated as 64-gons (sufficient for door
 *   anchoring; precise tangent placement is not required for this use).
 *
 * - The "shared edge" between two rooms is the union of segments that
 *   lie on the boundaries of *both* rooms. Disjoint shared segments are
 *   reduced to the longest one (a future plan can expose an `edge`
 *   index to disambiguate).
 *
 * - Exterior doors (`roomB === null`) treat the room's full exterior
 *   boundary as the parameterizable space; `along ∈ [0, 1]` walks that
 *   boundary by arc-length.
 */

import {
  AuthoredDoor,
  AuthoredDoorPos,
  AuthoredDoorRel,
  Door,
  DoorNormalizationError,
  GridRoom,
  isAuthoredDoorPos,
} from '../../../../types/encounterMap';

// -----------------------------------------------------------------------------
// Internal geometry primitives (kept local to avoid pulling in polygon2d, which
// lands in plan 21-01 in a parallel worktree). These are tiny.
// -----------------------------------------------------------------------------

interface Pt { x: number; y: number; }
interface Seg { a: Pt; b: Pt; }

const EPS = 1e-6;

function approxEq(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) < eps;
}

function distance(a: Pt, b: Pt): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function segmentLength(s: Seg): number {
  return distance(s.a, s.b);
}

/** Unit direction vector of segment, or {x:0,y:0} for degenerate segs. */
function segDir(s: Seg): Pt {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

/** Angle in degrees normal to segment (perpendicular, edge-normal). */
function normalAngleDeg(s: Seg): number {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  // Edge direction angle, then add 90° for normal. We pick the convention used
  // by the renderer's existing explicit-position doors: `angle=0` means a
  // horizontal slot (door sits on a north/south wall — i.e. edge is horizontal
  // running E-W), `angle=90` means a vertical slot (door sits on an E/W wall —
  // edge is vertical running N-S).
  if (Math.abs(dy) < EPS) return 0;        // horizontal edge → 0
  if (Math.abs(dx) < EPS) return 90;       // vertical edge → 90
  // Diagonal: edge direction angle in degrees, perpendicular = +90
  const edgeAngle = Math.atan2(dy, dx) * 180 / Math.PI;
  let n = edgeAngle + 90;
  // Normalize to (-180, 180]
  while (n > 180) n -= 360;
  while (n <= -180) n += 360;
  return n;
}

/**
 * Linearly interpolate a point fraction `t` along segment `s` (t ∈ [0,1]).
 */
function pointAlong(s: Seg, t: number): Pt {
  return {
    x: s.a.x + (s.b.x - s.a.x) * t,
    y: s.a.y + (s.b.y - s.a.y) * t,
  };
}

/** Cross product of (b-a) × (c-a). */
function cross3(a: Pt, b: Pt, c: Pt): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Is point p collinear with segment s (within epsilon)? */
function isCollinear(p: Pt, s: Seg): boolean {
  return Math.abs(cross3(s.a, s.b, p)) < EPS * Math.max(1, segmentLength(s));
}

/** Project point p onto segment s, returning parameter t (clamped to [0,1])
 *  and the squared perpendicular distance. */
function projectOntoSeg(p: Pt, s: Seg): { t: number; perpDist: number } {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS * EPS) {
    return { t: 0, perpDist: distance(p, s.a) };
  }
  const tRaw = ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / len2;
  const t = Math.max(0, Math.min(1, tRaw));
  const proj = pointAlong(s, t);
  return { t, perpDist: distance(p, proj) };
}

/**
 * Two segments are "shared" if they are collinear and have an overlapping
 * extent. Returns the overlapping sub-segment (in the orientation of `a`)
 * or null if no overlap.
 */
function segmentOverlap(a: Seg, b: Seg): Seg | null {
  // Both endpoints of b must be collinear with a.
  if (!isCollinear(b.a, a) || !isCollinear(b.b, a)) return null;
  // Parameterize both b endpoints along a's direction.
  const dir = segDir(a);
  if (dir.x === 0 && dir.y === 0) return null;
  const len = segmentLength(a);
  const tA0 = 0;
  const tA1 = len;
  const tB0 = (b.a.x - a.a.x) * dir.x + (b.a.y - a.a.y) * dir.y;
  const tB1 = (b.b.x - a.a.x) * dir.x + (b.b.y - a.a.y) * dir.y;
  const tBmin = Math.min(tB0, tB1);
  const tBmax = Math.max(tB0, tB1);
  const tStart = Math.max(tA0, tBmin);
  const tEnd = Math.min(tA1, tBmax);
  if (tEnd - tStart < EPS) return null;
  return {
    a: { x: a.a.x + dir.x * tStart, y: a.a.y + dir.y * tStart },
    b: { x: a.a.x + dir.x * tEnd,   y: a.a.y + dir.y * tEnd },
  };
}

// -----------------------------------------------------------------------------
// Boundary segment extraction per room shape.
// -----------------------------------------------------------------------------

/**
 * For a rect-only room: return its exterior boundary as a list of unit-length
 * segments using the wall-segment algorithm. Edges that appear in exactly one
 * cell of one rect are exterior — interior shared edges between the room's own
 * rects cancel out.
 *
 * Returns *unit-cell* edges; the consumer is responsible for merging collinear
 * adjacent units back into longer segments via segmentOverlap during shared-
 * edge resolution.
 */
function rectRoomBoundary(rects: GridRoom['rects']): Seg[] {
  const counts = new Map<string, number>();
  // We track each unit edge exactly once with a canonical key.
  // Horizontal edge at y between x and x+1: 'H:x:y'
  // Vertical edge at x between y and y+1: 'V:x:y'
  for (const r of rects ?? []) {
    for (let cx = r.x; cx < r.x + r.w; cx++) {
      const top = `H:${cx}:${r.y}`;
      const bot = `H:${cx}:${r.y + r.h}`;
      counts.set(top, (counts.get(top) ?? 0) + 1);
      counts.set(bot, (counts.get(bot) ?? 0) + 1);
    }
    for (let cy = r.y; cy < r.y + r.h; cy++) {
      const left = `V:${r.x}:${cy}`;
      const right = `V:${r.x + r.w}:${cy}`;
      counts.set(left, (counts.get(left) ?? 0) + 1);
      counts.set(right, (counts.get(right) ?? 0) + 1);
    }
  }
  const segs: Seg[] = [];
  for (const [key, n] of counts) {
    if (n !== 1) continue;
    const [orient, gxStr, gyStr] = key.split(':');
    const gx = parseInt(gxStr, 10);
    const gy = parseInt(gyStr, 10);
    if (orient === 'H') {
      segs.push({ a: { x: gx, y: gy }, b: { x: gx + 1, y: gy } });
    } else {
      segs.push({ a: { x: gx, y: gy }, b: { x: gx, y: gy + 1 } });
    }
  }
  return segs;
}

/** Polygon room: each edge of the vertex loop is a segment. */
function polygonRoomBoundary(polygon: [number, number][]): Seg[] {
  const segs: Seg[] = [];
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % n];
    segs.push({ a: { x: x1, y: y1 }, b: { x: x2, y: y2 } });
  }
  return segs;
}

/**
 * Circle room: approximate as a 64-gon for door-anchoring purposes.
 * (Exact tangent geometry is overkill for the use case; doors on circular
 * rooms are rare and the renderer already approximates similarly.)
 */
function circleRoomBoundary(circle: { cx: number; cy: number; r: number }): Seg[] {
  const N = 64;
  const segs: Seg[] = [];
  for (let i = 0; i < N; i++) {
    const a1 = (i / N) * Math.PI * 2;
    const a2 = ((i + 1) / N) * Math.PI * 2;
    segs.push({
      a: { x: circle.cx + circle.r * Math.cos(a1), y: circle.cy + circle.r * Math.sin(a1) },
      b: { x: circle.cx + circle.r * Math.cos(a2), y: circle.cy + circle.r * Math.sin(a2) },
    });
  }
  return segs;
}

/** Dispatch by room shape. */
function roomBoundary(room: GridRoom): Seg[] {
  if (room.polygon && room.polygon.length > 0) {
    return polygonRoomBoundary(room.polygon);
  }
  if (room.circle) {
    return circleRoomBoundary(room.circle);
  }
  return rectRoomBoundary(room.rects ?? []);
}

// -----------------------------------------------------------------------------
// Shared-edge resolution.
// -----------------------------------------------------------------------------

/**
 * Compute the shared edge between two rooms. Returns the longest connected
 * shared sub-segment, or null if no shared boundary exists. (When multiple
 * disjoint shared edges exist — e.g. an L-shaped pair touching on two
 * separate sides — we pick the longest by total length. A future plan can
 * expose an `edge` discriminator on the authored door for ambiguous cases.)
 */
function findSharedEdge(roomA: GridRoom, roomB: GridRoom): Seg | null {
  const runs = findAllSharedEdges(roomA, roomB);
  if (runs.length === 0) return null;
  runs.sort((a, b) => segmentLength(b) - segmentLength(a));
  return runs[0] ?? null;
}

/**
 * Return every maximal connected shared-edge run between two rooms (in arbitrary
 * order). Used by `resolveBPos` to accept doors on *any* shared edge, not just
 * the longest one — the B-pos form's explicit (x, y, angle) is the user's
 * disambiguator. `resolveBRel` still uses `findSharedEdge` (longest run) because
 * the relational `along` parameter is unambiguous only when one shared edge
 * exists.
 */
function findAllSharedEdges(roomA: GridRoom, roomB: GridRoom): Seg[] {
  const aBoundary = roomBoundary(roomA);
  const bBoundary = roomBoundary(roomB);
  const overlaps: Seg[] = [];
  for (const sa of aBoundary) {
    for (const sb of bBoundary) {
      const ov = segmentOverlap(sa, sb);
      if (ov && segmentLength(ov) > EPS) {
        overlaps.push(ov);
      }
    }
  }
  if (overlaps.length === 0) return [];
  return mergeCollinearAdjacent(overlaps);
}

/**
 * Merge a set of segments, joining any pair that is collinear and shares an
 * endpoint within epsilon. Returns the maximal connected runs.
 */
function mergeCollinearAdjacent(segs: Seg[]): Seg[] {
  // Group by line (direction + offset). For axis-aligned and general lines.
  const groups = new Map<string, Seg[]>();
  for (const s of segs) {
    const dir = segDir(s);
    // Normalize direction (always point right/down) for stable key.
    const ndir =
      dir.x < -EPS || (Math.abs(dir.x) < EPS && dir.y < -EPS)
        ? { x: -dir.x, y: -dir.y }
        : dir;
    // Line offset = perpendicular distance from origin (signed via normal).
    const nx = -ndir.y;
    const ny = ndir.x;
    const offset = nx * s.a.x + ny * s.a.y;
    const key = `${ndir.x.toFixed(8)}|${ndir.y.toFixed(8)}|${offset.toFixed(8)}`;
    const arr = groups.get(key) ?? [];
    arr.push(s);
    groups.set(key, arr);
  }
  const out: Seg[] = [];
  for (const [, group] of groups) {
    if (group.length === 0) continue;
    // Project endpoints onto the shared direction; merge intervals.
    const dir = segDir(group[0]);
    const origin = group[0].a;
    const intervals: Array<[number, number]> = group.map((s) => {
      const tA = (s.a.x - origin.x) * dir.x + (s.a.y - origin.y) * dir.y;
      const tB = (s.b.x - origin.x) * dir.x + (s.b.y - origin.y) * dir.y;
      return [Math.min(tA, tB), Math.max(tA, tB)];
    });
    intervals.sort((p, q) => p[0] - q[0]);
    const merged: Array<[number, number]> = [];
    for (const iv of intervals) {
      if (merged.length === 0 || iv[0] - merged[merged.length - 1][1] > EPS) {
        merged.push([iv[0], iv[1]]);
      } else {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
      }
    }
    for (const [t0, t1] of merged) {
      out.push({
        a: { x: origin.x + dir.x * t0, y: origin.y + dir.y * t0 },
        b: { x: origin.x + dir.x * t1, y: origin.y + dir.y * t1 },
      });
    }
  }
  return out;
}

/**
 * Exterior "shared edge" for an exterior door: the room's *full* exterior
 * boundary, walked as a sequence of segments. We collapse them into a
 * conceptual single segment by total arc-length — `along ∈ [0, 1]` walks the
 * boundary in source order, and the angle is computed from whichever segment
 * the resolved point lies on.
 *
 * Returns the connected boundary as a polyline (sequence of points), where the
 * polyline arc-length covers `along ∈ [0, 1]`.
 */
function exteriorPolyline(room: GridRoom): Pt[] {
  if (room.polygon && room.polygon.length > 0) {
    const poly = room.polygon.map(([x, y]) => ({ x, y }));
    poly.push(poly[0]);
    return poly;
  }
  if (room.circle) {
    const segs = circleRoomBoundary(room.circle);
    const pts: Pt[] = [segs[0].a];
    for (const s of segs) pts.push(s.b);
    return pts;
  }
  // Rect rooms: traverse exterior unit edges as a connected polyline. We do a
  // simple greedy walk; for non-degenerate rect rooms the exterior is a single
  // closed loop.
  const segs = rectRoomBoundary(room.rects ?? []);
  if (segs.length === 0) return [];
  const used = new Array(segs.length).fill(false);
  const pts: Pt[] = [segs[0].a, segs[0].b];
  used[0] = true;
  let progress = true;
  while (progress) {
    progress = false;
    const tail = pts[pts.length - 1];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      const s = segs[i];
      if (approxEq(s.a.x, tail.x) && approxEq(s.a.y, tail.y)) {
        pts.push(s.b);
        used[i] = true;
        progress = true;
        break;
      }
      if (approxEq(s.b.x, tail.x) && approxEq(s.b.y, tail.y)) {
        pts.push(s.a);
        used[i] = true;
        progress = true;
        break;
      }
    }
  }
  return pts;
}

/** Walk a polyline by fractional arc-length t∈[0,1] and return the point and
 *  the segment containing it (for angle derivation). */
function polylinePointAt(pts: Pt[], t: number): { pt: Pt; seg: Seg } | null {
  if (pts.length < 2) return null;
  let total = 0;
  const lens: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const len = distance(pts[i], pts[i + 1]);
    lens.push(len);
    total += len;
  }
  if (total < EPS) return null;
  const target = t * total;
  let acc = 0;
  for (let i = 0; i < lens.length; i++) {
    const next = acc + lens[i];
    if (target <= next + EPS) {
      const local = lens[i] < EPS ? 0 : (target - acc) / lens[i];
      const seg: Seg = { a: pts[i], b: pts[i + 1] };
      return { pt: pointAlong(seg, local), seg };
    }
    acc = next;
  }
  // Numerical drift past 1.0 — clamp to last segment endpoint.
  const lastSeg: Seg = { a: pts[pts.length - 2], b: pts[pts.length - 1] };
  return { pt: pts[pts.length - 1], seg: lastSeg };
}

/** Total arc length of a polyline. */
function polylineLength(pts: Pt[]): number {
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += distance(pts[i], pts[i + 1]);
  return total;
}

// -----------------------------------------------------------------------------
// Public API: normalizeDoor / normalizeDoors
// -----------------------------------------------------------------------------

/**
 * Normalize a single authored door entry to the canonical `Door` shape.
 *
 * @param authored authored YAML door (B-rel or B-pos)
 * @param rooms    full room list (for shared-edge resolution)
 * @param index    position in the input array (used for stable id derivation
 *                 when the authored entry omits `id`, and to disambiguate
 *                 multiple doors between the same pair of rooms)
 *
 * Throws `DoorNormalizationError` on validation failure.
 */
export function normalizeDoor(
  authored: AuthoredDoor,
  rooms: GridRoom[],
  index: number,
): Door {
  // Validate room references.
  const [aId, bId] = authored.rooms;
  const isExterior = authored.rooms.length === 1;
  const roomA = rooms.find((r) => r.id === aId);
  if (!roomA) {
    throw new DoorNormalizationError(
      `door references unknown room '${aId}'`,
      authored,
    );
  }
  let roomB: GridRoom | null = null;
  if (!isExterior) {
    roomB = rooms.find((r) => r.id === bId) ?? null;
    if (!roomB) {
      throw new DoorNormalizationError(
        `door references unknown room '${bId}'`,
        authored,
      );
    }
  }

  const width = authored.width ?? 1;
  if (width <= 0) {
    throw new DoorNormalizationError(
      `door width ${width} must be > 0`,
      authored,
    );
  }

  if (isAuthoredDoorPos(authored)) {
    return resolveBPos(authored, roomA, roomB, width, index);
  }
  return resolveBRel(authored, roomA, roomB, width, index);
}

/**
 * Normalize a list of authored doors. Performs per-door normalization and
 * additionally detects overlapping doors on the same shared edge (interval
 * test on `along` ± width/(2·edge_length)).
 */
export function normalizeDoors(
  authored: AuthoredDoor[],
  rooms: GridRoom[],
): Door[] {
  const out: Door[] = authored.map((a, i) => normalizeDoor(a, rooms, i));
  detectOverlap(authored, out, rooms);
  return out;
}

// -----------------------------------------------------------------------------
// Resolution helpers
// -----------------------------------------------------------------------------

function resolveBRel(
  authored: AuthoredDoorRel,
  roomA: GridRoom,
  roomB: GridRoom | null,
  width: number,
  index: number,
): Door {
  // Resolve the parameterizable boundary.
  let edgeLen: number;
  let centerPt: Pt;
  let segForAngle: Seg;

  if (roomB === null) {
    // Exterior: walk roomA's full exterior boundary by arc length.
    const polyline = exteriorPolyline(roomA);
    edgeLen = polylineLength(polyline);
    if (edgeLen < EPS) {
      throw new DoorNormalizationError(
        `room '${roomA.id}' has no exterior boundary`,
        authored,
      );
    }
    validateAlongFits(authored, authored.along, width, edgeLen);
    const at = polylinePointAt(polyline, authored.along);
    if (!at) {
      throw new DoorNormalizationError(
        `failed to resolve door position on exterior boundary of '${roomA.id}'`,
        authored,
      );
    }
    centerPt = at.pt;
    segForAngle = at.seg;
  } else {
    // Interior: shared edge of (roomA, roomB).
    const shared = findSharedEdge(roomA, roomB);
    if (!shared) {
      throw new DoorNormalizationError(
        `rooms '${roomA.id}' and '${roomB.id}' share no boundary`,
        authored,
      );
    }
    edgeLen = segmentLength(shared);
    validateAlongFits(authored, authored.along, width, edgeLen);
    centerPt = pointAlong(shared, authored.along);
    segForAngle = shared;
  }

  return {
    id: deriveId(authored, roomA.id, roomB?.id ?? null, index),
    x: centerPt.x,
    y: centerPt.y,
    angle: normalAngleDeg(segForAngle),
    width,
    roomA: roomA.id,
    roomB: roomB?.id ?? null,
    type: authored.type,
    status: authored.status,
  };
}

function resolveBPos(
  authored: AuthoredDoorPos,
  roomA: GridRoom,
  roomB: GridRoom | null,
  width: number,
  index: number,
): Door {
  const { x, y, angle } = authored.position;
  const center: Pt = { x, y };

  // Validate that (x, y) lies on a shared edge (interior) or on the exterior
  // boundary of roomA (exterior door).
  if (roomB === null) {
    const polyline = exteriorPolyline(roomA);
    if (!pointOnPolyline(center, polyline)) {
      throw new DoorNormalizationError(
        `door position (${x}, ${y}) does not lie on exterior boundary of '${roomA.id}'`,
        authored,
      );
    }
    // Width must fit *somewhere* — for exterior doors we don't strictly enforce
    // edge-length here because the boundary is a polyline. We do enforce that
    // width ≤ total perimeter, which is generally trivial, and that width > 0
    // (already checked).
    const perim = polylineLength(polyline);
    if (width > perim) {
      throw new DoorNormalizationError(
        `door width ${width} exceeds exterior perimeter ${perim} of '${roomA.id}'`,
        authored,
      );
    }
  } else {
    const runs = findAllSharedEdges(roomA, roomB);
    if (runs.length === 0) {
      throw new DoorNormalizationError(
        `rooms '${roomA.id}' and '${roomB.id}' share no boundary`,
        authored,
      );
    }
    // The door's explicit (x, y) is the disambiguator when multiple shared
    // edges exist — accept the door if it lies on ANY shared run.
    let best: { run: Seg; perp: number } | null = null;
    for (const run of runs) {
      const proj = projectOntoSeg(center, run);
      if (best === null || proj.perpDist < best.perp) {
        best = { run, perp: proj.perpDist };
      }
    }
    if (!best || best.perp > EPS * 100) {
      throw new DoorNormalizationError(
        `door position (${x}, ${y}) does not lie on shared edge of '${roomA.id}' and '${roomB.id}'`,
        authored,
      );
    }
    const edgeLen = segmentLength(best.run);
    if (width > edgeLen + EPS) {
      throw new DoorNormalizationError(
        `door width ${width} exceeds shared edge length ${edgeLen}`,
        authored,
      );
    }
  }

  return {
    id: deriveId(authored, roomA.id, roomB?.id ?? null, index),
    x,
    y,
    angle, // preserved verbatim — override semantics
    width,
    roomA: roomA.id,
    roomB: roomB?.id ?? null,
    type: authored.type,
    status: authored.status,
  };
}

/** Validate `along` and `width` fit inside an edge of length `edgeLen`. */
function validateAlongFits(
  authored: AuthoredDoor,
  along: number,
  width: number,
  edgeLen: number,
): void {
  if (width > edgeLen + EPS) {
    throw new DoorNormalizationError(
      `door width ${width} exceeds shared edge length ${edgeLen}`,
      authored,
    );
  }
  const halfFrac = width / (2 * edgeLen);
  if (along < halfFrac - EPS || along > 1 - halfFrac + EPS) {
    throw new DoorNormalizationError(
      `door 'along' value ${along} places door off the shared edge ` +
        `(edge length ${edgeLen}, width ${width})`,
      authored,
    );
  }
}

/** Test whether a point lies on any segment of a polyline (within epsilon). */
function pointOnPolyline(p: Pt, pts: Pt[]): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    const seg: Seg = { a: pts[i], b: pts[i + 1] };
    const proj = projectOntoSeg(p, seg);
    if (proj.perpDist < EPS * 100 && proj.t >= -EPS && proj.t <= 1 + EPS) {
      return true;
    }
  }
  return false;
}

/** Stable id derivation: explicit > derived. */
function deriveId(
  authored: AuthoredDoor,
  aId: string,
  bId: string | null,
  index: number,
): string {
  if (authored.id !== undefined && authored.id !== '') return authored.id;
  const second = bId ?? 'exterior';
  return `${aId}__${second}__${index}`;
}

// -----------------------------------------------------------------------------
// Overlap detection across the door set.
// -----------------------------------------------------------------------------

interface OverlapEntry {
  authoredIndex: number;
  along: number;
  width: number;
  edgeLen: number;
  id: string;
  /** Discriminator for the specific shared-edge run this door lies on — two
   *  doors on different runs of the same room pair must NOT be considered
   *  overlapping even if their `along` values collide. */
  runKey: string;
}

function detectOverlap(
  authoredList: AuthoredDoor[],
  doors: Door[],
  rooms: GridRoom[],
): void {
  // Group by sorted room pair (interior) or by `${roomA}__exterior` key.
  const groups = new Map<string, OverlapEntry[]>();
  for (let i = 0; i < authoredList.length; i++) {
    const authored = authoredList[i];
    if (isAuthoredDoorPos(authored)) {
      // B-pos doors are also subject to overlap, but they don't have a
      // straightforward `along`. We project the door center onto the shared
      // edge and treat the projected `t` as `along`.
      const aId = authored.rooms[0];
      const bId = authored.rooms.length === 2 ? authored.rooms[1] : null;
      const key = pairKey(aId, bId);
      const entry = bPosToEntry(authored, doors[i], rooms, i);
      if (entry) appendGroup(groups, key, entry);
      continue;
    }
    const aId = authored.rooms[0];
    const bId = authored.rooms.length === 2 ? authored.rooms[1] : null;
    const key = pairKey(aId, bId);
    const edgeLen = computeEdgeLen(aId, bId, rooms);
    if (edgeLen === null) continue; // already errored in normalizeDoor; defensive
    appendGroup(groups, key, {
      authoredIndex: i,
      along: authored.along,
      width: authored.width ?? 1,
      edgeLen,
      id: doors[i].id,
      runKey: 'longest', // B-rel always resolves to the longest shared run
    });
  }
  // Bucket by (pair, runKey) — doors on different shared-edge runs of the
  // same room pair must not be considered overlapping.
  for (const [pair, entries] of groups) {
    const byRun = new Map<string, OverlapEntry[]>();
    for (const e of entries) {
      const k = `${pair}::${e.runKey}`;
      const arr = byRun.get(k) ?? [];
      arr.push(e);
      byRun.set(k, arr);
    }
    for (const runEntries of byRun.values()) {
      runEntries.sort((p, q) => p.along - q.along);
      for (let i = 1; i < runEntries.length; i++) {
        const prev = runEntries[i - 1];
        const curr = runEntries[i];
        const prevHalf = prev.width / (2 * prev.edgeLen);
        const currHalf = curr.width / (2 * curr.edgeLen);
        if (prev.along + prevHalf > curr.along - currHalf + EPS) {
          throw new DoorNormalizationError(
            `doors '${prev.id}' and '${curr.id}' overlap on shared edge`,
            authoredList[curr.authoredIndex],
          );
        }
      }
    }
  }
}

function pairKey(aId: string, bId: string | null): string {
  if (bId === null) return `${aId}__exterior`;
  return aId < bId ? `${aId}__${bId}` : `${bId}__${aId}`;
}

function appendGroup<T>(map: Map<string, T[]>, key: string, value: T): void {
  const arr = map.get(key) ?? [];
  arr.push(value);
  map.set(key, arr);
}

function computeEdgeLen(
  aId: string,
  bId: string | null,
  rooms: GridRoom[],
): number | null {
  const ra = rooms.find((r) => r.id === aId);
  if (!ra) return null;
  if (bId === null) return polylineLength(exteriorPolyline(ra));
  const rb = rooms.find((r) => r.id === bId);
  if (!rb) return null;
  const shared = findSharedEdge(ra, rb);
  return shared ? segmentLength(shared) : null;
}

function bPosToEntry(
  authored: AuthoredDoorPos,
  door: Door,
  rooms: GridRoom[],
  index: number,
): OverlapEntry | null {
  const aId = authored.rooms[0];
  const bId = authored.rooms.length === 2 ? authored.rooms[1] : null;
  const ra = rooms.find((r) => r.id === aId);
  if (!ra) return null;
  if (bId === null) {
    const poly = exteriorPolyline(ra);
    const perim = polylineLength(poly);
    // Compute `along` for the B-pos door by walking the polyline until the
    // closest perpendicular projection. This is approximate but sufficient
    // for overlap detection.
    let bestT = 0;
    let bestPerp = Infinity;
    let acc = 0;
    for (let i = 0; i < poly.length - 1; i++) {
      const seg: Seg = { a: poly[i], b: poly[i + 1] };
      const segLen = segmentLength(seg);
      const proj = projectOntoSeg({ x: door.x, y: door.y }, seg);
      if (proj.perpDist < bestPerp) {
        bestPerp = proj.perpDist;
        bestT = (acc + proj.t * segLen) / Math.max(perim, EPS);
      }
      acc += segLen;
    }
    return {
      authoredIndex: index,
      along: bestT,
      width: authored.width ?? 1,
      edgeLen: perim,
      id: door.id,
      runKey: 'exterior',
    };
  }
  const rb = rooms.find((r) => r.id === bId);
  if (!rb) return null;
  const runs = findAllSharedEdges(ra, rb);
  if (runs.length === 0) return null;
  // Pick the run that best matches the door's explicit position — overlap
  // detection should not flag doors on different shared edges as colliding.
  let best: { run: Seg; t: number; perp: number } | null = null;
  for (const run of runs) {
    const proj = projectOntoSeg({ x: door.x, y: door.y }, run);
    if (best === null || proj.perpDist < best.perp) {
      best = { run, t: proj.t, perp: proj.perpDist };
    }
  }
  if (!best) return null;
  // Discriminator: start-point of the chosen run, rounded for stability.
  const runKey = `${best.run.a.x.toFixed(4)},${best.run.a.y.toFixed(4)}->${best.run.b.x.toFixed(4)},${best.run.b.y.toFixed(4)}`;
  return {
    authoredIndex: index,
    along: best.t,
    width: authored.width ?? 1,
    edgeLen: segmentLength(best.run),
    id: door.id,
    runKey,
  };
}
