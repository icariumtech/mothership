/**
 * Deckplan YAML Surgical Edit Builders
 *
 * Pure, Monaco-agnostic functions that return plain TextEdit objects
 * (1-based line/col, no DOM or Monaco imports). Plan 04 converts these
 * to monaco.Range for editor.executeEdits().
 *
 * Design goals:
 * - Never call YAML.stringify() on the whole document (D-12)
 * - Return null on any parse error or not-found case; never throw (Pitfall 2)
 * - Handle both flow-style ({x: 1, y: 2}) and block-style position nodes (Pitfall 5)
 */

import { parseDocument, LineCounter } from 'yaml';

// ============================================================
// TextEdit — Monaco-agnostic edit range descriptor
// ============================================================

/**
 * A text replacement edit with 1-based line/column coordinates.
 *
 * Plan 04 converts to `new monaco.Range(startLine, startCol, endLine, endCol)`
 * and calls `editor.executeEdits('deckplan-editor', [{ range, text }])`.
 */
export interface TextEdit {
  /** 1-based line where replacement starts */
  startLine: number;
  /** 1-based column where replacement starts */
  startCol: number;
  /** 1-based line where replacement ends (inclusive) */
  endLine: number;
  /** 1-based column where replacement ends (exclusive, matching Monaco convention) */
  endCol: number;
  /** Replacement text to insert at the range */
  text: string;
}

// ============================================================
// Internal helpers
// ============================================================

/** Convert a byte offset + LineCounter to a {line, col} 1-based position. */
function _lineCol(lineCounter: LineCounter, offset: number): { line: number; col: number } {
  return lineCounter.linePos(offset);
}

/**
 * Find a deck node by id in the CST decksSeq.
 * Returns the YAML map node or null.
 */
function _findDeckNode(decksSeq: any, deckId: string): any {
  if (!decksSeq || !Array.isArray(decksSeq.items)) return null;
  for (const deckNode of decksSeq.items) {
    if (deckNode?.get?.('id') === deckId) return deckNode;
  }
  return null;
}

/**
 * Find a POI node by id within a deck node.
 * Searches deck-level poi[] and per-room poi[].
 * Returns the YAML map node or null.
 */
function _findPoiNode(deckNode: any, poiId: string): any {
  if (!deckNode) return null;

  // Check deck-level poi[]
  const deckPoiSeq = deckNode.get?.('poi', true) as any;
  if (deckPoiSeq && Array.isArray(deckPoiSeq.items)) {
    for (const poiNode of deckPoiSeq.items) {
      if (poiNode?.get?.('id') === poiId) return poiNode;
    }
  }

  // Check per-room poi[]
  const roomsSeq = deckNode.get?.('rooms', true) as any;
  if (roomsSeq && Array.isArray(roomsSeq.items)) {
    for (const roomNode of roomsSeq.items) {
      const roomPoiSeq = roomNode?.get?.('poi', true) as any;
      if (roomPoiSeq && Array.isArray(roomPoiSeq.items)) {
        for (const poiNode of roomPoiSeq.items) {
          if (poiNode?.get?.('id') === poiId) return poiNode;
        }
      }
    }
  }

  return null;
}

// ============================================================
// buildPositionEdit
// ============================================================

/**
 * Build a TextEdit that replaces a POI's `position` value with new {x, y} coords.
 *
 * Works for both flow-style (`position: {x: 1, y: 2}`) and block-style
 * (`position:\n  x: 1\n  y: 2`) authored values. The block form is collapsed
 * to a single-line flow map on edit — an acceptable scoped reformat (Pitfall 5).
 *
 * @param yamlText - Raw YAML text (Monaco buffer content)
 * @param deckId - Deck to look in
 * @param poiId - POI whose position to update
 * @param newX - New x grid coordinate
 * @param newY - New y grid coordinate
 * @returns TextEdit replacing the position value, or null if not found / parse error
 */
export function buildPositionEdit(
  yamlText: string,
  deckId: string,
  poiId: string,
  newX: number,
  newY: number,
): TextEdit | null {
  try {
    const lineCounter = new LineCounter();
    const doc = parseDocument(yamlText, { lineCounter, keepSourceTokens: true });
    if (doc.errors.length > 0) return null;

    const decksSeq = doc.get('decks', true) as any;
    const deckNode = _findDeckNode(decksSeq, deckId);
    if (!deckNode) return null;

    const poiNode = _findPoiNode(deckNode, poiId);
    if (!poiNode) return null;

    // Get the position value node — this is the whole value (flow or block map)
    const posPair = poiNode.items?.find((p: any) => p?.key?.value === 'position');
    if (!posPair?.value?.range) return null;

    const [rangeStart, rangeEnd] = posPair.value.range as [number, number, number];
    const startPos = _lineCol(lineCounter, rangeStart);
    const endPos = _lineCol(lineCounter, rangeEnd);

    return {
      startLine: startPos.line,
      startCol: startPos.col,
      endLine: endPos.line,
      endCol: endPos.col,
      text: `{x: ${newX}, y: ${newY}}`,
    };
  } catch {
    return null;
  }
}

// ============================================================
// buildAddPoiEdit
// ============================================================

/** Options for the new POI stub added by buildAddPoiEdit. */
export interface AddPoiOpts {
  /** POI display name (default: "New POI") */
  name?: string;
  /** POI type (default: "marker") */
  type?: string;
  /** POI icon name (default: "marker") */
  icon?: string;
}

/**
 * Build a TextEdit that inserts a new POI stub into a deck's poi list.
 *
 * Two branches:
 * - **poi-exists**: Appends a new sequence item at the end of the existing
 *   `poi:` list, matching the first existing item's column for indentation.
 * - **poi-absent**: Inserts a new `poi:` key + first item after the deck's
 *   last existing key, without swallowing the next sibling deck's `- id:`.
 *
 * The id in the stub is auto-generated as `poi_${Date.now()}`.
 *
 * @param yamlText - Raw YAML text (Monaco buffer content)
 * @param deckId - Deck to add the POI to
 * @param x - New POI x grid coordinate
 * @param y - New POI y grid coordinate
 * @param opts - Optional overrides for name, type, icon defaults
 * @returns TextEdit inserting the new POI stub, or null if not found / parse error
 */
export function buildAddPoiEdit(
  yamlText: string,
  deckId: string,
  x: number,
  y: number,
  opts?: AddPoiOpts,
): TextEdit | null {
  try {
    const lineCounter = new LineCounter();
    const doc = parseDocument(yamlText, { lineCounter, keepSourceTokens: true });
    if (doc.errors.length > 0) return null;

    const decksSeq = doc.get('decks', true) as any;
    const deckNode = _findDeckNode(decksSeq, deckId);
    if (!deckNode) return null;

    const name = opts?.name ?? 'New POI';
    const type = opts?.type ?? 'marker';
    const icon = opts?.icon ?? 'marker';
    const poiStubId = `poi_${Date.now()}`;
    const poiItem = `- {id: ${poiStubId}, name: "${name}", type: ${type}, icon: ${icon}, position: {x: ${x}, y: ${y}}}`;

    // Check if deck already has a poi: seq
    const deckPoiSeq = deckNode.get?.('poi', true) as any;

    if (deckPoiSeq && Array.isArray(deckPoiSeq.items) && deckPoiSeq.items.length > 0) {
      // poi-exists branch: insert after the last item
      const lastItem = deckPoiSeq.items[deckPoiSeq.items.length - 1];
      const [, lastItemValueEnd] = lastItem.range as [number, number, number];

      // Determine indentation from the first item's column (1-based → count spaces)
      const firstItemStart = deckPoiSeq.items[0].range[0] as number;
      const firstItemCol = lineCounter.linePos(firstItemStart).col; // 1-based
      const indent = ' '.repeat(firstItemCol - 1); // col-1 spaces before '-'

      // Insert point: the lastItemValueEnd is at the start of the next line
      // (the '\n- id:' of the next sibling or EOF). We insert BEFORE that '\n'
      // to keep the new item within this deck's sequence.
      const charAtEnd = yamlText[lastItemValueEnd - 1]; // char just before lastItemValueEnd
      const insertByte = charAtEnd === '\n' ? lastItemValueEnd - 1 : lastItemValueEnd;
      const lineOfInsert = lineCounter.linePos(insertByte);

      return {
        startLine: lineOfInsert.line,
        startCol: lineOfInsert.col,
        endLine: lineOfInsert.line,
        endCol: lineOfInsert.col,
        text: '\n' + indent + poiItem,
      };
    } else {
      // poi-absent branch: insert a new poi: key + first item after the deck's last key
      // Find the last key pair in the deck node
      if (!Array.isArray(deckNode.items) || deckNode.items.length === 0) return null;

      const lastPair = deckNode.items[deckNode.items.length - 1];
      const lastPairValueRange = lastPair?.value?.range;
      if (!lastPairValueRange) return null;

      const [, lastPairValueEnd] = lastPairValueRange as [number, number, number];

      // Determine the deck key indentation from any existing key (e.g. 'id' key)
      // The deck keys are indented 2 from the sequence item's '-'
      // e.g. '  name:' at col 3 (1-based) = 2 spaces prefix
      const idPair = deckNode.items.find((p: any) => p?.key?.value === 'id');
      const deckKeyCol = idPair?.key?.range
        ? lineCounter.linePos(idPair.key.range[0]).col
        : 3; // default: 2 spaces + key
      const keyIndent = ' '.repeat(deckKeyCol - 1); // col-1 spaces before key text
      const itemIndent = keyIndent + '  '; // poi items indented 2 more than key

      // Back up past trailing whitespace to avoid swallowing the next deck's '- id:'
      // lastPairValueEnd typically points to the start of the next sibling's '- '
      // We need to insert right before the '\n' that precedes the next sibling
      const insertByte = lastPairValueEnd - 1; // just before the '\n'
      const charBefore = yamlText[insertByte];

      let insertLine: number;
      let insertCol: number;

      if (charBefore === '\n' || insertByte >= yamlText.length) {
        // Position at the end of the content (before newline)
        const pos = lineCounter.linePos(Math.max(0, insertByte));
        insertLine = pos.line;
        insertCol = pos.col;
      } else {
        const pos = lineCounter.linePos(lastPairValueEnd);
        insertLine = pos.line;
        insertCol = pos.col;
      }

      const poiKeyText = `${keyIndent}poi:`;
      const poiFirstItem = `${itemIndent}${poiItem}`;

      return {
        startLine: insertLine,
        startCol: insertCol,
        endLine: insertLine,
        endCol: insertCol,
        text: '\n' + poiKeyText + '\n' + poiFirstItem,
      };
    }
  } catch {
    return null;
  }
}
