/**
 * OrbitElementPath - Orbital path line for moons and stations in orbit view
 *
 * Renders a circular orbit path with optional inclination.
 * Named differently from system/OrbitPath to avoid export collision.
 */

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

// Constants
const PATH_COLOR = 0x5a7a7a;
const PATH_OPACITY = 0.3;
const PATH_SEGMENTS = 128;

interface OrbitElementPathProps {
  /** Orbital radius */
  radius: number;
  /** Orbital inclination in degrees */
  inclination?: number;
}

export function OrbitElementPath({
  radius,
  inclination = 0,
}: OrbitElementPathProps) {
  const lineRef = useRef<THREE.Line>(null);
  const inclinationRad = (inclination ?? 0) * (Math.PI / 180);

  // Create orbit line geometry
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(
      0, 0,
      radius, radius,
      0, 2 * Math.PI,
      false,
      0
    );

    const points = curve.getPoints(PATH_SEGMENTS);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [radius]);

  // Create the material
  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: new THREE.Color(PATH_COLOR),
      transparent: true,
      opacity: PATH_OPACITY,
    });
  }, []);

  // Create the line object
  const line = useMemo(() => {
    const l = new THREE.Line(geometry, material);
    // Rotate to XZ plane with inclination
    // Using (π/2 - inclination) to match moon/station Y calculation
    l.rotation.set(Math.PI / 2 - inclinationRad, 0, 0);
    return l;
  }, [geometry, material, inclinationRad]);

  // Cleanup geometry and material on unmount
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return <primitive ref={lineRef} object={line} />;
}

// Alias for backwards compatibility
export { OrbitElementPath as OrbitPath };
