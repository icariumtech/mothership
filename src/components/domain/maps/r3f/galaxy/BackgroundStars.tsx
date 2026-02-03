/**
 * BackgroundStars - Decorative starfield for galaxy view
 *
 * Creates a spherical shell of small star sprites that provide
 * atmospheric depth to the galaxy visualization.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProceduralTexture } from '../hooks/useProceduralTexture';
import { useIsPaused } from '../hooks/useSceneStore';

interface BackgroundStarsProps {
  /** Number of background stars to generate */
  count?: number;
  /** Inner radius of the star shell */
  minRadius?: number;
  /** Outer radius of the star shell */
  maxRadius?: number;
  /** Whether to animate star twinkling */
  animated?: boolean;
  /** Scene opacity for fade-in effect (0-1) */
  opacity?: number;
}

interface StarInstance {
  position: THREE.Vector3;
  baseOpacity: number;
  pulseOffset: number;
  size: number;
  rotation: number;
}

export function BackgroundStars({
  count = 5000,
  minRadius = 150,
  maxRadius = 450,
  animated = true,
  opacity = 1,
}: BackgroundStarsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const spritesRef = useRef<THREE.Sprite[]>([]);
  const isPaused = useIsPaused();
  const frameCounter = useRef(0);

  // Get procedural star texture
  const starTexture = useProceduralTexture('star');

  // Generate star instances once
  const starInstances = useMemo<StarInstance[]>(() => {
    const instances: StarInstance[] = [];
    const radiusRange = maxRadius - minRadius;

    for (let i = 0; i < count; i++) {
      // Distribute on spherical shell
      const radius = minRadius + Math.random() * radiusRange;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const position = new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi)
      );

      instances.push({
        position,
        baseOpacity: 0.4 + Math.random() * 0.4,
        pulseOffset: Math.random() * Math.PI * 2,
        size: 0.5 + Math.random() * 1.5,
        rotation: Math.random() * Math.PI * 2,
      });
    }

    return instances;
  }, [count, minRadius, maxRadius]);

  // Animate twinkling (every 3rd frame for performance)
  useFrame(() => {
    if (!animated || isPaused) return;

    frameCounter.current++;
    if (frameCounter.current % 3 !== 0) return;

    const time = performance.now() * 0.001;
    const sprites = spritesRef.current;

    sprites.forEach((sprite, i) => {
      if (!sprite?.material) return;

      const instance = starInstances[i];
      if (!instance) return;

      // Subtle twinkling
      const pulseSpeed = 0.3;
      const pulseAmount = 0.15;
      const pulse = Math.sin(time * pulseSpeed + instance.pulseOffset) * pulseAmount;
      (sprite.material as THREE.SpriteMaterial).opacity =
        instance.baseOpacity * (1.0 + pulse) * opacity;
    });
  });

  // Store sprite refs
  const setSprite = (index: number) => (el: THREE.Sprite | null) => {
    if (el) {
      spritesRef.current[index] = el;
    }
  };

  return (
    <group ref={groupRef}>
      {starInstances.map((instance, i) => (
        <sprite
          key={i}
          ref={setSprite(i)}
          position={instance.position}
          scale={[instance.size, instance.size, 1]}
        >
          <spriteMaterial
            map={starTexture}
            color={0xffffff}
            transparent
            opacity={instance.baseOpacity * opacity}
            blending={THREE.AdditiveBlending}
            rotation={instance.rotation}
          />
        </sprite>
      ))}
    </group>
  );
}
