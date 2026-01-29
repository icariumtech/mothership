/**
 * Sun - Distant sun visual with directional light for orbit view
 *
 * Renders the sun as seen from planetary orbit with:
 * - Multi-layered glow spheres for visual effect
 * - Lens flare sprite
 * - Directional light for planet illumination with shadows
 */

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Constants from legacy OrbitScene
const SUN_DISTANCE = 200;
const CORE_SIZE = 5;
const INNER_GLOW_SIZE = 8;
const MIDDLE_GLOW_SIZE = 14;
const OUTER_GLOW_SIZE = 22;
const FLARE_SIZE = 60;

interface SunProps {
  /** Sun declination angle in degrees (affects vertical position) */
  declination?: number;
  /** Directional light intensity */
  lightIntensity?: number;
  /** Enable shadow casting */
  castShadow?: boolean;
}

export function Sun({
  declination = 0,
  lightIntensity = 4.0,
  castShadow = true,
}: SunProps) {
  const groupRef = useRef<THREE.Group>(null);
  const flareRef = useRef<THREE.Sprite>(null);

  // Create sun flare texture
  const flareTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.08, 'rgba(255, 255, 220, 0.9)');
    gradient.addColorStop(0.2, 'rgba(255, 238, 136, 0.5)');
    gradient.addColorStop(0.4, 'rgba(255, 200, 80, 0.2)');
    gradient.addColorStop(0.7, 'rgba(255, 170, 50, 0.05)');
    gradient.addColorStop(1, 'rgba(255, 150, 30, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  // Cleanup texture on unmount
  useEffect(() => {
    return () => {
      flareTexture.dispose();
    };
  }, [flareTexture]);

  // Calculate sun position based on declination
  const sunPosition = useMemo<[number, number, number]>(() => {
    let direction = new THREE.Vector3(-1, 0, 0);

    if (declination !== 0) {
      const declinationRad = declination * (Math.PI / 180);
      direction.y = Math.sin(declinationRad);
      const horizontalScale = Math.cos(declinationRad);
      direction.x *= horizontalScale;
      direction.z *= horizontalScale;
    }
    direction.normalize();

    const position = direction.multiplyScalar(SUN_DISTANCE);
    return [position.x, position.y, position.z];
  }, [declination]);

  // Subtle flare animation
  useFrame(({ clock }) => {
    if (flareRef.current) {
      const scale = FLARE_SIZE + Math.sin(clock.getElapsedTime() * 0.5) * 2;
      flareRef.current.scale.set(scale, scale, 1);
    }
  });

  return (
    <>
      {/* Sun visual group */}
      <group ref={groupRef} position={sunPosition}>
        {/* Core sun sphere - pure white */}
        <mesh>
          <sphereGeometry args={[CORE_SIZE, 32, 32]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>

        {/* Inner glow layer */}
        <mesh>
          <sphereGeometry args={[INNER_GLOW_SIZE, 32, 32]} />
          <meshBasicMaterial
            color={0xffffdd}
            transparent
            opacity={0.7}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Middle glow layer */}
        <mesh>
          <sphereGeometry args={[MIDDLE_GLOW_SIZE, 32, 32]} />
          <meshBasicMaterial
            color={0xffee88}
            transparent
            opacity={0.4}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Outer glow layer (corona) */}
        <mesh>
          <sphereGeometry args={[OUTER_GLOW_SIZE, 32, 32]} />
          <meshBasicMaterial
            color={0xffcc44}
            transparent
            opacity={0.2}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Sun flare sprite */}
        <sprite ref={flareRef} scale={[FLARE_SIZE, FLARE_SIZE, 1]}>
          <spriteMaterial
            map={flareTexture}
            transparent
            blending={THREE.AdditiveBlending}
            opacity={1.0}
          />
        </sprite>
      </group>

      {/* Directional light for planet illumination */}
      <directionalLight
        position={sunPosition}
        color={0xfffff0}
        intensity={lightIntensity}
        castShadow={castShadow}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={50}
        shadow-camera-far={400}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.001}
      />
    </>
  );
}
