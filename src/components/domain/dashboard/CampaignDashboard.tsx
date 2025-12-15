import { ReactNode } from 'react';
import './CampaignDashboard.css';

interface DashboardPanelProps {
  title: string;
  children: ReactNode;
  className?: string;
}

// Reusable panel component for dashboard
function DashboardPanel({ title, children, className = '' }: DashboardPanelProps) {
  return (
    <div className={`panel-base border-all ${className}`}>
      <div className="dashboard-panel-header">
        <h3>{title}</h3>
      </div>
      <div className="dashboard-panel-content">
        {children}
      </div>
    </div>
  );
}

export interface StarSystem {
  name: string;
  hasSystemMap: boolean;
}

export interface SystemPlanet {
  name: string;
  hasOrbitMap: boolean;
  locationSlug?: string;
  surfaceFacilityCount?: number;
  orbitalStationCount?: number;
}

interface CampaignDashboardProps {
  campaignTitle?: string;
  crew?: string[];
  notes?: string[];
  starSystems?: StarSystem[];
  statusItems?: string[];
  onSystemSelect?: (systemName: string) => void;
  onSystemMapClick?: (systemName: string) => void;
  selectedSystem?: string | null;
  // System map view props
  mapViewMode?: 'galaxy' | 'system' | 'orbit';
  systemPlanets?: SystemPlanet[];
  selectedPlanet?: string | null;
  onPlanetSelect?: (planetName: string) => void;
  onBackToGalaxy?: () => void;
  onOrbitMapClick?: (planetName: string) => void;
}

export function CampaignDashboard({
  campaignTitle = 'THE OUTER VEIL CAMPAIGN',
  crew = [],
  notes = [],
  starSystems = [],
  statusItems = [],
  onSystemSelect,
  onSystemMapClick,
  selectedSystem = null,
  // System map view props
  mapViewMode = 'galaxy',
  systemPlanets = [],
  selectedPlanet = null,
  onPlanetSelect,
  onBackToGalaxy,
  onOrbitMapClick
}: CampaignDashboardProps) {
  // Render star systems list for galaxy view
  const renderGalaxyList = () => (
    <>
      {starSystems.length > 0 ? (
        starSystems.map((system) => (
          <div
            key={system.name}
            className={`star-system-row ${selectedSystem === system.name ? 'selected' : ''}`}
            onClick={() => onSystemSelect?.(system.name)}
          >
            <div className="star-system-content">
              <div className={`star-system-checkbox ${selectedSystem === system.name ? 'checked' : ''}`} />
              <div className="star-system-name">{system.name}</div>
            </div>
            {system.hasSystemMap && (
              <div
                className="system-map-btn-container"
                title="View system map"
                onClick={(e) => {
                  e.stopPropagation();
                  onSystemMapClick?.(system.name);
                }}
              >
                <span className="system-map-btn-icon">▶</span>
              </div>
            )}
          </div>
        ))
      ) : (
        <p>&gt; No star systems found</p>
      )}
    </>
  );

  // Render planet list for system view
  const renderPlanetList = () => (
    <>
      {/* Back to Galaxy button */}
      <div
        className="star-system-row back-to-galaxy-btn"
        onClick={() => onBackToGalaxy?.()}
        style={{ marginBottom: 12, borderColor: 'var(--color-amber)' }}
      >
        <div className="star-system-content">
          <div
            className="star-system-checkbox"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-amber)',
              fontSize: 14,
              background: 'none',
              border: 'none',
              marginLeft: 2
            }}
          >
            ◀
          </div>
          <div className="star-system-name" style={{ color: 'var(--color-amber)' }}>
            BACK TO GALAXY
          </div>
        </div>
      </div>

      {/* Planet list */}
      {systemPlanets.length > 0 ? (
        systemPlanets.map((planet) => (
          <div
            key={planet.name}
            className={`star-system-row planet-row ${selectedPlanet === planet.name ? 'selected' : ''}`}
            onClick={() => onPlanetSelect?.(planet.name)}
          >
            <div className="star-system-content">
              <div className={`star-system-checkbox ${selectedPlanet === planet.name ? 'checked' : ''}`} />
              <div className="star-system-name">{planet.name}</div>
              {/* Indicators for facilities */}
              <div className="planet-indicators">
                {(planet.surfaceFacilityCount ?? 0) > 0 && (
                  <span className="planet-indicator surface-indicator" title="Surface facilities">■</span>
                )}
                {(planet.orbitalStationCount ?? 0) > 0 && (
                  <span className="planet-indicator orbital-indicator" title="Orbital stations">▲</span>
                )}
              </div>
            </div>
            {planet.hasOrbitMap && (
              <div
                className="system-map-btn-container"
                title="View orbit map"
                onClick={(e) => {
                  e.stopPropagation();
                  onOrbitMapClick?.(planet.name);
                }}
              >
                <span className="system-map-btn-icon">▶</span>
              </div>
            )}
          </div>
        ))
      ) : (
        <p>&gt; No planetary bodies in system</p>
      )}
    </>
  );

  return (
    <div className="campaign-dashboard">
      {/* Top Panel - Campaign Title */}
      <div className="dashboard-top panel-base chamfer-bl-br border-all corner-line-bl-br">
        <div className="dashboard-top-content">{campaignTitle}</div>
      </div>

      {/* Left Column */}
      <div className="dashboard-left">
        {/* CREW Panel */}
        <DashboardPanel title="CREW" className="chamfer-tr-bl corner-line-tr-bl">
          {crew.length > 0 ? (
            crew.map((member, i) => <p key={i}>&gt; {member}</p>)
          ) : (
            <p>&gt; No crew assigned</p>
          )}
        </DashboardPanel>

        {/* NOTES Panel */}
        <DashboardPanel title="NOTES" className="chamfer-tr-bl corner-line-tr-bl">
          {notes.length > 0 ? (
            notes.map((note, i) => <p key={i}>&gt; {note}</p>)
          ) : (
            <p>&gt; No notes</p>
          )}
        </DashboardPanel>
      </div>

      {/* Right Column */}
      <div className="dashboard-right">
        {/* STAR MAP Panel - shows different content based on view mode */}
        <DashboardPanel title="STAR MAP" className="chamfer-tl-br corner-line-tl-br">
          {mapViewMode === 'galaxy' && renderGalaxyList()}
          {mapViewMode === 'system' && renderPlanetList()}
        </DashboardPanel>

        {/* STATUS Panel */}
        <DashboardPanel title="STATUS" className="chamfer-tl-br corner-line-tl-br">
          {statusItems.length > 0 ? (
            statusItems.map((item, i) => <p key={i}>&gt; {item}</p>)
          ) : (
            <>
              <p>&gt; All systems nominal</p>
              <p>&gt; Course steady</p>
            </>
          )}
        </DashboardPanel>
      </div>

    </div>
  );
}
