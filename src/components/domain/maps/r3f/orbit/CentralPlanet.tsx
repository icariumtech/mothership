/**
 * CentralPlanet - Main planet mesh for orbit view
 *
 * Renders the central planet with:
 * - Textured sphere with normal mapping
 * - Axial tilt
 * - Rotation animation
 * - Planet rings (if applicable)
 * - Shadow casting/receiving
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useIsPaused } from '../hooks/useSceneStore';
import type { PlanetData } from '@/types/orbitMap';
import { OrbitPlanetRings } from './OrbitPlanetRings';

// Constants from legacy OrbitScene
const DEFAULT_SIZE = 15.0;
const DEFAULT_ROTATION_SPEED = 0.002;
const SPHERE_SEGMENTS = 64;
const NORMAL_SCALE = 5.0;
const ROUGHNESS = 0.7;
const METALNESS = 0.0;

interface CentralPlanetProps {
  /** Planet configuration data */
  planet: PlanetData;
  /** Whether animation is paused for surface marker selection */
  animationPaused?: boolean;
  /** Shared rotation ref for syncing with grid and surface markers */
  rotationRef?: React.RefObject<number>;
}

// Textured planet component with normal map support
function TexturedPlanet({
  size,
  axialTilt,
  rotationSpeed,
  animationPaused,
  texturePath,
  normalMapPath,
  planet,
  rotationRef,
}: {
  size: number;
  axialTilt: number;
  rotationSpeed: number;
  animationPaused: boolean;
  texturePath: string;
  normalMapPath?: string;
  planet: PlanetData;
  rotationRef?: React.RefObject<number>;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const isPaused = useIsPaused();
  const paused = isPaused || animationPaused;

  // Load textures
  const textures = useTexture(
    normalMapPath && normalMapPath !== texturePath
      ? { map: texturePath, normalMap: normalMapPath }
      : { map: texturePath }
  ) as { map: THREE.Texture; normalMap?: THREE.Texture };

  // Animate rotation - update shared ref and mesh
  useFrame(() => {
    if (!meshRef.current || paused) return;
    if (rotationRef) {
      (rotationRef as React.MutableRefObject<number>).current += rotationSpeed;
      meshRef.current.rotation.y = rotationRef.current;
    }
  });

  // Create normal scale vector
  const normalScale = useMemo(
    () => new THREE.Vector2(NORMAL_SCALE, NORMAL_SCALE),
    []
  );

  return (
    <group rotation={[0, 0, axialTilt]}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <sphereGeometry args={[size, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
        <meshStandardMaterial
          map={textures.map}
          normalMap={textures.normalMap}
          normalScale={normalScale}
          roughness={ROUGHNESS}
          metalness={METALNESS}
        />
      </mesh>
      {/* Rings if applicable */}
      {planet.rings && (
        <OrbitPlanetRings rings={planet.rings} />
      )}
    </group>
  );
}

// Default fallback texture for planets without explicit texture path
const DEFAULT_PLANET_TEXTURE = '/textures/terrestrial/Terrestrial-EQUIRECTANGULAR-1-2048x1024.png';

export function CentralPlanet({
  planet,
  animationPaused = false,
  rotationRef,
}: CentralPlanetProps) {
  const size = planet.size ?? DEFAULT_SIZE;
  const rotationSpeed = planet.rotation_speed ?? DEFAULT_ROTATION_SPEED;
  const axialTilt = (planet.axial_tilt ?? 0) * (Math.PI / 180);

  // Use provided texture or fallback to default
  const texturePath = planet.texture ?? DEFAULT_PLANET_TEXTURE;

  // Derive normal map path from texture path if not provided
  const normalMapPath = useMemo(() => {
    if (planet.normal_map) return planet.normal_map;
    // Try to derive bump map path from texture path
    // e.g., /textures/terrestrial/Terrestrial-EQUIRECTANGULAR-1-2048x1024.png
    //    -> /textures/terrestrial/Bump-EQUIRECTANGULAR-1-2048x1024.png
    const match = texturePath.match(/\/([^/]+)-EQUIRECTANGULAR-(\d+)/);
    if (match) {
      return texturePath.replace(/\/[^/]+-EQUIRECTANGULAR-/, '/Bump-EQUIRECTANGULAR-');
    }
    return undefined;
  }, [planet.normal_map, texturePath]);

  return (
    <TexturedPlanet
      size={size}
      axialTilt={axialTilt}
      rotationSpeed={rotationSpeed}
      animationPaused={animationPaused}
      texturePath={texturePath}
      normalMapPath={normalMapPath}
      planet={planet}
      rotationRef={rotationRef}
    />
  );
}
