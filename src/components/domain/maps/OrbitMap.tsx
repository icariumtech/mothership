/**
 * OrbitMap - React Three Fiber wrapper for orbit visualization
 *
 * Handles:
 * - R3F Canvas setup
 * - Data loading from API
 * - Element selection state sync
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
import { OrbitScene } from './r3f';
import { TypewriterController } from './r3f/shared/TypewriterController';
import type { OrbitSceneHandle } from './r3f';
import type { OrbitMapData, MoonData, StationData, SurfaceMarkerData } from '@/types/orbitMap';
import './OrbitMap.css';

interface OrbitMapProps {
  systemSlug: string | null;
  bodySlug: string | null;
  selectedElement: string | null;
  selectedElementType: 'moon' | 'station' | 'surface' | null;
  onElementSelect?: (
    elementType: string | null,
    elementData: MoonData | StationData | SurfaceMarkerData | null
  ) => void;
  onBackToSystem?: () => void;
  onOrbitMapLoaded?: (data: OrbitMapData | null) => void;
  /** Callback when scene is fully constructed and ready */
  onReady?: () => void;
  /** Transition state */
  transitionState?: 'idle' | 'transitioning-out' | 'transitioning-in';
  /** Whether to hide the canvas (keeps scene mounted but invisible) */
  hidden?: boolean;
  /** Whether to pause rendering updates */
  paused?: boolean;
}

export interface OrbitMapHandle {
  // No methods needed - transitions handled by parent
}

export const OrbitMap = forwardRef<OrbitMapHandle, OrbitMapProps>(
  (
    {
      systemSlug,
      bodySlug,
      selectedElement,
      selectedElementType,
      onElementSelect,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onBackToSystem: _onBackToSystem,
      onOrbitMapLoaded,
      onReady,
      transitionState = 'idle',
      hidden = false,
      paused = false,
    },
    ref
  ) => {
    const sceneRef = useRef<OrbitSceneHandle>(null);
    const [orbitData, setOrbitData] = useState<OrbitMapData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const loadedLocationRef = useRef<string | null>(null);

    // Track selectedElement in a ref for access in callbacks
    const selectedElementRef = useRef<string | null>(selectedElement);
    useEffect(() => {
      selectedElementRef.current = selectedElement;
    }, [selectedElement]);

    // Load orbit data when systemSlug and bodySlug change
    useEffect(() => {
      if (!systemSlug || !bodySlug) {
        setOrbitData(null);
        loadedLocationRef.current = null;
        onOrbitMapLoaded?.(null);
        return;
      }

      const locationKey = `${systemSlug}/${bodySlug}`;
      if (locationKey === loadedLocationRef.current) {
        return;
      }

      const loadOrbit = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`/api/orbit-map/${systemSlug}/${bodySlug}/`);
          if (!response.ok) {
            throw new Error(`Failed to load orbit map: ${response.statusText}`);
          }
          const data: OrbitMapData = await response.json();
          setOrbitData(data);
          loadedLocationRef.current = locationKey;
          onOrbitMapLoaded?.(data);
        } catch (error) {
          console.error('Error loading orbit map:', error);
          setOrbitData(null);
          onOrbitMapLoaded?.(null);
        } finally {
          setIsLoading(false);
        }
      };

      loadOrbit();
    }, [systemSlug, bodySlug, onOrbitMapLoaded]);

    // Build selectedElement prop for scene
    const selectedElementProp = useMemo(() => {
      if (!selectedElement || !selectedElementType) {
        return { type: null as null, name: null as null };
      }
      return { type: selectedElementType, name: selectedElement };
    }, [selectedElement, selectedElementType]);

    // Handle element selection from scene
    const handleElementSelect = useCallback(
      (
        elementType: 'moon' | 'station' | 'surface' | null,
        elementData: MoonData | StationData | SurfaceMarkerData | null
      ) => {
        onElementSelect?.(elementType, elementData);
      },
      [onElementSelect]
    );

    // Expose methods to parent (none needed for now - transitions handled by parent)
    useImperativeHandle(
      ref,
      () => ({}),
      []
    );

    // Don't render if no systemSlug or bodySlug
    if (!systemSlug || !bodySlug) return null;

    const containerClass = `orbit-map-container${
      transitionState !== 'idle' ? ` ${transitionState}` : ''
    }${hidden ? ' hidden' : ''}`;

    // Get default camera config from orbit data
    // Use a safe default position on +X side (away from sun) to avoid showing sun during initial load
    const cameraConfig = orbitData?.camera ?? {
      position: [15, 7.5, 7.5] as [number, number, number], // On +X side, away from sun at -X
      lookAt: [0, 0, 0] as [number, number, number],
      fov: 60,
    };

    // When transitioning in, start camera at a close position on the opposite side from sun
    // Calculate position similar to where diveToPlanet would leave the camera
    const initialCameraPosition = useMemo(() => {
      if (transitionState === 'transitioning-in') {
        // Position camera on the +X side (opposite from sun which is typically at -X)
        // This ensures the sun is behind the camera, not in view
        const lookAt = cameraConfig.lookAt;
        const zoomFactor = 15; // Close zoom for smooth transition

        return [
          lookAt[0] + zoomFactor,  // On +X side (away from sun at -X)
          lookAt[1] + zoomFactor * 0.5,  // Slightly elevated
          lookAt[2] + zoomFactor * 0.5,  // Slightly offset in Z
        ] as [number, number, number];
      }

      // Default position for non-transition loads (also close to avoid sun)
      return cameraConfig.position;
    }, [transitionState, cameraConfig.position, cameraConfig.lookAt]);

    // Handle Canvas creation
    const handleCreated = useCallback(
      (state: RootState) => {
        const { camera, size } = state;

        // Apply lookAt
        camera.lookAt(cameraConfig.lookAt[0], cameraConfig.lookAt[1], cameraConfig.lookAt[2]);

        // Update projection matrix with correct aspect
        if ((camera as PerspectiveCamera).isPerspectiveCamera) {
          (camera as PerspectiveCamera).aspect = size.width / size.height;
          (camera as PerspectiveCamera).updateProjectionMatrix();
        }
      },
      [cameraConfig.lookAt]
    );

    return (
      <div className={containerClass}>
        <Canvas
          camera={{
            position: initialCameraPosition,
            fov: cameraConfig.fov ?? 60,
            near: 0.1,
            far: 1000,
          }}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
          }}
          shadows
          style={{ background: '#000000' }}
          frameloop={paused ? 'demand' : 'always'}
          onCreated={handleCreated}
        >
          {/* RAF-driven typewriter controller */}
          <TypewriterController speed={15} />

          <Suspense fallback={null}>
            {orbitData && !isLoading ? (
              <OrbitScene
                ref={sceneRef}
                data={orbitData}
                systemSlug={systemSlug}
                bodySlug={bodySlug}
                selectedElement={selectedElementProp}
                paused={paused}
                transitionState={transitionState}
                onElementSelect={handleElementSelect}
                onReady={onReady}
              />
            ) : null}
          </Suspense>
        </Canvas>
      </div>
    );
  }
);
