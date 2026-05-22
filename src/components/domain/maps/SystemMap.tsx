/**
 * SystemMap - React Three Fiber wrapper for system visualization
 *
 * Handles:
 * - R3F Canvas setup
 * - Data loading from API
 * - Planet selection state sync
 * - Callbacks to parent
 * - Transition animations
 *
 * This is a drop-in replacement for the old imperative Three.js version.
 */

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  Suspense,
  useMemo,
} from 'react';
import { Canvas, type RootState } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { SystemScene, LoadingScene } from './r3f';
import { TypewriterController } from './r3f/shared/TypewriterController';
import type { SystemSceneHandle } from './r3f';
import type { BodyData, SystemMapData } from '@/types/systemMap';
import { MapPlaybackControls } from './MapPlaybackControls';
import './SystemMap.css';

// Mirrors the ORBITAL_PERIOD_TARGET_SECONDS constant in SystemScene.tsx —
// used here to derive the scrub-pixel→radians conversion (D-06).
const ORBITAL_PERIOD_TARGET_SECONDS = 10;
const SCRUB_TRACK_WIDTH = 300;

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
  /** Callback when scene is fully constructed and ready */
  onReady?: () => void;
  /** Transition state */
  transitionState?: 'idle' | 'transitioning-out' | 'transitioning-in';
  /** Whether to hide the canvas (keeps scene mounted but invisible) */
  hidden?: boolean;
  /** Whether to pause rendering updates */
  paused?: boolean;
}

export interface SystemMapHandle {
  selectPlanetAndWait: (planetName: string) => Promise<void>;
  positionCameraOnPlanet: (planetName: string) => void;
}

export const SystemMap = forwardRef<SystemMapHandle, SystemMapProps>(
  (
    {
      systemSlug,
      selectedPlanet,
      onPlanetSelect,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onOrbitMapNavigate: _onOrbitMapNavigate,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onBackToGalaxy: _onBackToGalaxy,
      onSystemLoaded,
      onReady,
      transitionState = 'idle',
      hidden = false,
      paused = false,
    },
    ref
  ) => {
    const sceneRef = useRef<SystemSceneHandle>(null);
    const [systemData, setSystemData] = useState<SystemMapData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const loadedSystemRef = useRef<string | null>(null);

    // Orbital playback state — local per D-08 (resets on navigation; not persisted).
    const [isOrbiting, setIsOrbiting] = useState(true);
    // Accumulated scrub radians applied while orbitsPaused. Lives in a ref so
    // pointer-drag events do not trigger React re-renders on every move.
    const scrubOffsetRef = useRef<number>(0);

    // Track selectedPlanet in a ref for access in callbacks
    const selectedPlanetRef = useRef<string | null>(selectedPlanet);
    useEffect(() => {
      selectedPlanetRef.current = selectedPlanet;
    }, [selectedPlanet]);

    // Load system data when systemSlug changes
    useEffect(() => {
      if (!systemSlug) {
        setSystemData(null);
        loadedSystemRef.current = null;
        onSystemLoaded?.(null);
        return;
      }

      if (systemSlug === loadedSystemRef.current) {
        return;
      }

      const loadSystem = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/system-map/${systemSlug}/`);
          if (!response.ok) {
            throw new Error(`Failed to load system map: ${response.statusText}`);
          }
          const data: SystemMapData = await response.json();
          setSystemData(data);
          loadedSystemRef.current = systemSlug;
          onSystemLoaded?.(data);
        } catch (error) {
          console.error('Error loading system map:', error);
          setSystemData(null);
          onSystemLoaded?.(null);
        } finally {
          setIsLoading(false);
        }
      };

      loadSystem();
    }, [systemSlug, onSystemLoaded]);

    // Find the currently selected planet data
    const selectedPlanetData = systemData?.bodies?.find(
      (b) => b.name === selectedPlanet
    ) ?? null;

    // Handle planet selection from scene
    const handlePlanetSelect = useCallback(
      (planetData: BodyData | null) => {
        onPlanetSelect?.(planetData);
      },
      [onPlanetSelect]
    );

    // Toggle orbital playback — flips isOrbiting; SystemScene reads orbitsPaused=!isOrbiting.
    const handleTogglePlay = useCallback(() => {
      setIsOrbiting((prev) => !prev);
    }, []);

    // Convert scrub pixel delta → orbital radians.
    // radiansPerPixel = (2π) / (trackWidthPx * (period / ORBITAL_PERIOD_TARGET_SECONDS))
    // period = selected body's orbital_period when one is selected, else the
    // shortest period in the system (D-06).
    const handleScrubDelta = useCallback(
      (deltaX: number) => {
        if (!systemData?.bodies?.length) return;
        const periods = systemData.bodies
          .map((b) => b.orbital_period ?? 365)
          .filter((p): p is number => Number.isFinite(p) && p > 0);
        const shortest = periods.length ? Math.min(...periods) : 365;
        const period = selectedPlanetData?.orbital_period ?? shortest;
        const radiansPerPixel =
          (2 * Math.PI) /
          (SCRUB_TRACK_WIDTH * (period / ORBITAL_PERIOD_TARGET_SECONDS));
        scrubOffsetRef.current += deltaX * radiansPerPixel;
      },
      [systemData, selectedPlanetData]
    );

    // Expose methods to parent
    useImperativeHandle(
      ref,
      () => ({
        selectPlanetAndWait: (planetName: string) => {
          if (sceneRef.current) {
            return sceneRef.current.selectPlanetAndWait(planetName);
          }
          return Promise.resolve();
        },
        positionCameraOnPlanet: (planetName: string) => {
          if (sceneRef.current) {
            sceneRef.current.positionCameraOnPlanet(planetName);
          }
        },
      }),
      []
    );

    // Don't render if no systemSlug
    if (!systemSlug) return null;

    const containerClass = `system-map-container${
      transitionState !== 'idle' ? ` ${transitionState}` : ''
    }${hidden ? ' hidden' : ''}`;

    // Get default camera config from system data
    // Start with camera at a distant position for zoom-in animation
    const cameraConfig = systemData?.camera ?? {
      position: [0, 0, 180] as [number, number, number],
      lookAt: [0, 0, 0] as [number, number, number],
      fov: 75,
    };

    // Calculate distant start position for initial camera (same logic as zoomIn)
    // This prevents the camera from being at the final position before zoomIn kicks in
    const initialCameraPosition = useMemo(() => {
      const targetPos = cameraConfig.position;
      const targetLookAt = cameraConfig.lookAt;

      // Calculate direction from lookAt to camera position
      const dx = targetPos[0] - targetLookAt[0];
      const dy = targetPos[1] - targetLookAt[1];
      const dz = targetPos[2] - targetLookAt[2];
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (length === 0) return [0, 0, 500] as [number, number, number];

      // Normalize and scale to 300 units from lookAt
      const scale = 300 / length;
      return [
        targetLookAt[0] + dx * scale,
        targetLookAt[1] + dy * scale,
        targetLookAt[2] + dz * scale,
      ] as [number, number, number];
    }, [cameraConfig.position, cameraConfig.lookAt]);

    // Handle Canvas creation - set up camera lookAt (Canvas prop doesn't support it)
    const handleCreated = useCallback((state: RootState) => {
      const { camera, size } = state;

      // Apply lookAt - R3F Canvas camera prop doesn't support lookAt directly
      camera.lookAt(cameraConfig.lookAt[0], cameraConfig.lookAt[1], cameraConfig.lookAt[2]);

      // Update projection matrix with correct aspect
      if ((camera as PerspectiveCamera).isPerspectiveCamera) {
        (camera as PerspectiveCamera).aspect = size.width / size.height;
        (camera as PerspectiveCamera).updateProjectionMatrix();
      }
    }, [cameraConfig.lookAt]);

    return (
      <div className={containerClass}>
        <Canvas
          camera={{
            position: initialCameraPosition,
            fov: cameraConfig.fov ?? 75,
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
            {systemData && !isLoading ? (
              <SystemScene
                ref={sceneRef}
                data={systemData}
                systemSlug={systemSlug}
                selectedPlanet={selectedPlanetData}
                paused={paused}
                orbitsPaused={!isOrbiting}
                scrubOffsetRef={scrubOffsetRef}
                transitionState={transitionState}
                onPlanetSelect={handlePlanetSelect}
                onReady={onReady}
              />
            ) : (
              <LoadingScene />
            )}
          </Suspense>
        </Canvas>
        <MapPlaybackControls
          isPlaying={isOrbiting}
          onTogglePlay={handleTogglePlay}
          showScrub={true}
          onScrubDelta={handleScrubDelta}
        />
      </div>
    );
  }
);
