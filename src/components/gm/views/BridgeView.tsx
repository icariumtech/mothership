import { useState, useCallback, useEffect, useMemo } from 'react';
import { Modal, Typography, Tag, Progress } from 'antd';
import {
  ToolOutlined,
  RobotOutlined,
  TeamOutlined,
  ReadOutlined,
  ApartmentOutlined,
} from '@ant-design/icons';
import { ActiveView, Location } from '@/types/gmConsole';
import { gmConsoleApi, type CrewMember, type SessionLog } from '@/services/gmConsoleApi';
import { ToolRail, ToolRailButton } from '@/components/gm/layout/ToolRail';
import { SlideOutPanel } from '@/components/gm/layout/SlideOutPanel';
import { ShipStatusToolPanel } from '@/components/gm/panels/ShipStatusToolPanel';
import { LocationTreePanel } from '@/components/gm/panels/LocationTreePanel';
import { CharonPanel } from '@/components/gm/CharonPanel';
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

  const tools: ToolRailButton[] = useMemo(() => [
    { key: 'locations', icon: <ApartmentOutlined />, tooltip: 'Locations' },
    { key: 'ship-status', icon: <ToolOutlined />, tooltip: 'Ship Status' },
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

        <SlideOutPanel open={activePanel === 'ship-status'} title="Ship Status" onClose={() => setActivePanel(null)}>
          <ShipStatusToolPanel />
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
          style={{
            background: '#0a0a0a',
            border: '1px solid #1f1f1f',
            borderRadius: 4,
            padding: 12,
            fontSize: 12,
            color: '#aaa',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.7,
            maxHeight: 420,
            overflowY: 'auto',
          }}
        >
          {session.body}
        </div>
      ) : (
        <Text type="secondary" style={{ fontSize: 12 }}>No content.</Text>
      )}
    </div>
  );
}
