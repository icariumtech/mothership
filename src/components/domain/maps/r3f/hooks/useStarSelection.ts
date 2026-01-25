/**
 * useStarSelection - Star selection state management hook
 *
 * Provides a clean interface for managing star selection in the galaxy view.
 * Uses R3F's built-in event system (no manual raycasting needed).
 *
 * Selection is handled by:
 * 1. StarSystem component's onClick handler
 * 2. This hook coordinates with Zustand store and camera animations
 */

import { useCallback, useRef } from 'react';
import { useSceneStore, useSelectedSystem } from './useSceneStore';
import type { StarMapData } from '@/types/starMap';

interface UseStarSelectionOptions {
  /** Star map data containing systems */
  data: StarMapData | null;
  /** External callback when a system is selected */
  onSystemSelect?: (systemName: string | null) => void;
  /** Camera move function from useGalaxyCamera */
  onMoveToSystem?: (systemName: string) => Promise<void>;
  /** Camera move to origin function */
  onMoveToOrigin?: () => Promise<void>;
}

interface UseStarSelectionReturn {
  /** Currently selected system name */
  selectedSystem: string | null;
  /** Handle system click (for StarSystems component) */
  handleSystemClick: (systemName: string) => void;
  /** Handle system hover */
  handleSystemHover: (systemName: string | null) => void;
  /** Clear current selection */
  clearSelection: () => void;
  /** Select a specific system programmatically */
  selectSystem: (systemName: string | null) => void;
  /** Map of system names to positions */
  starPositions: Map<string, [number, number, number]>;
}

export function useStarSelection({
  data,
  onSystemSelect,
  onMoveToSystem,
  onMoveToOrigin,
}: UseStarSelectionOptions): UseStarSelectionReturn {
  const selectedSystem = useSelectedSystem();
  const storeSelectSystem = useSceneStore((state) => state.selectSystem);
  const hoveredSystemRef = useRef<string | null>(null);

  // Build position map from data
  const starPositions = useCallback(() => {
    const posMap = new Map<string, [number, number, number]>();
    if (data?.systems) {
      data.systems.forEach((sys) => {
        posMap.set(sys.name, sys.position);
      });
    }
    return posMap;
  }, [data])();

  // Handle system click - coordinates selection, callbacks, and camera
  const handleSystemClick = useCallback(
    (systemName: string) => {
      const currentSelection = useSceneStore.getState().selectedSystem;
      const isDeselecting = currentSelection === systemName;

      // Update store (toggles if clicking same system)
      storeSelectSystem(systemName);

      // Notify external callback
      onSystemSelect?.(isDeselecting ? null : systemName);

      // Animate camera
      if (isDeselecting) {
        onMoveToOrigin?.();
      } else {
        onMoveToSystem?.(systemName);
      }
    },
    [storeSelectSystem, onSystemSelect, onMoveToSystem, onMoveToOrigin]
  );

  // Handle system hover
  const handleSystemHover = useCallback((systemName: string | null) => {
    hoveredSystemRef.current = systemName;
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    storeSelectSystem(null);
    onSystemSelect?.(null);
    onMoveToOrigin?.();
  }, [storeSelectSystem, onSystemSelect, onMoveToOrigin]);

  // Programmatic selection (used by parent for initial state)
  const selectSystem = useCallback(
    (systemName: string | null) => {
      if (systemName === null) {
        clearSelection();
      } else {
        // Don't toggle, just select
        const current = useSceneStore.getState().selectedSystem;
        if (current !== systemName) {
          storeSelectSystem(systemName);
          onSystemSelect?.(systemName);
          onMoveToSystem?.(systemName);
        }
      }
    },
    [storeSelectSystem, onSystemSelect, onMoveToSystem, clearSelection]
  );

  return {
    selectedSystem,
    handleSystemClick,
    handleSystemHover,
    clearSelection,
    selectSystem,
    starPositions,
  };
}

/**
 * Build a position map from star system data
 * Utility function for components that need positions without full hook
 */
export function buildStarPositionMap(
  data: StarMapData | null
): Map<string, [number, number, number]> {
  const posMap = new Map<string, [number, number, number]>();
  if (data?.systems) {
    data.systems.forEach((sys) => {
      posMap.set(sys.name, sys.position);
    });
  }
  return posMap;
}
