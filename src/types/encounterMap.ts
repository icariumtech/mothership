/**
 * Encounter Map Data Types
 * Matches the YAML schema for encounter_map.yaml
 */

// Token types for encounter map tokens
export type TokenType = 'player' | 'npc' | 'creature' | 'object';
export type TokenStatus = 'wounded' | 'dead' | 'panicked' | 'stunned' | 'hidden';

export interface TokenData {
  type: TokenType;
  x: number;
  y: number;
  name: string;
  status: TokenStatus[];
  image_url: string;
  room_id: string;
}

export interface TokenState {
  [tokenId: string]: TokenData;
}

// Token image available for selection in GM gallery
export interface TokenImage {
  id: string;
  name: string;
  type: TokenType;
  url: string;
  source: 'crew' | 'npc' | 'images';
}

// Grid configuration
export interface GridConfig {
  width: number;
  height: number;
  unit_size?: number;
  show_grid?: boolean;
}

// Room status types
export type RoomStatus = 'OPERATIONAL' | 'WARNING' | 'HAZARD' | 'OFFLINE';

// Room definition
export interface RoomData {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  description?: string;
  status?: RoomStatus;
}

// Corridor definition
export interface CorridorData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Door/Connection types and status
export type DoorType = 'standard' | 'airlock' | 'blast_door' | 'emergency' | 'open';
export type DoorStatus = 'OPEN' | 'CLOSED' | 'LOCKED' | 'SEALED' | 'DAMAGED';

export interface DoorPosition {
  x: number;
  y: number;
  orientation: 'vertical' | 'horizontal';
}

export interface DoorData {
  id: string;
  type: DoorType;
  room_a: string;
  room_b: string | null;
  position?: DoorPosition;
  status?: DoorStatus;
}

// Connection between rooms (node-graph style)
export interface ConnectionData {
  id: string;
  from: string;
  to: string;
  door_type?: DoorType;
  door_status?: DoorStatus;
}

// Terminal definition
export interface TerminalPosition {
  x: number;
  y: number;
}

export interface TerminalData {
  id: string;
  room: string;
  position: TerminalPosition;
  terminal_slug: string;
  name: string;
}

// Point of Interest types
export type PoiType = 'objective' | 'item' | 'hazard' | 'npc' | 'player';

export interface PoiPosition {
  x: number;
  y: number;
}

export interface PoiData {
  id: string;
  type: PoiType;
  room: string;
  position: PoiPosition;
  name: string;
  icon: string;
  status?: string;
  description?: string;
}

// Map metadata
export interface MapMetadata {
  author?: string;
  created?: string;
  version?: number;
  tags?: string[];
}

// Inter-deck connection (ladder, lift, etc.)
export interface InterDeckConnection {
  id: string;
  from_room: string;
  to_deck: string;
  to_room: string;
  type: 'ladder' | 'lift' | 'hatch' | 'stairs';
  status?: 'OPEN' | 'CLOSED' | 'LOCKED' | 'DAMAGED';
}

// Deck info for manifest
export interface DeckInfo {
  id: string;
  name: string;
  file: string;
  level: number;
  default?: boolean;
  description?: string;
}

// Multi-deck manifest
export interface EncounterManifest {
  name: string;
  facility_type?: string;
  total_decks: number;
  decks: DeckInfo[];
  hull?: HullDef;  // optional ship hull polygon — same outline shown on every deck
}

// Room visibility state (GM-controlled)
export interface RoomVisibilityState {
  [roomId: string]: boolean;
}

// Door status state (GM-controlled runtime overrides)
export interface DoorStatusState {
  [connectionId: string]: DoorStatus;
}

// Complete encounter map data structure
export interface EncounterMapData {
  name: string;
  location_name?: string;
  description?: string;
  deck_id?: string;  // Deck identifier for multi-deck maps
  grid: GridConfig;
  rooms: RoomData[];
  corridors?: CorridorData[];
  doors?: DoorData[];
  connections?: ConnectionData[];  // Node-graph style room connections
  inter_deck_connections?: InterDeckConnection[];  // Connections to other decks
  terminals?: TerminalData[];
  poi?: PoiData[];
  metadata?: MapMetadata;
  // Legacy support
  image_path?: string;
  slug?: string;
}

// Multi-deck map data (returned by API when manifest exists)
export interface MultiDeckMapData {
  is_multi_deck: true;
  manifest: EncounterManifest;
  current_deck: EncounterMapData;
  current_deck_id: string;
  room_visibility?: RoomVisibilityState;
}

// Single-deck map data (legacy format or single deck)
export interface SingleDeckMapData extends EncounterMapData {
  is_multi_deck?: false;
  room_visibility?: RoomVisibilityState;
}

// Union type for map data from API
export type MapDataResponse = MultiDeckMapData | SingleDeckMapData;

// Type guard to check if map data is an encounter map (has rooms)
export function isEncounterMap(mapData: any): mapData is EncounterMapData {
  return mapData && Array.isArray(mapData.rooms) && mapData.grid;
}

// Type guard to check if map data is multi-deck
export function isMultiDeckMap(mapData: any): mapData is MultiDeckMapData {
  return mapData && mapData.is_multi_deck === true && mapData.manifest;
}

// Tooltip content for hover display
export interface TooltipContent {
  title: string;
  description?: string;
  status?: string;
  type?: string;
}

// Tooltip state
export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: TooltipContent;
}

// ============================================================
// Grid-based encounter map types (Phase 7)
// ============================================================

/** A single axis-aligned rectangle in grid cell units */
export interface GridRect {
  x: number;  // grid cell X (left edge, 0-based)
  y: number;  // grid cell Y (top edge, 0-based)
  w: number;  // width in cells
  h: number;  // height in cells
  chamfer?: number;  // diagonal corner cut in grid-cell units (0 = square corners, 1 = 1-cell cut)
}

/** Cardinal wall sides for door attachment (legacy — retained for any
 *  remaining authored references; canonical doors use grid-space (x, y, angle)). */
export type WallSide = 'north' | 'south' | 'east' | 'west';

/** A room composed of one or more grid rectangles, a circle, or a freeform polygon.
 *  Doors are NOT nested under the room — they live at the map root as a
 *  top-level `doors:` array of `AuthoredDoor` (see GridEncounterMapData). */
export interface GridRoom {
  id: string;
  name: string;         // empty string = corridor/hallway (no label rendered)
  rects: GridRect[];    // list of axis-aligned rectangles (may be empty for circle/polygon rooms)
  circle?: { cx: number; cy: number; r: number };  // circular room (grid coords)
  polygon?: [number, number][];                      // freeform polygon vertices (grid coords)
  holes?: [number, number][][];                      // polygons punched out of the room floor
  description?: string;
  type?: string;        // optional tag: corridor | bridge | cargo | medical | etc.
  label_offset?: [number, number];  // [dx, dy] in grid-cell units — nudges label from computed center
}

/** Ship hull outline — optional outer frame polygon for the deck */
export interface HullDef {
  polygon: [number, number][];  // vertices in grid cell coords
}

/** Complete grid-based encounter map (new format) */
export interface GridEncounterMapData {
  name: string;
  deck_id?: string;
  location_name?: string;
  description?: string;
  unit_size?: number;   // pixels per cell — default 40 if omitted
  rotation?: number;    // fixed display rotation in degrees (0, 90, 180, 270)
  hull?: HullDef;       // optional ship/structure outer frame polygon
  rooms: GridRoom[];
  /**
   * Top-level canonical doors (Phase 21 schema). YAML carries the authored
   * AuthoredDoor shapes (B-rel or B-pos); the frontend's `doorNormalizer`
   * validates each entry into a canonical `Door`. Plan 21-04 made this the
   * single source of truth — doors are no longer nested under GridRoom.
   */
  doors?: AuthoredDoor[];
  terminals?: TerminalData[];
  poi?: PoiData[];
  metadata?: MapMetadata;
}

/**
 * Type guard: identifies grid-based maps by presence of rects/circle/polygon on first room.
 * Used by EncounterMapDisplay to route to the new renderer.
 */
export function isGridEncounterMap(mapData: unknown): mapData is GridEncounterMapData {
  if (!mapData || typeof mapData !== 'object') return false;
  const m = mapData as Record<string, unknown>;
  if (!Array.isArray(m.rooms) || m.rooms.length === 0) return false;
  const firstRoom = m.rooms[0] as Record<string, unknown>;
  return (
    Array.isArray(firstRoom.rects) ||
    (typeof firstRoom.circle === 'object' && firstRoom.circle !== null) ||
    Array.isArray(firstRoom.polygon)
  );
}

// ============================================================
// Phase 21: canonical Door model (top-level)
// ------------------------------------------------------------
// Maps carry a top-level `doors: AuthoredDoor[]` array. The frontend's
// `doorNormalizer` validates each authored entry (B-rel or B-pos) into
// the canonical `Door` shape used by the renderer. Doors are NOT nested
// under rooms — the legacy `GridRoom.doors[]` and `DoorDef` were removed
// in plan 21-04 once all maps had migrated to the top-level schema.
// ============================================================

/**
 * Canonical Door — top-level, used by roomGeometry, mapView, renderer.
 *
 * Invariant (enforced at normalize time): `(x, y)` lies on the shared
 * edge of `(roomA, roomB)` within a small epsilon. When `roomB` is
 * `null` the door connects `roomA` to the exterior (e.g. an airlock
 * onto space) and `(x, y)` lies on `roomA`'s exterior boundary.
 */
export interface Door {
  /** Stable identifier — explicit from authored YAML, or derived as
   *  `${roomA}__${roomB|exterior}__${index}` by the normalizer. */
  id: string;
  /** Door center, grid coordinates. */
  x: number;
  y: number;
  /** Door slot orientation in degrees. Any value, supporting diagonal
   *  doors. Convention: 0 = horizontal slot (N/S wall), 90 = vertical
   *  slot (E/W wall). The normalizer derives this from edge geometry
   *  for B-rel inputs and preserves authored values for B-pos inputs. */
  angle: number;
  /** Door width in grid cells. Default 1. Fractional values allowed. */
  width: number;
  /** First (always-present) endpoint room id. */
  roomA: string;
  /** Second endpoint room id, or `null` for exterior doors. */
  roomB: string | null;
  type: DoorType;
  status: DoorStatus;
}

/**
 * Authored relational door — primary YAML form.
 *
 * Humans, AI, and tools like `svg_to_map.py` write this shape. It is a
 * *relational* statement of intent: the door sits on the shared edge of
 * `rooms`, `along` fraction of the way along that edge. Easy for humans
 * to write, easy for LLMs to generate, robust to small geometric edits.
 *
 * Single-element `rooms` list = exterior door (e.g. `[bridge]`).
 */
export interface AuthoredDoorRel {
  id?: string;
  /** Endpoint room ids. `[a, b]` = interior door, `[a]` = exterior door. */
  rooms: [string, string] | [string];
  /** Fraction along the shared edge, 0..1. Door center sits here. */
  along: number;
  /** Door width in grid cells. Default 1. */
  width?: number;
  type: DoorType;
  status: DoorStatus;
}

/**
 * Authored position-override door — escape hatch for fine control.
 *
 * Used when `(x, y, angle)` are known explicitly (e.g. from
 * `svg_to_map.py --detect-doors`, or for unusual door geometry the
 * relational form can't express cleanly). The normalizer still
 * validates that `(x, y)` lies on a shared edge of `rooms`.
 */
export interface AuthoredDoorPos {
  id?: string;
  rooms: [string, string] | [string];
  position: { x: number; y: number; angle: number };
  width?: number;
  type: DoorType;
  status: DoorStatus;
}

/** Tagged union of authored YAML door shapes. */
export type AuthoredDoor = AuthoredDoorRel | AuthoredDoorPos;

/** Type guard: distinguishes B-pos (with explicit position) from B-rel. */
export function isAuthoredDoorPos(d: AuthoredDoor): d is AuthoredDoorPos {
  return 'position' in d;
}

/**
 * Error type thrown by `doorNormalizer` when authored YAML fails to
 * resolve / validate. The offending authored entry is attached so
 * callers can surface useful messages in the UI / logs.
 */
export class DoorNormalizationError extends Error {
  public readonly authored: AuthoredDoor;
  constructor(message: string, authored: AuthoredDoor) {
    super(message);
    this.name = 'DoorNormalizationError';
    this.authored = authored;
  }
}
