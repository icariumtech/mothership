/**
 * PostProcessing - Configurable post-processing effects for R3F scenes
 *
 * Provides a foundation for visual effects like bloom, chromatic aberration, etc.
 * Effects are disabled by default and can be enabled via props.
 *
 * Usage:
 * ```tsx
 * <Canvas>
 *   <Scene />
 *   <PostProcessing
 *     enabled={true}
 *     bloom={{ intensity: 0.5, luminanceThreshold: 0.9 }}
 *   />
 * </Canvas>
 * ```
 *
 * Future enhancements:
 * - Add more effects (chromatic aberration, vignette, etc.)
 * - Add presets for different visual styles (holographic, retro CRT, etc.)
 * - Add runtime toggle for performance testing
 */

import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

export interface PostProcessingProps {
  /** Enable/disable all post-processing effects */
  enabled?: boolean;

  /** Bloom effect configuration (set to enable bloom) */
  bloom?: {
    /** Bloom intensity (0-1), default 0.5 */
    intensity?: number;
    /** Luminance threshold (0-1), default 0.9 */
    luminanceThreshold?: number;
    /** Luminance smoothing (0-1), default 0.025 */
    luminanceSmoothing?: number;
    /** Blend function, default BlendFunction.ADD */
    blendFunction?: BlendFunction;
  } | boolean;
}

/**
 * Post-processing effects wrapper
 *
 * @example
 * // Enable bloom with default settings
 * <PostProcessing enabled bloom />
 *
 * @example
 * // Enable bloom with custom settings
 * <PostProcessing
 *   enabled
 *   bloom={{
 *     intensity: 0.7,
 *     luminanceThreshold: 0.8
 *   }}
 * />
 *
 * @example
 * // Disabled (default) - no performance impact
 * <PostProcessing />
 */
export function PostProcessing({ enabled = false, bloom }: PostProcessingProps) {
  // If not enabled, render nothing (no performance impact)
  if (!enabled || !bloom) {
    return null;
  }

  // Parse bloom config
  const bloomConfig = typeof bloom === 'boolean' ? {} : bloom;
  const {
    intensity = 0.5,
    luminanceThreshold = 0.9,
    luminanceSmoothing = 0.025,
    blendFunction = BlendFunction.ADD,
  } = bloomConfig;

  return (
    <EffectComposer>
      <Bloom
        intensity={intensity}
        luminanceThreshold={luminanceThreshold}
        luminanceSmoothing={luminanceSmoothing}
        blendFunction={blendFunction}
      />
    </EffectComposer>
  );
}
