/**
 * useOrbitCamera - Camera control and animation hook for orbit view
 *
 * Provides camera transitions and tracking for the orbit scene:
 * - Move to and track selected elements (moons, stations, markers)
 * - Camera offset tracking to follow orbiting objects
 */

import { useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useIsPaused } from './useSceneStore';
import { useCameraAnimation, easeInOutQuad } from './useCameraAnimation';
import type { OrbitMapCameraConfig } from '@/types/orbitMap';

// Camera configuration constants
const ANIMATION_DURATION = 800; // ms
const ELEMENT_ZOOM_DISTANCE = 35;
const SURFACE_ZOOM_DISTANCE = 25;

interface ElementPositionGetter {
  (elementName: string, elementType: 'moon' | 'station' | 'surface'): THREE.Vector3 | null;
}

interface UseOrbitCameraOptions {
  /** Function to get current element position by name and type */
  getElementPosition: ElementPositionGetter;
  /** Default camera config from orbit data */
  defaultCamera?: OrbitMapCameraConfig;
}

interface UseOrbitCameraReturn {
  /** Move camera to focus on an element with animation */
  moveToElement: (
    elementName: string,
    elementType: 'moon' | 'station' | 'surface'
  ) => Promise<void>;
  /** Return camera to default view */
  returnToDefault: () => Promise<void>;
  /** Update camera tracking state (call from useFrame) */
  updateTracking: () => void;
  /** Set the element to track */
  setTrackedElement: (
    elementName: string | null,
    elementType: 'moon' | 'station' | 'surface' | null
  ) => void;
  /** Get current camera offset for tracking */
  getCameraOffset: () => THREE.Vector3 | null;
  /** Set camera offset (used after control interactions) */
  setCameraOffset: (offset: THREE.Vector3) => void;
  /** Whether camera is currently animating */
  isAnimating: () => boolean;
  /** Get current scene opacity (0-1) for fade-in effect */
  getSceneOpacity: () => number;
  /** Set scene opacity directly (0-1) */
  setSceneOpacity: (opacity: number) => void;
}

export function useOrbitCamera({
  getElementPosition,
  defaultCamera,
}: UseOrbitCameraOptions): UseOrbitCameraReturn {
  const { camera } = useThree();
  const isPaused = useIsPaused();

  // Use generic animation system
  const animation = useCameraAnimation();

  // Tracking state refs
  const trackedElementRef = useRef<{
    name: string;
    type: 'moon' | 'station' | 'surface';
  } | null>(null);
  const cameraOffsetRef = useRef<THREE.Vector3 | null>(null);

  // Move camera to focus on an element
  const moveToElement = useCallback(
    async (
      elementName: string,
      elementType: 'moon' | 'station' | 'surface'
    ): Promise<void> => {
      const elementPos = getElementPosition(elementName, elementType);
      if (!elementPos) return;

      // Clear previous tracking
      cameraOffsetRef.current = null;

      // Calculate zoom distance based on element type
      const distance = elementType === 'surface'
        ? SURFACE_ZOOM_DISTANCE
        : ELEMENT_ZOOM_DISTANCE;

      // Calculate camera position (offset from element)
      const direction = elementPos.clone().normalize();
      const endPosition = elementPos.clone().add(direction.multiplyScalar(distance));
      endPosition.y += 10; // Slight elevation

      await animation.startAnimation(
        endPosition,
        elementPos,
        ANIMATION_DURATION,
        easeInOutQuad,
        {
          trackTarget: elementType !== 'surface', // Don't track surface markers
          targetGetter: () => getElementPosition(elementName, elementType) ?? elementPos,
        }
      );

      // Set up tracking after animation
      const finalPos = getElementPosition(elementName, elementType);
      if (finalPos) {
        cameraOffsetRef.current = new THREE.Vector3(
          camera.position.x - finalPos.x,
          camera.position.y - finalPos.y,
          camera.position.z - finalPos.z
        );
        trackedElementRef.current = { name: elementName, type: elementType };
      }
    },
    [getElementPosition, animation, camera]
  );

  // Return camera to default view
  const returnToDefault = useCallback(
    async (): Promise<void> => {
      if (!defaultCamera) return;

      // Capture current target before clearing
      let currentTarget: THREE.Vector3 | null = null;
      if (trackedElementRef.current) {
        currentTarget = getElementPosition(
          trackedElementRef.current.name,
          trackedElementRef.current.type
        );
      }

      // Clear tracking
      trackedElementRef.current = null;
      cameraOffsetRef.current = null;

      const targetPos = new THREE.Vector3(...defaultCamera.position);
      const targetLookAt = new THREE.Vector3(...defaultCamera.lookAt);

      await animation.startAnimation(targetPos, targetLookAt, ANIMATION_DURATION, easeInOutQuad, {
        startTarget: currentTarget ?? undefined,
      });
    },
    [defaultCamera, getElementPosition, animation]
  );

  // Update camera tracking for orbiting elements
  const updateTracking = useCallback(() => {
    if (isPaused) return;
    if (!trackedElementRef.current || !cameraOffsetRef.current) return;
    if (animation.isAnimating()) return;

    // Don't track surface markers (they're static relative to planet)
    if (trackedElementRef.current.type === 'surface') return;

    const elementPos = getElementPosition(
      trackedElementRef.current.name,
      trackedElementRef.current.type
    );
    if (!elementPos) return;

    // Apply offset
    camera.position.x = elementPos.x + cameraOffsetRef.current.x;
    camera.position.y = elementPos.y + cameraOffsetRef.current.y;
    camera.position.z = elementPos.z + cameraOffsetRef.current.z;
    camera.lookAt(elementPos);
  }, [isPaused, getElementPosition, camera, animation]);

  // Set the element to track
  const setTrackedElement = useCallback(
    (
      elementName: string | null,
      elementType: 'moon' | 'station' | 'surface' | null
    ): void => {
      if (elementName && elementType) {
        trackedElementRef.current = { name: elementName, type: elementType };
      } else {
        trackedElementRef.current = null;
        cameraOffsetRef.current = null;
      }
    },
    []
  );

  // Get current camera offset
  const getCameraOffset = useCallback((): THREE.Vector3 | null => {
    return cameraOffsetRef.current?.clone() ?? null;
  }, []);

  // Set camera offset
  const setCameraOffset = useCallback((offset: THREE.Vector3): void => {
    cameraOffsetRef.current = offset.clone();
  }, []);

  // Check if animating
  const isAnimating = useCallback((): boolean => {
    return animation.isAnimating();
  }, [animation]);

  // Get current scene opacity for fade-in effect
  const getSceneOpacity = useCallback((): number => {
    return animation.getSceneOpacity();
  }, [animation]);

  // Set scene opacity directly
  const setSceneOpacity = useCallback((opacity: number): void => {
    animation.setSceneOpacity(opacity);
  }, [animation]);

  return {
    moveToElement,
    returnToDefault,
    updateTracking,
    setTrackedElement,
    getCameraOffset,
    setCameraOffset,
    isAnimating,
    getSceneOpacity,
    setSceneOpacity,
  };
}
