/**
 * Re-export Zustand store hooks for R3F components
 *
 * This module provides convenient access to the scene store
 * from within the R3F component hierarchy.
 */

export {
  useSceneStore,
  // View state selectors
  useMapViewMode,
  useTransitionState,
  useTransitionProgress,
  // API data selectors
  useStarMapData,
  useSystemMapData,
  useOrbitMapData,
  // Location selectors
  useCurrentSystemSlug,
  useCurrentBodySlug,
  // Selection selectors
  useSelectedSystem,
  useSelectedPlanet,
  useSelectedOrbitElement,
  // Camera selector
  useCameraState,
  // Animation selectors
  useAnimationState,
  useIsPaused,
  // Typewriter selector
  useTypewriterState,
  // Types
  type MapViewMode,
  type TransitionState,
  type SelectedOrbitElement,
  type CameraState,
  type AnimationState,
  type TypewriterState,
  type SceneState,
  type SceneActions,
} from '@/stores/sceneStore';
