import { describe, expect, it } from 'vitest';
import { GridRoom, RoomVisibilityState } from '../../../../../types/encounterMap';
import {
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_STAGGER_MS,
  scheduleReveal,
  RevealStep,
} from '../scheduleReveal';

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

const rectRoom = (id: string, x: number, y: number, w = 4, h = 4): GridRoom => ({
  id,
  name: id,
  rects: [{ x, y, w, h }],
});

const circleRoom = (id: string, cx: number, cy: number, r = 3): GridRoom => ({
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

const degenerateRoom = (id: string): GridRoom => ({
  id,
  name: id,
  rects: [],
  // no circle, no polygon → Y = 0
});

const all = (state: boolean, rooms: GridRoom[]): RoomVisibilityState =>
  Object.fromEntries(rooms.map(r => [r.id, state]));

const vis = (entries: [string, boolean][]): RoomVisibilityState =>
  Object.fromEntries(entries);

/** Same map identity — valid for testing actual diffs */
const IDENTITY = 'deck1|shipmap';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const stepsFor = (roomId: string, steps: RevealStep[]) =>
  steps.filter(s => s.roomId === roomId);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scheduleReveal', () => {
  // Case 1: prev is undefined → []
  it('returns [] when prev is undefined', () => {
    const rooms = [rectRoom('a', 0, 0)];
    const curr = all(true, rooms);
    const result = scheduleReveal(undefined, curr, rooms, IDENTITY, IDENTITY);
    expect(result).toEqual([]);
  });

  // Case 2: curr is undefined → []
  it('returns [] when curr is undefined', () => {
    const rooms = [rectRoom('a', 0, 0)];
    const prev = all(true, rooms);
    const result = scheduleReveal(prev, undefined, rooms, IDENTITY, IDENTITY);
    expect(result).toEqual([]);
  });

  // Case 3: both undefined → []
  it('returns [] when both prev and curr are undefined', () => {
    const rooms = [rectRoom('a', 0, 0)];
    const result = scheduleReveal(undefined, undefined, rooms, IDENTITY, IDENTITY);
    expect(result).toEqual([]);
  });

  // Case 4: mapIdentity changed → [] regardless of diff
  it('returns [] when mapIdentity changed (deck switch)', () => {
    const rooms = [rectRoom('a', 0, 0), rectRoom('b', 0, 5)];
    const prev = all(false, rooms);
    const curr = all(true, rooms);
    const result = scheduleReveal(prev, curr, rooms, 'deck2|bridge', 'deck1|engine');
    expect(result).toEqual([]);
  });

  // Case 5: mapIdentity changed from undefined (first render) → []
  it('returns [] when prevMapIdentity is undefined (first render)', () => {
    const rooms = [rectRoom('a', 0, 0)];
    const prev = all(false, rooms);
    const curr = all(true, rooms);
    const result = scheduleReveal(prev, curr, rooms, IDENTITY, undefined);
    expect(result).toEqual([]);
  });

  // Case 6: prev === curr → no steps
  it('returns [] when prev and curr are identical (no diff)', () => {
    const rooms = [rectRoom('a', 0, 0), rectRoom('b', 0, 5)];
    const state = all(true, rooms);
    const result = scheduleReveal(state, state, rooms, IDENTITY, IDENTITY);
    expect(result).toEqual([]);
  });

  // Case 7: single room transitioning false→true → one 'revealing' step
  it('returns one revealing step when a single room becomes visible', () => {
    const rooms = [rectRoom('bridge', 0, 0)];
    const prev = vis([['bridge', false]]);
    const curr = vis([['bridge', true]]);
    const steps = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY);
    expect(steps).toHaveLength(1);
    expect(steps[0].roomId).toBe('bridge');
    expect(steps[0].anim).toBe('revealing');
    expect(steps[0].delayMs).toBe(DEFAULT_BASE_DELAY_MS);
  });

  // Case 8: single room transitioning true→false → one 'hiding' step
  it('returns one hiding step when a single room becomes hidden', () => {
    const rooms = [rectRoom('cargo', 0, 0)];
    const prev = vis([['cargo', true]]);
    const curr = vis([['cargo', false]]);
    const steps = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY);
    expect(steps).toHaveLength(1);
    expect(steps[0].roomId).toBe('cargo');
    expect(steps[0].anim).toBe('hiding');
    expect(steps[0].delayMs).toBe(DEFAULT_BASE_DELAY_MS);
  });

  // Case 9: multiple rooms revealing → sorted by Y, staggered
  it('sorts multiple revealing rooms by Y-ascending with stagger', () => {
    // room C is at Y=10, room A at Y=0, room B at Y=5
    const rooms = [rectRoom('C', 0, 10), rectRoom('A', 0, 0), rectRoom('B', 0, 5)];
    const prev = all(false, rooms);
    const curr = all(true, rooms);
    const steps = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY);

    expect(steps).toHaveLength(3);
    // All should be 'revealing'
    expect(steps.every(s => s.anim === 'revealing')).toBe(true);

    // Sort steps by delay to check stagger order
    const sorted = [...steps].sort((a, b) => a.delayMs - b.delayMs);
    expect(sorted[0].roomId).toBe('A');
    expect(sorted[0].delayMs).toBe(DEFAULT_BASE_DELAY_MS + 0 * DEFAULT_STAGGER_MS);
    expect(sorted[1].roomId).toBe('B');
    expect(sorted[1].delayMs).toBe(DEFAULT_BASE_DELAY_MS + 1 * DEFAULT_STAGGER_MS);
    expect(sorted[2].roomId).toBe('C');
    expect(sorted[2].delayMs).toBe(DEFAULT_BASE_DELAY_MS + 2 * DEFAULT_STAGGER_MS);
  });

  // Case 10: mix of revealing and hiding rooms → both in result
  it('includes both revealing and hiding steps in a mixed diff', () => {
    const roomA = rectRoom('A', 0, 0);
    const roomB = rectRoom('B', 0, 5);
    const rooms = [roomA, roomB];
    // A was hidden, becomes visible; B was visible, becomes hidden
    const prev = vis([['A', false], ['B', true]]);
    const curr = vis([['A', true], ['B', false]]);
    const steps = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY);

    expect(steps).toHaveLength(2);
    const aStep = stepsFor('A', steps);
    const bStep = stepsFor('B', steps);
    expect(aStep).toHaveLength(1);
    expect(aStep[0].anim).toBe('revealing');
    expect(bStep).toHaveLength(1);
    expect(bStep[0].anim).toBe('hiding');
  });

  // Case 11: room not in rooms[] (stale visibility key) → ignored
  it('ignores stale visibility keys not present in the rooms array', () => {
    const rooms = [rectRoom('real', 0, 0)];
    const prev = vis([['real', false], ['ghost', false]]);
    const curr = vis([['real', true], ['ghost', true]]);
    const steps = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY);
    // Only 'real' should appear — 'ghost' is not in rooms[]
    expect(steps).toHaveLength(1);
    expect(steps[0].roomId).toBe('real');
  });

  // Case 12: opts.staggerMs = 0 → all delays equal baseDelayMs
  it('produces equal delays when staggerMs is 0', () => {
    const rooms = [rectRoom('A', 0, 0), rectRoom('B', 0, 5), rectRoom('C', 0, 10)];
    const prev = all(false, rooms);
    const curr = all(true, rooms);
    const steps = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY, { staggerMs: 0 });
    expect(steps).toHaveLength(3);
    steps.forEach(s => expect(s.delayMs).toBe(DEFAULT_BASE_DELAY_MS));
  });

  // Case 13: opts.strategy = 'y-ascending' explicitly → same as default
  it('explicit y-ascending strategy matches default behaviour', () => {
    const rooms = [rectRoom('A', 0, 5), rectRoom('B', 0, 0)];
    const prev = all(false, rooms);
    const curr = all(true, rooms);
    const withDefault = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY);
    const withExplicit = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY, {
      strategy: 'y-ascending',
    });
    expect(withExplicit).toEqual(withDefault);
  });

  // Case 14: degenerate room (no rects/circle/polygon) → Y=0, handled gracefully
  it('handles degenerate rooms (no geometry) with Y=0 fallback', () => {
    const deg = degenerateRoom('ghost');
    const real = rectRoom('real', 0, 5);
    const rooms = [deg, real];
    const prev = all(false, rooms);
    const curr = all(true, rooms);
    const steps = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY);
    expect(steps).toHaveLength(2);
    // ghost has Y=0, real has Y=5 → ghost first
    const sorted = [...steps].sort((a, b) => a.delayMs - b.delayMs);
    expect(sorted[0].roomId).toBe('ghost');
    expect(sorted[1].roomId).toBe('real');
  });

  // Case 15: circle room Y is cy
  it('uses cy for circle rooms', () => {
    const c10 = circleRoom('c10', 5, 10);
    const c3 = circleRoom('c3', 5, 3);
    const rooms = [c10, c3];
    const prev = all(false, rooms);
    const curr = all(true, rooms);
    const steps = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY);
    const sorted = [...steps].sort((a, b) => a.delayMs - b.delayMs);
    // c3 (cy=3) is lower Y → first
    expect(sorted[0].roomId).toBe('c3');
    expect(sorted[1].roomId).toBe('c10');
  });

  // Case 16: polygon room Y is average of vertices
  it('uses polygon Y-centroid (vertex average) for polygon rooms', () => {
    // Triangle with centroid Y ≈ 10
    const highPoly = polygonRoom('high', [[0, 8], [4, 8], [2, 14]]);  // avg Y = 10
    // Triangle with centroid Y ≈ 2
    const lowPoly = polygonRoom('low', [[0, 0], [4, 0], [2, 6]]);     // avg Y = 2
    const rooms = [highPoly, lowPoly];
    const prev = all(false, rooms);
    const curr = all(true, rooms);
    const steps = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY);
    const sorted = [...steps].sort((a, b) => a.delayMs - b.delayMs);
    expect(sorted[0].roomId).toBe('low');
    expect(sorted[1].roomId).toBe('high');
  });

  // Case 17: custom baseDelayMs
  it('respects custom baseDelayMs', () => {
    const rooms = [rectRoom('a', 0, 0)];
    const prev = vis([['a', false]]);
    const curr = vis([['a', true]]);
    const steps = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY, {
      baseDelayMs: 200,
    });
    expect(steps[0].delayMs).toBe(200);
  });

  // Case 18: no change in visibility keys that exist in rooms → []
  it('returns [] when all present rooms have unchanged visibility', () => {
    const rooms = [rectRoom('a', 0, 0), rectRoom('b', 0, 5)];
    // a was true, b was false — and still are
    const prev = vis([['a', true], ['b', false]]);
    const curr = vis([['a', true], ['b', false]]);
    const steps = scheduleReveal(prev, curr, rooms, IDENTITY, IDENTITY);
    expect(steps).toEqual([]);
  });

  // Case 19: mapIdentity same string even if constructed differently → animations fire
  it('fires animations when mapIdentity is same string (no map switch)', () => {
    const rooms = [rectRoom('a', 0, 0)];
    const prev = vis([['a', false]]);
    const curr = vis([['a', true]]);
    const identity = 'deck1|somnus';
    const steps = scheduleReveal(prev, curr, rooms, identity, identity);
    expect(steps).toHaveLength(1);
    expect(steps[0].anim).toBe('revealing');
  });
});
