/**
 * OrbitMap - React wrapper for OrbitScene Three.js visualization
 *
 * Manages the lifecycle of the Three.js scene and provides React-friendly props
 * for controlling the orbit map display.
 */

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { OrbitScene } from '../../../three/OrbitScene';
import type { OrbitMapData, MoonData, StationData, SurfaceMarkerData } from '../../../types/orbitMap';
import './OrbitMap.css';

interface OrbitMapProps {
  systemSlug: string | null;
  bodySlug: string | null;
  selectedElement: string | null;
  selectedElementType: 'moon' | 'station' | 'surface' | null;
  onElementSelect?: (elementType: string | null, elementData: MoonData | StationData | SurfaceMarkerData | null) => void;
  onBackToSystem?: () => void;
  onOrbitMapLoaded?: (data: OrbitMapData | null) => void;
  /** Transition state */
  transitionState?: 'idle' | 'transitioning-out' | 'transitioning-in';
}

export interface OrbitMapHandle {
  zoomOut: () => Promise<void>;
  zoomIn: () => Promise<void>;
}

export const OrbitMap = forwardRef<OrbitMapHandle, OrbitMapProps>(({
  systemSlug,
  bodySlug,
  selectedElement,
  selectedElementType,
  onElementSelect,
  onBackToSystem,
  onOrbitMapLoaded,
  transitionState = 'idle',
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OrbitScene | null>(null);

  // Expose zoom methods to parent
  useImperativeHandle(ref, () => ({
    zoomOut: () => {
      if (sceneRef.current) {
        return sceneRef.current.zoomOut();
      }
      return Promise.resolve();
    },
    zoomIn: () => {
      if (sceneRef.current) {
        return sceneRef.current.zoomIn();
      }
      return Promise.resolve();
    }
  }), []);

  // Initialize scene on mount
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create scene with callbacks
    const scene = new OrbitScene(canvasRef.current, {
      onElementSelect: (elementType, elementData) => {
        onElementSelect?.(elementType, elementData);
      },
      onBackToSystem,
      onOrbitMapLoaded,
    });

    sceneRef.current = scene;

    // Expose select function globally for menu integration
    (window as any).orbitMapSelectElement = (type: string, name: string) => {
      scene.selectElement(type as 'moon' | 'station' | 'surface', name);
    };
    (window as any).orbitMapUnselectElement = () => {
      scene.unselectElement();
    };

    // Cleanup on unmount
    return () => {
      scene.dispose();
      sceneRef.current = null;
      delete (window as any).orbitMapSelectElement;
      delete (window as any).orbitMapUnselectElement;
    };
  }, []);

  // Load orbit map when systemSlug and bodySlug change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !systemSlug || !bodySlug) return;

    // Load the new orbit map
    scene.loadOrbitMap(systemSlug, bodySlug);
    scene.show();

    return () => {
      scene.hide();
    };
  }, [systemSlug, bodySlug]);

  // Sync selection state from props
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const currentSelected = scene.getSelectedElement();

    if (selectedElement && selectedElementType) {
      // Select if different from current
      if (!currentSelected || currentSelected.name !== selectedElement) {
        scene.selectElement(selectedElementType, selectedElement);
      }
    } else if (currentSelected) {
      // Unselect if props say nothing selected
      scene.unselectElement();
    }
  }, [selectedElement, selectedElementType]);

  const canvasClass = transitionState !== 'idle' ? transitionState : undefined;

  return (
    <canvas
      ref={canvasRef}
      id="orbitmap-canvas"
      className={canvasClass}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
      }}
    />
  );
});
