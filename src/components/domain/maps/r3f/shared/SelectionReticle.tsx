/**
 * SelectionReticle - Animated selection indicator for 3D objects
 *
 * A reusable component that displays an animated reticle around selected
 * objects in galaxy, system, and orbit views.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSpring, animated } from '@react-spring/three';
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
  /** Rotation speed in radians per second (default: 0.5) */
  rotationSpeed?: number;
  /** Pulse amplitude (default: 0.1) */
  pulseAmplitude?: number;
  /** Pulse speed (default: 2) */
  pulseSpeed?: number;
  /** Color override (default: white - texture has color baked in) */
  color?: THREE.ColorRepresentation;
  /** Opacity (default: 0.8) */
  opacity?: number;
}

// Create animated sprite component
const AnimatedSprite = animated('sprite');

export function SelectionReticle({
  position,
  visible,
  getPosition,
  scale = 20,
  rotationSpeed = 0.5,
  pulseAmplitude = 0.1,
  pulseSpeed = 2,
  color = 0xffffff, // White - texture already has amber color baked in
  opacity = 0.8,
}: SelectionReticleProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const materialRef = useRef<THREE.SpriteMaterial>(null);

  // Get procedural reticle texture
  const reticleTexture = useProceduralTexture('reticle');

  // Spring animation for visibility transitions
  const { springOpacity, springScale } = useSpring({
    springOpacity: visible ? opacity : 0,
    springScale: visible ? scale : scale * 0.5,
    config: { tension: 200, friction: 20 },
  });

  // Animate rotation, pulse, and position tracking on each frame
  useFrame((_, delta) => {
    if (!spriteRef.current) return;

    // Update position from dynamic getter if provided
    if (getPosition && visible) {
      const dynamicPos = getPosition();
      if (dynamicPos) {
        spriteRef.current.position.set(dynamicPos[0], dynamicPos[1], dynamicPos[2]);
      }
    }

    if (!visible) return;

    // Rotate the sprite
    spriteRef.current.material.rotation += rotationSpeed * delta;

    // Pulse scale
    const time = performance.now() / 1000;
    const pulse = 1 + Math.sin(time * pulseSpeed) * pulseAmplitude;
    const baseScale = springScale.get();
    spriteRef.current.scale.set(baseScale * pulse, baseScale * pulse, 1);
  });

  // Update material opacity from spring
  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = springOpacity.get();
    }
  });

  if (!visible && springOpacity.get() < 0.01) {
    return null;
  }

  return (
    <AnimatedSprite
      ref={spriteRef}
      position={position}
      scale={[scale, scale, 1]}
    >
      <spriteMaterial
        ref={materialRef}
        attach="material"
        map={reticleTexture}
        color={color}
        transparent
        opacity={opacity}
        depthTest={false}
        depthWrite={false}
      />
    </AnimatedSprite>
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
