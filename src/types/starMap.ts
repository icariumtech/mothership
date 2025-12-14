/**
 * Star Map Data Types
 * Matches the structure returned by /api/star-map/
 */

export interface StarSystem {
  name: string;
  position: [number, number, number];
  color: number;
  size: number;
  type: string;
  label?: boolean;
  location_slug?: string;
  info?: {
    description?: string;
    population?: string;
  };
}

export interface TravelRoute {
  from: string;
  to: string;
  from_slug?: string;
  to_slug?: string;
  color?: number;
  route_type?: string;
}

export type NebulaType = 'emission' | 'reflection' | 'planetary' | 'dark';

export interface Nebula {
  name: string;
  position: [number, number, number];
  color: number;
  size: number;
  particle_count: number;
  opacity: number;
  type: NebulaType;
}

export interface CameraConfig {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov: number;
}

export interface StarMapData {
  camera?: CameraConfig;
  systems: StarSystem[];
  routes?: TravelRoute[];
  nebulae?: Nebula[];
}

/**
 * Galaxy Scene Event Callbacks
 */
export interface GalaxySceneCallbacks {
  onSystemClick?: (systemName: string) => void;
  onSystemHover?: (systemName: string | null) => void;
}

/**
 * Galaxy Scene State (for external access)
 */
export interface GalaxySceneState {
  starPositions: Map<string, { x: number; y: number; z: number }>;
  autoRotate: boolean;
  animating: boolean;
}
