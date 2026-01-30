/**
 * TypewriterController - RAF-driven typewriter effect controller
 *
 * This component runs inside the R3F Canvas and updates Zustand typewriter
 * progress via useFrame, eliminating setTimeout-based animations that compete
 * with the Canvas RAF loop and cause stuttering.
 *
 * Usage: Add to GalaxyMap, SystemMap, or OrbitMap Canvas
 */

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSceneStore } from '@components/domain/maps/r3f/hooks/useSceneStore';
import { calculateTypewriterDuration } from '@/utils/typewriterUtils';

interface TypewriterControllerProps {
  /** Speed in ms per character (default: 15) */
  speed?: number;
}

export function TypewriterController({ speed = 15 }: TypewriterControllerProps) {
  const typewriterState = useSceneStore((state) => state.typewriter);
  const updateTypewriter = useSceneStore((state) => state.updateTypewriter);
  const completeTypewriter = useSceneStore((state) => state.completeTypewriter);

  const startTimeRef = useRef<number | null>(null);
  const durationRef = useRef<number>(0);

  // Reset start time when typewriter becomes active
  useEffect(() => {
    if (typewriterState.active && typewriterState.progress === 0) {
      startTimeRef.current = null; // Will be set on first frame
      durationRef.current = calculateTypewriterDuration(typewriterState.text, speed);
    }
  }, [typewriterState.active, typewriterState.progress, typewriterState.text, speed]);

  // Update typewriter progress on each frame
  useFrame((state) => {
    if (!typewriterState.active) {
      return;
    }

    // Initialize start time on first frame
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime * 1000; // Convert to ms
      return;
    }

    // Calculate elapsed time and progress
    const currentTime = state.clock.elapsedTime * 1000;
    const elapsed = currentTime - startTimeRef.current;
    const progress = Math.min(1, elapsed / durationRef.current);

    // Update progress in store
    if (progress < 1) {
      updateTypewriter(progress);
    } else {
      // Animation complete
      completeTypewriter();
      startTimeRef.current = null;
    }
  });

  // This component doesn't render anything
  return null;
}
