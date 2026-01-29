/**
 * OrbitPlanetRings - Planet ring system for orbit view
 *
 * Renders detailed planet rings using RingGeometry with:
 * - Optional texture support
 * - Color and opacity customization
 * - Horizontal orientation (XZ plane)
 */

import { useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { RingData } from '@/types/orbitMap';

// Constants
const RING_SEGMENTS = 128;
const DEFAULT_COLOR = 0xd2b48c;
const DEFAULT_OPACITY = 0.6;

interface OrbitPlanetRingsProps {
  /** Ring configuration data */
  rings: RingData;
}

// Textured ring variant
function TexturedRings({ rings }: { rings: RingData }) {
  const ringTexture = useTexture(rings.texture!);

  // Rotate texture
  useMemo(() => {
    ringTexture.rotation = Math.PI / 2;
    ringTexture.needsUpdate = true;
  }, [ringTexture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[rings.inner_radius, rings.outer_radius, RING_SEGMENTS]} />
      <meshBasicMaterial
        map={ringTexture}
        side={THREE.DoubleSide}
        transparent
        opacity={rings.opacity ?? DEFAULT_OPACITY}
        depthWrite={false}
      />
    </mesh>
  );
}

// Solid color ring variant
function SolidRings({ rings }: { rings: RingData }) {
  const color = useMemo(
    () => new THREE.Color(rings.color ?? DEFAULT_COLOR),
    [rings.color]
  );

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[rings.inner_radius, rings.outer_radius, RING_SEGMENTS]} />
      <meshBasicMaterial
        color={color}
        side={THREE.DoubleSide}
        transparent
        opacity={rings.opacity ?? DEFAULT_OPACITY}
        depthWrite={false}
      />
    </mesh>
  );
}

export function OrbitPlanetRings({ rings }: OrbitPlanetRingsProps) {
  if (rings.texture) {
    return <TexturedRings rings={rings} />;
  }
  return <SolidRings rings={rings} />;
}
