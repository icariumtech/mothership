/**
 * useRoomRevealAnimations — hook wrapping scheduleReveal with timer side effects.
 *
 * Calls scheduleReveal on visibility changes, sets per-room clear timers,
 * and returns the current animation-state Map to the renderer.
 *
 * Policy / mechanism split:
 * - `enabled: boolean` is the only policy knob (caller decides when to animate).
 *   The renderer passes `!isGM`; a future "reduced motion" toggle can flip the same flag.
 * - `isGM` is NOT baked into this hook.
 *
 * SSE-echo cancellation: if a new animation arrives for a room that already has
 * an in-flight clear timer, the old timer is cancelled and a new one is scheduled.
 * This prevents stale-timer races when SSE echoes the same visibility update.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GridRoom, RoomVisibilityState } from '../../../../types/encounterMap';
import {
  scheduleReveal,
  DEFAULT_ANIMATION_DURATION_MS,
  RevealAnim,
} from './scheduleReveal';

export interface UseRoomRevealAnimationsOpts {
  visibility: RoomVisibilityState | undefined;
  rooms: GridRoom[];
  mapIdentity: string;
  /** When false: return empty Map, run no timers, cancel any in-flight timers. */
  enabled: boolean;
}

/**
 * Returns a Map<roomId, 'revealing'|'hiding'> representing which rooms are
 * currently mid-animation. An entry is present while the CSS animation plays;
 * when the clear timer fires the entry is deleted, restoring normal rendering.
 */
export function useRoomRevealAnimations({
  visibility,
  rooms,
  mapIdentity,
  enabled,
}: UseRoomRevealAnimationsOpts): Map<string, RevealAnim> {
  const [animState, setAnimState] = useState<Map<string, RevealAnim>>(new Map());

  // Track previous visibility and mapIdentity across renders
  const prevVisibilityRef = useRef<RoomVisibilityState | undefined>(undefined);
  const prevMapIdentityRef = useRef<string | undefined>(undefined);

  // Per-room clear timers — stored in a ref so that the effect's cleanup
  // cannot cancel a legitimate in-flight animation for a *different* room.
  const clearTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Stable helper to cancel all timers and clear anim state
  const cancelAll = useCallback(() => {
    clearTimersRef.current.forEach(t => clearTimeout(t));
    clearTimersRef.current.clear();
    setAnimState(new Map());
  }, []);

  // Main effect: runs when visibility or mapIdentity changes
  useEffect(() => {
    const prev = prevVisibilityRef.current;
    const prevMapKey = prevMapIdentityRef.current;

    // Always update refs to track the latest state
    prevVisibilityRef.current = visibility;
    prevMapIdentityRef.current = mapIdentity;

    if (!enabled) {
      cancelAll();
      return;
    }

    // scheduleReveal handles: mapIdentity changed → [], prev/curr undefined → []
    const steps = scheduleReveal(prev, visibility, rooms, mapIdentity, prevMapKey);

    if (steps.length === 0) return;

    // Apply new anim entries
    setAnimState(prev => {
      const next = new Map(prev);
      for (const step of steps) {
        next.set(step.roomId, step.anim);
      }
      return next;
    });

    // Schedule per-room clear timers.
    // Clear delay = animationDurationMs + stagger delay already baked into delayMs
    // + the delayMs itself + a small buffer (50ms) so the CSS animation finishes.
    for (const step of steps) {
      // Cancel any existing timer for this room before setting a new one
      const existing = clearTimersRef.current.get(step.roomId);
      if (existing !== undefined) clearTimeout(existing);

      const clearDelay = step.delayMs + DEFAULT_ANIMATION_DURATION_MS + 50;
      const timer = setTimeout(() => {
        clearTimersRef.current.delete(step.roomId);
        setAnimState(prev => {
          const next = new Map(prev);
          next.delete(step.roomId);
          return next;
        });
      }, clearDelay);

      clearTimersRef.current.set(step.roomId, timer);
    }
  }, [visibility, mapIdentity, rooms, enabled, cancelAll]);

  // Cleanup on unmount: cancel all in-flight timers
  useEffect(() => {
    const timers = clearTimersRef.current;
    return () => {
      timers.forEach(t => clearTimeout(t));
    };
  }, []);

  // When disabled: always return an empty Map (no need to hold a stale state)
  if (!enabled) return new Map();

  return animState;
}
