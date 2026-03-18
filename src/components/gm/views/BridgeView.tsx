import { useState, useCallback, useEffect, useMemo } from 'react';
import { Modal, Typography, Tag, Progress, Select, message } from 'antd';
import {
  RobotOutlined,
  TeamOutlined,
  ReadOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ActiveView, Location } from '@/types/gmConsole';
import type { ShipStatusData, SystemStatus } from '@/types/shipStatus';
import { gmConsoleApi, type CrewMember, type SessionLog } from '@/services/gmConsoleApi';
import { ToolRail, ToolRailButton } from '@/components/gm/layout/ToolRail';
import { SlideOutPanel } from '@/components/gm/layout/SlideOutPanel';
import { LocationTreePanel } from '@/components/gm/panels/LocationTreePanel';
import { CharonPanel } from '@/components/gm/CharonPanel';
import { GalaxyMap } from '@/components/domain/maps/GalaxyMap';
import { SystemMap } from '@/components/domain/maps/SystemMap';
import { OrbitMap } from '@/components/domain/maps/OrbitMap';
import type { StarMapData } from '@/types/starMap';
import './BridgeView.css';

const { Text } = Typography;

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: '#4a6b6b',
  INJURED: '#faad14',
  INCAPACITATED: '#ff4d4f',
  DEAD: '#888',
};

interface BridgeViewProps {
  activeView: ActiveView | null;
  locations: Location[];
  expandedNodes: Set<string>;
  onToggleNode: (key: string) => void;
  onShowTerminal: (locationSlug: string, terminalSlug: string) => void;
  charonChannel: string;
  charonDialogOpen: boolean;
  onDialogToggle: () => void;
  shipData: ShipStatusData | null;
}

export function BridgeView({
  activeView,
  locations,
  expandedNodes,
  onToggleNode,
  onShowTerminal,
  charonChannel,
  charonDialogOpen,
  onDialogToggle,
  shipData,
}: BridgeViewProps) {
  const [activePanel, setActivePanel] = useState<string | null>(null);

  // Personnel
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [npcs, setNpcs] = useState<CrewMember[]>([]);
  const [loadingCrew, setLoadingCrew] = useState(false);
  const [selectedCrew, setSelectedCrew] = useState<CrewMember | null>(null);

  // Sessions
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionLog | null>(null);

  // Star map data for map mirror
  const [starMapData, setStarMapData] = useState<StarMapData | null>(null);

  useEffect(() => {
    fetch('/api/star-map/')
      .then(r => r.json())
      .then((data: StarMapData) => setStarMapData(data))
      .catch(err => console.error('Failed to fetch star map data for GM mirror:', err));
  }, []);

  const tools: ToolRailButton[] = useMemo(() => [
    { key: 'locations', icon: <ApartmentOutlined />, tooltip: 'Locations' },
    { key: 'personnel', icon: <TeamOutlined />, tooltip: 'Personnel' },
    { key: 'sessions', icon: <ReadOutlined />, tooltip: 'Session Logs' },
    { key: 'charon', icon: <RobotOutlined />, tooltip: 'CHARON' },
  ], []);

  const handleToolToggle = useCallback((key: string) => {
    setActivePanel(prev => prev === key ? null : key);
  }, []);

  // Auto-expand tree to reveal the player's selected location
  useEffect(() => {
    const slug = activeView?.view_slug;
    if (!slug || !locations.length) return;

    function findAncestors(locs: Location[], target: string, path: string[] = []): string[] | null {
      for (const loc of locs) {
        if (loc.slug === target) return path;
        const found = findAncestors(loc.children, target, [...path, loc.slug]);
        if (found !== null) return found;
      }
      return null;
    }

    const ancestors = findAncestors(locations, slug);
    if (ancestors) {
      for (const ancestor of ancestors) {
        if (!expandedNodes.has(ancestor)) onToggleNode(ancestor);
      }
    }
  }, [activeView?.view_slug, locations, activePanel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load crew + NPCs when personnel panel opens
  useEffect(() => {
    if (activePanel === 'personnel' && crew.length === 0 && npcs.length === 0 && !loadingCrew) {
      setLoadingCrew(true);
      gmConsoleApi.getCrew()
        .then(data => { setCrew(data.crew); setNpcs(data.npcs); })
        .catch(err => console.error('Failed to load crew:', err))
        .finally(() => setLoadingCrew(false));
    }
  }, [activePanel, crew.length, npcs.length, loadingCrew]);

  // Load sessions when sessions panel opens
  useEffect(() => {
    if (activePanel === 'sessions' && sessions.length === 0 && !loadingSessions) {
      setLoadingSessions(true);
      gmConsoleApi.getSessions()
        .then(setSessions)
        .catch(err => console.error('Failed to load sessions:', err))
        .finally(() => setLoadingSessions(false));
    }
  }, [activePanel, sessions.length, loadingSessions]);

  return (
    <div className="gm-bridge-view">
      {/* Player tab indicator */}
      {activeView?.view_type === 'BRIDGE' && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 2,
          background: '#0a0f0f',
          border: '1px solid #1f2f2f',
          borderRadius: 4,
          padding: '3px 4px',
          pointerEvents: 'none',
          zIndex: 5,
        }}>
          {(['map', 'personnel', 'logs', 'status', 'charon'] as const).map(tab => {
            const active = activeView.bridge_tab === tab;
            return (
              <div key={tab} style={{
                padding: '5px 14px',
                borderRadius: 3,
                fontSize: 13,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                background: active ? '#4a6b6b' : 'transparent',
                color: active ? '#e8e8e8' : '#666',
              }}>
                {tab}
              </div>
            );
          })}
        </div>
      )}

      {/* Main dashboard area */}
      <GmBridgeDashboard
        activeView={activeView}
        locations={locations}
        starMapData={starMapData}
        shipData={shipData}
      />

      <div className="gm-bridge-view__right">
        <ToolRail tools={tools} activePanel={activePanel} onToggle={handleToolToggle} />

        <SlideOutPanel open={activePanel === 'locations'} title="Locations" onClose={() => setActivePanel(null)}>
          <LocationTreePanel
            locations={locations}
            selectedLocationSlug={activeView?.view_slug || null}
            activeTerminalLocationSlug={activeView?.overlay_location_slug || null}
            activeTerminalSlug={activeView?.overlay_terminal_slug || null}
            expandedNodes={expandedNodes}
            onToggleNode={onToggleNode}
            onSelectLocation={() => {}}
            onShowTerminal={onShowTerminal}
          />
        </SlideOutPanel>

        {/* Personnel list panel */}
        <SlideOutPanel open={activePanel === 'personnel'} title="Personnel" onClose={() => setActivePanel(null)}>
          {loadingCrew ? (
            <Text type="secondary" style={{ fontSize: 11 }}>Loading...</Text>
          ) : crew.length === 0 && npcs.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 11 }}>No personnel data found.</Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Crew section */}
              {crew.length > 0 && (
                <>
                  <PersonnelSectionHeader label="Crew" />
                  {crew.map(member => <PersonnelCard key={member.id} member={member} onClick={setSelectedCrew} />)}
                </>
              )}

              {/* NPCs grouped by location */}
              {(() => {
                const byLocation: Record<string, CrewMember[]> = {};
                for (const npc of npcs) {
                  const loc = npc.location || 'Unknown';
                  if (!byLocation[loc]) byLocation[loc] = [];
                  byLocation[loc].push(npc);
                }
                return Object.entries(byLocation).map(([loc, members]) => (
                  <div key={loc}>
                    <PersonnelSectionHeader label={loc} />
                    {members.map(member => <PersonnelCard key={member.id} member={member} onClick={setSelectedCrew} />)}
                  </div>
                ));
              })()}
            </div>
          )}
        </SlideOutPanel>

        {/* Session logs list panel */}
        <SlideOutPanel open={activePanel === 'sessions'} title="Session Logs" onClose={() => setActivePanel(null)}>
          {loadingSessions ? (
            <Text type="secondary" style={{ fontSize: 11 }}>Loading...</Text>
          ) : sessions.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 11 }}>No session logs found.</Text>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessions.map(session => (
                <div
                  key={session.filename}
                  onClick={() => setSelectedSession(session)}
                  style={{
                    padding: '8px 10px',
                    background: '#0f1515',
                    border: '1px solid #252525',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#4a6b6b')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#252525')}
                >
                  {session.session_number !== undefined && (
                    <div style={{ color: '#8b7355', fontSize: 10, marginBottom: 2 }}>
                      SESSION {session.session_number}
                    </div>
                  )}
                  <div style={{ color: '#d0d0d0', fontSize: 12, fontWeight: 500, marginBottom: 3 }}>
                    {session.title || session.filename}
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 10 }}>
                    {session.date && <span style={{ color: '#555' }}>{session.date}</span>}
                    {session.location && <span style={{ color: '#4a6b6b' }}>{session.location}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SlideOutPanel>

        <SlideOutPanel open={activePanel === 'charon'} title="CHARON" onClose={() => setActivePanel(null)}>
          <CharonPanel
            channel={charonChannel}
            currentViewType="BRIDGE"
            charonDialogOpen={charonDialogOpen}
            onDialogToggle={onDialogToggle}
          />
        </SlideOutPanel>
      </div>

      {/* Crew detail modal */}
      {selectedCrew && (
        <Modal
          title={selectedCrew.name}
          open={true}
          onCancel={() => setSelectedCrew(null)}
          footer={null}
          width={520}
        >
          <CrewDetailView member={selectedCrew} />
        </Modal>
      )}

      {/* Session detail modal */}
      {selectedSession && (
        <Modal
          title={selectedSession.title || selectedSession.filename}
          open={true}
          onCancel={() => setSelectedSession(null)}
          footer={null}
          width={620}
        >
          <SessionDetailView session={selectedSession} />
        </Modal>
      )}
    </div>
  );
}

// --- List sub-components ---

function PersonnelSectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      color: '#555',
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      padding: '6px 2px 2px',
      borderBottom: '1px solid #1f1f1f',
      marginTop: 4,
    }}>
      {label}
    </div>
  );
}

function PersonnelCard({ member, onClick }: { member: CrewMember; onClick: (m: CrewMember) => void }) {
  const hullPct = member.health ? (member.health.current / member.health.max) * 100 : 100;
  const hullColor = hullPct < 30 ? '#ff4d4f' : hullPct < 60 ? '#faad14' : '#52c41a';
  const statusColor = STATUS_COLOR[member.status || 'ACTIVE'] || '#4a6b6b';
  return (
    <div
      onClick={() => onClick(member)}
      style={{
        padding: '8px 10px',
        background: '#0f1515',
        border: '1px solid #252525',
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#4a6b6b')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#252525')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ color: '#d0d0d0', fontSize: 12, fontWeight: 500 }}>
          {member.name}
          {member.callsign && <span style={{ color: '#555', fontWeight: 400 }}> "{member.callsign}"</span>}
        </Text>
        <span style={{ fontSize: 10, color: statusColor }}>{member.status || 'ACTIVE'}</span>
      </div>
      <div style={{ color: '#666', fontSize: 11, marginBottom: member.health ? 5 : 0 }}>
        {member.role}{member.class && member.class !== member.role ? ` — ${member.class}` : ''}
        {member.faction && <span style={{ color: '#4a4a4a' }}> · {member.faction}</span>}
      </div>
      {member.health && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555', marginBottom: 2 }}>
            <span>HEALTH</span>
            <span>{member.health.current}/{member.health.max}</span>
          </div>
          <Progress percent={hullPct} showInfo={false} size={['100%', 3]} strokeColor={hullColor} />
        </div>
      )}
      {member.stress !== undefined && (
        <div style={{ marginTop: 4, fontSize: 10, color: member.stress > 3 ? '#faad14' : '#555' }}>
          STRESS {member.stress}
        </div>
      )}
    </div>
  );
}

// --- Detail sub-components ---

function CrewDetailView({ member }: { member: CrewMember }) {
  const hullPct = member.health ? (member.health.current / member.health.max) * 100 : 100;
  const hullColor = hullPct < 30 ? '#ff4d4f' : hullPct < 60 ? '#faad14' : '#52c41a';
  const statusColor = STATUS_COLOR[member.status || 'ACTIVE'] || '#4a6b6b';

  return (
    <div style={{ paddingTop: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ color: '#8b7355', fontSize: 12 }}>
            {member.role}{member.class && member.class !== member.role ? ` — ${member.class}` : ''}
          </div>
          {member.callsign && (
            <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>Callsign: "{member.callsign}"</div>
          )}
        </div>
        <Tag style={{ borderColor: statusColor, color: statusColor, background: 'transparent' }}>
          {member.status || 'ACTIVE'}
        </Tag>
      </div>

      {/* Health + Condition */}
      <div style={{ marginBottom: 16 }}>
        {member.health && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#888', marginBottom: 4 }}>
              <span>HEALTH</span>
              <span style={{ color: '#aaa' }}>{member.health.current} / {member.health.max}</span>
            </div>
            <Progress percent={hullPct} showInfo={false} size={['100%', 6]} strokeColor={hullColor} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 20, fontSize: 12 }}>
          {member.stress !== undefined && (
            <span>
              <span style={{ color: '#666', fontSize: 11 }}>STRESS </span>
              <span style={{ color: member.stress > 3 ? '#faad14' : '#aaa' }}>{member.stress}</span>
            </span>
          )}
          {member.wounds !== undefined && (
            <span>
              <span style={{ color: '#666', fontSize: 11 }}>WOUNDS </span>
              <span style={{ color: member.wounds > 0 ? '#ff4d4f' : '#aaa' }}>{member.wounds}</span>
            </span>
          )}
          {member.armor !== undefined && (
            <span>
              <span style={{ color: '#666', fontSize: 11 }}>ARMOR </span>
              <span style={{ color: '#aaa' }}>{member.armor}</span>
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      {member.stats && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#555', fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>STATS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            {Object.entries(member.stats).map(([key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#666', textTransform: 'uppercase', fontSize: 11 }}>{key}</span>
                <span style={{ color: '#d0d0d0' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saves */}
      {member.saves && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#555', fontSize: 10, letterSpacing: 1, marginBottom: 8 }}>SAVES</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 8px' }}>
            {Object.entries(member.saves).map(([key, val]) => (
              <div key={key} style={{ textAlign: 'center' }}>
                <div style={{ color: '#666', fontSize: 10, textTransform: 'uppercase' }}>{key}</div>
                <div style={{ color: '#d0d0d0', fontSize: 14 }}>{val}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {member.description && (
        <div style={{ borderTop: '1px solid #1f1f1f', paddingTop: 12, color: '#888', fontSize: 12, lineHeight: 1.6 }}>
          {member.description}
        </div>
      )}
    </div>
  );
}

function SessionDetailView({ session }: { session: SessionLog }) {
  const markdownComponents = {
    h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h1 className="gm-md-h1" {...props}>{children}</h1>,
    h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className="gm-md-h2" {...props}>{children}</h2>,
    h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className="gm-md-h3" {...props}>{children}</h3>,
    p:  ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p  className="gm-md-p"  {...props}>{children}</p>,
    strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <strong className="gm-md-strong" {...props}>{children}</strong>,
    em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <em className="gm-md-em" {...props}>{children}</em>,
    ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => <ul className="gm-md-ul" {...props}>{children}</ul>,
    ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => <ol className="gm-md-ol" {...props}>{children}</ol>,
    li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => <li className="gm-md-li" {...props}>{children}</li>,
    code: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <code className="gm-md-code" {...props}>{children}</code>,
  };

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12 }}>
        {session.session_number !== undefined && (
          <span style={{ color: '#8b7355' }}>Session {session.session_number}</span>
        )}
        {session.date && <span style={{ color: '#555' }}>{session.date}</span>}
        {session.location && <span style={{ color: '#4a6b6b' }}>{session.location}</span>}
      </div>
      {session.npcs && session.npcs.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 11, color: '#555' }}>
          NPCs: <span style={{ color: '#666' }}>{session.npcs.join(', ')}</span>
        </div>
      )}
      {session.body ? (
        <div
          style={{ background: '#0a0a0a', border: '1px solid #1f1f1f', borderRadius: 4,
            padding: 12, maxHeight: 420, overflowY: 'auto' }}
        >
          <div className="gm-session-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {session.body}
            </ReactMarkdown>
          </div>
        </div>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>No content.</Text>
      )}
    </div>
  );
}

// --- GM Bridge Dashboard sub-components ---

type BridgeMapMode = 'galaxy' | 'system' | 'orbit';

interface BridgeMapState {
  mode: BridgeMapMode;
  systemSlug: string | null;
  bodySlug: string | null;
  locationName: string | null;
}

function findLocationBySlug(locations: Location[], slug: string): Location | null {
  for (const loc of locations) {
    if (loc.slug === slug) return loc;
    const found = findLocationBySlug(loc.children, slug);
    if (found) return found;
  }
  return null;
}

function findParentSystemSlug(locations: Location[], targetSlug: string): string | null {
  for (const loc of locations) {
    if (loc.type === 'system') {
      const found = findLocationBySlug(loc.children, targetSlug);
      if (found) return loc.slug;
    }
  }
  return null;
}

function deriveBridgeMapMode(
  activeView: ActiveView | null,
  locations: Location[]
): BridgeMapState {
  if (!activeView || activeView.view_type !== 'BRIDGE' || activeView.bridge_tab !== 'map') {
    return { mode: 'galaxy', systemSlug: null, bodySlug: null, locationName: null };
  }
  const slug = activeView.view_slug;
  if (!slug) {
    return { mode: 'galaxy', systemSlug: null, bodySlug: null, locationName: null };
  }
  const loc = findLocationBySlug(locations, slug);
  if (!loc) {
    return { mode: 'galaxy', systemSlug: null, bodySlug: null, locationName: null };
  }
  if (loc.type === 'system') {
    return { mode: 'system', systemSlug: slug, bodySlug: null, locationName: loc.name };
  }
  // Planet/station/moon — find parent system
  const parentSystemSlug = findParentSystemSlug(locations, slug);
  if (parentSystemSlug) {
    return { mode: 'orbit', systemSlug: parentSystemSlug, bodySlug: slug, locationName: loc.name };
  }
  // Fallback
  return { mode: 'galaxy', systemSlug: null, bodySlug: null, locationName: slug };
}

function deriveBreadcrumb(activeView: ActiveView | null, locations: Location[]): string {
  if (!activeView) return 'BRIDGE';
  if (activeView.view_type !== 'BRIDGE') {
    return `BRIDGE — PLAYER ON ${activeView.view_type}`;
  }
  const tab = (activeView.bridge_tab || 'map').toUpperCase();
  if (tab !== 'MAP') return tab;
  const slug = activeView.view_slug;
  if (!slug) return 'MAP';
  const loc = findLocationBySlug(locations, slug);
  const displayName = loc ? loc.name.toUpperCase() : slug.toUpperCase();
  return `MAP > ${displayName}`;
}

interface GmBridgeDashboardProps {
  activeView: ActiveView | null;
  locations: Location[];
  starMapData: StarMapData | null;
  shipData: ShipStatusData | null;
}

function GmBridgeDashboard({ activeView, locations, starMapData, shipData }: GmBridgeDashboardProps) {
  return (
    <div className="gm-bridge-view__main">
      <GmBridgeBreadcrumb activeView={activeView} locations={locations} />
      <div className="gm-bridge-content">
        <GmBridgeMapPanel activeView={activeView} locations={locations} starMapData={starMapData} />
        <GmBridgeStatusPanel shipData={shipData} />
      </div>
    </div>
  );
}

function GmBridgeBreadcrumb({ activeView, locations }: { activeView: ActiveView | null; locations: Location[] }) {
  const crumb = deriveBreadcrumb(activeView, locations);
  return (
    <div className="gm-bridge-breadcrumb">
      <span className="gm-bridge-breadcrumb__text">{crumb}</span>
    </div>
  );
}

function GmBridgeMapPanel({
  activeView,
  locations,
  starMapData,
}: {
  activeView: ActiveView | null;
  locations: Location[];
  starMapData: StarMapData | null;
}) {
  const mapState = deriveBridgeMapMode(activeView, locations);
  const isMapTab = activeView?.view_type === 'BRIDGE' && activeView.bridge_tab === 'map';

  if (!isMapTab) {
    const label = activeView?.view_type !== 'BRIDGE'
      ? 'PLAYER NOT ON BRIDGE'
      : `PLAYER VIEWING: ${(activeView.bridge_tab || '').toUpperCase()}`;
    return (
      <div className="gm-bridge-map-panel gm-bridge-map-panel--placeholder">
        <span className="gm-bridge-map-placeholder-text">{label}</span>
      </div>
    );
  }

  return (
    <div className="gm-bridge-map-panel">
      <GalaxyMap
        data={starMapData}
        hidden={mapState.mode !== 'galaxy'}
        paused={mapState.mode !== 'galaxy'}
      />
      {mapState.systemSlug && (
        <SystemMap
          systemSlug={mapState.systemSlug}
          selectedPlanet={null}
          hidden={mapState.mode !== 'system'}
          paused={mapState.mode !== 'system'}
        />
      )}
      {mapState.systemSlug && mapState.bodySlug && (
        <OrbitMap
          systemSlug={mapState.systemSlug}
          bodySlug={mapState.bodySlug}
          selectedElement={null}
          selectedElementType={null}
          hidden={mapState.mode !== 'orbit'}
          paused={mapState.mode !== 'orbit'}
        />
      )}
    </div>
  );
}

const SYSTEM_STATUSES_GM: SystemStatus[] = ['ONLINE', 'STRESSED', 'DAMAGED', 'CRITICAL', 'OFFLINE'];
const SYSTEM_LABELS_GM: Record<string, string> = {
  life_support: 'Life Support',
  engines: 'Engines',
  weapons: 'Weapons',
  comms: 'Communications',
};
const STATUS_COLORS_GM: Record<SystemStatus, string> = {
  ONLINE: '#5a7a7a',
  STRESSED: '#8b7355',
  DAMAGED: '#8b6a55',
  CRITICAL: '#8b5555',
  OFFLINE: '#5a5a5a',
};

function GmBridgeStatusPanel({ shipData }: { shipData: ShipStatusData | null }) {
  const [messageApi, contextHolder] = message.useMessage();

  const handleSystemChange = useCallback(async (systemName: string, newStatus: SystemStatus) => {
    try {
      await gmConsoleApi.toggleShipSystem(systemName, newStatus);
      messageApi.success(`${SYSTEM_LABELS_GM[systemName]} → ${newStatus}`);
      // SSE will push the updated ship status back — no manual re-fetch needed
    } catch (err) {
      console.error('Error toggling ship system:', err);
      messageApi.error('Failed to update system status');
    }
  }, [messageApi]);

  if (!shipData) {
    return (
      <div className="gm-bridge-status-panel">
        {contextHolder}
        <Text type="secondary" style={{ fontSize: 11, padding: 16, display: 'block' }}>
          No ship data available
        </Text>
      </div>
    );
  }

  const { ship } = shipData;

  return (
    <div className="gm-bridge-status-panel">
      {contextHolder}

      {/* Ship identity */}
      <div className="gm-bridge-status-identity">
        <div style={{ color: '#5a7a7a', fontSize: 13, fontWeight: 600 }}>{ship.name}</div>
        <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>{ship.class}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
          <span><span style={{ color: '#444' }}>CREW </span><span style={{ color: '#aaa' }}>{ship.crew_count}/{ship.crew_capacity}</span></span>
          <span><span style={{ color: '#444' }}>HULL </span><span style={{ color: ship.hull.current < ship.hull.max * 0.3 ? '#8b5555' : '#aaa' }}>{ship.hull.current}/{ship.hull.max}</span></span>
          <span><span style={{ color: '#444' }}>ARMOR </span><span style={{ color: ship.armor.current < ship.armor.max * 0.3 ? '#8b5555' : '#aaa' }}>{ship.armor.current}/{ship.armor.max}</span></span>
        </div>
      </div>

      {/* System toggles */}
      <div className="gm-bridge-status-systems">
        {Object.entries(ship.systems).map(([systemKey, systemData]) => (
          <div key={systemKey} className="gm-bridge-status-system-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 12 }}>{SYSTEM_LABELS_GM[systemKey]}</Text>
              <Text style={{ fontSize: 10, color: STATUS_COLORS_GM[systemData.status], letterSpacing: 1 }}>
                {systemData.status}
              </Text>
            </div>
            <Select
              value={systemData.status}
              onChange={(value) => handleSystemChange(systemKey, value as SystemStatus)}
              style={{ width: '100%' }}
              size="small"
              options={SYSTEM_STATUSES_GM.map(s => ({
                value: s,
                label: <span style={{ color: STATUS_COLORS_GM[s] }}>{s}</span>,
              }))}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
