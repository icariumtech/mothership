/**
 * OrbitScene - Main R3F component for orbit map visualization
 *
 * Renders the complete orbit view including:
 * - Background starfield
 * - Sun with directional lighting
 * - Central textured planet with rotation
 * - Lat/lon grid overlay
 * - Orbiting moons with textures
 * - Orbital stations
 * - Surface markers
 * - Orbital path lines
 * - Selection reticle
 * - Camera controls and tracking
 *
 * Integrates with Zustand store for state management.
 */

import {
  useMemo,
  useImperativeHandle,
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useState,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BackgroundStars } from './galaxy';
import { SelectionReticle } from './shared';
import {
  Sun,
  CentralPlanet,
  LatLonGrid,
  Moon,
  OrbitalStation,
  SurfaceMarker,
  OrbitElementPath,
  OrbitControls,
} from './orbit';
import {
  useSceneStore,
  useOrbitMapData,
  useSelectedOrbitElement,
  useIsPaused,
} from './hooks/useSceneStore';
import { useOrbitCamera } from './hooks/useOrbitCamera';
import type { OrbitMapData, MoonData, StationData, SurfaceMarkerData } from '@/types/orbitMap';

export interface OrbitSceneProps {
  /** Orbit map data (optional, can also read from store) */
  data?: OrbitMapData | null;
  /** System slug identifier */
  systemSlug?: string | null;
  /** Body slug identifier */
  bodySlug?: string | null;
  /** Currently selected element (optional, can also read from store) */
  selectedElement?: {
    type: 'moon' | 'station' | 'surface' | null;
    name: string | null;
  } | null;
  /** Whether rendering is paused */
  paused?: boolean;
  /** Transition state for coordinating fade effects */
  transitionState?: 'idle' | 'transitioning-out' | 'transitioning-in';
  /** Callback when an element is selected */
  onElementSelect?: (
    elementType: 'moon' | 'station' | 'surface' | null,
    elementData: MoonData | StationData | SurfaceMarkerData | null
  ) => void;
  /** Callback when scene is fully constructed and ready */
  onReady?: () => void;
}

export interface OrbitSceneHandle {
  /** Animate camera to focus on an element */
  selectElementAndWait: (
    elementName: string,
    elementType: 'moon' | 'station' | 'surface'
  ) => Promise<void>;
  /** Get element positions map */
  getElementPositions: () => Map<string, THREE.Vector3>;
}

export const OrbitScene = forwardRef<OrbitSceneHandle, OrbitSceneProps>(
  function OrbitScene(
    {
      data: dataProp,
      systemSlug: _systemSlug,
      bodySlug,
      selectedElement: selectedElementProp,
      paused: pausedProp = false,
      transitionState = 'idle',
      onElementSelect,
      onReady,
    },
    ref
  ) {
    // Get data from store or props
    const storeData = useOrbitMapData();
    const storeSelectedElement = useSelectedOrbitElement();
    const storePaused = useIsPaused();

    // Use props if provided, otherwise fall back to store
    const data = dataProp ?? storeData;
    const selectedElement = selectedElementProp ?? storeSelectedElement;
    const paused = pausedProp || storePaused;

    // Store actions
    const selectOrbitElement = useSceneStore((state) => state.selectOrbitElement);
    const setOrbitMapData = useSceneStore((state) => state.setOrbitMapData);

    // Get R3F camera and size info
    const { camera, size } = useThree();

    // Track if we've initialized the camera for this body
    const cameraInitializedRef = useRef<string | null>(null);
    const waitingForInitRef = useRef<string | null>(null);
    const waitFramesRef = useRef(0);
    const readyCalledRef = useRef<string | null>(null);

    // Track if a fade animation is currently running to prevent duplicates
    const fadeAnimationRunningRef = useRef(false);

    // Track the last processed transition to prevent duplicate handling
    const lastProcessedTransitionRef = useRef<string>('idle');

    // Track scene opacity for fade-in effect using ref (avoids React state batching delays)
    // Start at 0 so scene is invisible until zoomIn animation begins
    const sceneOpacityRef = useRef(0);

    // Scene root ref for direct material updates (bypasses React prop system)
    const sceneRootRef = useRef<THREE.Group>(null);

    // Animation start time
    const startTimeRef = useRef(Date.now());

    // Shared rotation ref for planet, grid, and surface markers
    const rotationRef = useRef(0);

    // Element positions map (updated each frame)
    const elementPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());

    // Track animation paused state (for surface marker selection)
    const [animationPaused, setAnimationPaused] = useState(false);

    // Get element position by name and type
    const getElementPosition = useCallback(
      (elementName: string, elementType: 'moon' | 'station' | 'surface'): THREE.Vector3 | null => {
        const key = `${elementType}:${elementName}`;
        return elementPositionsRef.current.get(key) ?? null;
      },
      []
    );

    // Camera hooks
    const {
      moveToElement,
      returnToDefault,
      updateTracking,
      setTrackedElement,
      setCameraOffset,
      isAnimating: _isAnimating,
      getSceneOpacity,
      setSceneOpacity,
    } = useOrbitCamera({
      getElementPosition,
      defaultCamera: data?.camera,
    });

    // Reset opacity to 0 when switching to a new body (before fade-in animation)
    // CRITICAL: Use useLayoutEffect to run synchronously BEFORE paint, preventing flash
    useLayoutEffect(() => {
      if (bodySlug && cameraInitializedRef.current !== bodySlug) {
        sceneOpacityRef.current = 0;
        setSceneOpacity(0);
      }
    }, [bodySlug, setSceneOpacity]);

    // Fade out scene materials when transitioning out
    useEffect(() => {
      // Skip if we've already processed this transition state
      if (transitionState === lastProcessedTransitionRef.current) {
        return;
      }

      if (transitionState === 'transitioning-out') {
        if (fadeAnimationRunningRef.current) {
          console.log('[OrbitScene] Skipping fade-out - animation already running');
          return;
        }
        console.log('[OrbitScene] Starting fade-out animation');
        lastProcessedTransitionRef.current = transitionState;
        fadeAnimationRunningRef.current = true;
        const fadeStart = performance.now();
        const fadeDuration = 500; // Match FADE_OUT_TIME
        const fadeOut = () => {
          const elapsed = performance.now() - fadeStart;
          const progress = Math.min(elapsed / fadeDuration, 1);
          const newOpacity = 1 - progress; // Fade 1→0

          setSceneOpacity(newOpacity);
          sceneOpacityRef.current = newOpacity;

          if (progress < 1) {
            requestAnimationFrame(fadeOut);
          } else {
            console.log('[OrbitScene] Fade-out complete');
            fadeAnimationRunningRef.current = false;
          }
        };
        requestAnimationFrame(fadeOut);
      } else if (transitionState === 'transitioning-in') {
        // Fade in when returning to this scene (e.g., back from system)
        if (fadeAnimationRunningRef.current) {
          console.log('[OrbitScene] Skipping fade-in - animation already running');
          return;
        }
        console.log('[OrbitScene] Starting fade-in animation (transition)');
        lastProcessedTransitionRef.current = transitionState;
        fadeAnimationRunningRef.current = true;
        const fadeStart = performance.now();
        const fadeDuration = 1200; // Match FADE_TIME
        const fadeIn = () => {
          const elapsed = performance.now() - fadeStart;
          const progress = Math.min(elapsed / fadeDuration, 1);
          const newOpacity = progress; // Fade 0→1

          setSceneOpacity(newOpacity);
          sceneOpacityRef.current = newOpacity;

          if (progress < 1) {
            requestAnimationFrame(fadeIn);
          } else {
            console.log('[OrbitScene] Fade-in complete');
            fadeAnimationRunningRef.current = false;
          }
        };
        requestAnimationFrame(fadeIn);
      } else if (transitionState === 'idle') {
        lastProcessedTransitionRef.current = 'idle';
      }
    }, [transitionState, setSceneOpacity]);

    // Initialize camera position after verifying all scene objects are loaded
    useFrame(() => {
      if (!data?.camera || !bodySlug) return;

      // Start waiting for this body if we haven't initialized it yet
      if (cameraInitializedRef.current !== bodySlug) {
        if (waitingForInitRef.current !== bodySlug) {
          waitingForInitRef.current = bodySlug;
          waitFramesRef.current = 0;
        }
        waitFramesRef.current++;

        // Wait minimum 2 frames for layout to settle
        if (waitFramesRef.current < 2) return;

        // Verify all expected objects are in the scene before starting fade
        // Count expected objects: planet (1) + moons + stations + surface markers
        const expectedMoonCount = data.moons?.length ?? 0;
        const expectedStationCount = data.orbital_stations?.length ?? 0;
        const expectedMarkerCount = data.surface_markers?.length ?? 0;
        const expectedTotalObjects = 1 + expectedMoonCount + expectedStationCount + expectedMarkerCount;

        // Count actual meshes and sprites in scene (excluding helpers like grid, paths, lights)
        let actualObjectCount = 0;
        if (sceneRootRef.current) {
          sceneRootRef.current.traverse((object) => {
            // Count meshes (planet, moons) and sprites (stations, markers)
            if (object.type === 'Mesh' || object.type === 'Sprite') {
              // Only count if it has a material we recognize
              if ('material' in object && object.material) {
                const material = object.material as any;
                // Planet and moons use MeshStandardMaterial, stations/markers use SpriteMaterial
                if (material.type === 'MeshStandardMaterial' || material.type === 'SpriteMaterial') {
                  actualObjectCount++;
                }
              }
            }
          });
        }

        // Wait until all objects are loaded (or timeout after 60 frames ~1 second)
        if (actualObjectCount < expectedTotalObjects && waitFramesRef.current < 60) {
          console.log(`[OrbitScene] Waiting for objects to load: ${actualObjectCount}/${expectedTotalObjects} (frame ${waitFramesRef.current})`);
          return;
        }

        if (actualObjectCount < expectedTotalObjects) {
          console.warn(`[OrbitScene] Timeout waiting for objects. Expected ${expectedTotalObjects}, found ${actualObjectCount}`);
        } else {
          console.log(`[OrbitScene] All ${actualObjectCount} objects loaded, starting animation`);
        }
      }

      // Only initialize once per body
      if (cameraInitializedRef.current !== bodySlug) {
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.aspect = size.width / size.height;
          if (data.camera.fov) {
            camera.fov = data.camera.fov;
          }
          camera.updateProjectionMatrix();
        }

        // Position camera at default view immediately (no zoom animation)
        const targetPosition = new THREE.Vector3(...data.camera.position);
        const targetLookAt = new THREE.Vector3(...data.camera.lookAt);
        camera.position.copy(targetPosition);
        camera.lookAt(targetLookAt);

        // Mark as initialized
        cameraInitializedRef.current = bodySlug;

        // Call onReady callback FIRST, while still at opacity 0
        // This signals to parent that scene is ready to fade in
        if (onReady && readyCalledRef.current !== bodySlug) {
          readyCalledRef.current = bodySlug;
          // Use RAF to ensure rendering has happened
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              onReady();
              // Only start fade-in if NOT already transitioning
              // If transitionState is 'transitioning-in', the useEffect will handle it
              if (transitionState !== 'transitioning-in' && !fadeAnimationRunningRef.current) {
                console.log('[OrbitScene] Starting fade-in animation (initialization)');
                fadeAnimationRunningRef.current = true;
                // Gradually fade in scene opacity to match CSS animation
                // Start a gradual fade from 0 to 1 over 1200ms
                const fadeStart = performance.now();
                const fadeDuration = 1200; // Match CSS animation duration
                const fadeIn = () => {
                  const elapsed = performance.now() - fadeStart;
                  const progress = Math.min(elapsed / fadeDuration, 1);
                  const newOpacity = progress; // Linear fade 0→1

                  setSceneOpacity(newOpacity);
                  sceneOpacityRef.current = newOpacity;

                  if (progress < 1) {
                    requestAnimationFrame(fadeIn);
                  } else {
                    console.log('[OrbitScene] Fade-in complete');
                    fadeAnimationRunningRef.current = false;
                  }
                };
                requestAnimationFrame(fadeIn);
              }
            });
          });
        }
      }
    });

    // Update projection matrix when size changes
    useEffect(() => {
      if (camera instanceof THREE.PerspectiveCamera && size.width > 0 && size.height > 0) {
        camera.aspect = size.width / size.height;
        camera.updateProjectionMatrix();

        if (cameraInitializedRef.current === bodySlug && data?.camera) {
          const targetLookAt = new THREE.Vector3(...data.camera.lookAt);
          camera.lookAt(targetLookAt);
        }
      }
    }, [camera, size.width, size.height, bodySlug, data?.camera]);

    // Sync data to store if provided via props
    useEffect(() => {
      if (dataProp && dataProp !== storeData) {
        setOrbitMapData(dataProp);
      }
    }, [dataProp, storeData, setOrbitMapData]);

    // Reset start time when body changes
    useEffect(() => {
      startTimeRef.current = Date.now();
    }, [bodySlug]);

    // Track last valid reticle position
    const lastReticlePositionRef = useRef<[number, number, number]>([0, 0, 0]);

    // Selection reticle position
    const reticlePosition = useMemo<[number, number, number]>(() => {
      if (!selectedElement?.name || !selectedElement?.type) {
        return lastReticlePositionRef.current;
      }
      const pos = getElementPosition(selectedElement.name, selectedElement.type);
      if (!pos) return lastReticlePositionRef.current;
      const validPos: [number, number, number] = [pos.x, pos.y, pos.z];
      lastReticlePositionRef.current = validPos;
      return validPos;
    }, [selectedElement, getElementPosition]);

    // Dynamic position getter for reticle tracking
    const getReticlePosition = useCallback((): [number, number, number] | null => {
      if (!selectedElement?.name || !selectedElement?.type || paused) return null;
      const pos = getElementPosition(selectedElement.name, selectedElement.type);
      if (!pos) return null;
      const newPos: [number, number, number] = [pos.x, pos.y, pos.z];
      lastReticlePositionRef.current = newPos;
      return newPos;
    }, [selectedElement, paused, getElementPosition]);

    // Calculate reticle scale based on element type.
    // The reticle texture draws its outer circle at 31.25% of the sprite scale,
    // and the pulse shrinks to 90%. So the visible ring radius at pulse min is:
    //   ringRadius = spriteScale * 0.3125 * 0.9
    // We need ringRadius > moonRadius + padding, so:
    //   spriteScale > (moonRadius + padding) / (0.3125 * 0.9)
    const MIN_RETICLE_SCALE = 10;
    const RETICLE_RING_FACTOR = 0.3125 * 0.9; // ~0.281
    const RETICLE_PADDING = 2;
    const reticleScale = useMemo(() => {
      if (!selectedElement?.type) return MIN_RETICLE_SCALE;
      if (selectedElement.type === 'moon') {
        const moonData = data?.moons?.find((m) => m.name === selectedElement.name);
        const radius = moonData?.size ?? 3.0;
        const needed = (radius + RETICLE_PADDING) / RETICLE_RING_FACTOR;
        return Math.max(MIN_RETICLE_SCALE, needed);
      }
      if (selectedElement.type === 'station') return MIN_RETICLE_SCALE;
      return MIN_RETICLE_SCALE; // surface
    }, [selectedElement, data?.moons]);

    // Handle element click
    const handleMoonClick = useCallback(
      (moon: MoonData) => {
        if (selectedElement?.name === moon.name) {
          // Deselect if clicking the same element
          selectOrbitElement(null, null);
          setTrackedElement(null, null);
          setAnimationPaused(false);
          returnToDefault();
          onElementSelect?.(null, null);
        } else {
          // Select new element
          selectOrbitElement('moon', moon);
          setTrackedElement(moon.name, 'moon');
          setAnimationPaused(false);
          moveToElement(moon.name, 'moon');
          onElementSelect?.('moon', moon);
        }
      },
      [
        selectedElement,
        selectOrbitElement,
        setTrackedElement,
        returnToDefault,
        moveToElement,
        onElementSelect,
      ]
    );

    const handleStationClick = useCallback(
      (station: StationData) => {
        if (selectedElement?.name === station.name) {
          selectOrbitElement(null, null);
          setTrackedElement(null, null);
          setAnimationPaused(false);
          returnToDefault();
          onElementSelect?.(null, null);
        } else {
          selectOrbitElement('station', station);
          setTrackedElement(station.name, 'station');
          setAnimationPaused(false);
          moveToElement(station.name, 'station');
          onElementSelect?.('station', station);
        }
      },
      [
        selectedElement,
        selectOrbitElement,
        setTrackedElement,
        returnToDefault,
        moveToElement,
        onElementSelect,
      ]
    );

    const handleSurfaceMarkerClick = useCallback(
      (marker: SurfaceMarkerData) => {
        if (selectedElement?.name === marker.name) {
          selectOrbitElement(null, null);
          setTrackedElement(null, null);
          setAnimationPaused(false);
          returnToDefault();
          onElementSelect?.(null, null);
        } else {
          selectOrbitElement('surface', marker);
          setTrackedElement(marker.name, 'surface');
          // Pause animation when selecting surface marker
          setAnimationPaused(true);
          moveToElement(marker.name, 'surface');
          onElementSelect?.('surface', marker);
        }
      },
      [
        selectedElement,
        selectOrbitElement,
        setTrackedElement,
        returnToDefault,
        moveToElement,
        onElementSelect,
      ]
    );

    // Handle selection changes from props
    useEffect(() => {
      const propSelection = selectedElementProp ?? { type: null, name: null };
      const storeSelection = storeSelectedElement;

      // If prop selection is different from store, update store
      if (propSelection.name !== storeSelection.name) {
        if (propSelection.name === null) {
          selectOrbitElement(null, null);
          setTrackedElement(null, null);
          setAnimationPaused(false);
          returnToDefault();
        } else if (propSelection.type && propSelection.name) {
          // Find the element data
          let elementData: MoonData | StationData | SurfaceMarkerData | null = null;
          if (propSelection.type === 'moon') {
            elementData = data?.moons?.find((m) => m.name === propSelection.name) ?? null;
          } else if (propSelection.type === 'station') {
            elementData = data?.orbital_stations?.find((s) => s.name === propSelection.name) ?? null;
          } else if (propSelection.type === 'surface') {
            elementData = data?.surface_markers?.find((m) => m.name === propSelection.name) ?? null;
          }

          if (elementData) {
            selectOrbitElement(propSelection.type, elementData);
            setTrackedElement(propSelection.name, propSelection.type);
            setAnimationPaused(propSelection.type === 'surface');
            moveToElement(propSelection.name, propSelection.type);
          }
        }
      }
    }, [
      selectedElementProp,
      storeSelectedElement,
      data,
      selectOrbitElement,
      setTrackedElement,
      returnToDefault,
      moveToElement,
    ]);

    // Position update callbacks for elements
    const updateMoonPosition = useCallback((name: string) => (position: THREE.Vector3) => {
      elementPositionsRef.current.set(`moon:${name}`, position.clone());
    }, []);

    const updateStationPosition = useCallback((name: string) => (position: THREE.Vector3) => {
      elementPositionsRef.current.set(`station:${name}`, position.clone());
    }, []);

    const updateMarkerPosition = useCallback((name: string) => (position: THREE.Vector3) => {
      elementPositionsRef.current.set(`surface:${name}`, position.clone());
    }, []);

    // Update scene opacity for fade-in effect each frame
    useFrame(() => {
      // Update scene opacity for fade-in effect (even when paused)
      const currentOpacity = getSceneOpacity();
      if (currentOpacity !== sceneOpacityRef.current) {
        sceneOpacityRef.current = currentOpacity;
      }
    });

    // Direct material opacity updates (bypasses React prop system for 60fps updates)
    useFrame(() => {
      if (!sceneRootRef.current) return;

      const opacity = sceneOpacityRef.current;

      // Traverse all scene objects and directly update material opacity
      sceneRootRef.current.traverse((object: THREE.Object3D) => {
        if ('material' in object && object.material) {
          const material = object.material as THREE.Material;

          // Only update transparent materials that have opacity property
          if (material.transparent && 'opacity' in material) {
            // Store base opacity on first encounter (before any fade modifications)
            if (!('_baseOpacity' in material)) {
              (material as any)._baseOpacity = (material as any).opacity || 1;
            }

            // Apply scene fade: current opacity = base opacity * scene fade
            const baseOpacity = (material as any)._baseOpacity;
            (material as any).opacity = baseOpacity * opacity;

            // Mark material as needing update
            material.needsUpdate = true;
          }
        }

        // Handle point lights (for sun)
        if (object instanceof THREE.PointLight) {
          if (!('_baseIntensity' in object)) {
            (object as any)._baseIntensity = object.intensity;
          }
          object.intensity = (object as any)._baseIntensity * opacity;
        }
      });
    });

    // Update camera tracking each frame
    useFrame(() => {
      if (paused) return;
      updateTracking();
    });

    // Control target for camera
    const controlTarget = useMemo(() => {
      if (!selectedElement?.name || !selectedElement?.type) return undefined;
      const pos = getElementPosition(selectedElement.name, selectedElement.type);
      return pos ?? undefined;
    }, [selectedElement, getElementPosition]);

    // Dynamic control target getter
    const getControlTarget = useCallback((): THREE.Vector3 | null => {
      if (!selectedElement?.name || !selectedElement?.type) return null;
      return getElementPosition(selectedElement.name, selectedElement.type);
    }, [selectedElement, getElementPosition]);

    // Handle camera changes from controls
    const handleCameraChange = useCallback(
      (position: THREE.Vector3, target: THREE.Vector3) => {
        if (selectedElement?.name) {
          const offset = new THREE.Vector3(
            position.x - target.x,
            position.y - target.y,
            position.z - target.z
          );
          setCameraOffset(offset);
        }
      },
      [selectedElement, setCameraOffset]
    );


    // Expose imperative handle to parent
    useImperativeHandle(
      ref,
      () => ({
        selectElementAndWait: async (
          elementName: string,
          elementType: 'moon' | 'station' | 'surface'
        ) => {
          let elementData: MoonData | StationData | SurfaceMarkerData | null = null;
          if (elementType === 'moon') {
            elementData = data?.moons?.find((m) => m.name === elementName) ?? null;
          } else if (elementType === 'station') {
            elementData = data?.orbital_stations?.find((s) => s.name === elementName) ?? null;
          } else if (elementType === 'surface') {
            elementData = data?.surface_markers?.find((m) => m.name === elementName) ?? null;
          }

          if (elementData) {
            selectOrbitElement(elementType, elementData);
            setTrackedElement(elementName, elementType);
            setAnimationPaused(elementType === 'surface');
            await moveToElement(elementName, elementType);
          }
        },
        getElementPositions: () => elementPositionsRef.current,
      }),
      [
        data,
        selectOrbitElement,
        setTrackedElement,
        moveToElement,
      ]
    );

    // Clear reticle position ref on unmount to prevent stale position when re-mounting
    useEffect(() => {
      return () => {
        lastReticlePositionRef.current = [0, 0, 0];
      };
    }, []);

    // Don't render if no data
    if (!data) {
      return null;
    }

    const planetSize = data.planet.size ?? 15.0;
    const axialTilt = (data.planet.axial_tilt ?? 0) * (Math.PI / 180);

    return (
      <>
        {/* Ambient light for scene */}
        <ambientLight color={0x778899} intensity={2.25} />

        {/* Scene content with fade-in effect */}
        <group ref={sceneRootRef}>
          {/* Background starfield */}
          <BackgroundStars animated={!paused} />

          {/* Sun with directional lighting */}
          <Sun
            declination={data.planet.sun_declination}
            lightIntensity={4.0}
            castShadow
          />

          {/* Central planet */}
          <CentralPlanet
            planet={data.planet}
            animationPaused={animationPaused}
            rotationRef={rotationRef}
          />

          {/* Lat/Lon grid overlay */}
          <LatLonGrid
            planetSize={planetSize}
            axialTilt={axialTilt}
            rotationRef={rotationRef}
            animationPaused={animationPaused}
            showAxisLine={true}
          />

          {/* Orbital paths for moons */}
          {data.moons?.map((moon) => (
            <OrbitElementPath
              key={`orbit-moon-${moon.name}`}
              radius={moon.orbital_radius}
              inclination={moon.inclination}
            />
          ))}

          {/* Orbital paths for stations */}
          {data.orbital_stations?.map((station) => (
            <OrbitElementPath
              key={`orbit-station-${station.name}`}
              radius={station.orbital_radius}
              inclination={station.inclination}
            />
          ))}

          {/* Moons */}
          {data.moons?.map((moon) => (
            <Moon
              key={`moon-${moon.name}`}
              moon={moon}
              startTime={startTimeRef.current}
              isSelected={selectedElement?.name === moon.name}
              onClick={handleMoonClick}
              animationPaused={animationPaused}
              onPositionUpdate={updateMoonPosition(moon.name)}
            />
          ))}

          {/* Orbital stations */}
          {data.orbital_stations?.map((station) => (
            <OrbitalStation
              key={`station-${station.name}`}
              station={station}
              startTime={startTimeRef.current}
              isSelected={selectedElement?.name === station.name}
              onClick={handleStationClick}
              animationPaused={animationPaused}
              onPositionUpdate={updateStationPosition(station.name)}
            />
          ))}

          {/* Surface markers */}
          {data.surface_markers?.map((marker) => (
            <SurfaceMarker
              key={`marker-${marker.name}`}
              marker={marker}
              planetRadius={planetSize}
              axialTilt={axialTilt}
              rotationRef={rotationRef}
              isSelected={selectedElement?.name === marker.name}
              onClick={handleSurfaceMarkerClick}
              animationPaused={animationPaused}
              onPositionUpdate={updateMarkerPosition(marker.name)}
            />
          ))}
        </group>

        {/* Selection reticle (outside group - not affected by opacity) */}
        {/* Hide reticle until scene has faded in to prevent showing before objects are visible */}
        <SelectionReticle
          position={reticlePosition}
          visible={!!(selectedElement?.name && selectedElement?.type && sceneOpacityRef.current > 0.8)}
          scale={reticleScale}
          getPosition={getReticlePosition}
        />

        {/* Camera controls (outside group - not affected by opacity) */}
        <OrbitControls
          enabled={!paused}
          target={controlTarget}
          getTarget={getControlTarget}
          hasSelection={!!(selectedElement?.name)}
          onCameraChange={handleCameraChange}
          zoomLimits={data?.camera?.zoom_limits}
        />
      </>
    );
  }
);
