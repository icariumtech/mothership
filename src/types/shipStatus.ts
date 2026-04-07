export type SystemStatus = 'ONLINE' | 'STRESSED' | 'DAMAGED' | 'CRITICAL' | 'OFFLINE';

export interface SystemData {
  status: SystemStatus;
  condition: number;
  info?: string;
}

export interface ResourceValue {
  current: number;
  max: number;
}

export interface ResourceCount {
  occupied?: number;
  available?: number;
  total: number;
}

export interface ShipResources {
  fuel: ResourceValue;
  food: ResourceValue;
  o2: ResourceValue;
  cryopods: ResourceCount;
  escape_pods: ResourceCount;
}

export interface ShipStatusData {
  location_slug?: string;
  slug?: string;
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
      reactor: SystemData;
    };
    resources: ShipResources;
  };
}
