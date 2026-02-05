/**
 * LatLonGrid - Latitude/Longitude grid overlay for planet
 *
 * Renders a wireframe sphere slightly larger than the planet
 * to show the coordinate grid. Uses the same nested group structure
 * as CentralPlanet to ensure rotation sync.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useIsPaused } from '../hooks/useSceneStore';

/**
 * AxisLine - A line through the rotation axis for debugging
 */
function AxisLine({ length }: { length: number }) {
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([0, -length, 0, 0, length, 0]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: GRID_COLOR });
    return new THREE.Line(geometry, material);
  }, [length]);

  return <primitive object={line} />;
}

// Constants
const GRID_COLOR = 0x5a7a7a;
const GRID_OPACITY = 0.3;
const SIZE_MULTIPLIER = 1.02; // Slightly larger than planet
const SPHERE_SEGMENTS = 32;

interface LatLonGridProps {
  /** Planet radius */
  planetSize: number;
  /** Axial tilt in radians */
  axialTilt?: number;
  /** Reference to planet rotation for synchronization */
  rotationRef?: React.RefObject<number>;
  /** Whether animation is paused */
  animationPaused?: boolean;
  /** Show rotation axis line for debugging */
  showAxisLine?: boolean;
}

export function LatLonGrid({
  planetSize,
  axialTilt = 0,
  rotationRef,
  animationPaused = false,
  showAxisLine = false,
}: LatLonGridProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const isPaused = useIsPaused();
  const paused = isPaused || animationPaused;

  // Sync rotation with planet - same structure as CentralPlanet
  useFrame(() => {
    if (!meshRef.current || paused || !rotationRef) return;
    meshRef.current.rotation.y = rotationRef.current;
  });

  const gridSize = planetSize * SIZE_MULTIPLIER;
  const axisLength = planetSize * 2;

  // Create material with _baseOpacity set immediately
  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(GRID_COLOR),
      wireframe: true,
      transparent: true,
      opacity: 0, // Start at 0, scene fade will bring to GRID_OPACITY
      depthWrite: false,
    });
    // Set base opacity immediately for scene fade system
    (mat as any)._baseOpacity = GRID_OPACITY;
    return mat;
  }, []);

  return (
    <group rotation={[0, 0, axialTilt]}>
      {/* Wireframe grid sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[gridSize, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
        <primitive object={material} attach="material" />
      </mesh>

      {/* Rotation axis line for debugging */}
      {showAxisLine && (
        <AxisLine length={axisLength} />
      )}
    </group>
  );
}
