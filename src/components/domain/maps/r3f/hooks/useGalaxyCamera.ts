/**
 * useGalaxyCamera - Camera control and animation hook for galaxy view
 *
 * Provides smooth camera transitions using generic animation system:
 * - Move to selected star system
 * - Return to origin when deselecting
 */

import { useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from './useSceneStore';
import { useCameraAnimation, easeInOutQuad } from './useCameraAnimation';

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
  /** Move camera back to origin */
  moveToOrigin: () => Promise<void>;
  /** Instantly position camera on a system */
  positionOnSystem: (systemName: string) => void;
  /** Current camera position */
  position: [number, number, number];
  /** Current look-at target */
  target: [number, number, number];
}

export function useGalaxyCamera({
  starPositions,
}: UseGalaxyCameraOptions): UseGalaxyCameraReturn {
  const { camera } = useThree();
  const setAutoRotate = useSceneStore((state) => state.setAutoRotate);
  const recordInteraction = useSceneStore((state) => state.recordInteraction);
  const storeTarget = useSceneStore((state) => state.camera.target);

  // Use generic animation system
  const animation = useCameraAnimation();

  // Calculate camera end position for viewing a system
  const calculateViewPosition = useCallback(
    (systemPosition: [number, number, number]): [number, number, number] => {
      const currentPos = camera.position;
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

  // Move camera to focus on a system
  const moveToSystem = useCallback(
    (systemName: string): Promise<void> => {
      const systemPos = starPositions.get(systemName);
      if (!systemPos) {
        return Promise.resolve();
      }

      setAutoRotate(false);
      recordInteraction();

      const endPosition = calculateViewPosition(systemPos);
      return animation.startAnimation(
        new THREE.Vector3(...endPosition),
        new THREE.Vector3(...systemPos),
        2000,
        easeInOutQuad
      );
    },
    [starPositions, calculateViewPosition, setAutoRotate, recordInteraction, animation]
  );

  // Move camera back to origin
  const moveToOrigin = useCallback((): Promise<void> => {
    recordInteraction();
    return animation.startAnimation(
      new THREE.Vector3(...DEFAULT_POSITION),
      new THREE.Vector3(...DEFAULT_TARGET),
      1500,
      easeInOutQuad
    ).then(() => {
      setAutoRotate(true);
    });
  }, [setAutoRotate, recordInteraction, animation]);

  // Instantly position camera on a system (no animation)
  const positionOnSystem = useCallback(
    (systemName: string): void => {
      const systemPos = starPositions.get(systemName);
      if (!systemPos) return;

      setAutoRotate(false);

      const endPosition = calculateViewPosition(systemPos);
      animation.positionCamera(
        new THREE.Vector3(...endPosition),
        new THREE.Vector3(...systemPos)
      );
    },
    [starPositions, calculateViewPosition, setAutoRotate, animation]
  );

  return {
    moveToSystem,
    moveToOrigin,
    positionOnSystem,
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: storeTarget,
  };
}
