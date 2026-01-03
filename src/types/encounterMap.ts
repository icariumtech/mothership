/**
 * Encounter Map Data Types
 * Matches the YAML schema for encounter_map.yaml
 */

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
}

// Room visibility state (GM-controlled)
export interface RoomVisibilityState {
  [roomId: string]: boolean;
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
