import { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/global.css';
import { TerminalHeader } from '@components/layout/TerminalHeader';
import { StandbyView } from '@components/domain/dashboard/StandbyView';
import { CampaignDashboard, StarSystem, OrbitElement } from '@components/domain/dashboard/CampaignDashboard';
import { InfoPanel, buildSystemInfoHTML, buildPlanetInfoHTML, buildMoonInfoHTML, buildStationInfoHTML, buildSurfaceMarkerInfoHTML } from '@components/domain/dashboard/InfoPanel';
import { GalaxyMap } from '@components/domain/maps/GalaxyMap';
import { SystemMap } from '@components/domain/maps/SystemMap';
import { OrbitMap } from '@components/domain/maps/OrbitMap';
import type { StarMapData } from '../types/starMap';
import type { SystemMapData, BodyData } from '../types/systemMap';
import type { OrbitMapData, MoonData, StationData, SurfaceMarkerData } from '../types/orbitMap';

// View types matching Django's ActiveView model
type ViewType = 'STANDBY' | 'CAMPAIGN_DASHBOARD' | 'ENCOUNTER_MAP' | 'COMM_TERMINAL' | 'MESSAGES' | 'SHIP_DASHBOARD';

// Map view modes for CAMPAIGN_DASHBOARD
type MapViewMode = 'galaxy' | 'system' | 'orbit';

interface ActiveView {
  view_type: ViewType;
  location_slug: string;
  view_slug: string;
  overlay_location_slug: string;
  overlay_terminal_slug: string;
  updated_at: string;
}

interface InitialData {
  activeView: ActiveView;
  starSystems?: StarSystem[];
  crew?: string[];
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

  // Poll for active view changes
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/active-view/');
        const data = await response.json();

        // Check if view changed
        if (data.updated_at !== activeView?.updated_at) {
          setActiveView(data);
          // Reset selection on view change
          if (data.view_type === 'CAMPAIGN_DASHBOARD') {
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
        }
      } catch (error) {
        console.error('Failed to poll active view:', error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [activeView?.updated_at]);

  const viewType = activeView?.view_type || 'STANDBY';
  const isStandby = viewType === 'STANDBY';

  // Build star systems list from API data
  const starSystems: StarSystem[] = (starMapData?.systems || [])
    .filter(system => system.label)
    .map(system => ({
      name: system.name,
      hasSystemMap: !!system.has_system_map,
    }));

  // Get data from initial Django context (fallback)
  const crew = window.INITIAL_DATA?.crew || [
    'Dr. Elena Vasquez - Science Officer',
    'Marcus "Wrench" Chen - Engineer',
    'Lt. Sarah Kim - Security',
    'Alex Novak - Pilot'
  ];
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

  const handleSystemMapClick = useCallback((systemName: string) => {
    console.log('Navigate to system map:', systemName);
    // Find the system's location_slug
    const system = starMapData?.systems.find(s => s.name === systemName);
    if (system?.location_slug) {
      // Set selectedSystem so we preserve system info in the details panel
      setSelectedSystem(systemName);
      setCurrentSystemSlug(system.location_slug);
      setMapViewMode('system');
      setSelectedPlanet(null);
    }
  }, [starMapData]);

  const handleBackToGalaxy = useCallback(() => {
    console.log('Returning to galaxy view');
    setMapViewMode('galaxy');
    setCurrentSystemSlug(null);
    setSystemMapData(null);
    setSelectedPlanet(null);
  }, []);

  const handleSystemLoaded = useCallback((data: SystemMapData | null) => {
    console.log('System loaded:', data?.star.name);
    setSystemMapData(data);
  }, []);

  const handlePlanetSelect = useCallback((planetData: BodyData | null) => {
    console.log('Planet selected:', planetData?.name);
    setSelectedPlanet(planetData);
  }, []);

  const handleOrbitMapNavigate = useCallback((systemSlug: string, planetSlug: string) => {
    console.log('Navigate to orbit map:', systemSlug, planetSlug);
    // Navigate to orbit view
    setCurrentBodySlug(planetSlug);
    setMapViewMode('orbit');
    setSelectedOrbitElement(null);
    setSelectedOrbitElementType(null);
    setSelectedOrbitElementData(null);
  }, []);

  const handleBackToSystem = useCallback(() => {
    console.log('Returning to system view');
    setMapViewMode('system');
    setCurrentBodySlug(null);
    setOrbitMapData(null);
    setSelectedOrbitElement(null);
    setSelectedOrbitElementType(null);
    setSelectedOrbitElementData(null);
  }, []);

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

      {/* Header - hidden in standby mode */}
      <TerminalHeader
        title="MOTHERSHIP"
        subtitle="TERMINAL"
        rightText="STATION ACCESS"
        hidden={isStandby}
      />

      {/* View content */}
      {viewType === 'STANDBY' && (
        <StandbyView title="MOTHERSHIP" subtitle="The Outer Veil" />
      )}

      {viewType === 'CAMPAIGN_DASHBOARD' && (
        <>
          {/* Galaxy Map - renders behind dashboard panels (hidden when in system view) */}
          {mapViewMode === 'galaxy' && (
            <GalaxyMap
              data={starMapData}
              selectedSystem={selectedSystem}
              onSystemSelect={handleSystemSelect}
            />
          )}

          {/* System Map - renders when viewing a specific system */}
          {mapViewMode === 'system' && (
            <SystemMap
              systemSlug={currentSystemSlug}
              selectedPlanet={selectedPlanet?.name || null}
              onPlanetSelect={handlePlanetSelect}
              onOrbitMapNavigate={handleOrbitMapNavigate}
              onBackToGalaxy={handleBackToGalaxy}
              onSystemLoaded={handleSystemLoaded}
            />
          )}

          {/* Orbit Map - renders when viewing a specific planet */}
          {mapViewMode === 'orbit' && (
            <OrbitMap
              systemSlug={currentSystemSlug}
              bodySlug={currentBodySlug}
              selectedElement={selectedOrbitElement}
              selectedElementType={selectedOrbitElementType}
              onElementSelect={handleOrbitElementSelect}
              onBackToSystem={handleBackToSystem}
              onOrbitMapLoaded={handleOrbitMapLoaded}
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
                handleOrbitMapNavigate(currentSystemSlug, planet.location_slug);
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
            currentPlanetName={selectedPlanet?.name || orbitMapData?.planet?.name}
          />

          {/* Info Panel - reusable floating panel for selected item info */}
          <InfoPanel
            title={infoPanelTitle}
            content={infoPanelContent}
            visible={infoPanelVisible}
          />
        </>
      )}

      {/* Other view types can be added here */}
      {viewType !== 'STANDBY' && viewType !== 'CAMPAIGN_DASHBOARD' && (
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
    </>
  );
}

// Mount the app
const root = document.getElementById('shared-console-root');
if (root) {
  ReactDOM.createRoot(root).render(<SharedConsole />);
}
