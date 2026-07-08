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

import { parseDocument, LineCounter, parse as parseYaml, YAMLMap, YAMLSeq, Scalar } from 'yaml';
import type { GridEncounterMapData, GridRoom, AuthoredDoor, VentPath, PoiData, PoiType } from '@/types/encounterMap';

// ============================================================
// Plain-JS deckplan shapes (from `yaml.parse()`, not CST)
// ============================================================

/** Authored POI entry, room-scoped or deck-level — pre-normalization. */
export interface RawPoiEntry {
  id?: string;
  type?: string;
  room?: string;
  position?: { x: number; y: number };
  label?: string;
  name?: string;
  icon?: string;
  status?: string;
  description?: string;
}

/** A room as authored in YAML — GridRoom plus an optional inline poi list. */
export interface DeckplanRoom extends GridRoom {
  poi?: RawPoiEntry[];
}

/** A single deck entry in the top-level `decks:` list. */
export interface DeckplanDeck {
  id: string;
  name?: string;
  unit_size?: number;
  rotation?: number;
  hull?: GridEncounterMapData['hull'];
  rooms?: DeckplanRoom[];
  doors?: AuthoredDoor[];
  vents?: VentPath[];
  poi?: RawPoiEntry[];
}

/** Plain-JS parse of the whole deckplan YAML document. */
export interface DeckplanDoc {
  name?: string;
  unit_size?: number;
  hull?: GridEncounterMapData['hull'];
  decks: DeckplanDeck[];
}

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
  kind: 'room' | 'poi' | 'door';
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

    const decksSeq = doc.get('decks', true) as YAMLSeq | undefined;
    if (!decksSeq || !Array.isArray(decksSeq.items)) {
      return result;
    }

    for (const deckNodeItem of decksSeq.items) {
      const deckNode = deckNodeItem as YAMLMap;
      if (!deckNode || !Array.isArray(deckNode.items)) continue;

      const deckId = deckNode.get('id') as string | undefined;
      if (!deckId) continue;

      // Walk rooms[]
      const roomsSeq = deckNode.get('rooms', true) as YAMLSeq | undefined;
      if (roomsSeq && Array.isArray(roomsSeq.items)) {
        for (const roomNodeItem of roomsSeq.items) {
          const roomNode = roomNodeItem as YAMLMap;
          if (!roomNode || !Array.isArray(roomNode.items)) continue;
          _extractIdEntry(roomNode, deckId, 'room', lineCounter, result);

          // Also walk per-room poi[] (normalized server-side but may appear in source)
          const perRoomPoiSeq = roomNode.get('poi', true) as YAMLSeq | undefined;
          if (perRoomPoiSeq && Array.isArray(perRoomPoiSeq.items)) {
            for (const poiNodeItem of perRoomPoiSeq.items) {
              const poiNode = poiNodeItem as YAMLMap;
              if (!poiNode || !Array.isArray(poiNode.items)) continue;
              _extractIdEntry(poiNode, deckId, 'poi', lineCounter, result);
            }
          }
        }
      }

      // Walk deck-level poi[]
      const deckPoiSeq = deckNode.get('poi', true) as YAMLSeq | undefined;
      if (deckPoiSeq && Array.isArray(deckPoiSeq.items)) {
        for (const poiNodeItem of deckPoiSeq.items) {
          const poiNode = poiNodeItem as YAMLMap;
          if (!poiNode || !Array.isArray(poiNode.items)) continue;
          _extractIdEntry(poiNode, deckId, 'poi', lineCounter, result);
        }
      }

      // Walk deck-level doors[]
      const doorsSeq = deckNode.get('doors', true) as YAMLSeq | undefined;
      if (doorsSeq && Array.isArray(doorsSeq.items)) {
        for (const doorNodeItem of doorsSeq.items) {
          const doorNode = doorNodeItem as YAMLMap;
          if (!doorNode || !Array.isArray(doorNode.items)) continue;
          _extractIdEntry(doorNode, deckId, 'door', lineCounter, result);
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
  node: YAMLMap,
  deckId: string,
  kind: 'room' | 'poi' | 'door',
  lineCounter: LineCounter,
  result: Map<string, IdRangeEntry>,
): void {
  try {
    const idPair = node.items.find((p) => (p?.key as Scalar | undefined)?.value === 'id');
    const idKey = idPair?.key as Scalar | undefined;
    if (!idKey?.range) return;

    const id = node.get('id') as string | undefined;
    if (!id) return;

    const [keyStart, keyEnd] = idKey.range;
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
  parsedDeckplan: DeckplanDoc | null | undefined,
  deckId: string,
): GridEncounterMapData | null {
  try {
    if (!parsedDeckplan || !Array.isArray(parsedDeckplan.decks)) return null;

    const deck = parsedDeckplan.decks.find((d) => d?.id === deckId);
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
      poi: normalizeClientPoi(deck),
    };
  } catch {
    return null;
  }
}

/**
 * Client-side equivalent of the Python normalize_deck_poi: flattens room-level
 * poi entries into a single top-level list, computing room-center positions for
 * any entry that omits an explicit position.
 */
function normalizeClientPoi(deck: DeckplanDeck): PoiData[] {
  const topPoi: PoiData[] = Array.isArray(deck.poi) ? [...(deck.poi as PoiData[])] : [];
  const existingIds = new Set(topPoi.map((p) => p?.id).filter(Boolean));

  for (const room of deck.rooms ?? []) {
    const roomPoi = room.poi;
    if (!Array.isArray(roomPoi) || roomPoi.length === 0) continue;

    // Compute room center for entries with no explicit position
    let cx = 0;
    let cy = 0;
    if (Array.isArray(room.polygon) && room.polygon.length > 0) {
      cx = room.polygon.reduce((s, p) => s + p[0], 0) / room.polygon.length;
      cy = room.polygon.reduce((s, p) => s + p[1], 0) / room.polygon.length;
    } else if (room.circle) {
      cx = room.circle.cx;
      cy = room.circle.cy;
    } else if (Array.isArray(room.rects) && room.rects.length > 0) {
      cx = room.rects.reduce((s, r) => s + r.x + r.w / 2, 0) / room.rects.length;
      cy = room.rects.reduce((s, r) => s + r.y + r.h / 2, 0) / room.rects.length;
    }

    for (let idx = 0; idx < roomPoi.length; idx++) {
      const entry = roomPoi[idx];
      if (!entry) continue;
      if (entry.room && entry.id && existingIds.has(entry.id)) continue;

      const poiId = entry.id || `${room.id}_poi_${idx}`;
      const pos = entry.position ?? { x: cx, y: cy };
      topPoi.push({
        id: poiId,
        type: (entry.type as PoiType) ?? 'item',
        room: room.id,
        position: pos,
        name: entry.label ?? entry.name ?? entry.icon ?? 'POI',
        icon: entry.icon ?? '',
        status: entry.status,
        description: entry.description,
      });
    }
  }

  return topPoi;
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
export function parseYamlSafe(yamlText: string): DeckplanDoc | null {
  try {
    return (parseYaml(yamlText) as DeckplanDoc) ?? null;
  } catch {
    return null;
  }
}
