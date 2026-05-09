/**
 * Tests for doorNormalizer (Phase 21 plan 21-02).
 *
 * Fixtures: small synthetic GridRoom[] arrays. We exercise rect-only rooms,
 * polygon rooms, and irregular pairs. The normalizer is a pure module so
 * tests are fixture-driven with no React or DOM.
 */

import { describe, expect, it } from 'vitest';
import {
  AuthoredDoor,
  AuthoredDoorPos,
  AuthoredDoorRel,
  DoorNormalizationError,
  GridRoom,
} from '../../../../../types/encounterMap';
import { normalizeDoor, normalizeDoors } from '../doorNormalizer';

// -----------------------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------------------

/** Two adjacent square rooms touching on a vertical edge at x=4.
 *  bridge: (0,0)-(4,4), mess: (4,0)-(8,4). Shared edge: vertical segment
 *  from (4,0) to (4,4), length 4. */
const fixtureTwoRectRooms: GridRoom[] = [
  { id: 'bridge', name: 'Bridge', rects: [{ x: 0, y: 0, w: 4, h: 4 }] },
  { id: 'mess', name: 'Mess', rects: [{ x: 4, y: 0, w: 4, h: 4 }] },
];

/** Three rooms in a row: a-b-c. b shares 4-cell edge with a (at x=4) and
 *  4-cell edge with c (at x=8). */
const fixtureThreeRectRooms: GridRoom[] = [
  { id: 'a', name: 'A', rects: [{ x: 0, y: 0, w: 4, h: 4 }] },
  { id: 'b', name: 'B', rects: [{ x: 4, y: 0, w: 4, h: 4 }] },
  { id: 'c', name: 'C', rects: [{ x: 8, y: 0, w: 4, h: 4 }] },
];

/** Two rooms with no shared boundary (corner-of-map case). */
const fixtureDisjointRooms: GridRoom[] = [
  { id: 'alpha', name: 'Alpha', rects: [{ x: 0, y: 0, w: 2, h: 2 }] },
  { id: 'beta', name: 'Beta', rects: [{ x: 10, y: 10, w: 2, h: 2 }] },
];

/** Two polygon rooms sharing a diagonal edge from (0,0) to (4,4).
 *
 *  poly_a vertices:  (0,0)-(4,4)-(0,4)  (triangle, shared edge is the (0,0)-(4,4) hypotenuse)
 *  poly_b vertices:  (0,0)-(4,0)-(4,4)  (triangle, shared edge is the (0,0)-(4,4) hypotenuse)
 *
 *  Together they form a 4×4 square split along the NW-SE diagonal.
 */
const fixturePolygonDiagonal: GridRoom[] = [
  {
    id: 'poly_a',
    name: 'Poly A',
    rects: [],
    polygon: [
      [0, 0],
      [4, 4],
      [0, 4],
    ],
  },
  {
    id: 'poly_b',
    name: 'Poly B',
    rects: [],
    polygon: [
      [0, 0],
      [4, 0],
      [4, 4],
    ],
  },
];

/** Standard helper: B-rel door. */
function brel(p: Partial<AuthoredDoorRel> & {
  rooms: AuthoredDoorRel['rooms'];
  along: number;
}): AuthoredDoorRel {
  return {
    type: 'standard',
    status: 'CLOSED',
    ...p,
  };
}

/** Standard helper: B-pos door. */
function bpos(p: Partial<AuthoredDoorPos> & {
  rooms: AuthoredDoorPos['rooms'];
  position: { x: number; y: number; angle: number };
}): AuthoredDoorPos {
  return {
    type: 'standard',
    status: 'CLOSED',
    ...p,
  };
}

// -----------------------------------------------------------------------------
// B-rel happy paths
// -----------------------------------------------------------------------------

describe('normalizeDoor — B-rel happy paths', () => {
  it('two adjacent rect rooms, along=0.5, default width → canonical Door at edge midpoint', () => {
    const authored = brel({ rooms: ['bridge', 'mess'], along: 0.5 });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 0);

    expect(door.x).toBeCloseTo(4, 6);    // shared edge is x=4
    expect(door.y).toBeCloseTo(2, 6);    // midpoint y of [0,4]
    expect(door.angle).toBe(90);          // vertical edge → 90 (vertical slot)
    expect(door.width).toBe(1);
    expect(door.roomA).toBe('bridge');
    expect(door.roomB).toBe('mess');
    expect(door.type).toBe('standard');
    expect(door.status).toBe('CLOSED');
  });

  it('along=0.25 places door at one-quarter point', () => {
    const authored = brel({ rooms: ['bridge', 'mess'], along: 0.25 });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 0);
    expect(door.x).toBeCloseTo(4, 6);
    expect(door.y).toBeCloseTo(1, 6);  // 0.25 along [0,4] = 1
  });

  it('diagonal polygon edge between two polygon rooms, along=0.5 → non-axis-aligned angle', () => {
    const authored = brel({ rooms: ['poly_a', 'poly_b'], along: 0.5 });
    const door = normalizeDoor(authored, fixturePolygonDiagonal, 0);
    // Diagonal edge from (0,0) to (4,4); midpoint = (2, 2).
    expect(door.x).toBeCloseTo(2, 5);
    expect(door.y).toBeCloseTo(2, 5);
    // Edge direction is 45°; normal is 135° (or -45° depending on direction).
    // Either way it must NOT be 0 or 90.
    expect(door.angle).not.toBe(0);
    expect(door.angle).not.toBe(90);
  });

  it('width=2, along=0.5, edge length 4 → fits, valid', () => {
    const authored = brel({ rooms: ['bridge', 'mess'], along: 0.5, width: 2 });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 0);
    expect(door.width).toBe(2);
  });

  it('exterior door (single-room list), along=0.5 → roomB=null', () => {
    const authored = brel({ rooms: ['bridge'], along: 0.5 });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 0);
    expect(door.roomB).toBeNull();
    expect(door.roomA).toBe('bridge');
  });

  it('preserves type and status from authored entry', () => {
    const authored: AuthoredDoorRel = {
      rooms: ['bridge', 'mess'],
      along: 0.5,
      type: 'airlock',
      status: 'SEALED',
    };
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 0);
    expect(door.type).toBe('airlock');
    expect(door.status).toBe('SEALED');
  });

  it('default width is 1 when omitted', () => {
    const authored = brel({ rooms: ['bridge', 'mess'], along: 0.5 });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 0);
    expect(door.width).toBe(1);
  });
});

// -----------------------------------------------------------------------------
// B-pos happy paths
// -----------------------------------------------------------------------------

describe('normalizeDoor — B-pos happy paths', () => {
  it('explicit position on shared edge → returned with authored angle', () => {
    const authored = bpos({
      rooms: ['bridge', 'mess'],
      position: { x: 4, y: 2, angle: 90 },
    });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 0);
    expect(door.x).toBe(4);
    expect(door.y).toBe(2);
    expect(door.angle).toBe(90);
  });

  it('explicit angle different from edge normal → preserved (override semantics)', () => {
    const authored = bpos({
      rooms: ['bridge', 'mess'],
      position: { x: 4, y: 2, angle: 45 },
    });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 0);
    expect(door.angle).toBe(45);
  });

  it('B-pos exterior door on roomA boundary', () => {
    const authored = bpos({
      rooms: ['bridge'],
      position: { x: 0, y: 2, angle: 0 },
    });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 0);
    expect(door.roomB).toBeNull();
    expect(door.x).toBe(0);
    expect(door.y).toBe(2);
  });
});

// -----------------------------------------------------------------------------
// Validation failures
// -----------------------------------------------------------------------------

describe('normalizeDoor — validation failures', () => {
  it('throws on unknown roomA', () => {
    const authored = brel({ rooms: ['nope', 'mess'], along: 0.5 });
    expect(() => normalizeDoor(authored, fixtureTwoRectRooms, 0))
      .toThrow(DoorNormalizationError);
    expect(() => normalizeDoor(authored, fixtureTwoRectRooms, 0))
      .toThrow(/unknown room 'nope'/);
  });

  it('throws on unknown roomB', () => {
    const authored = brel({ rooms: ['bridge', 'nope'], along: 0.5 });
    expect(() => normalizeDoor(authored, fixtureTwoRectRooms, 0))
      .toThrow(/unknown room 'nope'/);
  });

  it('throws when rooms have no shared edge', () => {
    const authored = brel({ rooms: ['alpha', 'beta'], along: 0.5 });
    expect(() => normalizeDoor(authored, fixtureDisjointRooms, 0))
      .toThrow(/share no boundary/);
  });

  it('throws on width = 0', () => {
    const authored = brel({ rooms: ['bridge', 'mess'], along: 0.5, width: 0 });
    expect(() => normalizeDoor(authored, fixtureTwoRectRooms, 0))
      .toThrow(/width 0 must be > 0/);
  });

  it('throws on negative width', () => {
    const authored = brel({ rooms: ['bridge', 'mess'], along: 0.5, width: -1 });
    expect(() => normalizeDoor(authored, fixtureTwoRectRooms, 0))
      .toThrow(/must be > 0/);
  });

  it('throws when width exceeds edge length', () => {
    // Edge length is 4. width=99 is way over.
    const authored = brel({ rooms: ['bridge', 'mess'], along: 0.5, width: 99 });
    expect(() => normalizeDoor(authored, fixtureTwoRectRooms, 0))
      .toThrow(/exceeds shared edge length/);
  });

  it('throws when along=0.0 with width=2 (door runs off edge)', () => {
    // Edge length 4, width 2 → along must be in [0.25, 0.75]
    const authored = brel({ rooms: ['bridge', 'mess'], along: 0.0, width: 2 });
    expect(() => normalizeDoor(authored, fixtureTwoRectRooms, 0))
      .toThrow(/places door off the shared edge/);
  });

  it('throws when along=1.0 with width=2 (door runs off edge)', () => {
    const authored = brel({ rooms: ['bridge', 'mess'], along: 1.0, width: 2 });
    expect(() => normalizeDoor(authored, fixtureTwoRectRooms, 0))
      .toThrow(/places door off the shared edge/);
  });

  it('B-pos: throws when position is not on shared edge', () => {
    const authored = bpos({
      rooms: ['bridge', 'mess'],
      position: { x: 7, y: 7, angle: 0 }, // way off the edge
    });
    expect(() => normalizeDoor(authored, fixtureTwoRectRooms, 0))
      .toThrow(/does not lie on shared edge/);
  });

  it('B-pos: error includes both room ids in message', () => {
    const authored = bpos({
      rooms: ['bridge', 'mess'],
      position: { x: 7, y: 7, angle: 0 },
    });
    try {
      normalizeDoor(authored, fixtureTwoRectRooms, 0);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DoorNormalizationError);
      const err = e as DoorNormalizationError;
      expect(err.message).toMatch(/'bridge'/);
      expect(err.message).toMatch(/'mess'/);
    }
  });

  it('error attaches authored input', () => {
    const authored = brel({ rooms: ['nope', 'mess'], along: 0.5 });
    try {
      normalizeDoor(authored, fixtureTwoRectRooms, 0);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(DoorNormalizationError);
      expect((e as DoorNormalizationError).authored).toBe(authored);
    }
  });
});

// -----------------------------------------------------------------------------
// Overlap detection (normalizeDoors)
// -----------------------------------------------------------------------------

describe('normalizeDoors — overlap detection', () => {
  it('two doors at along=0.5, width=1 each, edge length 4 → throws', () => {
    // width=1, edge_length=4, halfFrac=0.125. Door A occupies [0.375, 0.625],
    // Door B occupies the same range → overlap.
    const authored: AuthoredDoor[] = [
      brel({ rooms: ['bridge', 'mess'], along: 0.5 }),
      brel({ rooms: ['bridge', 'mess'], along: 0.5 }),
    ];
    expect(() => normalizeDoors(authored, fixtureTwoRectRooms))
      .toThrow(/overlap on shared edge/);
  });

  it('two doors at along=0.25 and along=0.75, width=1 each, edge length 4 → no overlap', () => {
    // Door A occupies [0.125, 0.375], Door B occupies [0.625, 0.875] — disjoint.
    const authored: AuthoredDoor[] = [
      brel({ rooms: ['bridge', 'mess'], along: 0.25 }),
      brel({ rooms: ['bridge', 'mess'], along: 0.75 }),
    ];
    const doors = normalizeDoors(authored, fixtureTwoRectRooms);
    expect(doors).toHaveLength(2);
  });

  it('two doors on different shared-edge pairs → never overlap', () => {
    // Door 1 between a-b, Door 2 between b-c. Both at along=0.5 but on
    // different edges — must NOT trigger overlap.
    const authored: AuthoredDoor[] = [
      brel({ rooms: ['a', 'b'], along: 0.5 }),
      brel({ rooms: ['b', 'c'], along: 0.5 }),
    ];
    const doors = normalizeDoors(authored, fixtureThreeRectRooms);
    expect(doors).toHaveLength(2);
  });

  it('overlap key uses sorted room pair (rooms order swap → still detects)', () => {
    // [bridge, mess] and [mess, bridge] should both hash to the same edge.
    const authored: AuthoredDoor[] = [
      brel({ rooms: ['bridge', 'mess'], along: 0.5 }),
      brel({ rooms: ['mess', 'bridge'], along: 0.5 }),
    ];
    expect(() => normalizeDoors(authored, fixtureTwoRectRooms))
      .toThrow(/overlap on shared edge/);
  });

  it('exterior doors on the same room can also overlap', () => {
    // Two exterior doors on `bridge` at the same `along` value with width=4
    // — the boundary is 16 cells (square perimeter), so width=4 occupies
    // 0.125 fraction; both at along=0.5 → overlap.
    const authored: AuthoredDoor[] = [
      brel({ rooms: ['bridge'], along: 0.5, width: 4 }),
      brel({ rooms: ['bridge'], along: 0.5, width: 4 }),
    ];
    expect(() => normalizeDoors(authored, fixtureTwoRectRooms))
      .toThrow(/overlap on shared edge/);
  });
});

// -----------------------------------------------------------------------------
// Stable id derivation
// -----------------------------------------------------------------------------

describe('normalizeDoor — stable id derivation', () => {
  it('omitted id, interior door → ${roomA}__${roomB}__${index}', () => {
    const authored = brel({ rooms: ['bridge', 'mess'], along: 0.5 });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 0);
    expect(door.id).toBe('bridge__mess__0');
  });

  it('omitted id, exterior door → ${roomA}__exterior__${index}', () => {
    const authored = brel({ rooms: ['bridge'], along: 0.5 });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 3);
    expect(door.id).toBe('bridge__exterior__3');
  });

  it('explicit id is preserved', () => {
    const authored = brel({
      id: 'door_main_entry',
      rooms: ['bridge', 'mess'],
      along: 0.5,
    });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 0);
    expect(door.id).toBe('door_main_entry');
  });

  it('two doors between same pair at different along → ids differ by index', () => {
    const authored: AuthoredDoor[] = [
      brel({ rooms: ['bridge', 'mess'], along: 0.25 }),
      brel({ rooms: ['bridge', 'mess'], along: 0.75 }),
    ];
    const doors = normalizeDoors(authored, fixtureTwoRectRooms);
    expect(doors[0].id).toBe('bridge__mess__0');
    expect(doors[1].id).toBe('bridge__mess__1');
    expect(doors[0].id).not.toBe(doors[1].id);
  });

  it('explicit id wins even when index would collide', () => {
    const authored: AuthoredDoor[] = [
      brel({ id: 'first', rooms: ['bridge', 'mess'], along: 0.25 }),
      brel({ rooms: ['bridge', 'mess'], along: 0.75 }),
    ];
    const doors = normalizeDoors(authored, fixtureTwoRectRooms);
    expect(doors[0].id).toBe('first');
    expect(doors[1].id).toBe('bridge__mess__1');
  });

  it('B-pos doors also get derived ids', () => {
    const authored = bpos({
      rooms: ['bridge', 'mess'],
      position: { x: 4, y: 2, angle: 90 },
    });
    const door = normalizeDoor(authored, fixtureTwoRectRooms, 5);
    expect(door.id).toBe('bridge__mess__5');
  });
});

// -----------------------------------------------------------------------------
// Mixed scenarios (sanity checks integrating happy paths + validation)
// -----------------------------------------------------------------------------

describe('normalizeDoors — mixed scenarios', () => {
  it('processes a mix of B-rel and B-pos doors successfully', () => {
    const authored: AuthoredDoor[] = [
      brel({ rooms: ['a', 'b'], along: 0.5 }),
      bpos({ rooms: ['b', 'c'], position: { x: 8, y: 2, angle: 90 } }),
    ];
    const doors = normalizeDoors(authored, fixtureThreeRectRooms);
    expect(doors).toHaveLength(2);
    expect(doors[0].roomA).toBe('a');
    expect(doors[0].roomB).toBe('b');
    expect(doors[1].roomA).toBe('b');
    expect(doors[1].roomB).toBe('c');
    expect(doors[1].angle).toBe(90); // preserved from authored
  });

  it('first failing entry reports its index via attached authored input', () => {
    const bad = brel({ rooms: ['nope', 'mess'], along: 0.5 });
    const authored: AuthoredDoor[] = [
      brel({ rooms: ['bridge', 'mess'], along: 0.25 }),
      bad,
    ];
    try {
      normalizeDoors(authored, fixtureTwoRectRooms);
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as DoorNormalizationError).authored).toBe(bad);
    }
  });

  it('empty input → empty output', () => {
    expect(normalizeDoors([], fixtureTwoRectRooms)).toEqual([]);
  });
});
