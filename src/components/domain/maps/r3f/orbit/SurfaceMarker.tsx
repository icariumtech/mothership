/**
 * SurfaceMarker - Surface marker sprite for orbit view
 *
 * Renders a marker positioned on the planet surface using lat/lon coordinates.
 * Rotates with the planet when the planet spins and accounts for axial tilt.
 */

import { useRef, useMemo, useCallback, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { SurfaceMarkerData } from '@/types/orbitMap';

// Constants
const MARKER_SIZE = 2;
const MARKER_COLOR = '#5a7a7a'; // Teal theme color
const HEIGHT_OFFSET = 0.5; // Offset above planet surface

interface SurfaceMarkerProps {
  /** Marker configuration data */
  marker: SurfaceMarkerData;
  /** Planet radius for positioning */
  planetRadius: number;
  /** Axial tilt in radians */
  axialTilt?: number;
  /** Reference to planet rotation for synchronization */
  rotationRef?: React.RefObject<number>;
  /** Whether this marker is selected */
  isSelected?: boolean;
  /** Callback when marker is clicked */
  onClick?: (marker: SurfaceMarkerData) => void;
  /** Whether animation is paused */
  animationPaused?: boolean;
  /** Position ref callback for reticle tracking */
  onPositionUpdate?: (position: THREE.Vector3) => void;
}

/**
 * Convert latitude/longitude to 3D position on a sphere
 */
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export function SurfaceMarker({
  marker,
  planetRadius,
  axialTilt = 0,
  rotationRef,
  isSelected: _isSelected,
  onClick,
  animationPaused: _animationPaused = false,
  onPositionUpdate,
}: SurfaceMarkerProps) {
  const spriteRef = useRef<THREE.Sprite>(null);

  // Create marker texture and material with fade support
  const { texture, material } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;

    // Black circle background
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(12, 12, 10, 0, Math.PI * 2);
    ctx.fill();

    // Teal circle outline
    ctx.strokeStyle = MARKER_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(12, 12, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Teal center square
    ctx.fillStyle = MARKER_COLOR;
    ctx.fillRect(8, 8, 8, 8);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;

    // Create material with _baseOpacity for scene fade
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0, // Start at 0, scene fade will bring to 1
    });
    (mat as any)._baseOpacity = 1.0;

    return { texture: tex, material: mat };
  }, []);

  // Cleanup texture and material on unmount
  useEffect(() => {
    return () => {
      texture.dispose();
      material.dispose();
    };
  }, [texture, material]);

  // Calculate base position (before rotation)
  const basePosition = useMemo(() => {
    return latLonToVector3(
      marker.latitude,
      marker.longitude,
      planetRadius + HEIGHT_OFFSET
    );
  }, [marker.latitude, marker.longitude, planetRadius]);

  // Rotation matrices for applying planet rotation and tilt
  const yRotationMatrix = useMemo(() => new THREE.Matrix4(), []);
  const zTiltMatrix = useMemo(() => new THREE.Matrix4(), []);

  // Pre-compute tilt matrix (only changes when axialTilt changes)
  useEffect(() => {
    zTiltMatrix.makeRotationZ(axialTilt);
  }, [axialTilt, zTiltMatrix]);

  // Update position with planet rotation and tilt
  useFrame(() => {
    if (!spriteRef.current || !rotationRef) return;

    // Apply rotations in same order as CentralPlanet:
    // 1. First Y rotation (planet spin on local axis)
    // 2. Then Z rotation (axial tilt)
    yRotationMatrix.makeRotationY(rotationRef.current);

    const rotatedPosition = basePosition
      .clone()
      .applyMatrix4(yRotationMatrix)
      .applyMatrix4(zTiltMatrix);

    spriteRef.current.position.copy(rotatedPosition);

    // Report position for reticle tracking
    onPositionUpdate?.(spriteRef.current.position);
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick?.(marker);
  }, [onClick, marker]);

  return (
    <sprite
      ref={spriteRef}
      position={basePosition.toArray()}
      scale={[MARKER_SIZE, MARKER_SIZE, 1]}
      onClick={handleClick}
    >
      <primitive object={material} attach="material" />
    </sprite>
  );
}
