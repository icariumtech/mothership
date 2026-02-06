/**
 * SystemScene - Main R3F component for system map visualization
 *
 * Renders the complete system view including:
 * - Background starfield
 * - Central star with corona glow
 * - Orbiting planets with orbital motion
 * - Orbital path lines
 * - Planet rings
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
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BackgroundStars } from './galaxy';
import { SelectionReticle } from './shared';
import {
  CentralStar,
  Planet,
  OrbitPath,
  SystemControls,
} from './system';
import {
  useSceneStore,
  useSystemMapData,
  useSelectedPlanet,
  useIsPaused,
} from './hooks/useSceneStore';
import { useSystemCamera } from './hooks/useSystemCamera';
import type { SystemMapData, BodyData } from '@/types/systemMap';

// Constants
const ORBITAL_PERIOD_TARGET_SECONDS = 10;
const SIZE_MULTIPLIER = 2;

export interface SystemSceneProps {
  /** System map data (optional, can also read from store) */
  data?: SystemMapData | null;
  /** System slug identifier */
  systemSlug?: string | null;
  /** Currently selected planet (optional, can also read from store) */
  selectedPlanet?: BodyData | null;
  /** Whether rendering is paused */
  paused?: boolean;
  /** Transition state for coordinating fade effects */
  transitionState?: 'idle' | 'transitioning-out' | 'transitioning-in';
  /** Callback when a planet is selected */
  onPlanetSelect?: (planet: BodyData | null) => void;
  /** Callback when scene is fully constructed and ready */
  onReady?: () => void;
}

export interface SystemSceneHandle {
  /** Animate camera to focus on a planet */
  selectPlanetAndWait: (planetName: string) => Promise<void>;
  /** Instantly position camera on a planet */
  positionCameraOnPlanet: (planetName: string) => void;
  /** Get planet positions map */
  getPlanetPositions: () => Map<string, THREE.Vector3>;
}

export const SystemScene = forwardRef<SystemSceneHandle, SystemSceneProps>(
  function SystemScene(
    {
      data: dataProp,
      systemSlug,
      selectedPlanet: selectedPlanetProp,
      paused: pausedProp = false,
      transitionState = 'idle',
      onPlanetSelect,
      onReady,
    },
    ref
  ) {

    // Get data from store or props
    const storeData = useSystemMapData();
    const storeSelectedPlanet = useSelectedPlanet();
    const storePaused = useIsPaused();

    // Use props if provided, otherwise fall back to store
    const data = dataProp ?? storeData;
    const selectedPlanet = selectedPlanetProp ?? storeSelectedPlanet;
    const paused = pausedProp || storePaused;

    // Store actions
    const selectPlanet = useSceneStore((state) => state.selectPlanet);
    const setSystemMapData = useSceneStore((state) => state.setSystemMapData);

    // Get R3F camera and size info
    const { camera, size } = useThree();

    // Track if we've initialized the camera for this system
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

    // Initialize camera position and lookAt after a few frames to let layout settle
    // Using useFrame ensures this happens within R3F's render cycle
    useFrame(() => {
      if (!data?.camera || !systemSlug) return;

      // Start waiting for this system if we haven't initialized it yet
      if (cameraInitializedRef.current !== systemSlug) {
        if (waitingForInitRef.current !== systemSlug) {
          // New system - start the wait counter
          waitingForInitRef.current = systemSlug;
          waitFramesRef.current = 0;
        }
        waitFramesRef.current++;

        // Wait 2 frames for layout to settle before initializing
        if (waitFramesRef.current < 2) return;
      }

      // Only initialize once per system (avoid resetting during transitions)
      if (cameraInitializedRef.current !== systemSlug) {
        // Update aspect ratio and projection matrix to match current canvas size
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.aspect = size.width / size.height;
          if (data.camera.fov) {
            camera.fov = data.camera.fov;
          }
          camera.updateProjectionMatrix();
        }

        // Position camera at default view immediately (no animation)
        const targetPosition = new THREE.Vector3(...data.camera.position);
        const targetLookAt = new THREE.Vector3(...data.camera.lookAt);
        camera.position.copy(targetPosition);
        camera.lookAt(targetLookAt);

        // Mark as initialized
        cameraInitializedRef.current = systemSlug;

        // Call onReady callback FIRST, while still at opacity 0
        // This signals to parent that scene is ready to fade in
        // The parent will wait for this, then the CSS animation will fade in
        if (onReady && readyCalledRef.current !== systemSlug) {
          readyCalledRef.current = systemSlug;
          // Use RAF to ensure rendering has happened
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              onReady();
              // Only start fade-in if NOT already transitioning
              // If transitionState is 'transitioning-in', the useEffect will handle it
              if (transitionState !== 'transitioning-in' && !fadeAnimationRunningRef.current) {
                console.log('[SystemScene] Starting fade-in animation (initialization)');
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

    // Update projection matrix when size changes (handles initial layout)
    // Also re-apply lookAt since aspect ratio change can affect the view
    useEffect(() => {
      if (camera instanceof THREE.PerspectiveCamera && size.width > 0 && size.height > 0) {
        camera.aspect = size.width / size.height;
        camera.updateProjectionMatrix();

        // Re-apply lookAt if camera has been initialized for this system
        if (cameraInitializedRef.current === systemSlug && data?.camera) {
          const targetLookAt = new THREE.Vector3(...data.camera.lookAt);
          camera.lookAt(targetLookAt);
        }
      }
    }, [camera, size.width, size.height, systemSlug, data?.camera]);

    // Animation start time
    const startTimeRef = useRef(Date.now());

    // Calculate speed multiplier based on orbital periods
    const speedMultiplier = useMemo(() => {
      if (!data?.bodies?.length) return 10;
      const minOrbitalPeriod = Math.min(
        ...data.bodies.map((b) => b.orbital_period ?? 365)
      );
      return minOrbitalPeriod / ORBITAL_PERIOD_TARGET_SECONDS;
    }, [data?.bodies]);

    // Build planet positions map (updated each frame)
    const planetPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());

    // Calculate planet position at current time
    const calculatePlanetPosition = useCallback(
      (body: BodyData): THREE.Vector3 => {
        const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000;
        const orbitalPeriod = body.orbital_period ?? 365;
        const orbitalSpeed = (2 * Math.PI) / orbitalPeriod * speedMultiplier;
        const initialAngle = (body.orbital_angle ?? 0) * (Math.PI / 180);
        const currentAngle = initialAngle + orbitalSpeed * elapsedSeconds;
        const inclination = (body.inclination ?? 0) * (Math.PI / 180);

        const x = Math.cos(currentAngle) * body.orbital_radius;
        const z = Math.sin(currentAngle) * body.orbital_radius;

        const posX = x * Math.cos(inclination);
        const posY = x * Math.sin(inclination);
        const posZ = z;

        return new THREE.Vector3(posX, posY, posZ);
      },
      [speedMultiplier]
    );

    // Get planet position by name
    const getPlanetPosition = useCallback(
      (planetName: string): THREE.Vector3 | null => {
        if (!data?.bodies) return null;
        const body = data.bodies.find((b) => b.name === planetName);
        if (!body) return null;
        return calculatePlanetPosition(body);
      },
      [data?.bodies, calculatePlanetPosition]
    );

    // Camera hooks
    const {
      moveToPlanet,
      positionOnPlanet,
      returnToDefault,
      updateTracking,
      setTrackedPlanet,
      // getCameraOffset is available but not currently used
      setCameraOffset,
      getSceneOpacity,
      setSceneOpacity,
      isAnimating,
    } = useSystemCamera({
      getPlanetPosition,
      defaultCamera: data?.camera,
    });

    // Reset opacity to 0 when switching to a new system (before zoomIn animation)
    // CRITICAL: Use useLayoutEffect to run synchronously BEFORE paint, preventing flash
    useLayoutEffect(() => {
      if (systemSlug && cameraInitializedRef.current !== systemSlug) {
        sceneOpacityRef.current = 0;
        setSceneOpacity(0);
      }
    }, [systemSlug, setSceneOpacity]);

    // Fade out scene materials when transitioning out
    useEffect(() => {
      // Skip if we've already processed this transition state
      if (transitionState === lastProcessedTransitionRef.current) {
        return;
      }

      if (transitionState === 'transitioning-out') {
        if (fadeAnimationRunningRef.current) {
          console.log('[SystemScene] Skipping fade-out - animation already running');
          return;
        }
        console.log('[SystemScene] Starting fade-out animation');
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
            console.log('[SystemScene] Fade-out complete');
            fadeAnimationRunningRef.current = false;
          }
        };
        requestAnimationFrame(fadeOut);
      } else if (transitionState === 'transitioning-in') {
        // Fade in when returning to this scene (e.g., back from orbit)
        if (fadeAnimationRunningRef.current) {
          console.log('[SystemScene] Skipping fade-in - animation already running');
          return;
        }
        console.log('[SystemScene] Starting fade-in animation (transition)');
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
            console.log('[SystemScene] Fade-in complete');
            fadeAnimationRunningRef.current = false;
          }
        };
        requestAnimationFrame(fadeIn);
      } else if (transitionState === 'idle') {
        // Update tracking when transition completes
        lastProcessedTransitionRef.current = 'idle';
      }
    }, [transitionState, setSceneOpacity]);

    // Update planet positions and scene opacity each frame
    useFrame(() => {
      if (!data?.bodies) return;

      if (!paused) {
        data.bodies.forEach((body) => {
          const pos = calculatePlanetPosition(body);
          planetPositionsRef.current.set(body.name, pos);
        });

        // Update camera tracking
        updateTracking();
      }

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

        // Handle point lights (for star corona)
        if (object instanceof THREE.PointLight) {
          if (!('_baseIntensity' in object)) {
            (object as any)._baseIntensity = object.intensity;
          }
          object.intensity = (object as any)._baseIntensity * opacity;
        }
      });
    });


    // Sync data to store if provided via props
    useEffect(() => {
      if (dataProp && dataProp !== storeData) {
        setSystemMapData(dataProp);
      }
    }, [dataProp, storeData, setSystemMapData]);

    // Reset start time when system changes
    useEffect(() => {
      startTimeRef.current = Date.now();
    }, [systemSlug]);

    // Track last valid reticle position (to avoid jumping to origin during fade-out)
    const lastReticlePositionRef = useRef<[number, number, number]>([0, 0, 0]);

    // Selection reticle position - keep last position when deselecting for smooth fade-out
    const reticlePosition = useMemo<[number, number, number]>(() => {
      if (!selectedPlanet) {
        return lastReticlePositionRef.current;
      }
      const pos = getPlanetPosition(selectedPlanet.name);
      if (!pos) return lastReticlePositionRef.current;
      const validPos: [number, number, number] = [pos.x, pos.y, pos.z];
      lastReticlePositionRef.current = validPos;
      return validPos;
    }, [selectedPlanet, getPlanetPosition]);

    // Dynamic position getter for reticle tracking
    const getReticlePosition = useCallback((): [number, number, number] | null => {
      if (!selectedPlanet || paused) return null;
      const pos = getPlanetPosition(selectedPlanet.name);
      if (!pos) return null;
      const newPos: [number, number, number] = [pos.x, pos.y, pos.z];
      // Update last valid position for fade-out
      lastReticlePositionRef.current = newPos;
      return newPos;
    }, [selectedPlanet, paused, getPlanetPosition]);

    // Calculate reticle scale based on planet size
    const reticleScale = useMemo(() => {
      if (!selectedPlanet) return 10;
      const baseScale = (selectedPlanet.size ?? 1.0) * SIZE_MULTIPLIER * 3.0;
      return selectedPlanet.has_rings ? baseScale * 1.6 : baseScale;
    }, [selectedPlanet]);

    // Handle planet click
    const handlePlanetClick = useCallback(
      (body: BodyData) => {
        if (selectedPlanet?.name === body.name) {
          // Deselect if clicking the same planet
          selectPlanet(null);
          // returnToDefault handles clearing tracking state and animating
          returnToDefault();
          onPlanetSelect?.(null);
        } else {
          // Select new planet
          selectPlanet(body);
          // moveToPlanet will set up tracking after animation completes
          moveToPlanet(body);
          onPlanetSelect?.(body);
        }
      },
      [selectedPlanet, selectPlanet, moveToPlanet, returnToDefault, onPlanetSelect]
    );

    // Track previous selection to detect changes
    const prevSelectedPlanetRef = useRef<BodyData | null>(null);

    // Handle selection changes from props
    useEffect(() => {
      const prevSelection = prevSelectedPlanetRef.current;
      const newSelection = selectedPlanetProp ?? null;

      if (prevSelection?.name !== newSelection?.name) {
        if (newSelection === null) {
          // Deselected - return to default view
          // returnToDefault handles clearing tracking state and animating
          returnToDefault();
        } else {
          // New selection - check if camera is already positioned correctly
          const planetPos = getPlanetPosition(newSelection.name);
          if (planetPos) {
            const distance = camera.position.distanceTo(planetPos);

            // If camera is already animating, skip - prevents duplicate animations
            // when selection propagates from click handler -> parent -> prop
            if (isAnimating()) {
              // Just set up tracking without starting a new animation
              setTrackedPlanet(newSelection);
            }
            // If camera is already close to the planet (within 50 units), skip animation
            // This prevents unwanted animation when using positionCameraOnPlanet
            else if (distance > 50) {
              // Camera is far - animate to planet
              setTrackedPlanet(newSelection);
              moveToPlanet(newSelection);
            } else {
              // Camera is already close - just set up tracking without animation
              setTrackedPlanet(newSelection);
            }
          } else {
            // Fallback - animate if we can't determine position
            setTrackedPlanet(newSelection);
            moveToPlanet(newSelection);
          }
        }
      }

      prevSelectedPlanetRef.current = newSelection;
    }, [selectedPlanetProp, setTrackedPlanet, moveToPlanet, returnToDefault, getPlanetPosition, camera, isAnimating]);

    // Control target - orbits around selected planet or origin
    // Static target used as fallback when no planet is selected
    const controlTarget = useMemo(() => {
      if (!selectedPlanet) return undefined;
      const pos = getPlanetPosition(selectedPlanet.name);
      return pos ?? undefined;
    }, [selectedPlanet, getPlanetPosition]);

    // Dynamic target getter for controls - always returns current planet position
    const getControlTarget = useCallback((): THREE.Vector3 | null => {
      if (!selectedPlanet) return null;
      return getPlanetPosition(selectedPlanet.name);
    }, [selectedPlanet, getPlanetPosition]);

    // Handle camera changes from controls
    const handleCameraChange = useCallback(
      (position: THREE.Vector3, target: THREE.Vector3) => {
        if (selectedPlanet) {
          const offset = new THREE.Vector3(
            position.x - target.x,
            position.y - target.y,
            position.z - target.z
          );
          setCameraOffset(offset);
        }
      },
      [selectedPlanet, setCameraOffset]
    );

    // Expose imperative handle to parent
    useImperativeHandle(
      ref,
      () => ({
        selectPlanetAndWait: async (planetName: string) => {
          if (!data?.bodies) return;
          const body = data.bodies.find((b) => b.name === planetName);
          if (body) {
            selectPlanet(body);
            setTrackedPlanet(body);
            await moveToPlanet(body);
          }
        },
        positionCameraOnPlanet: (planetName: string) => {
          if (!data?.bodies) return;
          const body = data.bodies.find((b) => b.name === planetName);
          if (body) {
            selectPlanet(body);
            positionOnPlanet(body);
          }
        },
        getPlanetPositions: () => planetPositionsRef.current,
      }),
      [data?.bodies, selectPlanet, setTrackedPlanet, moveToPlanet, positionOnPlanet]
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

    return (
      <>
        {/* Ambient light for scene */}
        <ambientLight color={0x222244} intensity={0.2} />

        {/* Scene root group for direct material updates */}
        <group ref={sceneRootRef}>
          {/* Background starfield (reuse from galaxy view) */}
          <BackgroundStars animated={!paused} />

          {/* Central star */}
          <CentralStar star={data.star} />

          {/* Orbital paths */}
          {data.bodies &&
            (!data.orbits || data.orbits.show !== false) &&
            data.bodies.map((body) => (
              <OrbitPath
                key={`orbit-${body.name}`}
                body={body}
                settings={data.orbits}
              />
            ))}

          {/* Planets */}
          {data.bodies &&
            data.bodies.map((body) => (
              <Planet
                key={`planet-${body.name}`}
                body={body}
                speedMultiplier={speedMultiplier}
                startTime={startTimeRef.current}
                isSelected={selectedPlanet?.name === body.name}
                onClick={handlePlanetClick}
              />
            ))}
        </group>

        {/* Selection reticle */}
        {/* Hide reticle until scene has faded in to prevent showing before objects are visible */}
        <SelectionReticle
          position={reticlePosition}
          visible={!!(selectedPlanet && sceneOpacityRef.current > 0.8)}
          scale={reticleScale}
          getPosition={getReticlePosition}
        />

        {/* Camera controls */}
        <SystemControls
          enabled={!paused && transitionState === 'idle'}
          target={controlTarget}
          getTarget={getControlTarget}
          hasSelection={!!selectedPlanet}
          onCameraChange={handleCameraChange}
        />
      </>
    );
  }
);
