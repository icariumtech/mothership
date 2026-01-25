/**
 * GalaxyMap - React Three Fiber wrapper for galaxy visualization
 *
 * Handles:
 * - R3F Canvas setup
 * - Data loading integration
 * - System selection state sync
 * - Callbacks to parent
 * - Transition animations
 *
 * This is a drop-in replacement for the old imperative Three.js version.
 */

import { useRef, useImperativeHandle, forwardRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { GalaxyScene, LoadingScene } from './r3f';
import type { GalaxySceneHandle } from './r3f';
import type { StarMapData } from '@/types/starMap';
import './GalaxyMap.css';

interface GalaxyMapProps {
  /** Star map data (if already fetched by parent) */
  data?: StarMapData | null;
  /** Currently selected system name (selection via menu only) */
  selectedSystem?: string | null;
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

export const GalaxyMap = forwardRef<GalaxyMapHandle, GalaxyMapProps>(
  (
    {
      data,
      selectedSystem,
      visible = true,
      transitionState = 'idle',
      hidden = false,
      paused = false,
    },
    ref
  ) => {
    const sceneRef = useRef<GalaxySceneHandle>(null);

    // Expose methods to parent - same interface as before
    useImperativeHandle(
      ref,
      () => ({
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
        },
      }),
      []
    );

    if (!visible) return null;

    const containerClass = `galaxy-map-container${
      transitionState !== 'idle' ? ` ${transitionState}` : ''
    }${hidden ? ' hidden' : ''}`;

    return (
      <div className={containerClass}>
        <Canvas
          camera={{
            position: [0, 0, 100],
            fov: 75,
            near: 0.1,
            far: 1000,
          }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
          }}
          style={{ background: '#000000' }}
          frameloop={paused ? 'demand' : 'always'}
        >
          <Suspense fallback={<LoadingScene />}>
            <GalaxyScene
              ref={sceneRef}
              data={data}
              selectedSystem={selectedSystem}
              paused={paused}
            />
          </Suspense>
        </Canvas>
      </div>
    );
  }
);
