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

export interface ActiveView {
  location_slug: string;
  view_type: string;
  view_slug: string;
  overlay_location_slug: string;
  overlay_terminal_slug: string;
  charon_mode: 'DISPLAY' | 'QUERY';
  charon_dialog_open: boolean;
  charon_active_channel?: string;
  // Location info (when in ENCOUNTER view)
  location_type?: string;
  location_name?: string;
  // Encounter map fields
  encounter_level: number;
  encounter_deck_id: string;
  encounter_room_visibility: RoomVisibilityState;
  encounter_door_status: DoorStatusState;
  encounter_tokens: TokenState;
  updated_at: string;
}

export interface BroadcastMessage {
  sender: string;
  content: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}
