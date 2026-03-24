export type SystemStatus = 'ONLINE' | 'STRESSED' | 'DAMAGED' | 'CRITICAL' | 'OFFLINE';

export interface SystemData {
  status: SystemStatus;
  condition: number;
  info?: string;
}

export interface ShipStatusData {
  ship: {
    name: string;
    class: string;
    crew_count: number;
    crew_capacity: number;
    hull: { current: number; max: number; info?: string };
    armor: { current: number; max: number; info?: string };
    systems: {
      life_support: SystemData;
      engines: SystemData;
      weapons: SystemData;
      comms: SystemData;
    };
  };
}
