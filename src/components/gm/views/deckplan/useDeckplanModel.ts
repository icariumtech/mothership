/**
 * Deckplan Model Utilities
 *
 * Pure functions for parsing deckplan YAML into an id→range map
 * (for Monaco click-to-jump) and adapting deck data to GridEncounterMapData
 * (for MapPreview rendering).
 *
 * No React imports in the pure helpers — this file is safe to import in
 * vitest unit tests without a DOM or jsdom environment.
 */

import { parseDocument, LineCounter, parse as parseYaml } from 'yaml';
import type { GridEncounterMapData } from '@/types/encounterMap';

// ============================================================
// IdRangeEntry — deck-scoped id → Monaco line/column position
// ============================================================

/**
 * A single id→line/column mapping entry in the id range map.
 *
 * Key in the map: `${deckId}|${kind}|${id}`
 *   e.g. "main_deck|room|corridor_1" or "main_deck|poi|poi_alpha"
 *
 * Line and col numbers are 1-based (matching Monaco editor conventions).
 */
export interface IdRangeEntry {
  deckId: string;
  kind: 'room' | 'poi';
  id: string;
  /** 1-based line of the `id:` key */
  idLineStart: number;
  /** 1-based end line of the `id:` key (same as start for single-line keys) */
  idLineEnd: number;
  /** 1-based column of the start of the `id:` key text */
  idColStart: number;
  /** 1-based column of the end of the `id:` key text */
  idColEnd: number;
}

// ============================================================
// buildIdRangeMap
// ============================================================

/**
 * Parse deckplan YAML and build a deck-scoped id→range map.
 *
 * The map key is `${deckId}|${kind}|${id}` where kind is "room" or "poi".
 * Ids may be reused across different decks — the deck scope in the key
 * ensures lookups are unambiguous (Pitfall 3).
 *
 * Returns an empty Map if the YAML has parse errors or if any exception
 * is thrown — callers should retain the last-good map (Pitfall 2).
 *
 * @param yamlText - Raw YAML text (Monaco buffer content)
 * @returns Map keyed by `${deckId}|${kind}|${id}` → IdRangeEntry
 */
export function buildIdRangeMap(yamlText: string): Map<string, IdRangeEntry> {
  try {
    const lineCounter = new LineCounter();
    const doc = parseDocument(yamlText, { lineCounter, keepSourceTokens: true });

    // Return empty on parse errors — caller keeps last-good (Pitfall 2)
    if (doc.errors.length > 0) {
      return new Map();
    }

    const result = new Map<string, IdRangeEntry>();

    const decksSeq = doc.get('decks', true) as any;
    if (!decksSeq || !Array.isArray(decksSeq.items)) {
      return result;
    }

    for (const deckNode of decksSeq.items) {
      if (!deckNode || !Array.isArray(deckNode.items)) continue;

      const deckId = deckNode.get('id') as string | undefined;
      if (!deckId) continue;

      // Walk rooms[]
      const roomsSeq = deckNode.get('rooms', true) as any;
      if (roomsSeq && Array.isArray(roomsSeq.items)) {
        for (const roomNode of roomsSeq.items) {
          if (!roomNode || !Array.isArray(roomNode.items)) continue;
          _extractIdEntry(roomNode, deckId, 'room', lineCounter, result);

          // Also walk per-room poi[] (normalized server-side but may appear in source)
          const perRoomPoiSeq = roomNode.get('poi', true) as any;
          if (perRoomPoiSeq && Array.isArray(perRoomPoiSeq.items)) {
            for (const poiNode of perRoomPoiSeq.items) {
              if (!poiNode || !Array.isArray(poiNode.items)) continue;
              _extractIdEntry(poiNode, deckId, 'poi', lineCounter, result);
            }
          }
        }
      }

      // Walk deck-level poi[]
      const deckPoiSeq = deckNode.get('poi', true) as any;
      if (deckPoiSeq && Array.isArray(deckPoiSeq.items)) {
        for (const poiNode of deckPoiSeq.items) {
          if (!poiNode || !Array.isArray(poiNode.items)) continue;
          _extractIdEntry(poiNode, deckId, 'poi', lineCounter, result);
        }
      }
    }

    return result;
  } catch {
    // Never throw on malformed input (Pitfall 2)
    return new Map();
  }
}

/**
 * Internal helper — extract the `id:` key line/col from a YAML map node
 * and add it to the result map.
 */
function _extractIdEntry(
  node: any,
  deckId: string,
  kind: 'room' | 'poi',
  lineCounter: LineCounter,
  result: Map<string, IdRangeEntry>,
): void {
  try {
    const idPair = node.items.find((p: any) => p?.key?.value === 'id');
    if (!idPair?.key?.range) return;

    const id = node.get('id') as string | undefined;
    if (!id) return;

    const [keyStart, keyEnd] = idPair.key.range as [number, number, number];
    const startPos = lineCounter.linePos(keyStart);
    const endPos = lineCounter.linePos(keyEnd);

    const entry: IdRangeEntry = {
      deckId,
      kind,
      id,
      idLineStart: startPos.line,
      idLineEnd: endPos.line,
      idColStart: startPos.col,
      idColEnd: endPos.col,
    };

    result.set(`${deckId}|${kind}|${id}`, entry);
  } catch {
    // Skip malformed nodes silently
  }
}

// ============================================================
// deckToMapData
// ============================================================

/**
 * Adapt a parsed deckplan plain JS object to the GridEncounterMapData
 * shape expected by MapPreview / EncounterMapRenderer.
 *
 * Uses `yaml.parse()` (plain object, not CST) — this is intentional for
 * the rendering path; the CST is only needed for id→range mapping.
 *
 * @param parsedDeckplan - Plain JS object from `yaml.parse(text)`
 * @param deckId - ID of the deck to extract
 * @returns GridEncounterMapData or null if the deck is not found
 */
export function deckToMapData(
  parsedDeckplan: any,
  deckId: string,
): GridEncounterMapData | null {
  try {
    if (!parsedDeckplan || !Array.isArray(parsedDeckplan.decks)) return null;

    const deck = parsedDeckplan.decks.find((d: any) => d?.id === deckId);
    if (!deck) return null;

    return {
      name: deck.name ?? parsedDeckplan.name ?? '',
      unit_size: deck.unit_size ?? parsedDeckplan.unit_size ?? 40,
      rotation: deck.rotation,
      // Per HULL-01 (future phase): deck-level hull overrides deckplan-level hull
      hull: deck.hull ?? parsedDeckplan.hull,
      rooms: deck.rooms ?? [],
      doors: deck.doors ?? [],
      vents: deck.vents ?? [],
      poi: deck.poi ?? [],
    };
  } catch {
    return null;
  }
}

// ============================================================
// parseYamlSafe — helper for consumers that need the plain JS object
// ============================================================

/**
 * Parse deckplan YAML to a plain JS object, returning null on any error.
 *
 * Use this for the rendering path (deckToMapData). Do NOT use for the
 * id→range map — that requires the CST path (buildIdRangeMap).
 *
 * @param yamlText - Raw YAML text
 * @returns Parsed plain object or null
 */
export function parseYamlSafe(yamlText: string): any {
  try {
    return parseYaml(yamlText) ?? null;
  } catch {
    return null;
  }
}
