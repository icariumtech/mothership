/**
 * StarSystem - Individual star system sprite
 *
 * Renders a star sprite with point light, an amber camera-facing name label,
 * and an invisible click target so the user can select systems directly from
 * the 3D view.
 */

import { useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useProceduralTexture } from '../hooks/useProceduralTexture';
import { useIsPaused } from '../hooks/useSceneStore';
import type { StarSystem as StarSystemData } from '@/types/starMap';

const STAR_LABEL_AMBER = '#c9a050';

interface StarSystemProps {
  /** Star system data from API */
  data: StarSystemData;
  /** Whether this star is selected */
  selected?: boolean;
  /** Fired when the user clicks the star (or its label) */
  onSelect?: (systemName: string) => void;
}

export function StarSystem({
  data,
  selected = false,
  onSelect,
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

  // `label !== false` mirrors StarMapPanel — systems opting out are hidden
  const showLabel = data.label !== false;

  const handleSelect = (e: ThreeEvent<ReactMouseEvent>) => {
    if (!onSelect) return;
    e.stopPropagation();
    onSelect(data.name);
  };

  // Click target slightly larger than the visible sprite so small stars are
  // still easy to hit. Kept invisible.
  const hitScale = Math.max(scale * 1.2, 4);
  const labelOffset = scale * 0.5 + 0.8;

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

      {/* Invisible click target — also catches clicks on the label area */}
      {onSelect && (
        <sprite
          scale={[hitScale, hitScale, 1]}
          onClick={handleSelect}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = '';
          }}
        >
          <spriteMaterial
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
          />
        </sprite>
      )}

      {/* Name label — always faces camera so text is right-side up under rotation */}
      {showLabel && (
        <Billboard position={[labelOffset, 0, 0]}>
          <Text
            fontSize={1.5}
            color={STAR_LABEL_AMBER}
            anchorX="left"
            anchorY="middle"
            outlineWidth={0.06}
            outlineColor="#000000"
            outlineOpacity={0.7}
            // Render on top of additive star sprite so it stays readable
            renderOrder={1}
          >
            {data.name}
          </Text>
        </Billboard>
      )}

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
  /** Fired when the user clicks a star */
  onSystemSelect?: (systemName: string) => void;
}

export function StarSystems({
  systems,
  selectedSystem,
  onSystemSelect,
}: StarSystemsProps) {
  return (
    <group>
      {systems.map((system) => (
        <StarSystem
          key={system.name}
          data={system}
          selected={selectedSystem === system.name}
          onSelect={onSystemSelect}
        />
      ))}
    </group>
  );
}
