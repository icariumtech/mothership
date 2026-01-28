/**
 * Planet - Orbiting planet sprite with procedural texture
 *
 * Renders a planet as a sprite (circle with teal outline) that orbits
 * around the central star. Position is calculated each frame based on
 * orbital parameters.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProceduralTexture } from '../hooks/useProceduralTexture';
import { useIsPaused } from '../hooks/useSceneStore';
import type { BodyData } from '@/types/systemMap';
import { PlanetRings } from './PlanetRings';

// Constants (from legacy SystemScene)
const SIZE_MULTIPLIER = 2;

interface PlanetProps {
  /** Planet configuration data */
  body: BodyData;
  /** Speed multiplier for orbital animation */
  speedMultiplier?: number;
  /** Animation start time reference */
  startTime: number;
  /** Whether this planet is currently selected (reserved for future use) */
  isSelected?: boolean;
  /** Callback when planet is clicked */
  onClick?: (body: BodyData) => void;
}

export function Planet({
  body,
  speedMultiplier = 10,
  startTime,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isSelected: _isSelected = false,
  onClick,
}: PlanetProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const groupRef = useRef<THREE.Group>(null);
  const isPaused = useIsPaused();

  // Get planet texture
  const planetTexture = useProceduralTexture('planet');

  // Calculate orbital parameters
  const orbitalParams = useMemo(() => ({
    radius: body.orbital_radius,
    period: body.orbital_period ?? 365,
    initialAngle: (body.orbital_angle ?? 0) * (Math.PI / 180),
    inclination: (body.inclination ?? 0) * (Math.PI / 180),
  }), [body.orbital_radius, body.orbital_period, body.orbital_angle, body.inclination]);

  // Planet visual size
  const size = (body.size ?? 1) * SIZE_MULTIPLIER;

  // Animate orbital position
  useFrame(() => {
    if (!groupRef.current || isPaused) return;

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const orbitalSpeed = (2 * Math.PI) / orbitalParams.period * speedMultiplier;
    const currentAngle = orbitalParams.initialAngle + (orbitalSpeed * elapsedSeconds);

    // Calculate position in orbital plane
    const x = Math.cos(currentAngle) * orbitalParams.radius;
    const z = Math.sin(currentAngle) * orbitalParams.radius;

    // Apply orbital inclination
    const posX = x * Math.cos(orbitalParams.inclination);
    const posY = x * Math.sin(orbitalParams.inclination);
    const posZ = z;

    groupRef.current.position.set(posX, posY, posZ);
  });

  return (
    <group ref={groupRef}>
      {/* Planet sprite */}
      <sprite
        ref={spriteRef}
        scale={[size, size, 1]}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(body);
        }}
      >
        <spriteMaterial
          map={planetTexture}
          transparent
          depthWrite
          depthTest
        />
      </sprite>

      {/* Planet rings (if applicable) */}
      {body.has_rings && (
        <PlanetRings planetSize={size} />
      )}
    </group>
  );
}

/**
 * Hook to get current planet position for camera tracking
 * Returns a ref that updates each frame with the planet's world position
 */
export function usePlanetPosition(
  body: BodyData,
  speedMultiplier: number,
  startTime: number,
  isPaused: boolean
): React.RefObject<THREE.Vector3> {
  const positionRef = useRef(new THREE.Vector3());

  const orbitalParams = useMemo(() => ({
    radius: body.orbital_radius,
    period: body.orbital_period ?? 365,
    initialAngle: (body.orbital_angle ?? 0) * (Math.PI / 180),
    inclination: (body.inclination ?? 0) * (Math.PI / 180),
  }), [body.orbital_radius, body.orbital_period, body.orbital_angle, body.inclination]);

  useFrame(() => {
    if (isPaused) return;

    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const orbitalSpeed = (2 * Math.PI) / orbitalParams.period * speedMultiplier;
    const currentAngle = orbitalParams.initialAngle + (orbitalSpeed * elapsedSeconds);

    const x = Math.cos(currentAngle) * orbitalParams.radius;
    const z = Math.sin(currentAngle) * orbitalParams.radius;

    const posX = x * Math.cos(orbitalParams.inclination);
    const posY = x * Math.sin(orbitalParams.inclination);
    const posZ = z;

    positionRef.current.set(posX, posY, posZ);
  });

  return positionRef;
}
