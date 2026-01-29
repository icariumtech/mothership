import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
      if (saved && ['map', 'crew', 'contacts', 'notes', 'status'].includes(saved)) {
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

  // CHARON dialog state
  const [charonDialogOpen, setCharonDialogOpen] = useState(false);

  // Comm terminal overlay state
  const [terminalOverlayOpen, setTerminalOverlayOpen] = useState(false);
  const [terminalOverlayLocation, setTerminalOverlayLocation] = useState('');
  const [terminalOverlaySlug, setTerminalOverlaySlug] = useState('');

  // Refs for map components to call dive methods
  const galaxyMapRef = useRef<GalaxyMapHandle>(null);
  const systemMapRef = useRef<SystemMapHandle>(null);
  const orbitMapRef = useRef<OrbitMapHandle>(null);
  const infoPanelRef = useRef<HTMLDivElement>(null);

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

  const handleSystemSelect = useCallback((systemName: string) => {
    setSelectedSystem(prev => prev === systemName ? null : systemName);
  }, []);

  const handleBackToGalaxy = useCallback(() => {
    console.log('Returning to galaxy view, selected system:', selectedSystem);

    // Start zoom out animation (don't await - runs in parallel with fade)
    systemMapRef.current?.zoomOut();

    // Start fade out of system view
    setSystemTransition('transitioning-out');

    // After fade out completes (1s), switch to galaxy view
    setTimeout(() => {
      setMapViewMode('galaxy');
      setSelectedPlanet(null);
      setGalaxyTransition('transitioning-in');

      // Position galaxy camera on selected system after state updates
      // Use requestAnimationFrame to ensure it happens after React render
      requestAnimationFrame(() => {
        if (selectedSystem) {
          galaxyMapRef.current?.positionCameraOnSystem(selectedSystem);
        }
      });

      // Reset transitions and clear system data AFTER fade-in animation completes
      // This ensures SystemMap stays mounted (but hidden) during the full transition
      setTimeout(() => {
        setSystemTransition('idle');
        setGalaxyTransition('idle');
        // Clear system data after transitions complete to avoid abrupt DOM removal
        setCurrentSystemSlug(null);
        setSystemMapData(null);
      }, 1200);
    }, 1000); // Wait for fade-out to complete
  }, [selectedSystem]);

  const handleSystemLoaded = useCallback((data: SystemMapData | null) => {
    console.log('System loaded:', data?.star.name);
    setSystemMapData(data);
  }, []);

  const handlePlanetSelect = useCallback((planetData: BodyData | null) => {
    console.log('Planet selected:', planetData?.name);
    setSelectedPlanet(planetData);
  }, []);


  const handleBackToSystem = useCallback(() => {
    console.log('Returning to system view, selected planet:', selectedPlanet?.name);

    // Start zoom out animation (don't await - runs in parallel with fade)
    orbitMapRef.current?.zoomOut();

    // Start fade out of orbit view
    setOrbitTransition('transitioning-out');

    // After fade out completes (1s), switch to system view
    setTimeout(() => {
      // Clear orbit state
      setSelectedOrbitElement(null);
      setSelectedOrbitElementType(null);
      setSelectedOrbitElementData(null);
      setMapViewMode('system');
      setSystemTransition('transitioning-in');

      // Position system camera on selected planet after state updates
      requestAnimationFrame(() => {
        if (selectedPlanet?.name) {
          systemMapRef.current?.positionCameraOnPlanet(selectedPlanet.name);
        }
      });

      // Reset transitions and clear orbit data AFTER fade-in animation completes
      setTimeout(() => {
        setOrbitTransition('idle');
        setSystemTransition('idle');
        setCurrentBodySlug(null);
      }, 1200);
    }, 1000); // Wait for fade-out to complete
  }, [selectedPlanet]);

  const handleOrbitMapLoaded = useCallback((data: OrbitMapData | null) => {
    console.log('Orbit map loaded:', data?.planet.name);
    setOrbitMapData(data);
  }, []);

  const handleOrbitElementSelect = useCallback((elementType: string | null, elementData: MoonData | StationData | SurfaceMarkerData | null) => {
    if (elementType && elementData) {
      console.log('Orbit element selected:', elementType, elementData.name);
      setSelectedOrbitElement(elementData.name);
      setSelectedOrbitElementType(elementType as 'moon' | 'station' | 'surface');
      setSelectedOrbitElementData(elementData);
    } else {
      console.log('Orbit element deselected');
      setSelectedOrbitElement(null);
      setSelectedOrbitElementType(null);
      setSelectedOrbitElementData(null);
    }
  }, []);

  // Navigate from galaxy to system view
  const handleDiveToSystem = useCallback(async (systemName: string) => {
    console.log('Diving to system:', systemName);

    // Find the system slug from the star map data
    const system = starMapData?.systems.find(s => s.name === systemName);
    if (!system?.location_slug) {
      console.warn('No location_slug for system:', systemName);
      return;
    }

    // If system is not already selected, select it and wait for camera animation
    if (selectedSystem !== systemName) {
      console.log('System not selected, selecting and animating:', systemName);
      setSelectedSystem(systemName);
      // The useEffect in GalaxyScene will trigger moveToSystem animation (2000ms)
      // Wait for that animation to complete before diving
      await new Promise(resolve => setTimeout(resolve, 2100));
    }

    // Start fade out animation and zoom in
    setGalaxyTransition('transitioning-out');
    await galaxyMapRef.current?.diveToSystem(systemName);

    // Switch to system view
    setMapViewMode('system');
    setCurrentSystemSlug(system.location_slug);
    setSystemTransition('transitioning-in');

    // Reset transitions after fade-in completes
    setTimeout(() => {
      setGalaxyTransition('idle');
      setSystemTransition('idle');
    }, 1200);
  }, [starMapData, selectedSystem]);

  // Navigate from system to orbit view
  const handleOrbitMapNavigate = useCallback(async (systemSlug: string, planetSlug: string) => {
    console.log('Navigating to orbit view:', systemSlug, planetSlug);

    // Find the planet data
    const planet = systemMapData?.bodies?.find(b => b.location_slug === planetSlug);
    if (!planet) return;

    // If planet is not already selected, select it and wait for camera animation
    if (selectedPlanet?.location_slug !== planetSlug) {
      console.log('Planet not selected, selecting and animating:', planet.name);
      setSelectedPlanet(planet);
      // Wait for the camera animation to complete before diving
      await systemMapRef.current?.selectPlanetAndWait(planet.name);
    }

    // Start fade out animation
    setSystemTransition('transitioning-out');

    // Dive to planet
    await systemMapRef.current?.diveToPlanet(planet.name);

    // Switch to orbit view
    setMapViewMode('orbit');
    setCurrentBodySlug(planetSlug);
    setOrbitTransition('transitioning-in');

    // Reset transitions after fade-in completes
    setTimeout(() => {
      setSystemTransition('idle');
      setOrbitTransition('idle');
    }, 1200);
  }, [systemMapData, selectedPlanet]);

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
  const handleCharonDialogOpen = useCallback(async () => {
    setCharonDialogOpen(true); // Immediate feedback
    try {
      await charonApi.toggleDialog(true);
    } catch (error) {
      console.error('Failed to open CHARON dialog:', error);
      setCharonDialogOpen(false); // Revert on error
    }
  }, []);

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
        onCharonClick={viewType === 'BRIDGE' ? handleCharonDialogOpen : undefined}
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
