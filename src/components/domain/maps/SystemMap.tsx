/**
 * SystemMap Component
 *
 * React wrapper for the Three.js system map visualization.
 * Displays a solar system with star, planets, and orbits.
 */

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { SystemScene } from '../../../three/SystemScene';
import type { BodyData, SystemMapData } from '../../../types/systemMap';
import './SystemMap.css';

interface SystemMapProps {
  /** System slug to load (e.g., 'sol', 'tau-ceti') */
  systemSlug: string | null;
  /** Currently selected planet name */
  selectedPlanet: string | null;
  /** Callback when a planet is selected/deselected */
  onPlanetSelect?: (planetData: BodyData | null) => void;
  /** Callback when drill-down arrow is clicked */
  onOrbitMapNavigate?: (systemSlug: string, planetSlug: string) => void;
  /** Callback when back to galaxy is clicked */
  onBackToGalaxy?: () => void;
  /** Callback when system data is loaded */
  onSystemLoaded?: (data: SystemMapData | null) => void;
  /** Transition state */
  transitionState?: 'idle' | 'transitioning-out' | 'transitioning-in';
  /** Whether to hide the canvas (keeps scene mounted but invisible) */
  hidden?: boolean;
}

export interface SystemMapHandle {
  diveToPlanet: (planetName: string) => Promise<void>;
  zoomOutFromPlanet: (planetName: string) => Promise<void>;
  selectPlanetAndWait: (planetName: string) => Promise<void>;
  positionCameraOnPlanet: (planetName: string) => void;
  zoomOut: () => Promise<void>;
  zoomIn: () => void;
}

export const SystemMap = forwardRef<SystemMapHandle, SystemMapProps>(({
  systemSlug,
  selectedPlanet,
  onPlanetSelect,
  onOrbitMapNavigate,
  onBackToGalaxy,
  onSystemLoaded,
  transitionState = 'idle',
  hidden = false
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SystemScene | null>(null);
  const loadedSystemRef = useRef<string | null>(null);
  // Track selectedPlanet in a ref so we can access it in the system load callback
  // without adding it as a dependency (which would cause unnecessary reloads)
  const selectedPlanetRef = useRef<string | null>(selectedPlanet);

  // Expose dive methods to parent
  useImperativeHandle(ref, () => ({
    diveToPlanet: (planetName: string) => {
      if (sceneRef.current) {
        return sceneRef.current.diveToPlanet(planetName);
      }
      return Promise.resolve();
    },
    zoomOutFromPlanet: (planetName: string) => {
      if (sceneRef.current) {
        return sceneRef.current.zoomOutFromPlanet(planetName);
      }
      return Promise.resolve();
    },
    selectPlanetAndWait: (planetName: string) => {
      const scene = sceneRef.current;
      if (!scene) return Promise.resolve();

      const currentSystem = scene.getCurrentSystem();
      const planetData = currentSystem?.bodies?.find(b => b.name === planetName);
      if (planetData) {
        return scene.selectPlanetAndWait(planetData);
      }
      return Promise.resolve();
    },
    positionCameraOnPlanet: (planetName: string) => {
      if (sceneRef.current) {
        sceneRef.current.positionCameraOnPlanet(planetName);
      }
    },
    zoomOut: () => {
      if (sceneRef.current) {
        return sceneRef.current.zoomOut();
      }
      return Promise.resolve();
    },
    zoomIn: () => {
      if (sceneRef.current) {
        sceneRef.current.zoomIn();
      }
    }
  }), []);

  // Keep ref in sync with prop
  useEffect(() => {
    selectedPlanetRef.current = selectedPlanet;
  }, [selectedPlanet]);

  // Initialize scene
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create scene with callbacks
    const scene = new SystemScene(canvasRef.current, {
      onPlanetSelect,
      onOrbitMapNavigate,
      onBackToGalaxy,
      onPlanetClick: (planetName, planetData) => {
        console.log('Planet clicked:', planetName);
        onPlanetSelect?.(planetData);
      }
    });

    sceneRef.current = scene;

    // Cleanup on unmount
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []); // Empty deps - only create scene once

  // Load system when systemSlug changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (systemSlug && systemSlug !== loadedSystemRef.current) {
      console.log('Loading system:', systemSlug);
      scene.loadSystem(systemSlug).then(data => {
        loadedSystemRef.current = systemSlug;
        scene.show();
        onSystemLoaded?.(data);

        // Sync any pending planet selection after system is loaded and shown
        // This handles the case when returning from orbit view with a planet already selected
        const pendingSelection = selectedPlanetRef.current;
        if (pendingSelection && data?.bodies) {
          const planetData = data.bodies.find(b => b.name === pendingSelection);
          if (planetData) {
            console.log('Syncing pending planet selection:', pendingSelection);
            scene.selectPlanet(planetData);
          }
        }
      });
    } else if (!systemSlug) {
      scene.hide();
      scene.clearSystem();
      loadedSystemRef.current = null;
    }
  }, [systemSlug, onSystemLoaded]);

  // Handle planet selection from parent
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !scene.isSystemActive()) return;

    const currentSystem = scene.getCurrentSystem();
    if (!currentSystem?.bodies) return;

    const currentlySelected = scene.getSelectedPlanet();

    if (selectedPlanet && currentlySelected?.name !== selectedPlanet) {
      // Select the planet
      const planetData = currentSystem.bodies.find(b => b.name === selectedPlanet);
      if (planetData) {
        scene.selectPlanet(planetData);
      }
    } else if (!selectedPlanet && currentlySelected) {
      // Deselect
      scene.unselectPlanet();
    }
  }, [selectedPlanet]);

  // Handle programmatic planet selection
  const handleSelectPlanet = useCallback((planetName: string) => {
    const scene = sceneRef.current;
    if (!scene || !scene.isSystemActive()) return;

    const currentSystem = scene.getCurrentSystem();
    if (!currentSystem?.bodies) return;

    const planetData = currentSystem.bodies.find(b => b.name === planetName);
    if (planetData) {
      if (scene.getSelectedPlanet()?.name === planetName) {
        scene.unselectPlanet();
        onPlanetSelect?.(null);
      } else {
        scene.selectPlanet(planetData);
        onPlanetSelect?.(planetData);
      }
    }
  }, [onPlanetSelect]);

  // Expose methods via ref
  useEffect(() => {
    // Expose to window for menu panel integration
    (window as any).systemMapSelectPlanet = handleSelectPlanet;

    return () => {
      delete (window as any).systemMapSelectPlanet;
    };
  }, [handleSelectPlanet]);

  const canvasClass = transitionState !== 'idle' ? transitionState : undefined;

  return (
    <canvas
      ref={canvasRef}
      id="systemmap-canvas"
      className={canvasClass}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        display: systemSlug && !hidden ? 'block' : 'none'
      }}
    />
  );
});
