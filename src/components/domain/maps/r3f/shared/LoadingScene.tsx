/**
 * LoadingScene - Suspense fallback for R3F scenes
 *
 * Displays a loading indicator while scene assets are being loaded.
 * Uses a simple animated geometry that matches the retro aesthetic.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface LoadingSceneProps {
  /** Loading text to display (optional) */
  text?: string;
  /** Color of the loading indicator */
  color?: THREE.ColorRepresentation;
}

export function LoadingScene({
  color = 0x8b7355, // Theme amber
}: LoadingSceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const ring3Ref = useRef<THREE.Mesh>(null);

  // Animate the loading rings
  useFrame((_, delta) => {
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z += delta * 1.0;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z -= delta * 1.5;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z += delta * 2.0;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Outer ring */}
      <mesh ref={ring1Ref}>
        <ringGeometry args={[2.8, 3, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Middle ring */}
      <mesh ref={ring2Ref}>
        <ringGeometry args={[1.8, 2.2, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner ring */}
      <mesh ref={ring3Ref}>
        <ringGeometry args={[0.8, 1.2, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Center dot */}
      <mesh>
        <circleGeometry args={[0.3, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Ambient light for visibility */}
      <ambientLight intensity={0.5} />
    </group>
  );
}

/**
 * Simple dot-based loading indicator
 * Alternative style for smaller loading states
 */
export function LoadingDots({
  color = 0x8b7355,
  spacing = 0.5,
}: {
  color?: THREE.ColorRepresentation;
  spacing?: number;
}) {
  const dot1Ref = useRef<THREE.Mesh>(null);
  const dot2Ref = useRef<THREE.Mesh>(null);
  const dot3Ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const time = performance.now() / 1000;

    if (dot1Ref.current) {
      dot1Ref.current.scale.setScalar(0.5 + Math.sin(time * 3) * 0.3);
    }
    if (dot2Ref.current) {
      dot2Ref.current.scale.setScalar(0.5 + Math.sin(time * 3 + 1) * 0.3);
    }
    if (dot3Ref.current) {
      dot3Ref.current.scale.setScalar(0.5 + Math.sin(time * 3 + 2) * 0.3);
    }
  });

  return (
    <group>
      <mesh ref={dot1Ref} position={[-spacing, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={dot2Ref} position={[0, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={dot3Ref} position={[spacing, 0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
