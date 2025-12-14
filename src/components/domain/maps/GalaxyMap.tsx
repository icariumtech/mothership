/**
 * GalaxyMap - React wrapper for GalaxyScene Three.js visualization
 *
 * Handles:
 * - Lifecycle management (init/dispose)
 * - Data loading from API
 * - System selection state sync
 * - Callbacks to parent
 */

import { useEffect, useRef } from 'react';
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
}

export function GalaxyMap({
  data,
  selectedSystem,
  onSystemSelect,
  visible = true,
}: GalaxyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GalaxyScene | null>(null);

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

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="galaxy-map-container"
    />
  );
}
