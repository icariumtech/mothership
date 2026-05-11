/**
 * doorVisibility — player-side door visibility predicate.
 *
 * Extracted from EncounterMapRenderer.tsx so both the renderer and tests
 * reference the same logic. The renderer calls this for the common
 * two-room / exterior-door path; the spatial fallback (exterior doors with
 * no roomB and a cell-adjacency lookup) remains inline in the renderer
 * because it requires the room list and grid helpers.
 *
 * Phase 21 plan 21-02.
 */

import type { Door, RoomVisibilityState } from '../../../../types/encounterMap';

/**
 * Returns true if the door should be rendered on the player terminal.
 *
 * A door is visible when at least one of its endpoint rooms is visible.
 * For exterior doors (`roomB === null`) this function returns false when
 * roomA is hidden — the renderer's spatial fallback then handles the
 * "other side could belong to a visible room" case.
 *
 * @param door - canonical door from normalizeDoors
 * @param roomVisibility - current visibility state (absent key → visible by default)
 */
export function playerDoorVisible(
  door: Door,
  roomVisibility: RoomVisibilityState,
): boolean {
  const isRoomVisible = (id: string) => roomVisibility[id] !== false;
  const aVisible = isRoomVisible(door.roomA);
  const bVisible = door.roomB ? isRoomVisible(door.roomB) : false;
  if (!aVisible && !bVisible) {
    return false;
  }
  return true;
}
