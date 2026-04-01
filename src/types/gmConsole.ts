import { RoomVisibilityState, DoorStatusState, TokenState } from './encounterMap';

export interface Terminal {
  slug: string;
  name: string;
  owner?: string;
  description?: string;
}

export interface Location {
  slug: string;
  name: string;
  type: string;  // system, planet, station, deck, room, etc.
  status?: string;
  description?: string;
  children: Location[];
  terminals: Terminal[];
  has_map?: boolean;
}

export interface ShipDeckData {
  is_multi_deck: boolean;
  manifest: {
    name: string;
    facility_type: string;
    total_decks: number;
    decks: Array<{ id: string; name: string; file: string; level: number; default?: boolean }>;
  };
  current_deck: {
    deck_id: string;
    name: string;
    unit_size: number;
    rooms: Array<{
      id: string;
      name: string;
      polygon?: number[][];
      rects?: Array<{ x: number; y: number; w: number; h: number; chamfer?: number }>;
      doors?: Array<{ x?: number; y?: number; angle?: number; wall?: string; position?: number; type?: string; status?: string }>;
    }>;
  } | null;
  current_deck_id: string;
  slug: string;
}

export interface NpcPortraitData {
  id: string;
  name: string;
  portrait: string;  // URL path like "/data/campaign/NPCs/images/lucia_vance.png" or ""
}

export interface ActiveView {
  location_slug: string;
  view_type: string;
  view_slug: string;
  bridge_tab?: string;
  bridge_map_mode?: 'galaxy' | 'system' | 'orbit';
  bridge_label?: string;
  overlay_location_slug: string;
  overlay_terminal_slug: string;
  overlay_doc_slug: string;
  janus_mode: 'DISPLAY' | 'QUERY';
  janus_dialog_open: boolean;
  janus_active_channel?: string;
  // Location info (when in ENCOUNTER view)
  location_type?: string;
  location_name?: string;
  // Encounter map fields
  encounter_level: number;
  encounter_deck_id: string;
  encounter_room_visibility: RoomVisibilityState;
  encounter_door_status: DoorStatusState;
  encounter_tokens: TokenState;
  encounter_active_portraits: string[];          // ordered list of NPC IDs
  encounter_npc_data: { [id: string]: NpcPortraitData };  // NPC lookup map
  // Ship deck map data (populated when view_type == 'BRIDGE')
  ship_deck_data?: ShipDeckData;
  ship_deck_total_decks?: number;
  updated_at: string;
}

export interface BroadcastMessage {
  sender: string;
  content: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}
