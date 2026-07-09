/**
 * Zustand Store for R3F Scene State
 *
 * Single source of truth for all 3D scene state, replacing React useState
 * in SharedConsole. Scene components read/write directly to this store.
 */

import { create } from 'zustand';
import type { StarMapData } from '../types/starMap';
import type { SystemMapData, BodyData } from '../types/systemMap';
import type { OrbitMapData, MoonData, StationData, SurfaceMarkerData } from '../types/orbitMap';

// View modes for the map display
export type MapViewMode = 'galaxy' | 'system' | 'orbit';

// Per-layer transition state for coordinated fade animations. Each of the
// three map layers (galaxy/system/orbit) tracks its own state independently
// since e.g. a galaxy->system dive has galaxy 'transitioning-out' while
// system is simultaneously 'transitioning-in' for the duration of the fade.
export type TransitionState = 'idle' | 'transitioning-out' | 'transitioning-in';

// Selected orbit element with type discrimination
export interface SelectedOrbitElement {
  type: 'moon' | 'station' | 'surface' | null;
  name: string | null;
  data: MoonData | StationData | SurfaceMarkerData | null;
}

// Camera state for 3D scenes
export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

// Animation state flags
export interface AnimationState {
  orbitalMotion: boolean;  // Planets/moons orbit animation
  autoRotate: boolean;     // Camera auto-rotation when idle (transient — flipped by drags, zooms, selections; auto-resumed after idle delay)
  userPaused: boolean;     // Explicit pause via the play/pause overlay; only the button writes this. Always wins over autoRotate.
  paused: boolean;         // All animations paused
}

// Typewriter effect state for InfoPanel
export interface TypewriterState {
  active: boolean;
  text: string;
  progress: number;  // 0-1
}

/**
 * Complete scene state interface
 */
export interface SceneState {
  // View state
  mapViewMode: MapViewMode;
  // Per-layer transition state — see TransitionState doc comment above.
  galaxyTransition: TransitionState;
  systemTransition: TransitionState;
  orbitTransition: TransitionState;

  // API data (fetched from backend)
  starMapData: StarMapData | null;
  systemMapData: SystemMapData | null;
  orbitMapData: OrbitMapData | null;

  // Current location slugs
  currentSystemSlug: string | null;
  currentBodySlug: string | null;

  // Selection state
  selectedSystem: string | null;  // System name (for galaxy view)
  selectedPlanet: BodyData | null;  // Planet data (for system view)
  selectedOrbitElement: SelectedOrbitElement;  // Moon/station/surface (for orbit view)

  // Camera state (synced with R3F camera)
  camera: CameraState;

  // Animation state
  animations: AnimationState;

  // Typewriter state (for InfoPanel coordination)
  typewriter: TypewriterState;

  // Last user interaction timestamp (for auto-rotate resume)
  lastInteractionTime: number | null;
}

/**
 * Actions interface for state mutations
 */
export interface SceneActions {
  // View transitions
  setMapViewMode: (mode: MapViewMode) => void;
  setGalaxyTransition: (state: TransitionState) => void;
  setSystemTransition: (state: TransitionState) => void;
  setOrbitTransition: (state: TransitionState) => void;

  // API data setters
  setStarMapData: (data: StarMapData | null) => void;
  setSystemMapData: (data: SystemMapData | null) => void;
  setOrbitMapData: (data: OrbitMapData | null) => void;

  // Location setters
  setCurrentSystemSlug: (slug: string | null) => void;
  setCurrentBodySlug: (slug: string | null) => void;

  // Selection actions
  selectSystem: (systemName: string | null) => void;
  selectPlanet: (planetData: BodyData | null) => void;
  selectOrbitElement: (
    type: 'moon' | 'station' | 'surface' | null,
    data: MoonData | StationData | SurfaceMarkerData | null
  ) => void;
  clearAllSelections: () => void;

  // Camera actions
  updateCamera: (position: [number, number, number], target: [number, number, number]) => void;
  setCameraFov: (fov: number) => void;

  // Animation actions
  setOrbitalMotion: (enabled: boolean) => void;
  setAutoRotate: (enabled: boolean) => void;
  setUserPaused: (paused: boolean) => void;
  setPaused: (paused: boolean) => void;
  recordInteraction: () => void;

  // Typewriter actions
  startTypewriter: (text: string) => void;
  updateTypewriter: (progress: number) => void;
  completeTypewriter: () => void;

  // Reset
  reset: () => void;
}

/**
 * Initial state values
 */
const initialState: SceneState = {
  mapViewMode: 'galaxy',
  galaxyTransition: 'idle',
  systemTransition: 'idle',
  orbitTransition: 'idle',

  starMapData: null,
  systemMapData: null,
  orbitMapData: null,

  currentSystemSlug: null,
  currentBodySlug: null,

  selectedSystem: null,
  selectedPlanet: null,
  selectedOrbitElement: {
    type: null,
    name: null,
    data: null,
  },

  camera: {
    position: [0, 0, 100],
    target: [0, 0, 0],
    fov: 60,
  },

  animations: {
    orbitalMotion: true,
    autoRotate: true,
    userPaused: false,
    paused: false,
  },

  typewriter: {
    active: false,
    text: '',
    progress: 0,
  },

  lastInteractionTime: null,
};

/**
 * Create the Zustand store
 */
export const useSceneStore = create<SceneState & SceneActions>()((set, get) => ({
  ...initialState,

  // View transitions
  setMapViewMode: (mode) => set({ mapViewMode: mode }),
  setGalaxyTransition: (state) => set({ galaxyTransition: state }),
  setSystemTransition: (state) => set({ systemTransition: state }),
  setOrbitTransition: (state) => set({ orbitTransition: state }),

  // API data setters
  setStarMapData: (data) => set({ starMapData: data }),
  setSystemMapData: (data) => set({ systemMapData: data }),
  setOrbitMapData: (data) => set({ orbitMapData: data }),

  // Location setters
  setCurrentSystemSlug: (slug) => set({ currentSystemSlug: slug }),
  setCurrentBodySlug: (slug) => set({ currentBodySlug: slug }),

  // Selection actions
  selectSystem: (systemName) => {
    const current = get().selectedSystem;
    // Toggle selection if clicking the same system
    set({ selectedSystem: current === systemName ? null : systemName });
  },

  selectPlanet: (planetData) => set({ selectedPlanet: planetData }),

  selectOrbitElement: (type, data) => set({
    selectedOrbitElement: {
      type,
      name: data?.name ?? null,
      data,
    },
  }),

  clearAllSelections: () => set({
    selectedSystem: null,
    selectedPlanet: null,
    selectedOrbitElement: { type: null, name: null, data: null },
  }),

  // Camera actions
  updateCamera: (position, target) => set((state) => ({
    camera: { ...state.camera, position, target },
  })),

  setCameraFov: (fov) => set((state) => ({
    camera: { ...state.camera, fov },
  })),

  // Animation actions
  setOrbitalMotion: (enabled) => set((state) => ({
    animations: { ...state.animations, orbitalMotion: enabled },
  })),

  setAutoRotate: (enabled) => set((state) => ({
    animations: { ...state.animations, autoRotate: enabled },
  })),

  setUserPaused: (paused) => set((state) => ({
    animations: { ...state.animations, userPaused: paused },
  })),

  setPaused: (paused) => set((state) => ({
    animations: { ...state.animations, paused },
  })),

  recordInteraction: () => set({ lastInteractionTime: Date.now() }),

  // Typewriter actions
  startTypewriter: (text) => set({
    typewriter: { active: true, text, progress: 0 },
  }),

  updateTypewriter: (progress) => set((state) => ({
    typewriter: { ...state.typewriter, progress },
  })),

  completeTypewriter: () => set((state) => ({
    typewriter: { ...state.typewriter, active: false, progress: 1 },
  })),

  // Reset to initial state
  reset: () => set(initialState),
}));

/**
 * Selector hooks for optimized subscriptions
 * Use these instead of subscribing to the entire store
 */

// View state selectors
export const useMapViewMode = () => useSceneStore((state) => state.mapViewMode);
export const useGalaxyTransition = () => useSceneStore((state) => state.galaxyTransition);
export const useSystemTransition = () => useSceneStore((state) => state.systemTransition);
export const useOrbitTransition = () => useSceneStore((state) => state.orbitTransition);

// API data selectors
export const useStarMapData = () => useSceneStore((state) => state.starMapData);
export const useSystemMapData = () => useSceneStore((state) => state.systemMapData);
export const useOrbitMapData = () => useSceneStore((state) => state.orbitMapData);

// Location selectors
export const useCurrentSystemSlug = () => useSceneStore((state) => state.currentSystemSlug);
export const useCurrentBodySlug = () => useSceneStore((state) => state.currentBodySlug);

// Selection selectors
export const useSelectedSystem = () => useSceneStore((state) => state.selectedSystem);
export const useSelectedPlanet = () => useSceneStore((state) => state.selectedPlanet);
export const useSelectedOrbitElement = () => useSceneStore((state) => state.selectedOrbitElement);

// Camera selector
export const useCameraState = () => useSceneStore((state) => state.camera);

// Animation selectors
export const useAnimationState = () => useSceneStore((state) => state.animations);
export const useIsPaused = () => useSceneStore((state) => state.animations.paused);

// Typewriter selector
export const useTypewriterState = () => useSceneStore((state) => state.typewriter);
