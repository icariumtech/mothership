/**
 * StarSystem - Individual star system sprite
 *
 * Renders a star sprite with point light.
 * Selection is handled through the menu, not by clicking on stars.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProceduralTexture } from '../hooks/useProceduralTexture';
import { useIsPaused } from '../hooks/useSceneStore';
import type { StarSystem as StarSystemData } from '@/types/starMap';

interface StarSystemProps {
  /** Star system data from API */
  data: StarSystemData;
  /** Whether this star is selected */
  selected?: boolean;
}

export function StarSystem({
  data,
  selected = false,
}: StarSystemProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const materialRef = useRef<THREE.SpriteMaterial>(null);
  const isPaused = useIsPaused();
  const pulseOffset = useRef(Math.random() * Math.PI * 2);
  const baseRotation = useRef(Math.random() * Math.PI * 2);

  // Get procedural star texture
  const starTexture = useProceduralTexture('star');

  // Calculate position
  const position: [number, number, number] = [
    data.position[0],
    data.position[1],
    data.position[2],
  ];

  // Calculate scale based on size
  const scale = (data.size || 1) * 6;

  // Animate subtle pulsing
  useFrame(() => {
    if (isPaused || !materialRef.current) return;

    const time = performance.now() * 0.001;
    const pulseSpeed = 0.5;
    const pulseAmount = selected ? 0.2 : 0.1;
    const baseOpacity = selected ? 1.0 : 0.9;
    const pulse = Math.sin(time * pulseSpeed + pulseOffset.current) * pulseAmount;
    materialRef.current.opacity = baseOpacity * (1.0 + pulse);
  });

  return (
    <group position={position}>
      {/* Star sprite */}
      <sprite
        ref={spriteRef}
        scale={[scale, scale, 1]}
      >
        <spriteMaterial
          ref={materialRef}
          map={starTexture}
          color={0xffffff}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          rotation={baseRotation.current}
          depthTest
          depthWrite={false}
        />
      </sprite>

      {/* Point light for glow effect */}
      <pointLight color={0xffffff} intensity={0.3} distance={40} />
    </group>
  );
}

/**
 * StarSystems - Renders all star systems from data
 */
interface StarSystemsProps {
  /** Array of star system data */
  systems: StarSystemData[];
  /** Currently selected system name */
  selectedSystem?: string | null;
}

export function StarSystems({
  systems,
  selectedSystem,
}: StarSystemsProps) {
  return (
    <group>
      {systems.map((system) => (
        <StarSystem
          key={system.name}
          data={system}
          selected={selectedSystem === system.name}
        />
      ))}
    </group>
  );
}
