/**
 * useGalaxyCamera - Camera control and animation hook for galaxy view
 *
 * Provides smooth camera transitions using @react-spring/three:
 * - Move to selected star system
 * - Dive animation for galaxy→system transition
 * - Return to origin when deselecting
 */

import { useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from './useSceneStore';

// Default camera configuration
const DEFAULT_POSITION: [number, number, number] = [0, 0, 100];
const DEFAULT_TARGET: [number, number, number] = [0, 0, 0];
const SELECTION_DISTANCE = 80;
const SELECTION_HEIGHT_OFFSET = 30;

interface UseGalaxyCameraOptions {
  /** Map of system names to their positions */
  starPositions: Map<string, [number, number, number]>;
  /** Whether camera control is enabled */
  enabled?: boolean;
}

interface UseGalaxyCameraReturn {
  /** Move camera to focus on a system */
  moveToSystem: (systemName: string) => Promise<void>;
  /** Perform dive animation toward a system */
  diveToSystem: (systemName: string) => Promise<void>;
  /** Move camera back to origin */
  moveToOrigin: () => Promise<void>;
  /** Instantly position camera on a system */
  positionOnSystem: (systemName: string) => void;
  /** Current camera position */
  position: [number, number, number];
  /** Current look-at target */
  target: [number, number, number];
}

// Easing functions
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeInCubic(t: number): number {
  return t * t * t;
}

export function useGalaxyCamera({
  starPositions,
}: UseGalaxyCameraOptions): UseGalaxyCameraReturn {
  const { camera } = useThree();
  const updateCamera = useSceneStore((state) => state.updateCamera);
  const setAutoRotate = useSceneStore((state) => state.setAutoRotate);
  const recordInteraction = useSceneStore((state) => state.recordInteraction);
  // Read current target from store (kept in sync by GalaxyControls)
  const storeTarget = useSceneStore((state) => state.camera.target);

  // Track current positions (used during animation)
  const positionRef = useRef<[number, number, number]>(DEFAULT_POSITION);
  const targetRef = useRef<[number, number, number]>(DEFAULT_TARGET);

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
  });

  // Animation frame update
  useFrame(() => {
    const anim = animationRef.current;
    if (!anim.active) return;

    const elapsed = performance.now() - anim.startTime;
    const progress = Math.min(elapsed / anim.duration, 1);
    const eased = anim.easing(progress);

    // Interpolate position
    const pos = new THREE.Vector3().lerpVectors(anim.startPos, anim.endPos, eased);
    const tgt = new THREE.Vector3().lerpVectors(anim.startTarget, anim.endTarget, eased);

    camera.position.copy(pos);
    camera.lookAt(tgt);

    positionRef.current = [pos.x, pos.y, pos.z];
    targetRef.current = [tgt.x, tgt.y, tgt.z];
    updateCamera(positionRef.current, targetRef.current);

    if (progress >= 1) {
      anim.active = false;
      if (anim.resolve) {
        anim.resolve();
        anim.resolve = null;
      }
    }
  });

  // Calculate camera end position for viewing a system
  const calculateViewPosition = useCallback(
    (systemPosition: [number, number, number]): [number, number, number] => {
      // Use actual camera position (may have been moved by auto-rotation)
      const currentPos = camera.position;
      // Use store target (kept in sync by GalaxyControls)
      const currentTarget = storeTarget;

      const angle = Math.atan2(
        currentPos.x - currentTarget[0],
        currentPos.z - currentTarget[2]
      );

      return [
        systemPosition[0] + Math.sin(angle) * SELECTION_DISTANCE,
        systemPosition[1] + SELECTION_HEIGHT_OFFSET,
        systemPosition[2] + Math.cos(angle) * SELECTION_DISTANCE,
      ];
    },
    [camera, storeTarget]
  );

  // Start an animation
  const startAnimation = useCallback(
    (
      endPos: [number, number, number],
      endTarget: [number, number, number],
      duration: number,
      easing: (t: number) => number
    ): Promise<void> => {
      return new Promise((resolve) => {
        const anim = animationRef.current;

        // Cancel any existing animation
        if (anim.active && anim.resolve) {
          anim.resolve();
        }

        // Read actual camera position (may have been moved by auto-rotation)
        const currentPos = camera.position;
        // Use store target (kept in sync by GalaxyControls)
        const currentTarget = storeTarget;

        anim.active = true;
        anim.startTime = performance.now();
        anim.duration = duration;
        anim.startPos.set(currentPos.x, currentPos.y, currentPos.z);
        anim.endPos.set(...endPos);
        anim.startTarget.set(currentTarget[0], currentTarget[1], currentTarget[2]);
        anim.endTarget.set(...endTarget);
        anim.easing = easing;
        anim.resolve = resolve;
      });
    },
    [camera, storeTarget]
  );

  // Move camera to focus on a system
  const moveToSystem = useCallback(
    (systemName: string): Promise<void> => {
      const systemPos = starPositions.get(systemName);
      if (!systemPos) {
        return Promise.resolve();
      }

      setAutoRotate(false);
      // Record interaction so auto-rotate can resume after timeout
      recordInteraction();
      const endPosition = calculateViewPosition(systemPos);
      return startAnimation(endPosition, systemPos, 2000, easeInOutQuad);
    },
    [starPositions, calculateViewPosition, setAutoRotate, recordInteraction, startAnimation]
  );

  // Dive animation for transitioning to system view
  const diveToSystem = useCallback(
    (systemName: string): Promise<void> => {
      const systemPos = starPositions.get(systemName);
      if (!systemPos) {
        return Promise.resolve();
      }

      setAutoRotate(false);

      // Dive very close to the star
      const endPosition: [number, number, number] = [
        systemPos[0],
        systemPos[1] + 2,
        systemPos[2] + 5,
      ];

      return startAnimation(endPosition, systemPos, 800, easeInCubic);
    },
    [starPositions, setAutoRotate, startAnimation]
  );

  // Move camera back to origin
  const moveToOrigin = useCallback((): Promise<void> => {
    // Record interaction so auto-rotate timer is properly set
    recordInteraction();
    return startAnimation(DEFAULT_POSITION, DEFAULT_TARGET, 1500, easeInOutQuad).then(
      () => {
        setAutoRotate(true);
      }
    );
  }, [setAutoRotate, recordInteraction, startAnimation]);

  // Instantly position camera on a system (no animation)
  const positionOnSystem = useCallback(
    (systemName: string): void => {
      const systemPos = starPositions.get(systemName);
      if (!systemPos) return;

      setAutoRotate(false);

      const endPosition = calculateViewPosition(systemPos);

      positionRef.current = endPosition;
      targetRef.current = systemPos;

      camera.position.set(endPosition[0], endPosition[1], endPosition[2]);
      camera.lookAt(systemPos[0], systemPos[1], systemPos[2]);

      updateCamera(endPosition, systemPos);
    },
    [starPositions, camera, calculateViewPosition, setAutoRotate, updateCamera]
  );

  return {
    moveToSystem,
    diveToSystem,
    moveToOrigin,
    positionOnSystem,
    position: positionRef.current,
    target: targetRef.current,
  };
}
