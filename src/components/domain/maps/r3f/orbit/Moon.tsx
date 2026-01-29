/**
 * Moon - Orbiting moon mesh for orbit view
 *
 * Renders a moon with:
 * - Textured sphere (or solid color fallback)
 * - Orbital motion animation
 * - Normal mapping support
 * - Click interaction for selection
 */

import { useRef, useMemo, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useIsPaused } from '../hooks/useSceneStore';
import type { MoonData } from '@/types/orbitMap';

// Constants from legacy OrbitScene
const DEFAULT_SIZE = 3.0;
const SPHERE_SEGMENTS = 32;
const NORMAL_SCALE = 5.0;
const ROUGHNESS = 0.8;
const METALNESS = 0.0;

interface MoonProps {
  /** Moon configuration data */
  moon: MoonData;
  /** Animation start time reference */
  startTime: number;
  /** Whether this moon is selected */
  isSelected?: boolean;
  /** Callback when moon is clicked */
  onClick?: (moon: MoonData) => void;
  /** Whether animation is paused */
  animationPaused?: boolean;
  /** Position ref callback for reticle tracking */
  onPositionUpdate?: (position: THREE.Vector3) => void;
}

// Textured moon component
function TexturedMoon({
  moon,
  startTime,
  onClick,
  animationPaused,
  onPositionUpdate,
  texturePath,
  normalMapPath,
}: Omit<MoonProps, 'isSelected'> & {
  texturePath: string;
  normalMapPath?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const isPaused = useIsPaused();
  const paused = isPaused || animationPaused;

  const size = moon.size ?? DEFAULT_SIZE;

  // Load textures
  const textures = useTexture(
    normalMapPath && normalMapPath !== texturePath
      ? { map: texturePath, normalMap: normalMapPath }
      : { map: texturePath }
  ) as { map: THREE.Texture; normalMap?: THREE.Texture };

  // Orbital parameters
  const orbitalParams = useMemo(() => ({
    radius: moon.orbital_radius,
    period: moon.orbital_period,
    initialAngle: (moon.orbital_angle ?? 0) * (Math.PI / 180),
    inclination: (moon.inclination ?? 0) * (Math.PI / 180),
  }), [moon.orbital_radius, moon.orbital_period, moon.orbital_angle, moon.inclination]);

  // Create normal scale vector
  const normalScale = useMemo(
    () => new THREE.Vector2(NORMAL_SCALE, NORMAL_SCALE),
    []
  );

  // Animate orbital position
  useFrame(() => {
    if (!groupRef.current || paused) return;

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const orbitalSpeed = (2 * Math.PI) / orbitalParams.period;
    const currentAngle = orbitalParams.initialAngle + (orbitalSpeed * elapsedSeconds);

    const x = orbitalParams.radius * Math.cos(currentAngle);
    const z = orbitalParams.radius * Math.sin(currentAngle);

    // Apply inclination
    if (orbitalParams.inclination !== 0) {
      const cos = Math.cos(orbitalParams.inclination);
      const sin = Math.sin(orbitalParams.inclination);
      const y = z * sin;
      const adjustedZ = z * cos;
      groupRef.current.position.set(x, y, adjustedZ);
    } else {
      groupRef.current.position.set(x, 0, z);
    }

    // Report position for reticle tracking
    onPositionUpdate?.(groupRef.current.position);
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick?.(moon);
  }, [onClick, moon]);

  return (
    <group ref={groupRef}>
      <mesh onClick={handleClick} castShadow receiveShadow>
        <sphereGeometry args={[size, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
        <meshStandardMaterial
          map={textures.map}
          normalMap={textures.normalMap}
          normalScale={normalScale}
          roughness={ROUGHNESS}
          metalness={METALNESS}
        />
      </mesh>
    </group>
  );
}

// Default fallback texture for moons without explicit texture path
const DEFAULT_MOON_TEXTURE = '/textures/rock/Rock-EQUIRECTANGULAR-1-2048x1024.png';

export function Moon({
  moon,
  startTime,
  isSelected: _isSelected,
  onClick,
  animationPaused = false,
  onPositionUpdate,
}: MoonProps) {
  // Use provided texture or fallback to default
  const texturePath = moon.texture ?? DEFAULT_MOON_TEXTURE;

  // Derive normal map path
  const normalMapPath = useMemo(() => {
    if (moon.normal_map) return moon.normal_map;
    // Try to derive bump map path from texture path
    const match = texturePath.match(/\/([^/]+)-EQUIRECTANGULAR-(\d+)/);
    if (match) {
      return texturePath.replace(/\/[^/]+-EQUIRECTANGULAR-/, '/Bump-EQUIRECTANGULAR-');
    }
    return undefined;
  }, [moon.normal_map, texturePath]);

  return (
    <TexturedMoon
      moon={moon}
      startTime={startTime}
      onClick={onClick}
      animationPaused={animationPaused}
      onPositionUpdate={onPositionUpdate}
      texturePath={texturePath}
      normalMapPath={normalMapPath}
    />
  );
}
