/**
 * Nebula - Volumetric nebula visualization using particle sprites
 *
 * Supports different nebula types with appropriate animations:
 * - emission: Pulsing glow
 * - planetary: Slow rotation
 * - reflection: Subtle shimmer
 * - dark: Static opacity
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProceduralTexture } from '../hooks/useProceduralTexture';
import { useIsPaused } from '../hooks/useSceneStore';
import type { Nebula as NebulaData } from '@/types/starMap';

interface NebulaParticle {
  position: THREE.Vector3;
  baseOpacity: number;
  pulseOffset: number;
  rotationSpeed: number;
  size: number;
  // Store initial offset from center for rotation
  offsetFromCenter: THREE.Vector3;
}

interface NebulaProps {
  /** Nebula data from API */
  data: NebulaData;
}

export function Nebula({ data }: NebulaProps) {
  const groupRef = useRef<THREE.Group>(null);
  const spritesRef = useRef<THREE.Sprite[]>([]);
  const isPaused = useIsPaused();
  const frameCounter = useRef(0);

  // Get procedural nebula texture
  const nebulaTexture = useProceduralTexture('nebula');

  // Center position
  const centerPosition = useMemo(
    () => new THREE.Vector3(data.position[0], data.position[1], data.position[2]),
    [data.position]
  );

  // Generate particles
  const particles = useMemo<NebulaParticle[]>(() => {
    const result: NebulaParticle[] = [];
    const targetRadius = data.size * 0.85;
    const shellThickness = data.size * 0.25;

    for (let i = 0; i < data.particle_count; i++) {
      // Spherical distribution within shell
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      const radiusOffset = (Math.random() - 0.5) * shellThickness;
      const radius = targetRadius + radiusOffset;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      const offsetFromCenter = new THREE.Vector3(x, y, z);
      const position = centerPosition.clone().add(offsetFromCenter);

      // Calculate opacity based on shell position (brighter at target radius)
      const distanceFromFront = Math.abs(radiusOffset);
      const brightnessFactor = 1.0 - distanceFromFront / (shellThickness / 2);
      const particleOpacity =
        data.opacity * Math.max(0.3, brightnessFactor) * (0.6 + Math.random() * 0.4);

      result.push({
        position,
        baseOpacity: particleOpacity,
        pulseOffset: Math.random() * Math.PI * 2,
        rotationSpeed: 0.01 + Math.random() * 0.02,
        size: (data.size / 5) * (0.5 + Math.random() * 0.8),
        offsetFromCenter,
      });
    }

    return result;
  }, [data, centerPosition]);

  // Animate nebula particles (every 3rd frame for performance)
  useFrame(() => {
    if (isPaused) return;

    frameCounter.current++;
    if (frameCounter.current % 3 !== 0) return;

    const time = performance.now() * 0.001;
    const sprites = spritesRef.current;

    sprites.forEach((sprite, i) => {
      if (!sprite?.material) return;

      const particle = particles[i];
      if (!particle) return;

      const material = sprite.material as THREE.SpriteMaterial;

      switch (data.type) {
        case 'emission': {
          // Pulsing glow
          const pulseSpeed = 0.5;
          const pulseAmount = 0.15;
          const pulse = Math.sin(time * pulseSpeed + particle.pulseOffset) * pulseAmount;
          material.opacity = particle.baseOpacity * (1.0 + pulse);
          break;
        }

        case 'planetary': {
          // Slow rotation around center
          const angle = time * particle.rotationSpeed * 0.1;
          const cosAngle = Math.cos(angle);
          const sinAngle = Math.sin(angle);

          const offsetX = particle.offsetFromCenter.x;
          const offsetZ = particle.offsetFromCenter.z;

          const rotatedX = offsetX * cosAngle - offsetZ * sinAngle;
          const rotatedZ = offsetX * sinAngle + offsetZ * cosAngle;

          sprite.position.set(
            centerPosition.x + rotatedX,
            centerPosition.y + particle.offsetFromCenter.y,
            centerPosition.z + rotatedZ
          );
          break;
        }

        case 'reflection': {
          // Subtle shimmer
          const pulseSpeed = 0.3;
          const pulseAmount = 0.08;
          const pulse = Math.sin(time * pulseSpeed + particle.pulseOffset) * pulseAmount;
          material.opacity = particle.baseOpacity * (1.0 + pulse);
          break;
        }

        // 'dark' type has no animation
      }
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
      {particles.map((particle, i) => (
        <sprite
          key={i}
          ref={setSprite(i)}
          position={particle.position}
          scale={[particle.size, particle.size, 1]}
        >
          <spriteMaterial
            map={nebulaTexture}
            color={data.color}
            transparent
            opacity={particle.baseOpacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}

/**
 * Nebulae - Renders all nebulae from data
 */
interface NebulaeProps {
  /** Array of nebula data */
  nebulae: NebulaData[];
}

export function Nebulae({ nebulae }: NebulaeProps) {
  return (
    <group>
      {nebulae.map((nebula, index) => (
        <Nebula key={`${nebula.name}-${index}`} data={nebula} />
      ))}
    </group>
  );
}
