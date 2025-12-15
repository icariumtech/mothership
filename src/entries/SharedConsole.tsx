import { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/global.css';
import { TerminalHeader } from '@components/layout/TerminalHeader';
import { StandbyView } from '@components/domain/dashboard/StandbyView';
import { CampaignDashboard, StarSystem } from '@components/domain/dashboard/CampaignDashboard';
import { InfoPanel, buildSystemInfoHTML, buildPlanetInfoHTML } from '@components/domain/dashboard/InfoPanel';
import { GalaxyMap } from '@components/domain/maps/GalaxyMap';
import { SystemMap } from '@components/domain/maps/SystemMap';
import type { StarMapData } from '../types/starMap';
import type { SystemMapData, BodyData } from '../types/systemMap';

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
    if (mapViewMode === 'galaxy' && selectedSystemData) {
      return buildSystemInfoHTML(selectedSystemData);
    }
    return '';
  }, [selectedSystemData, mapViewMode, selectedPlanet, systemMapData]);

  // Determine info panel title
  const infoPanelTitle = useMemo(() => {
    if (mapViewMode === 'system' && selectedPlanet) {
      return selectedPlanet.name.toUpperCase();
    }
    if (mapViewMode === 'system' && systemMapData) {
      return systemMapData.star.name.toUpperCase();
    }
    if (selectedSystemData) {
      return selectedSystemData.name.toUpperCase();
    }
    return 'SYSTEM INFO';
  }, [selectedSystemData, mapViewMode, selectedPlanet, systemMapData]);

  // Determine if info panel should be visible
  const infoPanelVisible = useMemo(() => {
    if (mapViewMode === 'galaxy') {
      return !!selectedSystem;
    }
    if (mapViewMode === 'system') {
      return true; // Always show panel in system view
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
    // TODO: Implement orbit map view (Phase E)
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
