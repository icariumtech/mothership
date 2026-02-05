/**
 * useCameraAnimation - Generic camera animation infrastructure
 *
 * Provides reusable animation system for all camera hooks (Galaxy, System, Orbit).
 * Handles animation state, easing, interpolation, fade effects, and RAF loop.
 */

import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from './useSceneStore';

// ============================================================================
// Easing Functions
// ============================================================================

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeInCubic(t: number): number {
  return t * t * t;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ============================================================================
// Types
// ============================================================================

interface AnimationState {
  active: boolean;
  startTime: number;
  duration: number;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  easing: (t: number) => number;
  resolve: (() => void) | null;
  trackTarget: boolean; // Whether to track moving target
  targetGetter?: () => THREE.Vector3; // Dynamic target getter
  fadeIn: boolean; // Whether to fade in scene during animation
  fadeOut: boolean; // Whether to fade out scene during animation
  opacity: number; // Current scene opacity (0-1)
}

export interface AnimationOptions {
  /** Whether to track a moving target during animation */
  trackTarget?: boolean;
  /** Function to get current target position (for moving targets) */
  targetGetter?: () => THREE.Vector3;
  /** Override start target (default: origin) */
  startTarget?: THREE.Vector3;
  /** Enable fade-in during animation */
  fadeIn?: boolean;
  /** Enable fade-out during animation */
  fadeOut?: boolean;
}

export interface UseCameraAnimationReturn {
  /** Start a camera animation */
  startAnimation: (
    endPos: THREE.Vector3,
    endTarget: THREE.Vector3,
    duration: number,
    easing: (t: number) => number,
    options?: AnimationOptions
  ) => Promise<void>;
  /** Cancel any active animation */
  cancelAnimation: () => void;
  /** Check if animation is active */
  isAnimating: () => boolean;
  /** Get current scene opacity (for fade effects) */
  getSceneOpacity: () => number;
  /** Set scene opacity directly */
  setSceneOpacity: (opacity: number) => void;
  /** Instantly position camera without animation */
  positionCamera: (pos: THREE.Vector3, target: THREE.Vector3) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useCameraAnimation(): UseCameraAnimationReturn {
  const { camera } = useThree();
  const updateCamera = useSceneStore((state) => state.updateCamera);

  // Animation state
  const animationRef = useRef<AnimationState>({
    active: false,
    startTime: 0,
    duration: 0,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    easing: easeInOutQuad,
    resolve: null,
    trackTarget: false,
    fadeIn: false,
    fadeOut: false,
    opacity: 1, // Default to fully visible
  });

  // Process animation each frame
  useFrame(() => {
    const anim = animationRef.current;
    if (!anim.active) return;

    const elapsed = performance.now() - anim.startTime;
    const progress = Math.min(elapsed / anim.duration, 1);
    const eased = anim.easing(progress);

    // Get current target (may be moving)
    let currentTarget = anim.endTarget;
    if (anim.trackTarget && anim.targetGetter) {
      currentTarget = anim.targetGetter();
    }

    // Calculate end position relative to current target if tracking
    let endPos = anim.endPos;
    if (anim.trackTarget && anim.targetGetter) {
      const offset = anim.endPos.clone().sub(anim.endTarget);
      endPos = currentTarget.clone().add(offset);
    }

    // Interpolate position and target
    const pos = new THREE.Vector3().lerpVectors(anim.startPos, endPos, eased);
    const tgt = new THREE.Vector3().lerpVectors(anim.startTarget, currentTarget, eased);

    // Apply to camera
    camera.position.copy(pos);
    camera.lookAt(tgt);

    // Update store
    updateCamera(
      [camera.position.x, camera.position.y, camera.position.z],
      [tgt.x, tgt.y, tgt.z]
    );

    // Update opacity for fade effects
    if (anim.fadeIn) {
      anim.opacity = eased; // 0 → 1
    } else if (anim.fadeOut) {
      anim.opacity = 1 - eased; // 1 → 0
    }

    // Complete animation
    if (progress >= 1) {
      anim.active = false;
      if (anim.fadeIn) {
        anim.opacity = 1; // Ensure final opacity is exactly 1
        anim.fadeIn = false;
      } else if (anim.fadeOut) {
        anim.opacity = 0; // Ensure final opacity is exactly 0
        anim.fadeOut = false;
      }
      if (anim.resolve) {
        anim.resolve();
        anim.resolve = null;
      }
    }
  });

  // Start an animation
  const startAnimation = (
    endPos: THREE.Vector3,
    endTarget: THREE.Vector3,
    duration: number,
    easing: (t: number) => number,
    options?: AnimationOptions
  ): Promise<void> => {
    return new Promise((resolve) => {
      const anim = animationRef.current;

      // Cancel any existing animation
      if (anim.active && anim.resolve) {
        anim.resolve();
      }

      // Set up new animation
      anim.active = true;
      anim.startTime = performance.now();
      anim.duration = duration;
      anim.startPos.copy(camera.position);
      anim.endPos.copy(endPos);

      // Set start target (default to current camera target or origin)
      if (options?.startTarget) {
        anim.startTarget.copy(options.startTarget);
      } else {
        // Use current camera target from store
        const storeTarget = useSceneStore.getState().camera.target;
        anim.startTarget.set(storeTarget[0], storeTarget[1], storeTarget[2]);
      }

      anim.endTarget.copy(endTarget);
      anim.easing = easing;
      anim.resolve = resolve;
      anim.trackTarget = options?.trackTarget ?? false;
      anim.targetGetter = options?.targetGetter;

      // Set fade flags
      anim.fadeIn = options?.fadeIn ?? false;
      anim.fadeOut = options?.fadeOut ?? false;

      // Set initial opacity based on fade mode
      if (anim.fadeIn) {
        anim.opacity = 0;
      } else if (anim.fadeOut) {
        anim.opacity = 1;
      }
    });
  };

  // Cancel any active animation
  const cancelAnimation = (): void => {
    const anim = animationRef.current;
    if (anim.active && anim.resolve) {
      anim.resolve();
      anim.active = false;
    }
  };

  // Check if animation is active
  const isAnimating = (): boolean => {
    return animationRef.current.active;
  };

  // Get current scene opacity
  const getSceneOpacity = (): number => {
    return animationRef.current.opacity;
  };

  // Set scene opacity directly
  const setSceneOpacity = (opacity: number): void => {
    animationRef.current.opacity = Math.max(0, Math.min(1, opacity));
  };

  // Instantly position camera without animation
  const positionCamera = (pos: THREE.Vector3, target: THREE.Vector3): void => {
    cancelAnimation();
    camera.position.copy(pos);
    camera.lookAt(target);
    updateCamera(
      [camera.position.x, camera.position.y, camera.position.z],
      [target.x, target.y, target.z]
    );
  };

  return {
    startAnimation,
    cancelAnimation,
    isAnimating,
    getSceneOpacity,
    setSceneOpacity,
    positionCamera,
  };
}
