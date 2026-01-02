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

// Complete encounter map data structure
export interface EncounterMapData {
  name: string;
  location_name?: string;
  description?: string;
  grid: GridConfig;
  rooms: RoomData[];
  corridors?: CorridorData[];
  doors?: DoorData[];
  connections?: ConnectionData[];  // Node-graph style room connections
  terminals?: TerminalData[];
  poi?: PoiData[];
  metadata?: MapMetadata;
  // Legacy support
  image_path?: string;
  slug?: string;
}

// Type guard to check if map data is an encounter map (has rooms)
export function isEncounterMap(mapData: any): mapData is EncounterMapData {
  return mapData && Array.isArray(mapData.rooms) && mapData.grid;
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
