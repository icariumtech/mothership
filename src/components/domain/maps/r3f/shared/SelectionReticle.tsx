/**
 * SelectionReticle - Animated selection indicator for 3D objects
 *
 * A reusable component that displays an animated reticle around selected
 * objects in galaxy, system, and orbit views.
 *
 * Architecture:
 * - Fixed diamond corners (rotated 45°)
 * - Two independently rotating rings with randomized motion
 * - No pulsing scale animation
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring } from '@react-spring/three';
import * as THREE from 'three';
import { useProceduralTexture } from '../hooks/useProceduralTexture';

interface SelectionReticleProps {
  /** Static position to display the reticle (used if getPosition not provided) */
  position: [number, number, number];
  /** Whether the reticle is visible */
  visible: boolean;
  /** Dynamic position getter - called each frame for tracking moving objects */
  getPosition?: () => [number, number, number] | null;
  /** Scale of the reticle (default: 20) */
  scale?: number;
  /** Color override (default: white - texture has color baked in) */
  color?: THREE.ColorRepresentation;
  /** Opacity (default: 0.8) */
  opacity?: number;
  /** Minimum rotation speed in radians per second (default: 0.2) */
  minRotationSpeed?: number;
  /** Maximum rotation speed in radians per second (default: 1.5) */
  maxRotationSpeed?: number;
  /** How often to randomize ring rotation (in seconds, default: 2) */
  randomizeInterval?: number;
}

/**
 * Random rotation state for a ring
 */
interface RotationState {
  speed: number; // radians per second
  direction: 1 | -1; // clockwise or counter-clockwise
  nextChangeTime: number; // when to next randomize
}

/**
 * Generate random rotation state
 */
function generateRotationState(
  minSpeed: number,
  maxSpeed: number,
  interval: number,
  currentTime: number
): RotationState {
  return {
    speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
    direction: Math.random() > 0.5 ? 1 : -1,
    nextChangeTime: currentTime + interval,
  };
}

export function SelectionReticle({
  position,
  visible,
  getPosition,
  scale = 20,
  color = 0xffffff,
  opacity = 0.8,
  minRotationSpeed = 0.2,
  maxRotationSpeed = 1.5,
  randomizeInterval = 2,
}: SelectionReticleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRingRef = useRef<THREE.Sprite>(null);
  const outerRingRef = useRef<THREE.Sprite>(null);
  const innerRingMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const outerRingMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const cornersMaterialRef = useRef<THREE.SpriteMaterial>(null);

  // Get procedural textures
  const innerRingTexture = useProceduralTexture('reticle-inner-ring');
  const outerRingTexture = useProceduralTexture('reticle-outer-ring');
  const cornersTexture = useProceduralTexture('reticle-corners');

  // Rotation state for each ring (stored in refs to avoid re-renders)
  const innerRotationState = useRef<RotationState>(
    generateRotationState(minRotationSpeed, maxRotationSpeed, randomizeInterval, 0)
  );
  const outerRotationState = useRef<RotationState>(
    generateRotationState(minRotationSpeed, maxRotationSpeed, randomizeInterval, 0)
  );

  // Spring animation for visibility transitions
  const { springOpacity } = useSpring({
    springOpacity: visible ? opacity : 0,
    config: { tension: 200, friction: 20 },
  });

  // Animate rotation and position tracking on each frame
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // Update position from dynamic getter if provided
    if (getPosition && visible) {
      const dynamicPos = getPosition();
      if (dynamicPos) {
        groupRef.current.position.set(dynamicPos[0], dynamicPos[1], dynamicPos[2]);
      }
    }

    if (!visible) return;

    const currentTime = performance.now() / 1000;

    // Update inner ring rotation
    if (innerRingRef.current && innerRingRef.current.material) {
      // Check if we should randomize
      if (currentTime >= innerRotationState.current.nextChangeTime) {
        innerRotationState.current = generateRotationState(
          minRotationSpeed,
          maxRotationSpeed,
          randomizeInterval,
          currentTime
        );
      }

      // Apply rotation
      innerRingRef.current.material.rotation +=
        innerRotationState.current.speed *
        innerRotationState.current.direction *
        delta;
    }

    // Update outer ring rotation
    if (outerRingRef.current && outerRingRef.current.material) {
      // Check if we should randomize
      if (currentTime >= outerRotationState.current.nextChangeTime) {
        outerRotationState.current = generateRotationState(
          minRotationSpeed,
          maxRotationSpeed,
          randomizeInterval,
          currentTime
        );
      }

      // Apply rotation
      outerRingRef.current.material.rotation +=
        outerRotationState.current.speed *
        outerRotationState.current.direction *
        delta;
    }
  });

  // Update material opacity from spring
  useFrame(() => {
    const opacityValue = springOpacity.get();
    if (innerRingMaterialRef.current) {
      innerRingMaterialRef.current.opacity = opacityValue;
    }
    if (outerRingMaterialRef.current) {
      outerRingMaterialRef.current.opacity = opacityValue;
    }
    if (cornersMaterialRef.current) {
      cornersMaterialRef.current.opacity = opacityValue;
    }
  });

  if (!visible && springOpacity.get() < 0.01) {
    return null;
  }

  return (
    <group ref={groupRef} position={position}>
      {/* Fixed diamond corners (rotated 45 degrees) */}
      <sprite scale={[scale, scale, 1]}>
        <spriteMaterial
          ref={cornersMaterialRef}
          attach="material"
          map={cornersTexture}
          color={color}
          transparent
          opacity={opacity}
          depthTest={false}
          depthWrite={false}
          rotation={Math.PI / 4}
        />
      </sprite>

      {/* Outer ring (randomly rotating) */}
      <sprite ref={outerRingRef} scale={[scale, scale, 1]}>
        <spriteMaterial
          ref={outerRingMaterialRef}
          attach="material"
          map={outerRingTexture}
          color={color}
          transparent
          opacity={opacity}
          depthTest={false}
          depthWrite={false}
        />
      </sprite>

      {/* Inner ring (randomly rotating) */}
      <sprite ref={innerRingRef} scale={[scale, scale, 1]}>
        <spriteMaterial
          ref={innerRingMaterialRef}
          attach="material"
          map={innerRingTexture}
          color={color}
          transparent
          opacity={opacity}
          depthTest={false}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

/**
 * Hook to create a reticle that follows a target object
 * Returns position state that updates each frame
 */
export function useReticleFollower(
  targetRef: React.RefObject<THREE.Object3D | null>,
  enabled: boolean
): [number, number, number] {
  const positionRef = useRef<[number, number, number]>([0, 0, 0]);

  useFrame(() => {
    if (enabled && targetRef.current) {
      const worldPos = new THREE.Vector3();
      targetRef.current.getWorldPosition(worldPos);
      positionRef.current = [worldPos.x, worldPos.y, worldPos.z];
    }
  });

  return positionRef.current;
}
