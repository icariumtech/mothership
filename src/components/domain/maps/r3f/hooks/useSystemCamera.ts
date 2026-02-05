/**
 * useSystemCamera - Camera control and animation hook for system view
 *
 * Provides camera transitions and tracking for the system scene:
 * - Move to and track selected planets
 * - Camera offset tracking to follow orbiting planets
 */

import { useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useIsPaused } from './useSceneStore';
import { useCameraAnimation, easeInOutQuad } from './useCameraAnimation';
import type { BodyData, CameraConfig } from '@/types/systemMap';

// Camera configuration constants
const ANIMATION_DURATION = 1500; // ms
const PLANET_ZOOM_DISTANCE_RATIO = 0.3;
const MIN_PLANET_ZOOM_DISTANCE = 20;
// cos(45 deg) = sqrt(2)/2 for 45-degree camera offset angle
const CAMERA_ANGLE_45_DEG = Math.SQRT1_2; // ~0.7071

interface PlanetPositionGetter {
  (planetName: string): THREE.Vector3 | null;
}

interface UseSystemCameraOptions {
  /** Function to get current planet position by name */
  getPlanetPosition: PlanetPositionGetter;
  /** Default camera config from system data */
  defaultCamera?: CameraConfig;
}

interface UseSystemCameraReturn {
  /** Move camera to focus on a planet with animation */
  moveToPlanet: (planet: BodyData) => Promise<void>;
  /** Instantly position camera on a planet */
  positionOnPlanet: (planet: BodyData) => void;
  /** Return camera to default view */
  returnToDefault: () => Promise<void>;
  /** Update camera tracking state (call from useFrame) */
  updateTracking: () => void;
  /** Set the planet to track */
  setTrackedPlanet: (planet: BodyData | null) => void;
  /** Get current camera offset for tracking */
  getCameraOffset: () => THREE.Vector3 | null;
  /** Set camera offset (used after control interactions) */
  setCameraOffset: (offset: THREE.Vector3) => void;
  /** Get current scene opacity (0-1) for fade-in effect */
  getSceneOpacity: () => number;
  /** Set scene opacity directly (0-1) */
  setSceneOpacity: (opacity: number) => void;
}

export function useSystemCamera({
  getPlanetPosition,
  defaultCamera,
}: UseSystemCameraOptions): UseSystemCameraReturn {
  const { camera } = useThree();
  const isPaused = useIsPaused();

  // Use generic animation system
  const animation = useCameraAnimation();

  // Tracking state refs
  const trackedPlanetRef = useRef<BodyData | null>(null);
  const cameraOffsetRef = useRef<THREE.Vector3 | null>(null);
  const lastPlanetAngleRef = useRef(0);

  // Calculate camera position for viewing a planet
  const calculatePlanetViewPosition = useCallback(
    (planetPos: THREE.Vector3, orbitalRadius: number): THREE.Vector3 => {
      const zoomDistance = orbitalRadius * PLANET_ZOOM_DISTANCE_RATIO;
      const actualZoomDistance = Math.max(zoomDistance, MIN_PLANET_ZOOM_DISTANCE);

      return planetPos.clone().add(new THREE.Vector3(
        actualZoomDistance * CAMERA_ANGLE_45_DEG,
        actualZoomDistance * CAMERA_ANGLE_45_DEG,
        actualZoomDistance * CAMERA_ANGLE_45_DEG
      ));
    },
    []
  );

  // Move camera to focus on a planet
  const moveToPlanet = useCallback(
    async (planet: BodyData): Promise<void> => {
      const planetPos = getPlanetPosition(planet.name);
      if (!planetPos) return;

      // Clear tracking state
      cameraOffsetRef.current = null;
      lastPlanetAngleRef.current = 0;

      const endPosition = calculatePlanetViewPosition(planetPos, planet.orbital_radius);

      await animation.startAnimation(
        endPosition,
        planetPos,
        ANIMATION_DURATION,
        easeInOutQuad,
        {
          trackTarget: true,
          targetGetter: () => getPlanetPosition(planet.name) ?? planetPos,
        }
      );

      // Set up tracking after animation completes
      const finalPos = getPlanetPosition(planet.name);
      if (finalPos) {
        cameraOffsetRef.current = new THREE.Vector3(
          camera.position.x - finalPos.x,
          camera.position.y - finalPos.y,
          camera.position.z - finalPos.z
        );
        lastPlanetAngleRef.current = Math.atan2(finalPos.z, finalPos.x);
        trackedPlanetRef.current = planet;
      }
    },
    [getPlanetPosition, calculatePlanetViewPosition, animation, camera]
  );

  // Instantly position camera on a planet
  const positionOnPlanet = useCallback(
    (planet: BodyData): void => {
      const planetPos = getPlanetPosition(planet.name);
      if (!planetPos) return;

      const targetPosition = calculatePlanetViewPosition(planetPos, planet.orbital_radius);
      animation.positionCamera(targetPosition, planetPos);

      // Set up tracking
      cameraOffsetRef.current = new THREE.Vector3(
        camera.position.x - planetPos.x,
        camera.position.y - planetPos.y,
        camera.position.z - planetPos.z
      );
      lastPlanetAngleRef.current = Math.atan2(planetPos.z, planetPos.x);
      trackedPlanetRef.current = planet;
    },
    [getPlanetPosition, calculatePlanetViewPosition, animation, camera]
  );

  // Return camera to default view
  const returnToDefault = useCallback(
    async (): Promise<void> => {
      if (!defaultCamera) return;

      // Capture current planet position before clearing tracking
      let currentTarget: THREE.Vector3 | null = null;
      if (trackedPlanetRef.current) {
        currentTarget = getPlanetPosition(trackedPlanetRef.current.name);
      }

      // Clear tracking
      trackedPlanetRef.current = null;
      cameraOffsetRef.current = null;
      lastPlanetAngleRef.current = 0;

      const targetPos = new THREE.Vector3(...defaultCamera.position);
      const targetLookAt = new THREE.Vector3(...defaultCamera.lookAt);

      await animation.startAnimation(targetPos, targetLookAt, ANIMATION_DURATION, easeInOutQuad, {
        startTarget: currentTarget ?? undefined,
      });
    },
    [defaultCamera, getPlanetPosition, animation]
  );

  // Update camera tracking for orbiting planets
  const updateTracking = useCallback(() => {
    if (isPaused) return;
    if (!trackedPlanetRef.current || !cameraOffsetRef.current) return;
    if (animation.isAnimating()) return;

    const planetPos = getPlanetPosition(trackedPlanetRef.current.name);
    if (!planetPos) return;

    // Calculate planet's orbital angle change
    const currentPlanetAngle = Math.atan2(planetPos.z, planetPos.x);
    const angleChange = currentPlanetAngle - lastPlanetAngleRef.current;

    // Rotate camera offset with the planet
    const cos = Math.cos(angleChange);
    const sin = Math.sin(angleChange);
    const rotatedOffsetX = cameraOffsetRef.current.x * cos - cameraOffsetRef.current.z * sin;
    const rotatedOffsetZ = cameraOffsetRef.current.x * sin + cameraOffsetRef.current.z * cos;

    cameraOffsetRef.current.x = rotatedOffsetX;
    cameraOffsetRef.current.z = rotatedOffsetZ;
    lastPlanetAngleRef.current = currentPlanetAngle;

    // Apply offset
    camera.position.x = planetPos.x + rotatedOffsetX;
    camera.position.y = planetPos.y + cameraOffsetRef.current.y;
    camera.position.z = planetPos.z + rotatedOffsetZ;
    camera.lookAt(planetPos);
  }, [isPaused, getPlanetPosition, camera, animation]);

  // Set the planet to track
  const setTrackedPlanet = useCallback((planet: BodyData | null): void => {
    trackedPlanetRef.current = planet;
    if (!planet) {
      cameraOffsetRef.current = null;
      lastPlanetAngleRef.current = 0;
    }
  }, []);

  // Get current camera offset
  const getCameraOffset = useCallback((): THREE.Vector3 | null => {
    return cameraOffsetRef.current?.clone() ?? null;
  }, []);

  // Set camera offset (used after control interactions)
  const setCameraOffset = useCallback((offset: THREE.Vector3): void => {
    cameraOffsetRef.current = offset.clone();
    if (trackedPlanetRef.current) {
      const planetPos = getPlanetPosition(trackedPlanetRef.current.name);
      if (planetPos) {
        lastPlanetAngleRef.current = Math.atan2(planetPos.z, planetPos.x);
      }
    }
  }, [getPlanetPosition]);

  // Get current scene opacity for fade-in effect
  const getSceneOpacity = useCallback((): number => {
    return animation.getSceneOpacity();
  }, [animation]);

  // Set scene opacity directly
  const setSceneOpacity = useCallback((opacity: number): void => {
    animation.setSceneOpacity(opacity);
  }, [animation]);

  return {
    moveToPlanet,
    positionOnPlanet,
    returnToDefault,
    updateTracking,
    setTrackedPlanet,
    getCameraOffset,
    setCameraOffset,
    getSceneOpacity,
    setSceneOpacity,
  };
}
