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

import { parseDocument, LineCounter, parse as parseYaml } from 'yaml';

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
  /** POI id override (default: auto-generated `poi_${Date.now()}`).
   *  Callers that need to jump to the newly-inserted POI should generate the id
   *  before calling buildAddPoiEdit and pass it here so they can look it up via
   *  jumpToElement after the edit is applied. */
  id?: string;
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
    const poiStubId = opts?.id ?? `poi_${Date.now()}`;

    // Primary path: add POI directly to the room containing (x, y).
    // This keeps the entry room-scoped, matching how the schema organises POIs.
    const plainDeck = (parseYaml(yamlText) as any)?.decks?.find((d: any) => d?.id === deckId);
    if (plainDeck) {
      const targetRoom = _findRoomForPoint(plainDeck.rooms ?? [], x, y);
      if (targetRoom) {
        const targetRoomNode = _findRoomNodeById(deckNode, targetRoom.id);
        if (targetRoomNode) {
          return _buildAddPoiToRoomNodeEdit(yamlText, lineCounter, targetRoomNode,
            { id: poiStubId, name, type, icon }, x, y);
        }
      }
    }

    // Fallback: no room found (click outside all polygons) — add to deck-level poi list.
    const poiItem = `- {id: ${poiStubId}, name: "${name}", type: ${type}, icon: ${icon}, position: {x: ${x}, y: ${y}}}`;

    // Check if deck already has a poi: key (even if its value is empty/null)
    const deckPoiSeq = deckNode.get?.('poi', true) as any;
    const deckPoiPair = (deckNode.items as any[])?.find((p: any) => p?.key?.value === 'poi');
    const hasPoiItems = deckPoiSeq && Array.isArray(deckPoiSeq.items) && deckPoiSeq.items.length > 0;

    if (hasPoiItems) {
      // poi-exists branch: insert after the last item
      const lastItem = deckPoiSeq.items[deckPoiSeq.items.length - 1];
      const [, lastItemValueEnd] = lastItem.range as [number, number, number];

      // Determine indentation from the '-' column of the first item.
      // items[0].range[0] points to the value start (the '{' in a flow map),
      // NOT the '-' dash. Scan back to the start of the line to find '-'.
      const firstItemStart = deckPoiSeq.items[0].range[0] as number;
      const lineStart = yamlText.lastIndexOf('\n', firstItemStart - 1) + 1;
      const linePrefix = yamlText.slice(lineStart, firstItemStart);
      const dashRelIdx = linePrefix.indexOf('-');
      const dashColOneBased = dashRelIdx >= 0 ? dashRelIdx + 1 : lineCounter.linePos(firstItemStart).col;
      const indent = ' '.repeat(dashColOneBased - 1);

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
    } else if (deckPoiPair?.key?.range) {
      // poi-empty branch: poi: key exists but value is null (last item was deleted
      // but the key wasn't cleaned up). Insert the new item right after the poi: line.
      const poiKeyStart = deckPoiPair.key.range[0] as number;
      const keyCol = lineCounter.linePos(poiKeyStart).col; // 1-based col of 'p'
      const itemIndent = ' '.repeat(keyCol - 1 + 2); // 2 more than key indent

      // Find the \n that ends the `poi:` line and insert after it (at the \n position
      // so the new item appears on the next line, before any sibling key).
      const lfIdx = yamlText.indexOf('\n', poiKeyStart);
      const insertPos = lfIdx >= 0
        ? lineCounter.linePos(lfIdx)
        : lineCounter.linePos(Math.max(0, yamlText.length - 1));

      return {
        startLine: insertPos.line,
        startCol: insertPos.col,
        endLine: insertPos.line,
        endCol: insertPos.col,
        text: '\n' + itemIndent + poiItem,
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

// ============================================================
// buildPoiRoomMoveEdit
// ============================================================

/** Ray-casting point-in-polygon test for 2-D grid coordinates. */
function _pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Find the first plain-JS room whose polygon contains (x, y). */
function _findRoomForPoint(rooms: any[], x: number, y: number): any | null {
  for (const room of rooms) {
    if (Array.isArray(room.polygon) && _pointInPolygon(x, y, room.polygon)) return room;
  }
  return null;
}

interface PoiOwner {
  sourceRoomId: string | null;
  poiItemNode: any;
}

function _findPoiOwner(deckNode: any, poiId: string): PoiOwner | null {
  const roomsSeq = deckNode.get?.('rooms', true) as any;
  if (roomsSeq && Array.isArray(roomsSeq.items)) {
    for (const roomNode of roomsSeq.items) {
      const roomId = roomNode?.get?.('id') as string;
      const roomPoiSeq = roomNode?.get?.('poi', true) as any;
      if (roomPoiSeq && Array.isArray(roomPoiSeq.items)) {
        for (const poiItemNode of roomPoiSeq.items) {
          if (poiItemNode?.get?.('id') === poiId) return { sourceRoomId: roomId, poiItemNode };
        }
      }
    }
  }
  const deckPoiSeq = deckNode.get?.('poi', true) as any;
  if (deckPoiSeq && Array.isArray(deckPoiSeq.items)) {
    for (const poiItemNode of deckPoiSeq.items) {
      if (poiItemNode?.get?.('id') === poiId) return { sourceRoomId: null, poiItemNode };
    }
  }
  return null;
}

function _findPlainPoi(plainDeck: any, poiId: string): any | null {
  for (const room of plainDeck?.rooms ?? []) {
    for (const poi of room.poi ?? []) {
      if (poi?.id === poiId) return poi;
    }
  }
  for (const poi of plainDeck?.poi ?? []) {
    if (poi?.id === poiId) return poi;
  }
  return null;
}

function _findRoomNodeById(deckNode: any, roomId: string): any | null {
  const roomsSeq = deckNode.get?.('rooms', true) as any;
  if (!roomsSeq || !Array.isArray(roomsSeq.items)) return null;
  for (const roomNode of roomsSeq.items) {
    if (roomNode?.get?.('id') === roomId) return roomNode;
  }
  return null;
}

/**
 * Delete a single-line POI sequence item (`    - {id: ...}\n`).
 * Replaces (startLine, 1) → (startLine+1, 1) with '' to remove the full line.
 */
function _buildDeletePoiLineEdit(lineCounter: LineCounter, poiItemNode: any): TextEdit {
  const startLine = lineCounter.linePos(poiItemNode.range[0]).line;
  return { startLine, startCol: 1, endLine: startLine + 1, endCol: 1, text: '' };
}

/**
 * Build a TextEdit inserting a POI entry into a room's poi list.
 * Mirrors buildAddPoiEdit but targets a specific room node.
 */
function _buildAddPoiToRoomNodeEdit(
  yamlText: string,
  lineCounter: LineCounter,
  roomNode: any,
  poiData: { id: string; type?: string; icon?: string; name?: string; label?: string },
  newX: number,
  newY: number,
): TextEdit | null {
  const icon  = poiData.icon  ?? '';
  const type  = poiData.type  ?? 'item';
  const label = poiData.label ?? poiData.name ?? '';
  let poiItem = `- {id: ${poiData.id}, icon: ${icon}`;
  if (label) poiItem += `, label: "${label}"`;
  poiItem += `, type: ${type}, position: {x: ${newX}, y: ${newY}}}`;

  const roomPoiSeq = roomNode.get?.('poi', true) as any;

  if (roomPoiSeq && Array.isArray(roomPoiSeq.items) && roomPoiSeq.items.length > 0) {
    // poi-exists: append after last item
    const lastItem    = roomPoiSeq.items[roomPoiSeq.items.length - 1];
    const [, lastEnd] = lastItem.range as [number, number, number];
    // firstItemCol is 1-based column of `{`; subtract 3 to get 0-based column of `-`
    const firstItemCol = lineCounter.linePos(roomPoiSeq.items[0].range[0]).col;
    const indent = ' '.repeat(Math.max(0, firstItemCol - 3));
    const charAtEnd  = yamlText[lastEnd - 1];
    const insertByte = charAtEnd === '\n' ? lastEnd - 1 : lastEnd;
    const pos = lineCounter.linePos(insertByte);
    return { startLine: pos.line, startCol: pos.col, endLine: pos.line, endCol: pos.col, text: '\n' + indent + poiItem };
  }

  // poi-absent: insert new `poi:\n- item` after the room's last key
  if (!Array.isArray(roomNode.items) || roomNode.items.length === 0) return null;
  const lastPair = roomNode.items[roomNode.items.length - 1];
  if (!lastPair?.value?.range) return null;
  const [, lastValEnd] = lastPair.value.range as [number, number, number];

  const idPair = roomNode.items.find((p: any) => p?.key?.value === 'id');
  const roomKeyCol = idPair?.key?.range ? lineCounter.linePos(idPair.key.range[0]).col : 5;
  const keyIndent  = ' '.repeat(roomKeyCol - 1);

  const charBefore = yamlText[lastValEnd - 1];
  const insertByte = charBefore === '\n' ? lastValEnd - 1 : lastValEnd;
  const pos = lineCounter.linePos(Math.max(0, insertByte));
  return {
    startLine: pos.line, startCol: pos.col,
    endLine:   pos.line, endCol:   pos.col,
    text: '\n' + keyIndent + 'poi:\n' + keyIndent + poiItem,
  };
}

/**
 * Build TextEdits that move a POI to a new position, re-parenting its YAML entry
 * to the containing room when the drop lands in a different room.
 *
 * - Same room or no containing room: single position-only edit.
 * - Different room: [deleteFromOldRoom, addToNewRoom] — pass both to
 *   editor.executeEdits() so Monaco applies them atomically (bottom-to-top order).
 *
 * Returns [] on parse error or when the POI has no indexable id.
 */
export function buildPoiRoomMoveEdit(
  yamlText: string,
  deckId: string,
  poiId: string,
  newX: number,
  newY: number,
): TextEdit[] {
  try {
    const lineCounter = new LineCounter();
    const doc = parseDocument(yamlText, { lineCounter, keepSourceTokens: true });
    if (doc.errors.length > 0) return [];

    const plainDeck = (parseYaml(yamlText) as any)?.decks?.find((d: any) => d?.id === deckId);
    if (!plainDeck) return [];

    const decksSeq = doc.get('decks', true) as any;
    const deckNode = _findDeckNode(decksSeq, deckId);
    if (!deckNode) return [];

    const targetRoom = _findRoomForPoint(plainDeck.rooms ?? [], newX, newY);
    const poiOwner   = _findPoiOwner(deckNode, poiId);
    const posEdit    = buildPositionEdit(yamlText, deckId, poiId, newX, newY);

    // Same room, no target room, or POI not found by id — position-only edit
    if (!targetRoom || !poiOwner || poiOwner.sourceRoomId === targetRoom.id) {
      return posEdit ? [posEdit] : [];
    }

    // Cross-room move
    const existingData = _findPlainPoi(plainDeck, poiId);
    if (!existingData) return posEdit ? [posEdit] : [];

    const targetRoomNode = _findRoomNodeById(deckNode, targetRoom.id);
    if (!targetRoomNode) return posEdit ? [posEdit] : [];

    const deleteEdit = _buildDeletePoiLineEdit(lineCounter, poiOwner.poiItemNode);
    const addEdit    = _buildAddPoiToRoomNodeEdit(yamlText, lineCounter, targetRoomNode, existingData, newX, newY);
    if (!addEdit) return posEdit ? [posEdit] : [];

    return [deleteEdit, addEdit];
  } catch {
    return [];
  }
}
