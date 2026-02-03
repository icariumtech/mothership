/**
 * CentralStar - Central star mesh with corona glow effect
 *
 * Renders the central star of a solar system with:
 * - Solid sphere for the star body
 * - Translucent glow sphere for corona effect
 * - Point light for illumination
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { StarData } from '@/types/systemMap';

// Default values (from legacy SystemScene)
const DEFAULT_SIZE = 4;
const SPHERE_SEGMENTS = 32;
const DEFAULT_CORONA_INTENSITY = 1.5;
const LIGHT_DISTANCE = 500;
const GLOW_SIZE_MULTIPLIER = 1.5;
const GLOW_OPACITY = 0.3;

interface CentralStarProps {
  /** Star configuration data */
  star: StarData;
  /** Scene opacity for fade-in effect (0-1) */
  opacity?: number;
}

export function CentralStar({ star, opacity = 1 }: CentralStarProps) {
  const size = star.size ?? DEFAULT_SIZE;
  const color = useMemo(() => new THREE.Color(star.color ?? 0xffffaa), [star.color]);
  const lightColor = useMemo(
    () => new THREE.Color(star.light_color ?? star.color ?? 0xffffaa),
    [star.light_color, star.color]
  );
  const coronaIntensity = star.corona_intensity ?? DEFAULT_CORONA_INTENSITY;
  const glowSize = size * GLOW_SIZE_MULTIPLIER;

  return (
    <group>
      {/* Main star sphere */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[size, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>

      {/* Corona glow sphere */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[glowSize, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={GLOW_OPACITY * opacity}
        />
      </mesh>

      {/* Point light for star illumination */}
      <pointLight
        position={[0, 0, 0]}
        color={lightColor}
        intensity={coronaIntensity * opacity}
        distance={LIGHT_DISTANCE}
      />
    </group>
  );
}
