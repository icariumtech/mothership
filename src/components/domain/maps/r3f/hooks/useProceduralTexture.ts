/**
 * Hook for generating and caching procedural textures
 *
 * Uses useMemo to ensure textures are only generated once per configuration.
 * Textures are automatically disposed when the component unmounts.
 */

import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  createStarTexture,
  createReticleTexture,
  createReticleCornersTexture,
  createReticleOuterRingTexture,
  createReticleInnerRingTexture,
  createNebulaTexture,
  createGlowTexture,
  createPlanetTexture,
} from '../shared/textureUtils';

export type TextureType =
  | 'star'
  | 'reticle'
  | 'reticle-corners'
  | 'reticle-outer-ring'
  | 'reticle-inner-ring'
  | 'nebula'
  | 'glow'
  | 'planet';

interface TextureConfig {
  type: TextureType;
  size?: number;
}

/**
 * Generate a procedural texture with automatic cleanup
 *
 * @param type - Type of texture to generate
 * @param size - Optional size override (default varies by type)
 * @returns THREE.CanvasTexture
 *
 * @example
 * const starTexture = useProceduralTexture('star');
 * const largeReticle = useProceduralTexture('reticle', 512);
 */
export function useProceduralTexture(
  type: TextureType,
  size?: number
): THREE.CanvasTexture {
  const previousTextureRef = useRef<THREE.CanvasTexture | null>(null);

  const texture = useMemo(() => {
    switch (type) {
      case 'star':
        return createStarTexture(size ?? 128);
      case 'reticle':
        return createReticleTexture(size ?? 256);
      case 'reticle-corners':
        return createReticleCornersTexture(size ?? 256);
      case 'reticle-outer-ring':
        return createReticleOuterRingTexture(size ?? 256);
      case 'reticle-inner-ring':
        return createReticleInnerRingTexture(size ?? 256);
      case 'nebula':
        return createNebulaTexture(size ?? 64);
      case 'glow':
        return createGlowTexture(size ?? 128);
      case 'planet':
        return createPlanetTexture(size ?? 64);
      default:
        return createStarTexture(size ?? 128);
    }
  }, [type, size]);

  // Cleanup previous texture when type/size changes, and cleanup on unmount
  useEffect(() => {
    // Dispose previous texture if it exists and is different
    if (previousTextureRef.current && previousTextureRef.current !== texture) {
      previousTextureRef.current.dispose();
    }
    previousTextureRef.current = texture;

    return () => {
      texture.dispose();
    };
  }, [texture]);

  return texture;
}

/**
 * Generate multiple procedural textures at once
 *
 * @param configs - Array of texture configurations
 * @returns Record of textures keyed by type
 *
 * @example
 * const textures = useProceduralTextures([
 *   { type: 'star' },
 *   { type: 'reticle', size: 512 },
 * ]);
 * // textures.star, textures.reticle
 */
export function useProceduralTextures(
  configs: TextureConfig[]
): Record<TextureType, THREE.CanvasTexture> {
  const texturesRef = useRef<THREE.CanvasTexture[]>([]);

  const textures = useMemo(() => {
    const result: Partial<Record<TextureType, THREE.CanvasTexture>> = {};

    configs.forEach((config) => {
      let texture: THREE.CanvasTexture;
      switch (config.type) {
        case 'star':
          texture = createStarTexture(config.size ?? 128);
          break;
        case 'reticle':
          texture = createReticleTexture(config.size ?? 256);
          break;
        case 'reticle-corners':
          texture = createReticleCornersTexture(config.size ?? 256);
          break;
        case 'reticle-outer-ring':
          texture = createReticleOuterRingTexture(config.size ?? 256);
          break;
        case 'reticle-inner-ring':
          texture = createReticleInnerRingTexture(config.size ?? 256);
          break;
        case 'nebula':
          texture = createNebulaTexture(config.size ?? 64);
          break;
        case 'glow':
          texture = createGlowTexture(config.size ?? 128);
          break;
        case 'planet':
          texture = createPlanetTexture(config.size ?? 64);
          break;
        default:
          texture = createStarTexture(config.size ?? 128);
      }
      result[config.type] = texture;
      texturesRef.current.push(texture);
    });

    return result as Record<TextureType, THREE.CanvasTexture>;
    // Stringify configs for dependency comparison
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(configs)]);

  // Cleanup all textures on unmount
  useEffect(() => {
    return () => {
      texturesRef.current.forEach((texture) => texture.dispose());
      texturesRef.current = [];
    };
  }, []);

  return textures;
}

/**
 * Hook for managing a single texture that may change
 * Handles disposal of old textures when replaced
 */
export function useManagedTexture(
  textureOrUrl: THREE.Texture | string | null
): THREE.Texture | null {
  const previousTextureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    // Dispose previous texture if it was created internally
    return () => {
      if (previousTextureRef.current) {
        previousTextureRef.current.dispose();
      }
    };
  }, [textureOrUrl]);

  if (typeof textureOrUrl === 'string') {
    // URL provided - would need TextureLoader, but we keep it simple
    // In R3F, prefer using drei's useTexture hook for URLs
    return null;
  }

  previousTextureRef.current = textureOrUrl;
  return textureOrUrl;
}
