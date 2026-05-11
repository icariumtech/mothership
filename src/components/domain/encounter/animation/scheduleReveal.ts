/**
 * scheduleReveal — pure cascade scheduler for room reveal/hide animations.
 *
 * Same inputs → same outputs. No React, no side effects, no timers.
 * The hook (useRoomRevealAnimations) calls this and owns the setTimeout plumbing.
 *
 * Strategy parameter shape is future-friendly: only 'y-ascending' ships now.
 * New strategies (center-out, player-position-out, instant) plug in later
 * without breaking callers.
 */

import { GridRoom, RoomVisibilityState } from '../../../../types/encounterMap';

export type RevealAnim = 'revealing' | 'hiding';

export interface RevealStep {
  roomId: string;
  anim: RevealAnim;
  /** Delay before starting the CSS animation (ms) */
  delayMs: number;
}

export type CascadeStrategy = 'y-ascending';

export interface ScheduleRevealOpts {
  strategy?: CascadeStrategy;
  /** Delay for the first room (ms). Default 50. */
  baseDelayMs?: number;
  /** Additional delay per position in the sorted order (ms). Default 75. */
  staggerMs?: number;
  /** CSS animation duration (ms). Used by the hook to compute clear timers.
   *  Stored here as a default so callers share one source of truth. Default 400. */
  animationDurationMs?: number;
}

// ---------------------------------------------------------------------------
// Defaults — kept as named constants so the hook and renderer can reference
// the same values without duplicating magic numbers.
// ---------------------------------------------------------------------------
export const DEFAULT_BASE_DELAY_MS = 50;
export const DEFAULT_STAGGER_MS = 75;
export const DEFAULT_ANIMATION_DURATION_MS = 400;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute the Y centroid (grid coords) of a room for sorting.
 * Mirrors the `getY` closure that was inline in EncounterMapRenderer.
 */
function roomYCentroid(room: GridRoom): number {
  const rects = room.rects ?? [];
  if (rects.length > 0) {
    return Math.min(...rects.map(r => r.y));
  }
  if (room.circle) {
    return room.circle.cy;
  }
  if (room.polygon && room.polygon.length > 0) {
    return room.polygon.reduce((sum, [, y]) => sum + y, 0) / room.polygon.length;
  }
  return 0; // degenerate — no geometry
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the list of per-room animation steps resulting from a
 * roomVisibility state change.
 *
 * @param prev     Previous visibility state (undefined = no prior state)
 * @param curr     Current visibility state (undefined = not yet received)
 * @param rooms    All rooms on the current map (used for sort order)
 * @param mapIdentity    Stable string key for the current map (e.g. `${deck_id}|${name}`)
 * @param prevMapIdentity Previous map identity (undefined if this is the first render)
 * @param opts     Optional tuning: strategy, delays, animation duration
 * @returns Array of RevealStep — empty when no animation is needed.
 */
export function scheduleReveal(
  prev: RoomVisibilityState | undefined,
  curr: RoomVisibilityState | undefined,
  rooms: GridRoom[],
  mapIdentity: string,
  prevMapIdentity: string | undefined,
  opts?: ScheduleRevealOpts,
): RevealStep[] {
  // Map switch — treat current visibility as the new baseline.
  // No animations on deck/map switch to avoid phantom cascades.
  if (mapIdentity !== prevMapIdentity) return [];

  // No state yet — nothing to diff.
  if (!prev || !curr) return [];

  const baseDelayMs = opts?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const staggerMs = opts?.staggerMs ?? DEFAULT_STAGGER_MS;
  // strategy is 'y-ascending' by default (and only option for now)

  // Collect rooms that changed visibility
  const revealing: GridRoom[] = [];
  const hiding: GridRoom[] = [];

  // Walk the CURRENT rooms array (not the prev/curr keys) to maintain sort-
  // stable behaviour and ignore stale visibility keys.
  for (const room of rooms) {
    const wasVisible = prev[room.id] !== false;
    const nowVisible = curr[room.id] !== false;

    if (!wasVisible && nowVisible) {
      revealing.push(room);
    } else if (wasVisible && !nowVisible) {
      hiding.push(room);
    }
  }

  // Rooms that appear in prev or curr but not in rooms[] (stale visibility
  // keys) are implicitly ignored by iterating rooms[] above.

  if (revealing.length === 0 && hiding.length === 0) return [];

  // Sort each group Y-ascending
  const byY = (a: GridRoom, b: GridRoom) => roomYCentroid(a) - roomYCentroid(b);
  revealing.sort(byY);
  hiding.sort(byY);

  const steps: RevealStep[] = [];

  revealing.forEach((room, idx) => {
    steps.push({
      roomId: room.id,
      anim: 'revealing',
      delayMs: baseDelayMs + idx * staggerMs,
    });
  });

  hiding.forEach((room, idx) => {
    steps.push({
      roomId: room.id,
      anim: 'hiding',
      delayMs: baseDelayMs + idx * staggerMs,
    });
  });

  return steps;
}
