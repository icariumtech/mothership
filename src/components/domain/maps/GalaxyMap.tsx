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
import { useSceneStore, useAnimationState } from '@/stores/sceneStore';
import { MapPlaybackControls } from './MapPlaybackControls';
import './GalaxyMap.css';

interface GalaxyMapProps {
  /** Star map data (if already fetched by parent) */
  data?: StarMapData | null;
  /** Currently selected system name */
  selectedSystem?: string | null;
  /** Whether the map is visible */
  visible?: boolean;
  /** Transition state: 'idle' | 'transitioning-out' | 'transitioning-in' */
  transitionState?: 'idle' | 'transitioning-out' | 'transitioning-in';
  /** Whether to hide the container (keeps scene mounted but invisible) */
  hidden?: boolean;
  /** Whether to pause rendering updates */
  paused?: boolean;
  /** Fired when the user clicks a star directly in the 3D view */
  onSystemSelect?: (systemName: string) => void;
}

export interface GalaxyMapHandle {
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
      onSystemSelect,
    },
    ref
  ) => {
    const sceneRef = useRef<GalaxySceneHandle>(null);

    // Play/pause overlay state. The button writes `userPaused` only — system
    // selection, drag, zoom, and the 5s auto-resume continue to manipulate
    // `autoRotate` transparently without flipping the button's visual.
    // Rotation runs only when autoRotate is on AND the user hasn't paused.
    const animations = useAnimationState();
    const setUserPaused = useSceneStore((state) => state.setUserPaused);
    const handleTogglePlay = useCallback(() => {
      setUserPaused(!animations.userPaused);
    }, [animations.userPaused, setUserPaused]);

    // Expose methods to parent - same interface as before
    useImperativeHandle(
      ref,
      () => ({
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
              onSystemSelect={onSystemSelect}
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
        <MapPlaybackControls
          isPlaying={!animations.userPaused}
          onTogglePlay={handleTogglePlay}
        />
      </div>
    );
  }
);
