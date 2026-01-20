import { useState } from 'react';
import { DashboardPanel } from '@components/ui/DashboardPanel';
import './CampaignDashboard.css';

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

export interface OrbitElement {
  name: string;
  type: 'moon' | 'station' | 'surface';
  hasFacilities?: boolean;
}

// Crew member stats following Mothership RPG format
export interface CrewMemberStats {
  strength: number;
  speed: number;
  intellect: number;
  combat: number;
}

export interface CrewMemberSaves {
  sanity: number;
  fear: number;
  body: number;
}

export interface CrewMemberHealth {
  current: number;
  max: number;
}

export interface CrewMember {
  id: string;
  name: string;
  callsign?: string;
  role: string;
  class: string;
  portrait?: string;
  stats: CrewMemberStats;
  saves: CrewMemberSaves;
  stress: number;
  health: CrewMemberHealth;
  wounds: number;
  armor: number;
  background: string;
  motivation: string;
  status: string;
  description: string;
}

interface CampaignDashboardProps {
  campaignTitle?: string;
  crew?: CrewMember[];
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
  // Orbit map view props
  orbitElements?: OrbitElement[];
  selectedOrbitElement?: string | null;
  selectedOrbitElementType?: 'moon' | 'station' | 'surface' | null;
  onOrbitElementSelect?: (elementType: string, elementName: string) => void;
  onBackToSystem?: () => void;
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
  onOrbitMapClick,
  // Orbit map view props
  orbitElements = [],
  selectedOrbitElement = null,
  selectedOrbitElementType = null,
  onOrbitElementSelect,
  onBackToSystem,
}: CampaignDashboardProps) {
  // State for selected crew member
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);

  // Get the selected crew member data
  const selectedCrewMember = crew.find(m => m.id === selectedCrewId);

  // Handle crew member selection
  const handleCrewSelect = (crewId: string) => {
    setSelectedCrewId(selectedCrewId === crewId ? null : crewId);
  };

  // Render crew list (similar to star system list)
  const renderCrewList = () => (
    <>
      {crew.length > 0 ? (
        crew.map((member) => (
          <div
            key={member.id}
            className={`crew-member-row ${selectedCrewId === member.id ? 'selected' : ''}`}
            onClick={() => handleCrewSelect(member.id)}
          >
            <div className="crew-member-content">
              <div className={`crew-member-checkbox ${selectedCrewId === member.id ? 'checked' : ''}`} />
              <div className="crew-member-info">
                <div className="crew-member-name">
                  {member.callsign ? `"${member.callsign}"` : member.name.split(' ')[0]}
                </div>
                <div className="crew-member-role">{member.role}</div>
              </div>
              <div className="crew-member-status-indicators">
                {/* Health indicator */}
                <span
                  className={`crew-indicator health-indicator ${member.health.current < member.health.max ? 'damaged' : ''}`}
                  title={`Health: ${member.health.current}/${member.health.max}`}
                >
                  {member.health.current < member.health.max ? '◐' : '●'}
                </span>
                {/* Stress indicator */}
                {member.stress > 0 && (
                  <span
                    className={`crew-indicator stress-indicator ${member.stress >= 5 ? 'critical' : member.stress >= 3 ? 'warning' : ''}`}
                    title={`Stress: ${member.stress}`}
                  >
                    ◆
                  </span>
                )}
              </div>
            </div>
          </div>
        ))
      ) : (
        <p>&gt; No crew assigned</p>
      )}
    </>
  );

  // Render crew member details panel
  const renderCrewDetails = () => {
    if (!selectedCrewMember) return null;

    const m = selectedCrewMember;
    const displayName = m.callsign ? `${m.name} "${m.callsign}"` : m.name;

    return (
      <div className="crew-details">
        {/* Portrait and name header */}
        <div className="crew-details-header">
          <div className="crew-portrait-container">
            {m.portrait ? (
              <img src={m.portrait} alt={m.name} className="crew-portrait" />
            ) : (
              <div className="crew-portrait-placeholder">
                <span>{m.name.charAt(0)}</span>
              </div>
            )}
          </div>
          <div className="crew-header-info">
            <div className="crew-details-name">{displayName}</div>
            <div className="crew-details-class">{m.class} / {m.role}</div>
            <div className={`crew-details-status status-${m.status.toLowerCase()}`}>
              {m.status}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="crew-stats-section">
          <div className="crew-section-label">ATTRIBUTES</div>
          <div className="crew-stats-grid">
            <div className="crew-stat">
              <span className="stat-label">STR</span>
              <span className="stat-value">{m.stats.strength}</span>
            </div>
            <div className="crew-stat">
              <span className="stat-label">SPD</span>
              <span className="stat-value">{m.stats.speed}</span>
            </div>
            <div className="crew-stat">
              <span className="stat-label">INT</span>
              <span className="stat-value">{m.stats.intellect}</span>
            </div>
            <div className="crew-stat">
              <span className="stat-label">CMB</span>
              <span className="stat-value">{m.stats.combat}</span>
            </div>
          </div>
        </div>

        {/* Saves */}
        <div className="crew-saves-section">
          <div className="crew-section-label">SAVES</div>
          <div className="crew-saves-grid">
            <div className="crew-save">
              <span className="save-label">SAN</span>
              <span className="save-value">{m.saves.sanity}%</span>
            </div>
            <div className="crew-save">
              <span className="save-label">FEAR</span>
              <span className="save-value">{m.saves.fear}%</span>
            </div>
            <div className="crew-save">
              <span className="save-label">BODY</span>
              <span className="save-value">{m.saves.body}%</span>
            </div>
          </div>
        </div>

        {/* Condition bars */}
        <div className="crew-condition-section">
          <div className="crew-section-label">CONDITION</div>
          <div className="crew-condition-bars">
            {/* Health bar */}
            <div className="condition-row">
              <span className="condition-label">HEALTH</span>
              <div className="condition-bar-container">
                <div
                  className="condition-bar health-bar"
                  style={{ width: `${(m.health.current / m.health.max) * 100}%` }}
                />
              </div>
              <span className="condition-value">{m.health.current}/{m.health.max}</span>
            </div>
            {/* Stress bar */}
            <div className="condition-row">
              <span className="condition-label">STRESS</span>
              <div className="condition-bar-container">
                <div
                  className={`condition-bar stress-bar ${m.stress >= 5 ? 'critical' : m.stress >= 3 ? 'warning' : ''}`}
                  style={{ width: `${(m.stress / 10) * 100}%` }}
                />
              </div>
              <span className="condition-value">{m.stress}/10</span>
            </div>
            {/* Armor/Wounds */}
            <div className="condition-stats-row">
              <div className="condition-stat">
                <span className="condition-label">ARMOR</span>
                <span className="condition-value">{m.armor}</span>
              </div>
              <div className="condition-stat">
                <span className="condition-label">WOUNDS</span>
                <span className={`condition-value ${m.wounds > 0 ? 'wounded' : ''}`}>{m.wounds}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="crew-description-section">
          <div className="crew-description">{m.description}</div>
        </div>
      </div>
    );
  };

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

  // Render orbit elements list for orbit view
  const renderOrbitList = () => {
    // Group elements by type
    const moons = orbitElements.filter(e => e.type === 'moon');
    const stations = orbitElements.filter(e => e.type === 'station');
    const surface = orbitElements.filter(e => e.type === 'surface');

    return (
      <>
        {/* Back to System button */}
        <div
          className="star-system-row back-to-system-btn"
          onClick={() => onBackToSystem?.()}
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
              BACK TO SYSTEM
            </div>
          </div>
        </div>

        {/* Moons section */}
        {moons.length > 0 && (
          <>
            <div className="orbit-section-label">MOONS</div>
            {moons.map((element) => (
              <div
                key={`moon-${element.name}`}
                className={`star-system-row orbit-element-row ${selectedOrbitElement === element.name && selectedOrbitElementType === 'moon' ? 'selected' : ''}`}
                onClick={() => onOrbitElementSelect?.('moon', element.name)}
              >
                <div className="star-system-content">
                  <div className={`star-system-checkbox ${selectedOrbitElement === element.name && selectedOrbitElementType === 'moon' ? 'checked' : ''}`} />
                  <div className="star-system-name">{element.name}</div>
                  {element.hasFacilities && (
                    <div className="planet-indicators">
                      <span className="planet-indicator surface-indicator" title="Has facilities">■</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Stations section */}
        {stations.length > 0 && (
          <>
            <div className="orbit-section-label">ORBITAL STATIONS</div>
            {stations.map((element) => (
              <div
                key={`station-${element.name}`}
                className={`star-system-row orbit-element-row ${selectedOrbitElement === element.name && selectedOrbitElementType === 'station' ? 'selected' : ''}`}
                onClick={() => onOrbitElementSelect?.('station', element.name)}
              >
                <div className="star-system-content">
                  <div className={`star-system-checkbox ${selectedOrbitElement === element.name && selectedOrbitElementType === 'station' ? 'checked' : ''}`} />
                  <div className="star-system-name">{element.name}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Surface markers section */}
        {surface.length > 0 && (
          <>
            <div className="orbit-section-label">SURFACE LOCATIONS</div>
            {surface.map((element) => (
              <div
                key={`surface-${element.name}`}
                className={`star-system-row orbit-element-row ${selectedOrbitElement === element.name && selectedOrbitElementType === 'surface' ? 'selected' : ''}`}
                onClick={() => onOrbitElementSelect?.('surface', element.name)}
              >
                <div className="star-system-content">
                  <div className={`star-system-checkbox ${selectedOrbitElement === element.name && selectedOrbitElementType === 'surface' ? 'checked' : ''}`} />
                  <div className="star-system-name">{element.name}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Empty state */}
        {moons.length === 0 && stations.length === 0 && surface.length === 0 && (
          <p>&gt; No orbital elements</p>
        )}
      </>
    );
  };

  return (
    <div className="campaign-dashboard">
      {/* Top Panel - Campaign Title */}
      <DashboardPanel
        chamferCorners={['bl', 'br']}
        className="dashboard-top-panel"
        scrollable={false}
        padding="0"
      >
        <div className="dashboard-top-content">{campaignTitle}</div>
      </DashboardPanel>

      {/* Left Column */}
      <div className="dashboard-left">
        {/* CREW Panel - shows list and details subpanels */}
        <DashboardPanel
          title="CREW"
          chamferCorners={['tr', 'bl']}
          className="crew-panel-wrapper"
          padding="0"
        >
          <div className="crew-panel-content">
            {/* Crew list subpanel */}
            <div className="crew-list-subpanel">
              {renderCrewList()}
            </div>
            {/* Crew details subpanel - only shows when crew member selected */}
            {selectedCrewMember && (
              <div className="crew-details-subpanel">
                {renderCrewDetails()}
              </div>
            )}
          </div>
        </DashboardPanel>

        {/* NOTES Panel */}
        <DashboardPanel title="NOTES" chamferCorners={['tr', 'bl']}>
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
        <DashboardPanel title="STAR MAP" chamferCorners={['tl', 'br']}>
          {mapViewMode === 'galaxy' && renderGalaxyList()}
          {mapViewMode === 'system' && renderPlanetList()}
          {mapViewMode === 'orbit' && renderOrbitList()}
        </DashboardPanel>

        {/* STATUS Panel */}
        <DashboardPanel title="STATUS" chamferCorners={['tl', 'br']}>
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
