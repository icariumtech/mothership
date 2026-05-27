/**
 * Planet - Orbiting planet sprite with procedural texture
 *
 * Renders a planet as a sprite (circle with teal outline) that orbits
 * around the central star. Position is calculated each frame based on
 * orbital parameters.
 */

import { useRef, useMemo, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProceduralTexture } from '../hooks/useProceduralTexture';
import { useIsPaused } from '../hooks/useSceneStore';
import { MapLabel } from '../shared';
import type { BodyData } from '@/types/systemMap';
import { PlanetRings } from './PlanetRings';

// Constants (from legacy SystemScene)
const SIZE_MULTIPLIER = 2;
// World-unit font size for planet name labels.
const PLANET_LABEL_FONT_SIZE = 2.5;

interface PlanetProps {
  /** Planet configuration data */
  body: BodyData;
  /** Speed multiplier for orbital animation */
  speedMultiplier?: number;
  /**
   * Animation start time reference. Passed as a ref so the parent can re-anchor
   * it on resume after a scrub (Phase 25 D-07) without forcing a remount.
   */
  startTimeRef: RefObject<number>;
  /** Captured elapsed seconds at the moment orbitsPaused flipped true. */
  frozenElapsedRef?: RefObject<number | null>;
  /**
   * Accumulated scrub offset in **seconds of visualization time**, added to
   * elapsed time while paused. Each body advances proportional to its own
   * orbital speed — inner planets cycle faster, outer planets slower.
   */
  scrubOffsetRef?: RefObject<number>;
  /** Whether orbital math is currently frozen (overlay pause). */
  orbitsPaused?: boolean;
  /** Whether this planet is currently selected (reserved for future use) */
  isSelected?: boolean;
  /** Callback when planet is clicked */
  onClick?: (body: BodyData) => void;
  /** Scene opacity for fade-in effect (0-1) */
  opacity?: number;
}

export function Planet({
  body,
  speedMultiplier = 10,
  startTimeRef,
  frozenElapsedRef,
  scrubOffsetRef,
  orbitsPaused = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isSelected: _isSelected = false,
  onClick,
  opacity = 1,
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

  // Animate orbital position. While orbitsPaused, freeze elapsed time at the
  // capture point (frozenElapsedRef) and add the accumulated scrub offset so
  // dragging the slider rotates planets along their orbits.
  useFrame(() => {
    if (!groupRef.current || isPaused) return;

    const elapsedSeconds =
      orbitsPaused && frozenElapsedRef?.current != null
        ? frozenElapsedRef.current
        : (Date.now() - startTimeRef.current) / 1000;
    const scrubSeconds = orbitsPaused ? (scrubOffsetRef?.current ?? 0) : 0;
    const orbitalSpeed = (2 * Math.PI) / orbitalParams.period * speedMultiplier;
    const currentAngle = orbitalParams.initialAngle + orbitalSpeed * (elapsedSeconds + scrubSeconds);

    // Calculate position in orbital plane
    const x = Math.cos(currentAngle) * orbitalParams.radius;
    const z = Math.sin(currentAngle) * orbitalParams.radius;

    // Apply orbital inclination
    const posX = x * Math.cos(orbitalParams.inclination);
    const posY = x * Math.sin(orbitalParams.inclination);
    const posZ = z;

    groupRef.current.position.set(posX, posY, posZ);
  });

  // Generous invisible hit target so small planets are still easy to click.
  const hitScale = Math.max(size * 1.6, 6);
  // Place the name label just to the right of the planet (and its rings).
  const labelOffset = (body.has_rings ? size * 0.9 : size * 0.5) + 1.2;

  return (
    <group ref={groupRef}>
      {/* Planet sprite */}
      <sprite
        ref={spriteRef}
        scale={[size, size, 1]}
      >
        <spriteMaterial
          map={planetTexture}
          transparent
          opacity={opacity}
          depthWrite
          depthTest
        />
      </sprite>

      {/* Invisible, larger click target */}
      <sprite
        scale={[hitScale, hitScale, 1]}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(body);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = '';
        }}
      >
        {/* colorWrite=false keeps it invisible even though SystemScene's fade
            traversal forces transparent materials' opacity back to 1. */}
        <spriteMaterial transparent opacity={0} depthTest={false} depthWrite={false} colorWrite={false} />
      </sprite>

      {/* Planet rings (if applicable) */}
      {body.has_rings && (
        <PlanetRings planetSize={size} opacity={opacity} />
      )}

      {/* Name label — rides the planet's orbit via the moving group */}
      <MapLabel
        text={body.name}
        offset={[labelOffset, 0, 0]}
        fontSize={PLANET_LABEL_FONT_SIZE}
      />
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
