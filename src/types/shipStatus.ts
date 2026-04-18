export type SystemStatus = 'ONLINE' | 'STRESSED' | 'DAMAGED' | 'CRITICAL' | 'OFFLINE';

export interface FaultIndicator {
  label: string;
  active: boolean;
}

export interface SystemData {
  status: SystemStatus;
  condition: number;
  warnings?: string[];
  display_name?: string;
  icon?: string;
  power?: { allocated: number; max: number };
  subsystems?: string[];
  power_capacity?: number;
  faults?: FaultIndicator[];
}

export interface ResourceData {
  current: number;
  max: number;
  display_name: string;
  info?: string;
}

export interface CargoData {
  items: string[];
}

export interface ShipStatusData {
  class: string;
  name: string;
  slug?: string;
  location_slug?: string;
  crew_capacity: number;
  crew_count: number;
  stats?: { thrusters?: number; battle?: number; systems?: number };
  systems: Record<string, SystemData>;
  resources: Record<string, ResourceData>;
  cargo?: CargoData;
}
