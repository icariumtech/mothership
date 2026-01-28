/**
 * useSystemCamera - Camera control and animation hook for system view
 *
 * Provides camera transitions and tracking for the system scene:
 * - Move to and track selected planets
 * - Dive animation for system→orbit transition
 * - Zoom out animation for returning to galaxy view
 * - Camera offset tracking to follow orbiting planets
 */

import { useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore, useIsPaused } from './useSceneStore';
import type { BodyData, CameraConfig } from '@/types/systemMap';

// Camera configuration constants
const ANIMATION_DURATION = 1500; // ms
const PLANET_ZOOM_DISTANCE_RATIO = 0.3;
const MIN_PLANET_ZOOM_DISTANCE = 20;
// cos(45 deg) = sqrt(2)/2 for 45-degree camera offset angle
const CAMERA_ANGLE_45_DEG = Math.SQRT1_2; // ~0.7071

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
  /** Dive animation toward a planet (for system→orbit transition) */
  diveToPlanet: (planetName: string) => Promise<void>;
  /** Zoom out from a planet (for orbit→system transition) */
  zoomOutFromPlanet: (planetName: string) => Promise<void>;
  /** Zoom out from current view (for system→galaxy transition) */
  zoomOut: () => Promise<void>;
  /** Zoom in from distant view (for galaxy→system transition) */
  zoomIn: () => void;
  /** Update camera tracking state (call from useFrame) */
  updateTracking: () => void;
  /** Set the planet to track */
  setTrackedPlanet: (planet: BodyData | null) => void;
  /** Get current camera offset for tracking */
  getCameraOffset: () => THREE.Vector3 | null;
  /** Set camera offset (used after control interactions) */
  setCameraOffset: (offset: THREE.Vector3) => void;
}

export function useSystemCamera({
  getPlanetPosition,
  defaultCamera,
}: UseSystemCameraOptions): UseSystemCameraReturn {
  const { camera } = useThree();
  const updateCamera = useSceneStore((state) => state.updateCamera);
  const isPaused = useIsPaused();

  // Tracking state refs
  const trackedPlanetRef = useRef<BodyData | null>(null);
  const cameraOffsetRef = useRef<THREE.Vector3 | null>(null);
  const lastPlanetAngleRef = useRef(0);

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
    trackTarget: boolean; // Whether to track moving target
    targetGetter?: () => THREE.Vector3; // Dynamic target getter
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
      options?: { trackTarget?: boolean; targetGetter?: () => THREE.Vector3; startTarget?: THREE.Vector3 }
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
        // Use provided startTarget or default to origin
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

      await startAnimation(
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
    [getPlanetPosition, calculatePlanetViewPosition, startAnimation, camera]
  );

  // Instantly position camera on a planet
  const positionOnPlanet = useCallback(
    (planet: BodyData): void => {
      const planetPos = getPlanetPosition(planet.name);
      if (!planetPos) return;

      // Cancel any ongoing animation
      if (animationRef.current.active && animationRef.current.resolve) {
        animationRef.current.resolve();
        animationRef.current.active = false;
      }

      const targetPosition = calculatePlanetViewPosition(planetPos, planet.orbital_radius);

      camera.position.copy(targetPosition);
      camera.lookAt(planetPos);

      // Set up tracking
      cameraOffsetRef.current = new THREE.Vector3(
        camera.position.x - planetPos.x,
        camera.position.y - planetPos.y,
        camera.position.z - planetPos.z
      );
      lastPlanetAngleRef.current = Math.atan2(planetPos.z, planetPos.x);
      trackedPlanetRef.current = planet;

      updateCamera(
        [camera.position.x, camera.position.y, camera.position.z],
        [planetPos.x, planetPos.y, planetPos.z]
      );
    },
    [getPlanetPosition, calculatePlanetViewPosition, camera, updateCamera]
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

      // Animate from current planet position to default view
      await startAnimation(targetPos, targetLookAt, ANIMATION_DURATION, easeInOutQuad, {
        startTarget: currentTarget ?? undefined,
      });
    },
    [defaultCamera, getPlanetPosition, startAnimation]
  );

  // Dive toward a planet for system→orbit transition
  const diveToPlanet = useCallback(
    async (planetName: string): Promise<void> => {
      const planetPos = getPlanetPosition(planetName);
      if (!planetPos) return;

      // Cancel any ongoing animation
      if (animationRef.current.active && animationRef.current.resolve) {
        animationRef.current.resolve();
        animationRef.current.active = false;
      }

      cameraOffsetRef.current = null;

      const endPosition = planetPos.clone().add(new THREE.Vector3(0, 1, 3));

      await startAnimation(
        endPosition,
        planetPos,
        800,
        easeInCubic,
        {
          trackTarget: true,
          targetGetter: () => getPlanetPosition(planetName) ?? planetPos,
        }
      );
    },
    [getPlanetPosition, startAnimation]
  );

  // Zoom out from a planet for orbit→system transition
  const zoomOutFromPlanet = useCallback(
    async (planetName: string): Promise<void> => {
      const trackedPlanet = trackedPlanetRef.current;
      if (!trackedPlanet) return;

      const planetPos = getPlanetPosition(planetName);
      if (!planetPos) return;

      // Calculate target position
      const zoomDistance = trackedPlanet.orbital_radius * PLANET_ZOOM_DISTANCE_RATIO;
      const actualZoomDistance = Math.max(zoomDistance, MIN_PLANET_ZOOM_DISTANCE);

      const endOffset = new THREE.Vector3(
        actualZoomDistance * CAMERA_ANGLE_45_DEG,
        actualZoomDistance * CAMERA_ANGLE_45_DEG,
        actualZoomDistance * CAMERA_ANGLE_45_DEG
      );

      // Start camera very close to the planet
      const startPosition = planetPos.clone().add(new THREE.Vector3(0, 1, 3));
      camera.position.copy(startPosition);
      camera.lookAt(planetPos);

      const endPosition = planetPos.clone().add(endOffset);

      await startAnimation(
        endPosition,
        planetPos,
        800,
        easeOutCubic,
        {
          trackTarget: true,
          targetGetter: () => getPlanetPosition(planetName) ?? planetPos,
        }
      );

      // Set up tracking after animation
      const finalPos = getPlanetPosition(planetName);
      if (finalPos) {
        cameraOffsetRef.current = new THREE.Vector3(
          camera.position.x - finalPos.x,
          camera.position.y - finalPos.y,
          camera.position.z - finalPos.z
        );
        lastPlanetAngleRef.current = Math.atan2(finalPos.z, finalPos.x);
      }
    },
    [getPlanetPosition, startAnimation, camera]
  );

  // Zoom out from current view for system→galaxy transition
  const zoomOut = useCallback(
    async (): Promise<void> => {
      cameraOffsetRef.current = null;

      let lookAtTarget = new THREE.Vector3(0, 0, 0);
      if (trackedPlanetRef.current) {
        const planetPos = getPlanetPosition(trackedPlanetRef.current.name);
        if (planetPos) {
          lookAtTarget = planetPos;
        }
      }

      // Calculate end position - zoom out significantly
      const direction = camera.position.clone().sub(lookAtTarget).normalize();
      const endPosition = lookAtTarget.clone().add(direction.multiplyScalar(200));

      await startAnimation(endPosition, lookAtTarget, 600, easeInCubic);
    },
    [getPlanetPosition, startAnimation, camera]
  );

  // Zoom in from distant view for galaxy→system transition
  const zoomIn = useCallback((): void => {
    if (!defaultCamera) return;

    // Cancel any ongoing animation
    if (animationRef.current.active && animationRef.current.resolve) {
      animationRef.current.resolve();
      animationRef.current.active = false;
    }

    cameraOffsetRef.current = null;

    const targetPos = new THREE.Vector3(...defaultCamera.position);
    const targetLookAt = new THREE.Vector3(...defaultCamera.lookAt);

    // Start from a distant position
    const direction = targetPos.clone().sub(targetLookAt).normalize();
    const startPosition = targetLookAt.clone().add(direction.multiplyScalar(300));

    camera.position.copy(startPosition);
    camera.lookAt(targetLookAt);

    startAnimation(targetPos, targetLookAt, 1000, easeOutCubic);
  }, [defaultCamera, camera, startAnimation]);

  // Update camera tracking for orbiting planets
  const updateTracking = useCallback(() => {
    if (isPaused) return;
    if (!trackedPlanetRef.current || !cameraOffsetRef.current) return;
    if (animationRef.current.active) return;

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

    updateCamera(
      [camera.position.x, camera.position.y, camera.position.z],
      [planetPos.x, planetPos.y, planetPos.z]
    );
  }, [isPaused, getPlanetPosition, camera, updateCamera]);

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

  return {
    moveToPlanet,
    positionOnPlanet,
    returnToDefault,
    diveToPlanet,
    zoomOutFromPlanet,
    zoomOut,
    zoomIn,
    updateTracking,
    setTrackedPlanet,
    getCameraOffset,
    setCameraOffset,
  };
}
