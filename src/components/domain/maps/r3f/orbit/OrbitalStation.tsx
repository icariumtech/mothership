/**
 * OrbitalStation - Orbiting station sprite for orbit view
 *
 * Renders a station with:
 * - Procedural sprite texture (square icon)
 * - Orbital motion animation
 * - Click interaction for selection
 */

import { useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useIsPaused } from '../hooks/useSceneStore';
import type { StationData } from '@/types/orbitMap';

// Constants from legacy OrbitScene
const DEFAULT_SIZE = 1.5;
const STATION_COLOR = '#8b7355'; // Amber theme color

interface OrbitalStationProps {
  /** Station configuration data */
  station: StationData;
  /** Animation start time reference */
  startTime: number;
  /** Whether this station is selected */
  isSelected?: boolean;
  /** Callback when station is clicked */
  onClick?: (station: StationData) => void;
  /** Whether animation is paused */
  animationPaused?: boolean;
  /** Position ref callback for reticle tracking */
  onPositionUpdate?: (position: THREE.Vector3) => void;
}

export function OrbitalStation({
  station,
  startTime,
  isSelected: _isSelected,
  onClick,
  animationPaused = false,
  onPositionUpdate,
}: OrbitalStationProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const isPaused = useIsPaused();
  const paused = isPaused || animationPaused;

  const size = station.size ?? DEFAULT_SIZE;

  // Create station texture
  const stationTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 32, 32);

    // Amber border
    ctx.strokeStyle = STATION_COLOR;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 24, 24);

    // Amber center fill
    ctx.fillStyle = STATION_COLOR;
    ctx.fillRect(8, 8, 16, 16);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  // Cleanup texture on unmount
  useEffect(() => {
    return () => {
      stationTexture.dispose();
    };
  }, [stationTexture]);

  // Orbital parameters
  const orbitalParams = useMemo(() => ({
    radius: station.orbital_radius,
    period: station.orbital_period,
    initialAngle: (station.orbital_angle ?? 0) * (Math.PI / 180),
    inclination: (station.inclination ?? 0) * (Math.PI / 180),
  }), [station.orbital_radius, station.orbital_period, station.orbital_angle, station.inclination]);

  // Animate orbital position
  useFrame(() => {
    if (!spriteRef.current || paused) return;

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
      spriteRef.current.position.set(x, y, adjustedZ);
    } else {
      spriteRef.current.position.set(x, 0, z);
    }

    // Report position for reticle tracking
    onPositionUpdate?.(spriteRef.current.position);
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick?.(station);
  }, [onClick, station]);

  return (
    <sprite
      ref={spriteRef}
      scale={[size, size, 1]}
      onClick={handleClick}
    >
      <spriteMaterial map={stationTexture} transparent />
    </sprite>
  );
}
