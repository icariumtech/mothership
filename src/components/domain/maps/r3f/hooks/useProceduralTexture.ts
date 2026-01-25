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
  createNebulaTexture,
  createGlowTexture,
} from '../shared/textureUtils';

export type TextureType = 'star' | 'reticle' | 'nebula' | 'glow';

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
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  const texture = useMemo(() => {
    switch (type) {
      case 'star':
        return createStarTexture(size ?? 128);
      case 'reticle':
        return createReticleTexture(size ?? 256);
      case 'nebula':
        return createNebulaTexture(size ?? 64);
      case 'glow':
        return createGlowTexture(size ?? 128);
      default:
        return createStarTexture(size ?? 128);
    }
  }, [type, size]);

  // Store reference for cleanup
  textureRef.current = texture;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      textureRef.current?.dispose();
    };
  }, []);

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
        case 'nebula':
          texture = createNebulaTexture(config.size ?? 64);
          break;
        case 'glow':
          texture = createGlowTexture(config.size ?? 128);
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
