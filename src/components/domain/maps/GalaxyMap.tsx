/**
 * GalaxyMap - React wrapper for GalaxyScene Three.js visualization
 *
 * Handles:
 * - Lifecycle management (init/dispose)
 * - Data loading from API
 * - System selection state sync
 * - Callbacks to parent
 * - Transition animations
 */

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { GalaxyScene } from '../../../three/GalaxyScene';
import type { StarMapData } from '../../../types/starMap';
import './GalaxyMap.css';

interface GalaxyMapProps {
  /** Star map data (if already fetched by parent) */
  data?: StarMapData | null;
  /** Currently selected system name */
  selectedSystem?: string | null;
  /** Callback when user clicks a system */
  onSystemSelect?: (systemName: string) => void;
  /** Whether the map is visible */
  visible?: boolean;
  /** Transition state: 'idle' | 'transitioning-out' | 'transitioning-in' */
  transitionState?: 'idle' | 'transitioning-out' | 'transitioning-in';
  /** Whether to hide the container (keeps scene mounted but invisible) */
  hidden?: boolean;
  /** Whether to pause rendering updates */
  paused?: boolean;
}

export interface GalaxyMapHandle {
  diveToSystem: (systemName: string) => Promise<void>;
  selectSystemAndWait: (systemName: string) => Promise<void>;
  positionCameraOnSystem: (systemName: string) => void;
}

export const GalaxyMap = forwardRef<GalaxyMapHandle, GalaxyMapProps>(({
  data,
  selectedSystem,
  onSystemSelect,
  visible = true,
  transitionState = 'idle',
  hidden = false,
  paused = false,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GalaxyScene | null>(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    diveToSystem: (systemName: string) => {
      if (sceneRef.current) {
        return sceneRef.current.diveToSystem(systemName);
      }
      return Promise.resolve();
    },
    selectSystemAndWait: (systemName: string) => {
      if (sceneRef.current) {
        return sceneRef.current.selectSystemAndWait(systemName);
      }
      return Promise.resolve();
    },
    positionCameraOnSystem: (systemName: string) => {
      if (sceneRef.current) {
        sceneRef.current.positionCameraOnSystem(systemName);
      }
    }
  }), []);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current || !visible) return;

    // Create scene
    sceneRef.current = new GalaxyScene(containerRef.current);

    // Set up callbacks
    if (onSystemSelect) {
      sceneRef.current.onSystemClick = onSystemSelect;
    }

    // Cleanup on unmount
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [visible]); // Only re-init if visibility changes

  // Load data when it changes
  useEffect(() => {
    if (sceneRef.current && data) {
      sceneRef.current.loadData(data);
    }
  }, [data]);

  // Sync selected system
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.selectSystem(selectedSystem || null);
    }
  }, [selectedSystem]);

  // Trigger resize when hidden changes to visible (fixes blank galaxy after returning from system view)
  useEffect(() => {
    if (!hidden && sceneRef.current) {
      // Small delay to ensure display: none is removed and container has dimensions
      requestAnimationFrame(() => {
        sceneRef.current?.resize();
      });
    }
  }, [hidden]);

  // Sync paused state to scene
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setPaused(paused);
    }
  }, [paused]);

  if (!visible) return null;

  const containerClass = `galaxy-map-container${transitionState !== 'idle' ? ` ${transitionState}` : ''}${hidden ? ' hidden' : ''}`;

  return (
    <div
      ref={containerRef}
      className={containerClass}
    />
  );
});
