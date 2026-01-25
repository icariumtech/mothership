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

// Transition states for coordinated animations
export type TransitionState =
  | 'idle'
  | 'diving'       // Zooming into a target (galaxy->system, system->orbit)
  | 'zooming-out'  // Zooming out to parent view
  | 'fading-in'    // Fading in after view switch
  | 'fading-out';  // Fading out before view switch

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
  autoRotate: boolean;     // Camera auto-rotation when idle
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
  transitionState: TransitionState;
  transitionProgress: number;  // 0-1 for animation progress
  transitionTarget: string | null;  // Target system/planet/element being transitioned to

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
  startTransition: (target: string, transitionType: TransitionState) => void;
  completeTransition: () => void;
  setMapViewMode: (mode: MapViewMode) => void;
  updateTransitionProgress: (progress: number) => void;

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
  transitionState: 'idle',
  transitionProgress: 0,
  transitionTarget: null,

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
  startTransition: (target, transitionType) => set({
    transitionState: transitionType,
    transitionTarget: target,
    transitionProgress: 0,
  }),

  completeTransition: () => set({
    transitionState: 'idle',
    transitionTarget: null,
    transitionProgress: 1,
  }),

  setMapViewMode: (mode) => set({ mapViewMode: mode }),

  updateTransitionProgress: (progress) => set({ transitionProgress: progress }),

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
export const useTransitionState = () => useSceneStore((state) => state.transitionState);
export const useTransitionProgress = () => useSceneStore((state) => state.transitionProgress);

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
