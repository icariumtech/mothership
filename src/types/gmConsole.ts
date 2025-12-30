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
  updated_at: string;
}

export interface BroadcastMessage {
  sender: string;
  content: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}
