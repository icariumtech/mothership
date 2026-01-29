/**
 * useOrbitCamera - Camera control and animation hook for orbit view
 *
 * Provides camera transitions and tracking for the orbit scene:
 * - Move to and track selected elements (moons, stations, markers)
 * - Zoom in animation for system→orbit transition
 * - Zoom out animation for returning to system view
 * - Camera offset tracking to follow orbiting objects
 */

import { useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore, useIsPaused } from './useSceneStore';
import type { OrbitMapCameraConfig } from '@/types/orbitMap';

// Camera configuration constants
const ANIMATION_DURATION = 800; // ms
const ELEMENT_ZOOM_DISTANCE = 35;
const SURFACE_ZOOM_DISTANCE = 25;
const ZOOM_OUT_POSITION = { x: 0, y: 150, z: 250 };

// Easing functions
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeInCubic(t: number): number {
  return t * t * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

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
  /** Zoom out from current view (for orbit→system transition) */
  zoomOut: () => Promise<void>;
  /** Zoom in from distant view (for system→orbit transition) */
  zoomIn: () => Promise<void>;
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
}

export function useOrbitCamera({
  getElementPosition,
  defaultCamera,
}: UseOrbitCameraOptions): UseOrbitCameraReturn {
  const { camera } = useThree();
  const updateCamera = useSceneStore((state) => state.updateCamera);
  const isPaused = useIsPaused();

  // Tracking state refs
  const trackedElementRef = useRef<{
    name: string;
    type: 'moon' | 'station' | 'surface';
  } | null>(null);
  const cameraOffsetRef = useRef<THREE.Vector3 | null>(null);

  // Animation state
  const animationRef = useRef<{
    active: boolean;
    startTime: number;
    duration: number;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    easing: (t: number) => number;
    resolve: (() => void) | null;
    trackTarget: boolean;
    targetGetter?: () => THREE.Vector3;
  }>({
    active: false,
    startTime: 0,
    duration: 0,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    easing: easeInOutQuad,
    resolve: null,
    trackTarget: false,
  });

  // Process animation each frame
  useFrame(() => {
    const anim = animationRef.current;
    if (!anim.active) return;

    const elapsed = performance.now() - anim.startTime;
    const progress = Math.min(elapsed / anim.duration, 1);
    const eased = anim.easing(progress);

    // Get current target (may be moving)
    let currentTarget = anim.endTarget;
    if (anim.trackTarget && anim.targetGetter) {
      currentTarget = anim.targetGetter();
    }

    // Calculate end position relative to current target if tracking
    let endPos = anim.endPos;
    if (anim.trackTarget && anim.targetGetter) {
      const offset = anim.endPos.clone().sub(anim.endTarget);
      endPos = currentTarget.clone().add(offset);
    }

    // Interpolate position
    const pos = new THREE.Vector3().lerpVectors(anim.startPos, endPos, eased);
    const tgt = new THREE.Vector3().lerpVectors(anim.startTarget, currentTarget, eased);

    camera.position.copy(pos);
    camera.lookAt(tgt);

    updateCamera(
      [camera.position.x, camera.position.y, camera.position.z],
      [tgt.x, tgt.y, tgt.z]
    );

    if (progress >= 1) {
      anim.active = false;
      if (anim.resolve) {
        anim.resolve();
        anim.resolve = null;
      }
    }
  });

  // Start an animation
  const startAnimation = useCallback(
    (
      endPos: THREE.Vector3,
      endTarget: THREE.Vector3,
      duration: number,
      easing: (t: number) => number,
      options?: {
        trackTarget?: boolean;
        targetGetter?: () => THREE.Vector3;
        startTarget?: THREE.Vector3;
      }
    ): Promise<void> => {
      return new Promise((resolve) => {
        const anim = animationRef.current;

        // Cancel any existing animation
        if (anim.active && anim.resolve) {
          anim.resolve();
        }

        anim.active = true;
        anim.startTime = performance.now();
        anim.duration = duration;
        anim.startPos.copy(camera.position);
        anim.endPos.copy(endPos);
        if (options?.startTarget) {
          anim.startTarget.copy(options.startTarget);
        } else {
          anim.startTarget.set(0, 0, 0);
        }
        anim.endTarget.copy(endTarget);
        anim.easing = easing;
        anim.resolve = resolve;
        anim.trackTarget = options?.trackTarget ?? false;
        anim.targetGetter = options?.targetGetter;
      });
    },
    [camera]
  );

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

      await startAnimation(
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
    [getElementPosition, startAnimation, camera]
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

      await startAnimation(targetPos, targetLookAt, ANIMATION_DURATION, easeInOutQuad, {
        startTarget: currentTarget ?? undefined,
      });
    },
    [defaultCamera, getElementPosition, startAnimation]
  );

  // Zoom out for orbit→system transition
  const zoomOut = useCallback(
    async (): Promise<void> => {
      cameraOffsetRef.current = null;

      const endPosition = new THREE.Vector3(
        ZOOM_OUT_POSITION.x,
        ZOOM_OUT_POSITION.y,
        ZOOM_OUT_POSITION.z
      );
      const lookAtTarget = new THREE.Vector3(0, 0, 0);

      await startAnimation(endPosition, lookAtTarget, ANIMATION_DURATION, easeInCubic);
    },
    [startAnimation]
  );

  // Zoom in for system→orbit transition
  const zoomIn = useCallback(
    async (): Promise<void> => {
      if (!defaultCamera) return;

      cameraOffsetRef.current = null;

      // Start from distant position
      const startPosition = new THREE.Vector3(
        ZOOM_OUT_POSITION.x,
        ZOOM_OUT_POSITION.y,
        ZOOM_OUT_POSITION.z
      );
      const targetPos = new THREE.Vector3(...defaultCamera.position);
      const targetLookAt = new THREE.Vector3(...defaultCamera.lookAt);

      // Set camera to start position
      camera.position.copy(startPosition);
      camera.lookAt(targetLookAt);

      await startAnimation(targetPos, targetLookAt, ANIMATION_DURATION, easeOutCubic);
    },
    [defaultCamera, camera, startAnimation]
  );

  // Update camera tracking for orbiting elements
  const updateTracking = useCallback(() => {
    if (isPaused) return;
    if (!trackedElementRef.current || !cameraOffsetRef.current) return;
    if (animationRef.current.active) return;

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

    updateCamera(
      [camera.position.x, camera.position.y, camera.position.z],
      [elementPos.x, elementPos.y, elementPos.z]
    );
  }, [isPaused, getElementPosition, camera, updateCamera]);

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
    return animationRef.current.active;
  }, []);

  return {
    moveToElement,
    returnToDefault,
    zoomOut,
    zoomIn,
    updateTracking,
    setTrackedElement,
    getCameraOffset,
    setCameraOffset,
    isAnimating,
  };
}
