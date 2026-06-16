/**
 * migratedMaps.test.ts — load every migrated map YAML file and run it
 * through `normalizeDoors`. This is the verification gate for Phase 21
 * plan 21-04 Task 2 (YAML migration): every existing map must produce
 * canonical doors without throwing `DoorNormalizationError`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { normalizeDoors } from '../doorNormalizer';
import type { AuthoredDoor, GridRoom } from '../../../../../types/encounterMap';

const REPO_ROOT = resolve(__dirname, '../../../../../..');

interface DeckLike {
  id?: string;
  rooms?: GridRoom[];
  doors?: AuthoredDoor[];
}

interface MapDocLike extends DeckLike {
  decks?: DeckLike[];
}

const MIGRATED_FILES = [
  'data/ships/somnus/deckplan.yaml',
  'data/galaxy/kepler-442/kepler-442b/base_alpha/deckplan.yaml',
  'data/ships/patrol_gunboat/deckplan.yaml',
  'data/campaign/ship/deckplan.yaml',
  'data/ships/ship_gamma/deckplan.yaml',
];

function decksFor(doc: MapDocLike): DeckLike[] {
  if (Array.isArray(doc.rooms)) return [doc];
  return doc.decks ?? [];
}

describe('migrated map YAML files', () => {
  for (const rel of MIGRATED_FILES) {
    it(`normalizes doors in ${rel}`, () => {
      const text = readFileSync(resolve(REPO_ROOT, rel), 'utf-8');
      const doc = parseYaml(text) as MapDocLike;
      const decks = decksFor(doc);
      for (const deck of decks) {
        const rooms = deck.rooms ?? [];
        const doors = deck.doors ?? [];
        if (rooms.length === 0) continue; // metadata-only deck
        // No room may still have nested doors after migration.
        for (const r of rooms) {
          expect((r as GridRoom & { doors?: unknown }).doors).toBeUndefined();
        }
        // The canonical normalizer must accept every authored entry.
        const canonical = normalizeDoors(doors, rooms);
        expect(canonical.length).toBe(doors.length);
        // Every door id must be either explicit (legacy `${room}_door_${i}`)
        // or derived; either way non-empty.
        for (const d of canonical) {
          expect(d.id.length).toBeGreaterThan(0);
        }
      }
    });
  }
});
