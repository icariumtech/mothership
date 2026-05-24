/**
 * OrbitalStation - Orbiting station sprite for orbit view
 *
 * Renders a station with:
 * - Procedural sprite texture (square icon)
 * - Orbital motion animation
 * - Click interaction for selection
 */

import { useRef, useMemo, useCallback, useEffect, type RefObject } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useIsPaused } from '../hooks/useSceneStore';
import type { StationData } from '@/types/orbitMap';
import { getOrbitIconSvg } from './OrbitIcons';

// Constants from legacy OrbitScene
const DEFAULT_SIZE = 1.5;
const STATION_COLOR = '#8b7355'; // Amber theme color

interface OrbitalStationProps {
  /** Station configuration data */
  station: StationData;
  /** Animation start time reference */
  /**
   * Animation start time ref. The parent (OrbitScene) re-anchors this on
   * resume so live elapsed time picks up continuously from the scrubbed
   * position.
   */
  startTimeRef: RefObject<number>;
  /**
   * Captured elapsed seconds when animation is frozen (owned by OrbitScene).
   * While paused, frame math reads this instead of live elapsed.
   */
  frozenElapsedRef?: RefObject<number | null>;
  /** Whether this station is selected */
  isSelected?: boolean;
  /** Callback when station is clicked */
  onClick?: (station: StationData) => void;
  /** Whether animation is paused */
  animationPaused?: boolean;
  /**
   * Accumulated scrub offset in **seconds of visualization time** (from
   * MapPlaybackControls). Added to elapsed time while paused so each station
   * advances proportional to its own orbital period.
   */
  scrubOffsetRef?: RefObject<number>;
  /** Position ref callback for reticle tracking */
  onPositionUpdate?: (position: THREE.Vector3) => void;
}

export function OrbitalStation({
  station,
  startTimeRef,
  frozenElapsedRef,
  isSelected: _isSelected,
  onClick,
  animationPaused = false,
  scrubOffsetRef,
  onPositionUpdate,
}: OrbitalStationProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const isPaused = useIsPaused();

  const size = station.size ?? DEFAULT_SIZE;

  // Create station texture and material with fade support
  const { texture, material, canvas } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Default: square-within-square fallback
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = STATION_COLOR;
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 48, 48);
    ctx.fillStyle = STATION_COLOR;
    ctx.fillRect(16, 16, 32, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0, // Start at 0, scene fade will bring to 1
    });
    (mat as any)._baseOpacity = 1.0;

    return { texture: tex, material: mat, canvas };
  }, []);

  // Async SVG icon load — overwrites canvas once image is ready
  useEffect(() => {
    if (!station.icon_type) return;
    const svg = getOrbitIconSvg(station.icon_type);
    if (!svg) return;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    let cancelled = false;

    img.onload = () => {
      if (cancelled) return;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 64, 64);
      ctx.drawImage(img, 0, 0, 64, 64);
      URL.revokeObjectURL(url);
      texture.needsUpdate = true;
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [station.icon_type, canvas, texture]);

  // Cleanup texture and material on unmount
  useEffect(() => {
    return () => {
      texture.dispose();
      material.dispose();
    };
  }, [texture, material]);

  // Orbital parameters
  const orbitalParams = useMemo(() => ({
    radius: station.orbital_radius,
    period: station.orbital_period,
    initialAngle: (station.orbital_angle ?? 0) * (Math.PI / 180),
    inclination: (station.inclination ?? 0) * (Math.PI / 180),
  }), [station.orbital_radius, station.orbital_period, station.orbital_angle, station.inclination]);

  // Animate orbital position. Pause/resume + scrub bookkeeping is owned by
  // OrbitScene (frozenElapsedRef + startTimeRef re-anchor on resume).
  useFrame(() => {
    if (!spriteRef.current) return;
    if (isPaused) return;

    const elapsedSeconds =
      animationPaused && frozenElapsedRef?.current != null
        ? frozenElapsedRef.current
        : (Date.now() - startTimeRef.current) / 1000;
    const scrubSeconds = animationPaused ? (scrubOffsetRef?.current ?? 0) : 0;

    const orbitalSpeed = (2 * Math.PI) / orbitalParams.period;
    const currentAngle =
      orbitalParams.initialAngle + orbitalSpeed * (elapsedSeconds + scrubSeconds);

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
      <primitive object={material} attach="material" />
    </sprite>
  );
}
