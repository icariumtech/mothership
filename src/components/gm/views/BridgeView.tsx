import { useState, useEffect, useCallback, useMemo } from 'react';
import { ToolOutlined, RobotOutlined } from '@ant-design/icons';
import { ActiveView } from '@/types/gmConsole';
import { ShipStatusData, SystemStatus } from '@/types/shipStatus';
import { gmConsoleApi } from '@/services/gmConsoleApi';
import { ToolRail, ToolRailButton } from '@/components/gm/layout/ToolRail';
import { SlideOutPanel } from '@/components/gm/layout/SlideOutPanel';
import { ShipStatusToolPanel } from '@/components/gm/panels/ShipStatusToolPanel';
import { CharonQuickSend } from '@/components/gm/panels/CharonQuickSend';
import './BridgeView.css';

const STATUS_COLORS: Record<SystemStatus, string> = {
  ONLINE: '#52c41a',
  STRESSED: '#faad14',
  DAMAGED: '#fa8c16',
  CRITICAL: '#ff4d4f',
  OFFLINE: '#888',
};

const SYSTEM_LABELS: Record<string, string> = {
  life_support: 'Life Support',
  engines: 'Engines',
  weapons: 'Weapons',
  comms: 'Comms',
};

interface BridgeViewProps {
  activeView: ActiveView | null;
  charonChannel: string;
  charonDialogOpen: boolean;
  onDialogToggle: () => void;
}

export function BridgeView({ activeView, charonChannel, charonDialogOpen, onDialogToggle }: BridgeViewProps) {
  const [shipStatus, setShipStatus] = useState<ShipStatusData | null>(null);
  const [activePanel, setActivePanel] = useState<string | null>(null);

  // Suppress unused warnings for props reserved for future use
  void charonDialogOpen;
  void onDialogToggle;

  const fetchShipStatus = useCallback(async () => {
    try {
      const data = await gmConsoleApi.getShipStatus();
      setShipStatus(data);
    } catch (err) {
      console.error('Error fetching ship status:', err);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchShipStatus();
  }, [fetchShipStatus]);

  // Re-fetch when activeView updates (SSE push)
  useEffect(() => {
    if (activeView?.updated_at) {
      fetchShipStatus();
    }
  }, [activeView?.updated_at, fetchShipStatus]);

  const tools: ToolRailButton[] = useMemo(() => [
    { key: 'ship-status', icon: <ToolOutlined />, tooltip: 'Ship Status' },
    { key: 'charon-send', icon: <RobotOutlined />, tooltip: 'CHARON Quick-Send' },
  ], []);

  const handleToolToggle = useCallback((key: string) => {
    setActivePanel((prev) => (prev === key ? null : key));
  }, []);

  const ship = shipStatus?.ship;

  const hullPct = ship ? (ship.hull.current / ship.hull.max) * 100 : 0;
  const armorPct = ship ? (ship.armor.current / ship.armor.max) * 100 : 0;

  const hullColor = hullPct < 30 ? '#ff4d4f' : hullPct < 60 ? '#faad14' : '#52c41a';
  const armorColor = armorPct < 30 ? '#ff4d4f' : armorPct < 60 ? '#faad14' : '#1668dc';

  return (
    <div className="bridge-view">
      <div className="bridge-view__dashboard">
        {/* Location Context */}
        <div className="bridge-view__card">
          <div className="bridge-view__card-title">Location</div>
          <div className="bridge-view__card-value">
            {activeView?.location_name || activeView?.location_slug || 'No location'}
          </div>
          {activeView?.location_type && (
            <div style={{ color: '#666', fontSize: 11, marginTop: 4 }}>
              {activeView.location_type.toUpperCase()}
            </div>
          )}
          {activeView?.location_slug && (
            <div style={{ color: '#555', fontSize: 10, marginTop: 2, fontFamily: 'monospace' }}>
              {activeView.location_slug}
            </div>
          )}
        </div>

        {/* Ship Status */}
        <div className="bridge-view__card">
          <div className="bridge-view__card-title">Ship</div>
          {ship ? (
            <>
              <div className="bridge-view__card-value">{ship.name}</div>
              <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{ship.class}</div>
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#888' }}>HULL</span>
                  <span style={{ color: '#aaa' }}>{ship.hull.current}/{ship.hull.max}</span>
                </div>
                <div className="bridge-view__bar-track">
                  <div
                    className="bridge-view__bar-fill"
                    style={{ width: `${hullPct}%`, background: hullColor }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#888' }}>ARMOR</span>
                  <span style={{ color: '#aaa' }}>{ship.armor.current}/{ship.armor.max}</span>
                </div>
                <div className="bridge-view__bar-track">
                  <div
                    className="bridge-view__bar-fill"
                    style={{ width: `${armorPct}%`, background: armorColor }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: '#555', fontSize: 12 }}>Loading...</div>
          )}
        </div>

        {/* Crew */}
        <div className="bridge-view__card">
          <div className="bridge-view__card-title">Crew</div>
          {ship ? (
            <div className="bridge-view__card-value">
              <span style={{ fontSize: 24 }}>{ship.crew_count}</span>
              <span style={{ color: '#666', fontSize: 14 }}> / {ship.crew_capacity}</span>
            </div>
          ) : (
            <div style={{ color: '#555', fontSize: 12 }}>Loading...</div>
          )}
        </div>

        {/* Systems Overview */}
        <div className="bridge-view__card">
          <div className="bridge-view__card-title">Systems</div>
          {ship ? (
            <div className="bridge-view__system-grid">
              {Object.entries(ship.systems).map(([key, sys]) => (
                <div key={key} className="bridge-view__system-badge">
                  <span className="bridge-view__system-name">{SYSTEM_LABELS[key] || key}</span>
                  <span
                    className="bridge-view__system-status"
                    style={{ color: STATUS_COLORS[sys.status] }}
                  >
                    {sys.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#555', fontSize: 12 }}>Loading...</div>
          )}
        </div>
      </div>

      <ToolRail tools={tools} activePanel={activePanel} onToggle={handleToolToggle} />

      <SlideOutPanel
        open={activePanel === 'ship-status'}
        title="Ship Status"
        onClose={() => setActivePanel(null)}
      >
        <ShipStatusToolPanel />
      </SlideOutPanel>

      <SlideOutPanel
        open={activePanel === 'charon-send'}
        title="CHARON Quick-Send"
        onClose={() => setActivePanel(null)}
      >
        <CharonQuickSend channel={charonChannel} />
      </SlideOutPanel>
    </div>
  );
}
