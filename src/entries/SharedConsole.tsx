import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/global.css';
import { TerminalHeader } from '@components/layout/TerminalHeader';
import { StandbyView } from '@components/domain/dashboard/StandbyView';
import { CampaignDashboard, StarSystem, OrbitElement, CrewMember } from '@components/domain/dashboard/CampaignDashboard';
import { InfoPanel, buildSystemInfoHTML, buildPlanetInfoHTML, buildMoonInfoHTML, buildStationInfoHTML, buildSurfaceMarkerInfoHTML } from '@components/domain/dashboard/InfoPanel';
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
import type { OrbitMapData, MoonData, StationData, SurfaceMarkerData } from '../types/orbitMap';
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
  starSystems?: StarSystem[];
  crew?: CrewMember[];
  notes?: string[];
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
            setOrbitMapData(null);
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

  // Build star systems list from API data
  const starSystems: StarSystem[] = (starMapData?.systems || [])
    .filter(system => system.label)
    .map(system => ({
      name: system.name,
      hasSystemMap: !!system.has_system_map,
    }));

  // Get data from initial Django context (fallback)
  const crew = window.INITIAL_DATA?.crew || [];
  const notes = window.INITIAL_DATA?.notes || [
    'Investigating anomalous readings',
    'Specimen requires containment',
    'Station comms experiencing intermittent interference'
  ];
  const campaignTitle = window.INITIAL_DATA?.campaignTitle || 'THE OUTER VEIL CAMPAIGN';

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

  const handleSystemMapClick = useCallback(async (systemName: string) => {
    // Find the system's location_slug
    const system = starMapData?.systems.find(s => s.name === systemName);
    if (system?.location_slug) {
      // If system is not already selected, first select it and wait for animation
      if (selectedSystem !== systemName) {
        await galaxyMapRef.current?.selectSystemAndWait(systemName);
        // Don't setSelectedSystem here - it triggers a useEffect that cancels the dive animation
      }

      // Start dive animation and fade out
      setGalaxyTransition('transitioning-out');
      await galaxyMapRef.current?.diveToSystem(systemName);

      // Now update selectedSystem after dive is complete
      setSelectedSystem(systemName);

      // Switch to system view with fade-in
      setCurrentSystemSlug(system.location_slug);
      setMapViewMode('system');
      setSelectedPlanet(null);
      setSystemTransition('transitioning-in');

      // Reset transitions after animation completes
      setTimeout(() => {
        setGalaxyTransition('idle');
        setSystemTransition('idle');
      }, 1200);
    }
  }, [starMapData, selectedSystem]);

  const handleBackToGalaxy = useCallback(() => {
    console.log('Returning to galaxy view');

    // Position galaxy camera on selected system immediately (before any state changes)
    if (selectedSystem) {
      galaxyMapRef.current?.positionCameraOnSystem(selectedSystem);
    }

    // Start zoom out animation (don't await - runs in parallel with fade)
    systemMapRef.current?.zoomOut();

    // Start fade out of system view
    setSystemTransition('transitioning-out');

    // After fade out completes (1s), switch to galaxy view
    setTimeout(() => {
      setMapViewMode('galaxy');
      setCurrentSystemSlug(null);
      setSystemMapData(null);
      setSelectedPlanet(null);
      setGalaxyTransition('transitioning-in');

      // Reset transitions after fade-in animation completes
      setTimeout(() => {
        setSystemTransition('idle');
        setGalaxyTransition('idle');
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

  const handleOrbitMapNavigate = useCallback(async (systemSlug: string, planetSlug: string, planetName: string) => {
    console.log('Navigate to orbit map:', systemSlug, planetSlug, planetName);

    // If planet is not already selected, first select it and wait for animation
    if (selectedPlanet?.name !== planetName) {
      console.log('Selecting planet first:', planetName);
      await systemMapRef.current?.selectPlanetAndWait(planetName);
      // Update state to reflect selection (for info panel)
      const planet = systemMapData?.bodies?.find(b => b.name === planetName);
      if (planet) {
        setSelectedPlanet(planet);
      }
    }

    // Start dive animation and fade out
    setSystemTransition('transitioning-out');
    await systemMapRef.current?.diveToPlanet(planetName);

    // Navigate to orbit view with fade-in
    setCurrentBodySlug(planetSlug);
    setMapViewMode('orbit');
    setSelectedOrbitElement(null);
    setSelectedOrbitElementType(null);
    setSelectedOrbitElementData(null);
    setOrbitTransition('transitioning-in');

    // Reset transitions after animation completes
    setTimeout(() => {
      setSystemTransition('idle');
      setOrbitTransition('idle');
    }, 1200);
  }, [selectedPlanet, systemMapData]);

  const handleBackToSystem = useCallback(async () => {
    console.log('Returning to system view');

    // Start zoom out animation and fade out
    setOrbitTransition('transitioning-out');
    await orbitMapRef.current?.zoomOut();

    // Position camera on selected planet immediately (SystemMap stays mounted during orbit view)
    if (selectedPlanet?.name) {
      systemMapRef.current?.positionCameraOnPlanet(selectedPlanet.name);
    }

    // Clear orbit state and switch to system view
    setCurrentBodySlug(null);
    setOrbitMapData(null);
    setSelectedOrbitElement(null);
    setSelectedOrbitElementType(null);
    setSelectedOrbitElementData(null);
    setMapViewMode('system');
    setSystemTransition('transitioning-in');

    // Reset transitions after animation completes
    setTimeout(() => {
      setOrbitTransition('idle');
      setSystemTransition('idle');
    }, 1200);
  }, [selectedPlanet]);

  const handleOrbitMapLoaded = useCallback((data: OrbitMapData | null) => {
    console.log('Orbit map loaded:', data?.planet?.name);
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

  // Build planet list for menu when in system view
  const systemPlanets = useMemo(() => {
    if (!systemMapData?.bodies) return [];
    return systemMapData.bodies.map(body => ({
      name: body.name,
      hasOrbitMap: !!body.has_orbit_map,
      locationSlug: body.location_slug,
      surfaceFacilityCount: body.surface_facility_count,
      orbitalStationCount: body.orbital_station_count,
    }));
  }, [systemMapData]);

  // Build orbit elements list for menu when in orbit view
  const orbitElements: OrbitElement[] = useMemo(() => {
    if (!orbitMapData) return [];
    const elements: OrbitElement[] = [];

    // Add moons
    if (orbitMapData.moons) {
      orbitMapData.moons.forEach(moon => {
        elements.push({
          name: moon.name,
          type: 'moon',
          hasFacilities: moon.has_facilities,
        });
      });
    }

    // Add orbital stations
    if (orbitMapData.orbital_stations) {
      orbitMapData.orbital_stations.forEach(station => {
        elements.push({
          name: station.name,
          type: 'station',
        });
      });
    }

    // Add surface markers
    if (orbitMapData.surface_markers) {
      orbitMapData.surface_markers.forEach(marker => {
        elements.push({
          name: marker.name,
          type: 'surface',
        });
      });
    }

    return elements;
  }, [orbitMapData]);

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
        <>
          {/* Galaxy Map - renders behind dashboard panels, stays mounted during system view */}
          {(mapViewMode === 'galaxy' || mapViewMode === 'system' || galaxyTransition !== 'idle') && (
            <GalaxyMap
              ref={galaxyMapRef}
              data={starMapData}
              selectedSystem={selectedSystem}
              onSystemSelect={handleSystemSelect}
              transitionState={galaxyTransition}
              hidden={mapViewMode === 'system' || mapViewMode === 'orbit'}
            />
          )}

          {/* System Map - renders when viewing a specific system or orbit (stays mounted) */}
          {(mapViewMode === 'system' || mapViewMode === 'orbit' || systemTransition !== 'idle') && (
            <SystemMap
              ref={systemMapRef}
              systemSlug={currentSystemSlug}
              selectedPlanet={selectedPlanet?.name || null}
              onPlanetSelect={handlePlanetSelect}
              onBackToGalaxy={handleBackToGalaxy}
              onSystemLoaded={handleSystemLoaded}
              transitionState={systemTransition}
              hidden={mapViewMode === 'orbit'}
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
            />
          )}

          <CampaignDashboard
            campaignTitle={campaignTitle}
            crew={crew}
            notes={notes}
            starSystems={mapViewMode === 'galaxy' ? starSystems : []}
            selectedSystem={mapViewMode === 'galaxy' ? selectedSystem : null}
            onSystemSelect={mapViewMode === 'galaxy' ? handleSystemSelect : undefined}
            onSystemMapClick={mapViewMode === 'galaxy' ? handleSystemMapClick : undefined}
            mapViewMode={mapViewMode}
            systemPlanets={mapViewMode === 'system' ? systemPlanets : undefined}
            selectedPlanet={selectedPlanet?.name || null}
            onPlanetSelect={mapViewMode === 'system' ? (name) => {
              const planet = systemMapData?.bodies?.find(b => b.name === name);
              if (planet) {
                if (selectedPlanet?.name === name) {
                  handlePlanetSelect(null);
                } else {
                  handlePlanetSelect(planet);
                }
              }
            } : undefined}
            onBackToGalaxy={mapViewMode === 'system' ? handleBackToGalaxy : undefined}
            onOrbitMapClick={mapViewMode === 'system' ? (planetName) => {
              const planet = systemMapData?.bodies?.find(b => b.name === planetName);
              if (planet?.location_slug && currentSystemSlug) {
                handleOrbitMapNavigate(currentSystemSlug, planet.location_slug, planetName);
              }
            } : undefined}
            // Orbit view props
            orbitElements={mapViewMode === 'orbit' ? orbitElements : undefined}
            selectedOrbitElement={selectedOrbitElement}
            selectedOrbitElementType={selectedOrbitElementType}
            onOrbitElementSelect={mapViewMode === 'orbit' ? (type, name) => {
              // Find the element data
              let elementData: MoonData | StationData | SurfaceMarkerData | null = null;
              if (type === 'moon') {
                elementData = orbitMapData?.moons?.find(m => m.name === name) || null;
              } else if (type === 'station') {
                elementData = orbitMapData?.orbital_stations?.find(s => s.name === name) || null;
              } else if (type === 'surface') {
                elementData = orbitMapData?.surface_markers?.find(m => m.name === name) || null;
              }
              // Toggle selection
              if (selectedOrbitElement === name && selectedOrbitElementType === type) {
                handleOrbitElementSelect(null, null);
              } else if (elementData) {
                handleOrbitElementSelect(type, elementData);
              }
            } : undefined}
            onBackToSystem={mapViewMode === 'orbit' ? handleBackToSystem : undefined}
          />

          {/* Info Panel - reusable floating panel for selected item info */}
          <InfoPanel
            title={infoPanelTitle}
            content={infoPanelContent}
            visible={infoPanelVisible}
          />
        </>
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
