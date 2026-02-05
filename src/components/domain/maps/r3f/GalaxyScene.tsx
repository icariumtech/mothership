/**
 * GalaxyScene - Main R3F component for galaxy map visualization
 *
 * Renders the complete galaxy view including:
 * - Background starfield
 * - Star systems (display only, selection via menu)
 * - Travel routes between systems
 * - Nebulae with animations
 * - Selection reticle
 * - Camera controls
 *
 * Integrates with Zustand store for state management.
 */

import { useMemo, useImperativeHandle, forwardRef, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  BackgroundStars,
  StarSystems,
  TravelRoutes,
  Nebulae,
  GalaxyControls,
} from './galaxy';
import { SelectionReticle } from './shared';
import {
  useSceneStore,
  useStarMapData,
  useTransitionState,
  useIsPaused,
} from './hooks/useSceneStore';
import { useGalaxyCamera } from './hooks/useGalaxyCamera';
import { buildStarPositionMap } from './hooks/useStarSelection';
import type { StarMapData } from '@/types/starMap';

export interface GalaxySceneProps {
  /** Star map data (optional, can also read from store) */
  data?: StarMapData | null;
  /** Currently selected system name (optional, can also read from store) */
  selectedSystem?: string | null;
  /** Whether rendering is paused */
  paused?: boolean;
}

export interface GalaxySceneHandle {
  /** Animate camera to focus on a system */
  selectSystemAndWait: (systemName: string) => Promise<void>;
  /** Instantly position camera on a system */
  positionCameraOnSystem: (systemName: string) => void;
  /** Get star positions map */
  getStarPositions: () => Map<string, [number, number, number]>;
}

export const GalaxyScene = forwardRef<GalaxySceneHandle, GalaxySceneProps>(
  function GalaxyScene(
    {
      data: dataProp,
      selectedSystem: selectedSystemProp,
      paused: pausedProp = false,
    },
    ref
  ) {
    useThree();

    // Get data from store or props
    const storeData = useStarMapData();
    const transitionState = useTransitionState();
    const storePaused = useIsPaused();

    // Use props if provided, otherwise fall back to store
    // For selection, always use props - don't fall back to store since parent manages selection state
    const data = dataProp ?? storeData;
    const selectedSystem = selectedSystemProp;
    const paused = pausedProp || storePaused;

    // Store actions
    const selectSystem = useSceneStore((state) => state.selectSystem);
    const setStarMapData = useSceneStore((state) => state.setStarMapData);
    const setAutoRotate = useSceneStore((state) => state.setAutoRotate);

    // Build star positions map
    const starPositions = useMemo(() => buildStarPositionMap(data), [data]);

    // Camera hooks
    const {
      moveToSystem,
      moveToOrigin,
      positionOnSystem,
    } = useGalaxyCamera({
      starPositions,
    });

    // Sync data to store if provided via props
    useEffect(() => {
      if (dataProp && dataProp !== storeData) {
        setStarMapData(dataProp);
      }
    }, [dataProp, storeData, setStarMapData]);

    // Track last valid reticle position (to avoid jumping to origin during fade-out)
    const lastReticlePositionRef = useRef<[number, number, number]>([0, 0, 0]);

    // Selection reticle position - keep last position when deselecting for smooth fade-out
    const reticlePosition = useMemo<[number, number, number]>(() => {
      if (!selectedSystem) {
        // Return last valid position during fade-out
        return lastReticlePositionRef.current;
      }
      const pos = starPositions.get(selectedSystem);
      const validPos = pos ?? [0, 0, 0];
      // Update ref with valid position
      lastReticlePositionRef.current = validPos;
      return validPos;
    }, [selectedSystem, starPositions]);

    // Expose imperative handle to parent
    useImperativeHandle(
      ref,
      () => ({
        selectSystemAndWait: async (systemName: string) => {
          selectSystem(systemName);
          await moveToSystem(systemName);
        },
        positionCameraOnSystem: (systemName: string) => {
          selectSystem(systemName);
          positionOnSystem(systemName);
        },
        getStarPositions: () => starPositions,
      }),
      [selectSystem, moveToSystem, positionOnSystem, starPositions]
    );

    // Track previous selection to detect changes (all selection is via menu)
    const prevSelectedSystemRef = useRef<string | null>(null);

    // Handle selection changes from menu
    useEffect(() => {
      const prevSelection = prevSelectedSystemRef.current;
      const newSelection = selectedSystemProp ?? null;

      // Only animate if selection actually changed
      if (prevSelection !== newSelection) {
        if (newSelection === null) {
          // Deselected - return to origin
          moveToOrigin();
        } else {
          // New selection or changed selection - animate to it
          moveToSystem(newSelection);
        }
      }

      prevSelectedSystemRef.current = newSelection;
    }, [selectedSystemProp, moveToSystem, moveToOrigin]);

    // Enable auto-rotate after initial render
    useEffect(() => {
      const timer = setTimeout(() => {
        setAutoRotate(true);
      }, 500);
      return () => clearTimeout(timer);
    }, [setAutoRotate]);

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
        <ambientLight color={0x222244} intensity={0.3} />

        {/* Background starfield */}
        <BackgroundStars animated={!paused} />

        {/* Star systems (display only, selection via menu) */}
        <StarSystems
          systems={data.systems}
          selectedSystem={selectedSystem}
        />

        {/* Travel routes */}
        {data.routes && data.routes.length > 0 && (
          <TravelRoutes routes={data.routes} systems={data.systems} />
        )}

        {/* Nebulae */}
        {data.nebulae && data.nebulae.length > 0 && (
          <Nebulae nebulae={data.nebulae} />
        )}

        {/* Selection reticle */}
        <SelectionReticle
          position={reticlePosition}
          visible={!!selectedSystem}
        />

        {/* Camera controls */}
        <GalaxyControls
          enabled={!paused && transitionState === 'idle'}
        />
      </>
    );
  }
);
