/**
 * PlanetRings - Ring system for planets (Saturn-style)
 *
 * Renders planet rings using a tube geometry that follows a circular path.
 * The rings appear as a visible line with thickness.
 */

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

// Constants (from legacy SystemScene)
const RING_COLOR = 0x7a9a9a; // Lighter teal shade
const RING_OPACITY = 0.8;
const TUBE_RADIUS = 0.15; // Thickness of the ring line
const RING_SIZE_RATIO = 1.5; // Ring is 1.5x the planet's visual radius
const CURVE_SEGMENTS = 64;
const TUBE_SEGMENTS = 8;

interface PlanetRingsProps {
  /** Planet visual size (diameter) */
  planetSize: number;
  /** Custom ring color */
  color?: number;
  /** Custom ring opacity */
  opacity?: number;
}

export function PlanetRings({
  planetSize,
  color = RING_COLOR,
  opacity = RING_OPACITY,
}: PlanetRingsProps) {
  // Ring radius is based on planet's visual radius
  const ringRadius = (planetSize / 2) * RING_SIZE_RATIO;

  // Create the tube geometry that follows a circular path
  const geometry = useMemo(() => {
    // Create a circular path in the XZ plane
    const curve = new THREE.EllipseCurve(0, 0, ringRadius, ringRadius, 0, 2 * Math.PI, false, 0);
    const points2D = curve.getPoints(CURVE_SEGMENTS);
    const points3D = points2D.map(p => new THREE.Vector3(p.x, 0, p.y));

    // Create a closed CatmullRomCurve3 from the points
    const tubePath = new THREE.CatmullRomCurve3(points3D, true);

    return new THREE.TubeGeometry(tubePath, CURVE_SEGMENTS, TUBE_RADIUS, TUBE_SEGMENTS, true);
  }, [ringRadius]);

  // Cleanup geometry on unmount or when ringRadius changes
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color={threeColor}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}
