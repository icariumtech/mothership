import { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/global.css';
import { TerminalHeader } from '@components/layout/TerminalHeader';
import { StandbyView } from '@components/domain/dashboard/StandbyView';
import { CampaignDashboard, StarSystem } from '@components/domain/dashboard/CampaignDashboard';
import { InfoPanel, buildSystemInfoHTML } from '@components/domain/dashboard/InfoPanel';
import { GalaxyMap } from '@components/domain/maps/GalaxyMap';
import type { StarMapData } from '../types/starMap';

// View types matching Django's ActiveView model
type ViewType = 'STANDBY' | 'CAMPAIGN_DASHBOARD' | 'ENCOUNTER_MAP' | 'COMM_TERMINAL' | 'MESSAGES' | 'SHIP_DASHBOARD';

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
      hasSystemMap: !!system.location_slug,
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

  // Build info panel content HTML (memoized to prevent re-renders)
  const infoPanelContent = useMemo(() => {
    if (!selectedSystemData) return '';
    return buildSystemInfoHTML(selectedSystemData);
  }, [selectedSystemData]);

  const handleSystemSelect = (systemName: string) => {
    setSelectedSystem(prev => prev === systemName ? null : systemName);
  };

  const handleSystemMapClick = (systemName: string) => {
    console.log('Navigate to system map:', systemName);
    // Find the system's location_slug
    const system = starMapData?.systems.find(s => s.name === systemName);
    if (system?.location_slug) {
      // TODO: Trigger navigation to system map view
      // This would typically POST to the GM console or update active view
      console.log('Would navigate to:', system.location_slug);
    }
  };

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
          {/* Galaxy Map - renders behind dashboard panels */}
          <GalaxyMap
            data={starMapData}
            selectedSystem={selectedSystem}
            onSystemSelect={handleSystemSelect}
          />

          <CampaignDashboard
            campaignTitle={campaignTitle}
            crew={crew}
            notes={notes}
            starSystems={starSystems}
            selectedSystem={selectedSystem}
            onSystemSelect={handleSystemSelect}
            onSystemMapClick={handleSystemMapClick}
          />

          {/* Info Panel - reusable floating panel for selected item info */}
          <InfoPanel
            title={selectedSystemData?.name?.toUpperCase() || 'SYSTEM INFO'}
            content={infoPanelContent}
            visible={!!selectedSystem}
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
