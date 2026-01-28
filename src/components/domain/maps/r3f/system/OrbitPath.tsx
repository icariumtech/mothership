/**
 * OrbitPath - Orbital path line for planets
 *
 * Renders a circular line showing the orbital path of a planet.
 * The line is rotated to match the planet's orbital inclination.
 */

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { BodyData, OrbitSettings } from '@/types/systemMap';

// Constants (from legacy SystemScene)
const CURVE_POINTS = 128;
const DEFAULT_OPACITY = 0.45;
const DEFAULT_COLOR = 0x5a7a7a;

interface OrbitPathProps {
  /** Body data containing orbital radius and inclination */
  body: BodyData;
  /** Orbit display settings */
  settings?: OrbitSettings;
}

export function OrbitPath({ body, settings }: OrbitPathProps) {
  const color = settings?.color ?? DEFAULT_COLOR;
  const opacity = settings?.opacity ?? DEFAULT_OPACITY;
  const inclinationRad = (body.inclination ?? 0) * (Math.PI / 180);
  const lineRef = useRef<THREE.Line>(null);

  // Create the orbit line geometry
  const geometry = useMemo(() => {
    const curve = new THREE.EllipseCurve(
      0, 0,
      body.orbital_radius, body.orbital_radius,
      0, 2 * Math.PI,
      false,
      0
    );

    const points = curve.getPoints(CURVE_POINTS);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [body.orbital_radius]);

  // Create the material
  const material = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: opacity,
    });
  }, [color, opacity]);

  // Create the line object
  const line = useMemo(() => {
    const l = new THREE.Line(geometry, material);
    l.rotation.set(Math.PI / 2, inclinationRad, 0);
    return l;
  }, [geometry, material, inclinationRad]);

  // Cleanup geometry and material on unmount or when dependencies change
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return <primitive ref={lineRef} object={line} />;
}
