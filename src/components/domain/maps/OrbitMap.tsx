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
import { OrbitScene, LoadingScene } from './r3f';
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
  /** Transition state */
  transitionState?: 'idle' | 'transitioning-out' | 'transitioning-in';
  /** Whether to hide the canvas (keeps scene mounted but invisible) */
  hidden?: boolean;
  /** Whether to pause rendering updates */
  paused?: boolean;
}

export interface OrbitMapHandle {
  zoomOut: () => Promise<void>;
  zoomIn: () => Promise<void>;
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

    // Expose methods to parent
    useImperativeHandle(
      ref,
      () => ({
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
        },
      }),
      []
    );

    // Don't render if no systemSlug or bodySlug
    if (!systemSlug || !bodySlug) return null;

    const containerClass = `orbit-map-container${
      transitionState !== 'idle' ? ` ${transitionState}` : ''
    }${hidden ? ' hidden' : ''}`;

    // Get default camera config from orbit data
    // Start with camera at a distant position for zoom-in animation
    const cameraConfig = orbitData?.camera ?? {
      position: [0, 30, 50] as [number, number, number],
      lookAt: [0, 0, 0] as [number, number, number],
      fov: 60,
    };

    // Calculate distant start position for initial camera
    const initialCameraPosition = useMemo(() => {
      const targetPos = cameraConfig.position;
      const targetLookAt = cameraConfig.lookAt;

      // Calculate direction from lookAt to camera position
      const dx = targetPos[0] - targetLookAt[0];
      const dy = targetPos[1] - targetLookAt[1];
      const dz = targetPos[2] - targetLookAt[2];
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (length === 0) return [0, 150, 250] as [number, number, number];

      // Normalize and scale to distant position
      const scale = 250 / length;
      return [
        targetLookAt[0] + dx * scale,
        targetLookAt[1] + dy * scale + 100,
        targetLookAt[2] + dz * scale,
      ] as [number, number, number];
    }, [cameraConfig.position, cameraConfig.lookAt]);

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
          <Suspense fallback={<LoadingScene />}>
            {orbitData && !isLoading ? (
              <OrbitScene
                ref={sceneRef}
                data={orbitData}
                systemSlug={systemSlug}
                bodySlug={bodySlug}
                selectedElement={selectedElementProp}
                paused={paused}
                onElementSelect={handleElementSelect}
              />
            ) : (
              <LoadingScene />
            )}
          </Suspense>
        </Canvas>
      </div>
    );
  }
);
