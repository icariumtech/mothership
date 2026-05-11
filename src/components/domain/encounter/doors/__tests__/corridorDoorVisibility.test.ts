/**
 * corridorDoorVisibility.test.ts — repro for the 21-04 regression where doors
 * connecting a room to a corridor do NOT render on the player terminal when
 * only the corridor is revealed.
 *
 * Hypothesis order:
 *   H1 — normalizer drops corridor-shared doors silently
 *   H2 — normalized door coords don't lie on the shared edge
 *   H5 — visibility filter logic doesn't pass for [room, corridor] doors
 *
 * The test mirrors the renderer's player-side visibility filter exactly
 * (EncounterMapRenderer.tsx lines 1356–1378).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { normalizeDoors } from '../doorNormalizer';
import { playerDoorVisible } from '../doorVisibility';
import type {
  AuthoredDoor,
  GridRoom,
  RoomVisibilityState,
} from '../../../../../types/encounterMap';

const REPO_ROOT = resolve(__dirname, '../../../../../..');

interface DeckLike {
  id?: string;
  rooms?: GridRoom[];
  doors?: AuthoredDoor[];
}
interface MapDocLike extends DeckLike {
  decks?: DeckLike[];
}

const CASES = [
  // (rel path, deck id or null for single-deck, room with corridor neighbour, corridor id)
  ['data/ships/patrol_gunboat/deckplan.yaml', 'main_deck', 'bridge', 'corridor_3'] as const,
  ['data/campaign/ship/deckplan.yaml', 'main_deck', 'bridge', 'corridor_3'] as const,
  ['data/galaxy/tau-ceti/somnus/map/main_deck.yaml', null, 'cyropod_chamber', 'corridor_3'] as const,
];

function decksFor(doc: MapDocLike): DeckLike[] {
  if (Array.isArray(doc.rooms)) return [doc];
  return doc.decks ?? [];
}

function loadDeck(rel: string, deckId: string | null): {rooms: GridRoom[]; doors: AuthoredDoor[]} {
  const text = readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
  const doc = parseYaml(text) as MapDocLike;
  const decks = decksFor(doc);
  const deck = deckId
    ? decks.find(d => d.id === deckId)
    : decks[0];
  if (!deck) throw new Error(`no deck ${deckId} in ${rel}`);
  return { rooms: deck.rooms ?? [], doors: deck.doors ?? [] };
}

// playerDoorVisible is imported from ../doorVisibility — imported above.
// Tests reference the actual renderer predicate, not a snapshot copy.

describe('corridor↔room door visibility (player terminal)', () => {
  for (const [rel, deckId, roomId, corridorId] of CASES) {
    describe(`${rel} :: ${roomId} ↔ ${corridorId}`, () => {
      const { rooms, doors } = loadDeck(rel, deckId);

      it('H1: normalizer accepts the corridor-shared door without dropping it', () => {
        // Find the authored door connecting (roomId, corridorId) in either order.
        const authoredIdx = doors.findIndex(d =>
          d.rooms.length === 2 &&
          ((d.rooms[0] === roomId && d.rooms[1] === corridorId) ||
            (d.rooms[0] === corridorId && d.rooms[1] === roomId))
        );
        expect(authoredIdx, `no authored door ${roomId} ↔ ${corridorId}`).toBeGreaterThanOrEqual(0);

        // Full canonical normalization — must not drop the door.
        const canonical = normalizeDoors(doors, rooms);
        expect(canonical.length).toBe(doors.length);

        const door = canonical[authoredIdx];
        expect(door.roomA).toBeTruthy();
        expect(door.roomB).toBeTruthy();
      });

      it('H5: player visibility filter passes when ONLY the corridor is revealed', () => {
        const canonical = normalizeDoors(doors, rooms);
        // Initial state: all rooms hidden (backend default at encounter start).
        const allHidden: RoomVisibilityState = Object.fromEntries(
          rooms.map(r => [r.id, false])
        );
        // GM reveals just the corridor.
        const onlyCorridor: RoomVisibilityState = { ...allHidden, [corridorId]: true };

        // Find the door connecting roomId ↔ corridorId.
        const door = canonical.find(d =>
          (d.roomA === roomId && d.roomB === corridorId) ||
          (d.roomA === corridorId && d.roomB === roomId)
        );
        expect(door, `canonical door ${roomId} ↔ ${corridorId} should exist`).toBeDefined();

        // The expected behavior — door must render on the player terminal.
        expect(
          playerDoorVisible(door!, onlyCorridor),
          `door ${door!.id} should render when ${corridorId} is the only revealed room`
        ).toBe(true);
      });

      it('H5b: player visibility filter passes when ONLY the room is revealed', () => {
        const canonical = normalizeDoors(doors, rooms);
        const allHidden: RoomVisibilityState = Object.fromEntries(
          rooms.map(r => [r.id, false])
        );
        const onlyRoom: RoomVisibilityState = { ...allHidden, [roomId]: true };
        const door = canonical.find(d =>
          (d.roomA === roomId && d.roomB === corridorId) ||
          (d.roomA === corridorId && d.roomB === roomId)
        );
        expect(door).toBeDefined();
        expect(playerDoorVisible(door!, onlyRoom)).toBe(true);
      });

      it('H5c: filter rejects the door when BOTH endpoints are hidden', () => {
        const canonical = normalizeDoors(doors, rooms);
        const allHidden: RoomVisibilityState = Object.fromEntries(
          rooms.map(r => [r.id, false])
        );
        const door = canonical.find(d =>
          (d.roomA === roomId && d.roomB === corridorId) ||
          (d.roomA === corridorId && d.roomB === roomId)
        );
        expect(door).toBeDefined();
        expect(playerDoorVisible(door!, allHidden)).toBe(false);
      });

      it('H6: every door touching the corridor renders when ONLY corridor is revealed', () => {
        const canonical = normalizeDoors(doors, rooms);
        const allHidden: RoomVisibilityState = Object.fromEntries(
          rooms.map(r => [r.id, false])
        );
        const onlyCorridor: RoomVisibilityState = { ...allHidden, [corridorId]: true };

        const corridorDoors = canonical.filter(d =>
          d.roomA === corridorId || d.roomB === corridorId
        );
        expect(corridorDoors.length, `no doors touch ${corridorId}`).toBeGreaterThan(0);

        const dropped = corridorDoors.filter(d => !playerDoorVisible(d, onlyCorridor));
        expect(
          dropped,
          `dropped corridor-shared doors:\n${dropped.map(d => `  - ${d.id} (${d.roomA} ↔ ${d.roomB})`).join('\n')}`
        ).toEqual([]);
      });
    });
  }
});
