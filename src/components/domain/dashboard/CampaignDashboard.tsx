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

interface CampaignDashboardProps {
  campaignTitle?: string;
  crew?: string[];
  notes?: string[];
  starSystems?: StarSystem[];
  statusItems?: string[];
  onSystemSelect?: (systemName: string) => void;
  onSystemMapClick?: (systemName: string) => void;
  selectedSystem?: string | null;
}

export function CampaignDashboard({
  campaignTitle = 'THE OUTER VEIL CAMPAIGN',
  crew = [],
  notes = [],
  starSystems = [],
  statusItems = [],
  onSystemSelect,
  onSystemMapClick,
  selectedSystem = null
}: CampaignDashboardProps) {
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
        {/* STAR MAP Panel */}
        <DashboardPanel title="STAR MAP" className="chamfer-tl-br corner-line-tl-br">
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

      {/* System Info Panel - positioned absolutely */}
      <div id="system-info-panel" className={`system-info-panel ${selectedSystem ? 'visible' : ''}`}>
        <div className="dashboard-panel-header">
          <h3 id="system-info-name">{selectedSystem || 'SYSTEM INFO'}</h3>
        </div>
        <div className="dashboard-panel-content">
          <div id="system-info-content">
            {/* Dynamic content will be inserted here */}
          </div>
        </div>
      </div>

      {/* Decorative elements for system info panel */}
      <div className={`system-info-indicator-boxes ${selectedSystem ? 'visible' : ''}`} />
      <div className={`system-info-rectangle ${selectedSystem ? 'visible' : ''}`} />
      <div className={`system-info-triangle ${selectedSystem ? 'visible' : ''}`} />
    </div>
  );
}
