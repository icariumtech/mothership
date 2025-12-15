/**
 * System Map Data Types
 * Matches the structure returned by /api/system-map/{system_slug}/
 */

export interface StarData {
  name: string;
  type: string;
  color?: number;
  size?: number;
  corona_intensity?: number;
  light_color?: number;
}

export interface BodyData {
  name: string;
  type?: string;
  orbital_radius: number;
  orbital_period?: number;
  orbital_angle?: number;
  inclination?: number;
  size?: number;
  color?: number;
  clickable?: boolean;
  location_slug?: string;
  has_orbit_map?: boolean;
  surface_facility_count?: number;
  orbital_station_count?: number;
  tidally_locked?: boolean;
  info?: {
    description?: string;
    population?: string;
    habitability?: string;
    industry?: string;
  };
}

export interface OrbitSettings {
  show?: boolean;
  color?: number;
  opacity?: number;
}

export interface CameraConfig {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov?: number;
}

export interface SystemMapData {
  star: StarData;
  bodies?: BodyData[];
  orbits?: OrbitSettings;
  camera?: CameraConfig;
  system_slug?: string;
}

/**
 * Internal planet data for animation
 * Note: mesh is typed as any since THREE types are internal to SystemScene
 */
export interface PlanetRenderData {
  mesh: any; // THREE.Sprite
  orbitalRadius: number;
  orbitalPeriod: number;
  initialAngle: number;
  inclination: number;
  name: string;
  clickable: boolean;
  locationSlug?: string;
}

/**
 * System Scene Event Callbacks
 */
export interface SystemSceneCallbacks {
  onPlanetClick?: (planetName: string, planetData: BodyData) => void;
  onPlanetSelect?: (planetData: BodyData | null) => void;
  onBackToGalaxy?: () => void;
  onOrbitMapNavigate?: (systemSlug: string, planetSlug: string) => void;
}

/**
 * System Scene State
 */
export interface SystemSceneState {
  currentSystem: SystemMapData | null;
  currentSystemSlug: string | null;
  selectedPlanet: BodyData | null;
  isActive: boolean;
  speedMultiplier: number;
}
