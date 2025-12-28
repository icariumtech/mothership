/**
 * Orbit Map Data Types
 * Matches the structure returned by /api/orbit-map/{system_slug}/{body_slug}/
 */

export interface PlanetData {
  name: string;
  type?: string;
  size?: number;
  rotation_speed?: number;
  axial_tilt?: number;
  texture?: string;
  normal_map?: string;
  sun_declination?: number;
}

export interface MoonData {
  name: string;
  location_slug?: string;
  orbital_radius: number;
  orbital_period: number;
  orbital_angle?: number;
  inclination?: number;
  size?: number;
  color?: number;
  texture?: string;
  normal_map?: string;
  clickable?: boolean;
  has_facilities?: boolean;
  info?: {
    description?: string;
    population?: string;
    type?: string;
  };
}

export interface StationData {
  name: string;
  location_slug?: string;
  orbital_radius: number;
  orbital_period: number;
  orbital_angle?: number;
  inclination?: number;
  size?: number;
  icon_type?: string;
  info?: {
    description?: string;
    population?: string;
    type?: string;
    status?: string;
  };
}

export interface SurfaceMarkerData {
  name: string;
  location_slug?: string;
  latitude: number;
  longitude: number;
  marker_type?: string;
  info?: {
    description?: string;
    population?: string;
    type?: string;
    status?: string;
    traffic?: string;
  };
}

export interface OrbitMapCameraConfig {
  position: [number, number, number];
  lookAt: [number, number, number];
  fov?: number;
  zoom_limits?: [number, number];
}

export interface OrbitMapData {
  planet: PlanetData;
  moons?: MoonData[];
  orbital_stations?: StationData[];
  surface_markers?: SurfaceMarkerData[];
  camera?: OrbitMapCameraConfig;
  system_slug?: string;
  body_slug?: string;
}

/**
 * Internal moon render data for animation
 */
export interface MoonRenderData {
  mesh: any; // THREE.Mesh
  name: string;
  orbitalRadius: number;
  orbitalPeriod: number;
  initialAngle: number;
  inclination: number;
  clickable: boolean;
  data: MoonData;
}

/**
 * Internal station render data for animation
 */
export interface StationRenderData {
  mesh: any; // THREE.Sprite
  name: string;
  orbitalRadius: number;
  orbitalPeriod: number;
  initialAngle: number;
  inclination: number;
  data: StationData;
}

/**
 * Internal surface marker render data
 */
export interface SurfaceMarkerRenderData {
  mesh: any; // THREE.Sprite
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  data: SurfaceMarkerData;
}

/**
 * Central planet render data
 */
export interface PlanetRenderData {
  mesh: any; // THREE.Mesh
  rotationSpeed: number;
  latLonGrid?: any; // THREE.Mesh
  clouds?: any; // THREE.Mesh
}

/**
 * Selected element state
 */
export interface SelectedElement {
  type: 'moon' | 'station' | 'surface';
  name: string;
  mesh: any; // THREE object
}

/**
 * Orbit Scene Event Callbacks
 */
export interface OrbitSceneCallbacks {
  onElementSelect?: (elementType: string, elementData: MoonData | StationData | SurfaceMarkerData | null) => void;
  onBackToSystem?: () => void;
  onOrbitMapLoaded?: (data: OrbitMapData | null) => void;
}

/**
 * Orbit Scene State
 */
export interface OrbitSceneState {
  currentSystem: string | null;
  currentBody: string | null;
  orbitMapData: OrbitMapData | null;
  selectedElement: SelectedElement | null;
  isActive: boolean;
  animationPaused: boolean;
}
