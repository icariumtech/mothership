import { useState, useEffect, useMemo, useCallback, useRef, startTransition } from 'react';
import ReactDOM from 'react-dom/client';
import gsap from 'gsap';
import '../styles/global.css';
import './SharedConsole.css';
import { TerminalHeader } from '@components/layout/TerminalHeader';
import { StandbyView } from '@components/domain/dashboard/StandbyView';
import { BridgeView } from '@components/domain/dashboard/BridgeView';
import { BridgeTab } from '@components/domain/dashboard/TabBar';
import { InfoPanel, buildSystemInfoHTML, buildPlanetInfoHTML, buildMoonInfoHTML, buildStationInfoHTML, buildSurfaceMarkerInfoHTML } from '@components/domain/dashboard/InfoPanel';
import { StarMapPanel } from '@components/domain/dashboard/StarMapPanel';
import { GalaxyMap, GalaxyMapHandle } from '@components/domain/maps/GalaxyMap';
import { SystemMap, SystemMapHandle } from '@components/domain/maps/SystemMap';
import { OrbitMap, OrbitMapHandle } from '@components/domain/maps/OrbitMap';
import { CharonDialog } from '@components/domain/charon/CharonDialog';
import { CommTerminalDialog } from '@components/domain/terminal/CommTerminalDialog';
import { EncounterView } from '@components/domain/encounter/EncounterView';
import { charonApi } from '@/services/charonApi';
import { terminalApi } from '@/services/terminalApi';
import { useTransitionGuard } from '@hooks/useDebounce';
import { useSceneStore } from '@/stores/sceneStore';
import { TRANSITION_TIMING, waitForTypewriter } from '@/utils/transitionCoordinator';
import type { StarMapData } from '../types/starMap';
import type { SystemMapData, BodyData } from '../types/systemMap';
import type { MoonData, StationData, SurfaceMarkerData, OrbitMapData } from '../types/orbitMap';
import type { DoorStatusState } from '../types/encounterMap';

// Transition state type
type TransitionState = 'idle' | 'transitioning-out' | 'transitioning-in';

// View types matching Django's ActiveView model
type ViewType = 'STANDBY' | 'BRIDGE' | 'ENCOUNTER' | 'COMM_TERMINAL' | 'MESSAGES' | 'SHIP_DASHBOARD' | 'CHARON_TERMINAL';

// Map view modes for BRIDGE view
type MapViewMode = 'galaxy' | 'system' | 'orbit';

interface ActiveView {
  view_type: ViewType;
  location_slug: string;
  view_slug: string;
  overlay_location_slug: string;
  overlay_terminal_slug: string;
  charon_dialog_open: boolean;
  charon_active_channel?: string;
  updated_at: string;
  // ENCOUNTER view specific fields
  location_type?: string;
  location_name?: string;
  location_data?: {
    slug: string;
    name: string;
    type: string;
    status?: string;
    description?: string;
    has_map?: boolean;
    map?: {
      image_path?: string;
      name?: string;
    };
    parent_slug?: string;
    system_slug?: string;
  };
  // Multi-deck encounter fields
  encounter_level?: number;
  encounter_deck_id?: string;
  encounter_room_visibility?: { [roomId: string]: boolean };
  encounter_door_status?: DoorStatusState;
  // Multi-deck manifest info (added by API)
  encounter_total_decks?: number;
  encounter_deck_name?: string;
}

interface InitialData {
  activeView: ActiveView;
  campaignTitle?: string;
  crew?: import('@components/domain/dashboard/BridgeView').CrewMember[];
  npcs?: import('@components/domain/dashboard/BridgeView').NPC[];
}

// Get initial data from Django (passed via window object)
declare global {
  interface Window {
    INITIAL_DATA?: InitialData;
  }
}

function SharedConsole() {
  const [activeView, setActiveView] = useState<ActiveView | null>(
    window.INITIAL_DATA?.activeView || null
  );
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [starMapData, setStarMapData] = useState<StarMapData | null>(null);

  // Performance mode state - reduces visual effects for low-powered devices
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [performanceMode, _setPerformanceMode] = useState<boolean>(() => {
    // Check URL parameter first, then localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlPerf = urlParams.get('perf');
    if (urlPerf === '1' || urlPerf === 'true') {
      localStorage.setItem('performanceMode', 'true');
      return true;
    }
    if (urlPerf === '0' || urlPerf === 'false') {
      localStorage.setItem('performanceMode', 'false');
      return false;
    }
    // Fall back to localStorage
    return localStorage.getItem('performanceMode') === 'true';
  });

  // Apply performance mode class to body
  useEffect(() => {
    if (performanceMode) {
      document.body.classList.add('performance-mode');
    } else {
      document.body.classList.remove('performance-mode');
    }
  }, [performanceMode]);

  // Map view state
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('galaxy');
  const [currentSystemSlug, setCurrentSystemSlug] = useState<string | null>(null);
  const [systemMapData, setSystemMapData] = useState<SystemMapData | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<BodyData | null>(null);

  // Orbit view state
  const [currentBodySlug, setCurrentBodySlug] = useState<string | null>(null);
  const [orbitMapData, setOrbitMapData] = useState<OrbitMapData | null>(null);
  const [selectedOrbitElement, setSelectedOrbitElement] = useState<string | null>(null);
  const [selectedOrbitElementType, setSelectedOrbitElementType] = useState<'moon' | 'station' | 'surface' | null>(null);
  const [selectedOrbitElementData, setSelectedOrbitElementData] = useState<MoonData | StationData | SurfaceMarkerData | null>(null);

  // Transition state for map switching animations
  const [galaxyTransition, setGalaxyTransition] = useState<TransitionState>('idle');
  const [systemTransition, setSystemTransition] = useState<TransitionState>('idle');
  const [orbitTransition, setOrbitTransition] = useState<TransitionState>('idle');

  // Tab state management
  const [activeTab, setActiveTab] = useState<BridgeTab>(() => {
    try {
      const saved = sessionStorage.getItem('bridgeActiveTab');
      if (saved && ['map', 'personnel', 'notes', 'status', 'charon'].includes(saved)) {
        return saved as BridgeTab;
      }
    } catch (error) {
      console.warn('Failed to restore tab from session storage:', error);
    }
    return 'map';
  });
  const [tabTransition, setTabTransition] = useState<'idle' | 'transitioning'>('idle');

  // Sync activeTab to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('bridgeActiveTab', activeTab);
    } catch (error) {
      console.warn('Failed to save tab to session storage:', error);
    }
  }, [activeTab]);

  // State cleanup effects - clear child view states when parent view changes
  useEffect(() => {
    if (mapViewMode === 'galaxy') {
      // When in galaxy view, clear all child view states (system and orbit)
      setSelectedPlanet(null);
      setSelectedOrbitElement(null);
      setSelectedOrbitElementType(null);
      setSelectedOrbitElementData(null);
    } else if (mapViewMode === 'system') {
      // When in system view, clear only orbit view states
      setSelectedOrbitElement(null);
      setSelectedOrbitElementType(null);
      setSelectedOrbitElementData(null);
    }
  }, [mapViewMode]);

  // CHARON dialog state
  const [charonDialogOpen, setCharonDialogOpen] = useState(false);

  // Bridge CHARON message indicator
  const [charonHasMessages, setCharonHasMessages] = useState(false);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);

  // Comm terminal overlay state
  const [terminalOverlayOpen, setTerminalOverlayOpen] = useState(false);
  const [terminalOverlayLocation, setTerminalOverlayLocation] = useState('');
  const [terminalOverlaySlug, setTerminalOverlaySlug] = useState('');

  // Refs for map components to call dive methods
  const galaxyMapRef = useRef<GalaxyMapHandle>(null);
  const systemMapRef = useRef<SystemMapHandle>(null);
  const orbitMapRef = useRef<OrbitMapHandle>(null);
  const infoPanelRef = useRef<HTMLDivElement>(null);

  // Transition lock to prevent concurrent transitions
  const transitionLockRef = useRef<boolean>(false);

  // Track when scenes are ready (callback-based)
  const sceneReadyResolveRef = useRef<(() => void) | null>(null);

  // Zustand store actions for typewriter coordination and scene pause
  const startTypewriter = useSceneStore((state) => state.startTypewriter);
  const completeTypewriter = useSceneStore((state) => state.completeTypewriter);
  const setPaused = useSceneStore((state) => state.setPaused);

  // Scene ready callback
  const handleSceneReady = useCallback(() => {
    if (sceneReadyResolveRef.current) {
      sceneReadyResolveRef.current();
      sceneReadyResolveRef.current = null;
    }
  }, []);

  // Wait for scene to be ready
  const waitForSceneReady = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      sceneReadyResolveRef.current = resolve;
      // Fallback timeout in case onReady is never called
      setTimeout(() => {
        if (sceneReadyResolveRef.current) {
          console.warn('[Transition] Scene ready timeout - proceeding anyway');
          sceneReadyResolveRef.current();
          sceneReadyResolveRef.current = null;
        }
      }, 2000); // 2 second timeout
    });
  }, []);

  // Fetch star map data on mount
  useEffect(() => {
    async function fetchStarMapData() {
      try {
        const response = await fetch('/api/star-map/');
        const data = await response.json();
        setStarMapData(data);
      } catch (error) {
        console.error('Failed to fetch star map data:', error);
      }
    }
    fetchStarMapData();
  }, []);

  // Fetch full active view data on mount (initial data from template is incomplete)
  useEffect(() => {
    async function fetchActiveView() {
      try {
        const response = await fetch('/api/active-view/');
        const data = await response.json();
        setActiveView(data);
        setCharonDialogOpen(data.charon_dialog_open);
      } catch (error) {
        console.error('Failed to fetch active view:', error);
      }
    }
    fetchActiveView();
  }, []);

  // Poll for active view changes
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/active-view/');
        const data = await response.json();

        // Check if view changed
        if (data.updated_at !== activeView?.updated_at) {
          const previousViewType = activeView?.view_type;
          setActiveView(data);

          // Handle CHARON_TERMINAL view transitions
          if (data.view_type === 'CHARON_TERMINAL' && previousViewType !== 'CHARON_TERMINAL') {
            // Switching TO CHARON_TERMINAL - auto-open dialog
            setCharonDialogOpen(true);
            charonApi.toggleDialog(true).catch(console.error);
          } else if (data.view_type !== 'CHARON_TERMINAL' && previousViewType === 'CHARON_TERMINAL') {
            // Switching AWAY from CHARON_TERMINAL - auto-close dialog
            setCharonDialogOpen(false);
            charonApi.toggleDialog(false).catch(console.error);
          } else {
            // Sync charon dialog state for other transitions
            setCharonDialogOpen(data.charon_dialog_open);
          }

          // Reset selection on view change to dashboard
          if (data.view_type === 'BRIDGE') {
            setSelectedSystem(null);
            setMapViewMode('galaxy');
            setCurrentSystemSlug(null);
            setSelectedPlanet(null);
            setCurrentBodySlug(null);
            setSelectedOrbitElement(null);
            setSelectedOrbitElementType(null);
            setSelectedOrbitElementData(null);
            setActiveTab('map');
          }

          // Sync terminal overlay state
          if (data.overlay_terminal_slug && data.overlay_location_slug) {
            setTerminalOverlayLocation(data.overlay_location_slug);
            setTerminalOverlaySlug(data.overlay_terminal_slug);
            setTerminalOverlayOpen(true);
          } else {
            setTerminalOverlayOpen(false);
          }
        } else if (data.charon_dialog_open !== charonDialogOpen) {
          // Sync dialog state even if updated_at didn't change
          setCharonDialogOpen(data.charon_dialog_open);
        }

        // Sync terminal overlay state even if updated_at didn't change
        const overlayOpen = !!(data.overlay_terminal_slug && data.overlay_location_slug);
        if (overlayOpen !== terminalOverlayOpen) {
          if (overlayOpen) {
            setTerminalOverlayLocation(data.overlay_location_slug);
            setTerminalOverlaySlug(data.overlay_terminal_slug);
            setTerminalOverlayOpen(true);
          } else {
            setTerminalOverlayOpen(false);
          }
        }
      } catch (error) {
        console.error('Failed to poll active view:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [activeView?.updated_at, activeView?.view_type, charonDialogOpen, terminalOverlayOpen]);

  // Poll bridge channel for new messages (for CHARON tab indicator).
  // When the CHARON tab is active, auto-mark messages as read so the indicator
  // doesn't flash when switching away.
  useEffect(() => {
    const pollBridgeMessages = async () => {
      try {
        const data = await charonApi.getChannelConversation('bridge');
        if (data.messages.length > 0) {
          const lastMessage = data.messages[data.messages.length - 1];
          if (activeTab === 'charon') {
            // User is viewing CHARON — keep lastReadMessageId in sync
            setLastReadMessageId(lastMessage.message_id);
            setCharonHasMessages(false);
          } else if (!lastReadMessageId || lastMessage.message_id !== lastReadMessageId) {
            setCharonHasMessages(true);
          }
        }
      } catch (error) {
        console.error('Failed to poll bridge messages:', error);
      }
    };

    pollBridgeMessages();
    const pollInterval = setInterval(pollBridgeMessages, 3000);
    return () => clearInterval(pollInterval);
  }, [lastReadMessageId, activeTab]);

  const viewType = activeView?.view_type || 'STANDBY';
  const isStandby = viewType === 'STANDBY';
  const isCharonTerminal = viewType === 'CHARON_TERMINAL';

  // Get selected system data and build content HTML
  const selectedSystemData = useMemo(() => {
    if (!selectedSystem || !starMapData) return null;
    const system = starMapData.systems.find(s => s.name === selectedSystem);
    if (!system) return null;
    return {
      name: system.name,
      type: system.type,
      description: system.info?.description,
      population: system.info?.population,
      position: system.position,
      has_system_map: !!system.location_slug,
      location_slug: system.location_slug,
    };
  }, [selectedSystem, starMapData]);

  // Build info panel content based on current view mode and selection
  const infoPanelContent = useMemo(() => {
    // Orbit mode - show element or planet info
    if (mapViewMode === 'orbit') {
      if (selectedOrbitElementData && selectedOrbitElementType) {
        if (selectedOrbitElementType === 'moon') {
          return buildMoonInfoHTML(selectedOrbitElementData as MoonData);
        }
        if (selectedOrbitElementType === 'station') {
          return buildStationInfoHTML(selectedOrbitElementData as StationData);
        }
        if (selectedOrbitElementType === 'surface') {
          return buildSurfaceMarkerInfoHTML(selectedOrbitElementData as SurfaceMarkerData);
        }
      }
      // Show planet info if in orbit view but no element selected
      if (selectedPlanet) {
        return buildPlanetInfoHTML(selectedPlanet);
      }
      return '';
    }
    // System mode
    if (mapViewMode === 'system' && selectedPlanet) {
      return buildPlanetInfoHTML(selectedPlanet);
    }
    if (mapViewMode === 'system' && !selectedPlanet) {
      // Show system info when in system view but no planet selected
      // Use selectedSystemData from galaxy map (has description, population, etc.)
      // Fall back to systemMapData if no selection data available
      if (selectedSystemData) {
        return buildSystemInfoHTML(selectedSystemData);
      }
      if (systemMapData) {
        return buildSystemInfoHTML({
          type: systemMapData.star.type,
        });
      }
    }
    // Galaxy mode
    if (mapViewMode === 'galaxy' && selectedSystemData) {
      return buildSystemInfoHTML(selectedSystemData);
    }
    return '';
  }, [selectedSystemData, mapViewMode, selectedPlanet, systemMapData, selectedOrbitElementData, selectedOrbitElementType]);

  // Determine info panel title
  const infoPanelTitle = useMemo(() => {
    // Orbit mode
    if (mapViewMode === 'orbit') {
      if (selectedOrbitElement) {
        return selectedOrbitElement.toUpperCase();
      }
      if (selectedPlanet) {
        return selectedPlanet.name.toUpperCase();
      }
      return 'PLANET INFO';
    }
    // System mode
    if (mapViewMode === 'system' && selectedPlanet) {
      return selectedPlanet.name.toUpperCase();
    }
    if (mapViewMode === 'system' && systemMapData) {
      return systemMapData.star.name.toUpperCase();
    }
    // Galaxy mode
    if (selectedSystemData) {
      return selectedSystemData.name.toUpperCase();
    }
    return 'SYSTEM INFO';
  }, [selectedSystemData, mapViewMode, selectedPlanet, systemMapData, selectedOrbitElement]);

  // Determine if info panel should be visible
  const infoPanelVisible = useMemo(() => {
    if (mapViewMode === 'galaxy') {
      return !!selectedSystem;
    }
    if (mapViewMode === 'system') {
      return true; // Always show panel in system view
    }
    if (mapViewMode === 'orbit') {
      return true; // Always show panel in orbit view
    }
    return false;
  }, [mapViewMode, selectedSystem]);

  // Trigger typewriter when info panel content changes
  useEffect(() => {
    if (infoPanelContent && infoPanelVisible) {
      // Start typewriter animation in Zustand store
      // This will be picked up by TypewriterController in the Canvas RAF loop
      startTypewriter(infoPanelContent);
    } else {
      // Complete/clear typewriter if panel is hidden
      completeTypewriter();
    }
  }, [infoPanelContent, infoPanelVisible, startTypewriter, completeTypewriter]);

  const handleSystemSelect = useCallback((systemName: string) => {
    setSelectedSystem(prev => prev === systemName ? null : systemName);
  }, []);

  const handleBackToGalaxyInternal = useCallback(async () => {
    // Check transition lock
    if (transitionLockRef.current) {
      console.warn('[Transition] Transition already in progress, ignoring');
      return;
    }
    transitionLockRef.current = true;

    try {
      // Phase 0: If a planet is selected, deselect it first and wait for animation
      if (selectedPlanet) {
        setSelectedPlanet(null);
        // Wait for deselect camera animation (return to default view)
        await new Promise(resolve => setTimeout(resolve, 1500)); // 1500ms for returnToDefault animation
      }

      // Phase 1: Fade out current view
      setSystemTransition('transitioning-out');
      await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.FADE_OUT_TIME));

      // Phase 2: Switch to galaxy view with React.startTransition
      startTransition(() => {
        setMapViewMode('galaxy');
        setSelectedPlanet(null);
        setGalaxyTransition('transitioning-in');
      });

      // Phase 3: Wait for React to render galaxy view
      await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.VIEW_RENDER_DELAY));

      // Phase 4: Position camera on selected system
      if (selectedSystem) {
        galaxyMapRef.current?.positionCameraOnSystem(selectedSystem);
      }

      // Phase 5: Wait for fade-in
      await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.FADE_TIME));

      // Phase 6: Reset states and cleanup
      setSystemTransition('idle');
      setGalaxyTransition('idle');
      setCurrentSystemSlug(null);
      setSystemMapData(null);
    } finally {
      transitionLockRef.current = false;
    }
  }, [selectedSystem, selectedPlanet]);

  // Debounced version with transition guard
  const [handleBackToGalaxy] = useTransitionGuard(handleBackToGalaxyInternal, 300);

  const handleSystemLoaded = useCallback((data: SystemMapData | null) => {
    setSystemMapData(data);
  }, []);

  const handlePlanetSelect = useCallback((planetData: BodyData | null) => {
    setSelectedPlanet(planetData);
  }, []);


  const handleBackToSystemInternal = useCallback(async () => {
    // Check transition lock
    if (transitionLockRef.current) {
      console.warn('[Transition] Transition already in progress, ignoring');
      return;
    }
    transitionLockRef.current = true;

    try {
      // Phase 0: If an orbit element is selected, deselect it first and wait for animation
      if (selectedOrbitElement) {
        setSelectedOrbitElement(null);
        setSelectedOrbitElementType(null);
        setSelectedOrbitElementData(null);
        // Wait for deselect camera animation (return to default view)
        await new Promise(resolve => setTimeout(resolve, 800)); // 800ms for returnToDefault animation
      }

      // Phase 1: Fade out current view
      setOrbitTransition('transitioning-out');
      await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.FADE_OUT_TIME));

      // Phase 2: Switch to system view with React.startTransition
      startTransition(() => {
        setSelectedOrbitElement(null);
        setSelectedOrbitElementType(null);
        setSelectedOrbitElementData(null);
        setMapViewMode('system');
        setSystemTransition('transitioning-in');
      });

      // Phase 3: Wait for React to render system view
      await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.VIEW_RENDER_DELAY));

      // Phase 4: Position camera on selected planet
      if (selectedPlanet?.name) {
        systemMapRef.current?.positionCameraOnPlanet(selectedPlanet.name);
      }

      // Phase 5: Wait for fade-in
      await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.FADE_TIME));

      // Phase 6: Reset states and cleanup
      setOrbitTransition('idle');
      setSystemTransition('idle');
      setCurrentBodySlug(null);
    } finally {
      transitionLockRef.current = false;
    }
  }, [selectedPlanet, selectedOrbitElement]);

  // Debounced version with transition guard
  const [handleBackToSystem] = useTransitionGuard(handleBackToSystemInternal, 300);

  const handleOrbitMapLoaded = useCallback((data: OrbitMapData | null) => {
    setOrbitMapData(data);
  }, []);

  const handleOrbitElementSelect = useCallback((elementType: string | null, elementData: MoonData | StationData | SurfaceMarkerData | null) => {
    if (elementType && elementData) {
      setSelectedOrbitElement(elementData.name);
      setSelectedOrbitElementType(elementType as 'moon' | 'station' | 'surface');
      setSelectedOrbitElementData(elementData);
    } else {
      setSelectedOrbitElement(null);
      setSelectedOrbitElementType(null);
      setSelectedOrbitElementData(null);
    }
  }, []);

  // Navigate from galaxy to system view - with transition guard and RAF coordination
  const handleDiveToSystemInternal = useCallback(async (systemName: string) => {
    // Check transition lock
    if (transitionLockRef.current) {
      console.warn('[Transition] Transition already in progress, ignoring');
      return;
    }
    transitionLockRef.current = true;

    try {
      // Find the system slug from the star map data
      const system = starMapData?.systems.find(s => s.name === systemName);
      if (!system?.location_slug) {
        console.warn('No location_slug for system:', systemName);
        return;
      }

      // Extract location_slug (guaranteed to exist after check above)
      const systemSlug = system.location_slug;

      // Phase 0: Pre-fetch system data to eliminate loading delay
      let systemData: SystemMapData | null = null;
      try {
        const response = await fetch(`/api/system-map/${systemSlug}/`);
        if (response.ok) {
          systemData = await response.json();
          setSystemMapData(systemData);
        }
      } catch (error) {
        console.error('Error pre-fetching system data:', error);
      }

      // Phase 1: Select system and wait for camera animation + typewriter to complete
      if (selectedSystem !== systemName) {
        // Select the system - this triggers all the UI updates (reticle, info panel, camera)
        setSelectedSystem(systemName);

        // Wait one frame for React to re-render and show reticle/info panel
        await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

        // The GalaxyScene useEffect will automatically start camera animation
        await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.CAMERA_MOVE_TIME));

        // Wait for typewriter to complete using utility function
        await waitForTypewriter(TRANSITION_TIMING.TYPEWRITER_MAX_WAIT);
      }

      // Phase 2: Fade out galaxy view
      setGalaxyTransition('transitioning-out');
      await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.FADE_OUT_TIME));

      // Phase 3: Switch view mode with React.startTransition (data already loaded)
      startTransition(() => {
        setMapViewMode('system');
        setCurrentSystemSlug(systemSlug);
        setSystemTransition('transitioning-in');
      });

      // Phase 4: Wait for scene to be ready
      await waitForSceneReady();

      // Phase 5: Fade in new view
      await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.FADE_TIME));

      // Phase 6: Reset transition states
      setGalaxyTransition('idle');
      setSystemTransition('idle');
    } finally {
      transitionLockRef.current = false;
    }
  }, [starMapData, selectedSystem]);

  // Debounced version with transition guard (300ms minimum between calls)
  const [handleDiveToSystem] = useTransitionGuard(handleDiveToSystemInternal, 300);

  // Navigate from system to orbit view - with transition guard and RAF coordination
  const handleOrbitMapNavigateInternal = useCallback(async (systemSlug: string, planetSlug: string) => {
    // Check transition lock
    if (transitionLockRef.current) {
      console.warn('[Transition] Transition already in progress, ignoring');
      return;
    }
    transitionLockRef.current = true;

    try {
      // Find the planet data
      const planet = systemMapData?.bodies?.find(b => b.location_slug === planetSlug);
      if (!planet) return;

      // Phase 0: Pre-fetch orbit data to eliminate loading delay
      let orbitData: OrbitMapData | null = null;
      try {
        const response = await fetch(`/api/orbit-map/${systemSlug}/${planetSlug}/`);
        if (response.ok) {
          orbitData = await response.json();
          setOrbitMapData(orbitData);
        }
      } catch (error) {
        console.error('Error pre-fetching orbit data:', error);
      }

      // Phase 1: Select planet and wait for camera animation + typewriter to complete
      if (selectedPlanet?.location_slug !== planetSlug) {
        // Select the planet - triggers camera animation, reticle, and info panel
        setSelectedPlanet(planet);

        // Wait one frame for React to re-render
        await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)));

        // Wait for camera animation to complete
        await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.CAMERA_MOVE_TIME));

        // Wait for typewriter to complete
        await waitForTypewriter(TRANSITION_TIMING.TYPEWRITER_MAX_WAIT);
      }

      // Phase 2: Pause planet orbits to prevent camera tracking issues
      setPaused(true);

      // Phase 3: Fade out system view
      setSystemTransition('transitioning-out');
      await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.FADE_OUT_TIME));

      // Phase 4: Switch view mode with React.startTransition (data already loaded)
      startTransition(() => {
        setMapViewMode('orbit');
        setCurrentBodySlug(planetSlug);
        setOrbitTransition('transitioning-in');
      });

      // Phase 5: Wait for scene to be ready
      await waitForSceneReady();

      // Phase 6: Fade in new view
      await new Promise(resolve => setTimeout(resolve, TRANSITION_TIMING.FADE_TIME));

      // Phase 7: Reset transition states
      setSystemTransition('idle');
      setOrbitTransition('idle');
    } finally {
      // Always unpause animations and release transition lock
      setPaused(false);
      transitionLockRef.current = false;
    }
  }, [systemMapData, selectedPlanet]);

  // Debounced version with transition guard
  const [handleOrbitMapNavigate] = useTransitionGuard(handleOrbitMapNavigateInternal, 300);

  // Tab change handler with GSAP transitions
  const handleTabChange = useCallback((newTab: BridgeTab) => {
    if (newTab === activeTab) return; // No-op if already active
    if (tabTransition !== 'idle') return; // Block during transition

    setTabTransition('transitioning');

    // GSAP timeline for coordinated fade
    const timeline = gsap.timeline({
      onComplete: () => setTabTransition('idle')
    });

    // Fade out current section (300ms)
    timeline.to('.bridge-content-area', { opacity: 0, duration: 0.3 });

    // Update state (instant)
    timeline.call(() => setActiveTab(newTab));

    // Fade in new section (300ms)
    timeline.to('.bridge-content-area', { opacity: 1, duration: 0.3 });
  }, [activeTab, tabTransition]);

  // CHARON dialog handlers
  const handleCharonDialogClose = useCallback(async () => {
    setCharonDialogOpen(false); // Immediate feedback
    try {
      await charonApi.toggleDialog(false);
    } catch (error) {
      console.error('Failed to close CHARON dialog:', error);
      setCharonDialogOpen(true); // Revert on error
    }
  }, []);

  // Terminal overlay handlers
  // When players close the dialog, notify the GM view to unselect the terminal
  const handleTerminalOverlayClose = useCallback(async () => {
    setTerminalOverlayOpen(false); // Immediate feedback
    try {
      await terminalApi.hideTerminal();
    } catch (error) {
      console.error('Failed to hide terminal overlay:', error);
      // Don't revert - let user close it locally even if API fails
    }
  }, []);


  return (
    <>
      {/* Scanline overlay */}
      <div className="scanline-overlay" />

      {/* Header - hidden in standby and CHARON terminal modes */}
      <TerminalHeader
        title={viewType === 'ENCOUNTER' ? (activeView?.location_name?.toUpperCase() || '') : 'MOTHERSHIP'}
        subtitle={viewType === 'ENCOUNTER' ? undefined : 'TERMINAL'}
        rightText={viewType === 'ENCOUNTER' || viewType === 'BRIDGE' ? undefined : 'STATION ACCESS'}
        hidden={isStandby || isCharonTerminal}
        typewriterTitle={viewType === 'ENCOUNTER'}
      />

      {/* View content */}
      {viewType === 'STANDBY' && (
        <StandbyView title="MOTHERSHIP" subtitle="The Outer Veil" />
      )}

      {viewType === 'CHARON_TERMINAL' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: '#000',
          zIndex: 1
        }} />
      )}

      {viewType === 'BRIDGE' && (
        <BridgeView
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabTransitionActive={tabTransition !== 'idle'}
          charonHasMessages={charonHasMessages}
        >
          {/* Map components - only visible when map tab is active */}
          <>
            {/* Map container - wraps maps and UI panels */}
            <div className="map-view-container">
              {/* Galaxy Map - renders behind dashboard panels, stays mounted during system view */}
              {(mapViewMode === 'galaxy' || mapViewMode === 'system' || galaxyTransition !== 'idle') && (
                <GalaxyMap
                  ref={galaxyMapRef}
                  data={starMapData}
                  selectedSystem={selectedSystem}
                  transitionState={galaxyTransition}
                  hidden={(mapViewMode === 'system' || mapViewMode === 'orbit') || activeTab !== 'map'}
                  paused={activeTab !== 'map'}
                />
              )}

              {/* System Map - renders when viewing a specific system or orbit (stays mounted) */}
              {(mapViewMode === 'system' || mapViewMode === 'orbit' || systemTransition !== 'idle') && (
                <SystemMap
                  ref={systemMapRef}
                  systemSlug={currentSystemSlug}
                  selectedPlanet={selectedPlanet?.name || null}
                  onPlanetSelect={handlePlanetSelect}
                  onOrbitMapNavigate={handleOrbitMapNavigate}
                  onBackToGalaxy={handleBackToGalaxy}
                  onSystemLoaded={handleSystemLoaded}
                  onReady={handleSceneReady}
                  transitionState={systemTransition}
                  hidden={mapViewMode === 'orbit' || activeTab !== 'map'}
                  paused={activeTab !== 'map'}
                />
              )}

              {/* Orbit Map - renders when viewing a specific planet */}
              {(mapViewMode === 'orbit' || orbitTransition !== 'idle') && (
                <OrbitMap
                  ref={orbitMapRef}
                  systemSlug={currentSystemSlug}
                  bodySlug={currentBodySlug}
                  selectedElement={selectedOrbitElement}
                  selectedElementType={selectedOrbitElementType}
                  onElementSelect={handleOrbitElementSelect}
                  onBackToSystem={handleBackToSystem}
                  onOrbitMapLoaded={handleOrbitMapLoaded}
                  onReady={handleSceneReady}
                  transitionState={orbitTransition}
                  hidden={activeTab !== 'map'}
                  paused={activeTab !== 'map'}
                />
              )}

              {/* Star Map Panel - left side - shows lists based on map view mode */}
              <StarMapPanel
                mapViewMode={mapViewMode}
                starMapData={starMapData}
                selectedSystem={selectedSystem}
                onSystemSelect={handleSystemSelect}
                systemMapData={systemMapData}
                currentSystemSlug={currentSystemSlug}
                selectedPlanet={selectedPlanet}
                onPlanetSelect={handlePlanetSelect}
                onBackToGalaxy={handleBackToGalaxy}
                orbitMapData={orbitMapData}
                currentBodySlug={currentBodySlug}
                selectedOrbitElement={selectedOrbitElement}
                selectedOrbitElementType={selectedOrbitElementType}
                onOrbitElementSelect={handleOrbitElementSelect}
                onBackToSystem={handleBackToSystem}
                onDiveToSystem={handleDiveToSystem}
                onOrbitMapNavigate={handleOrbitMapNavigate}
                visible={activeTab === 'map'}
              />

              {/* Info Panel - right side - reusable floating panel for selected item info */}
              <InfoPanel
                ref={infoPanelRef}
                title={infoPanelTitle}
                content={infoPanelContent}
                visible={infoPanelVisible && activeTab === 'map'}
              />
            </div>
          </>
        </BridgeView>
      )}

      {/* ENCOUNTER view - clean display for player terminal */}
      {viewType === 'ENCOUNTER' && (
        <EncounterView
          locationSlug={activeView?.location_slug || null}
          locationType={activeView?.location_type || null}
          locationData={activeView?.location_data || null}
          encounterLevel={activeView?.encounter_level}
          totalDecks={activeView?.encounter_total_decks}
          deckName={activeView?.encounter_deck_name}
          roomVisibility={activeView?.encounter_room_visibility}
          doorStatus={activeView?.encounter_door_status}
        />
      )}

      {/* Other view types can be added here */}
      {viewType !== 'STANDBY' && viewType !== 'BRIDGE' && viewType !== 'CHARON_TERMINAL' && viewType !== 'ENCOUNTER' && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          color: 'var(--color-text-muted)'
        }}>
          View type "{viewType}" not yet implemented in React
        </div>
      )}

      {/* CHARON Dialog - overlay for quick CHARON access from dashboard */}
      <CharonDialog
        open={charonDialogOpen}
        onClose={handleCharonDialogClose}
        channel={activeView?.charon_active_channel || 'story'}
        disableClose={isCharonTerminal}
      />

      {/* Comm Terminal Dialog - overlay for viewing terminal messages */}
      <CommTerminalDialog
        open={terminalOverlayOpen}
        locationSlug={terminalOverlayLocation}
        terminalSlug={terminalOverlaySlug}
        onClose={handleTerminalOverlayClose}
      />
    </>
  );
}

// Mount the app
const root = document.getElementById('shared-console-root');
if (root) {
  ReactDOM.createRoot(root).render(<SharedConsole />);
}
