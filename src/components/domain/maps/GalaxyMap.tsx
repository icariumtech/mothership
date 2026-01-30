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

import { useRef, useImperativeHandle, forwardRef, Suspense, useCallback } from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { GalaxyScene, LoadingScene, PostProcessing } from './r3f';
import { TypewriterController } from './r3f/shared/TypewriterController';
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

    // Handle Canvas creation - ensure camera is properly set up
    const handleCreated = useCallback((state: RootState) => {
      const { camera, size } = state;

      // Ensure camera looks at origin
      camera.lookAt(0, 0, 0);

      // Update projection matrix with correct aspect
      if ((camera as PerspectiveCamera).isPerspectiveCamera) {
        (camera as PerspectiveCamera).aspect = size.width / size.height;
        (camera as PerspectiveCamera).updateProjectionMatrix();
      }
    }, []);

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
          onCreated={handleCreated}
        >
          {/* RAF-driven typewriter controller */}
          <TypewriterController speed={15} />

          <Suspense fallback={<LoadingScene />}>
            <GalaxyScene
              ref={sceneRef}
              data={data}
              selectedSystem={selectedSystem}
              paused={paused}
            />
          </Suspense>

          {/* Post-processing effects (disabled by default for performance)
              To enable bloom effect, set enabled={true} and configure bloom:
              <PostProcessing
                enabled={true}
                bloom={{ intensity: 0.5, luminanceThreshold: 0.9 }}
              />
          */}
          <PostProcessing enabled={false} />
        </Canvas>
      </div>
    );
  }
);
