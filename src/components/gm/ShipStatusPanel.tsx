import { useState, useEffect, useCallback, useRef } from 'react';
import { Select, Typography, Space, Card, message, Empty, Input, Button, Checkbox } from 'antd';
import { gmConsoleApi } from '@/services/gmConsoleApi';
import type { ShipStatusData, SystemStatus } from '@/types/shipStatus';

const { Text, Title } = Typography;
const { Option } = Select;

const SYSTEM_STATUSES: SystemStatus[] = ['ONLINE', 'STRESSED', 'DAMAGED', 'CRITICAL', 'OFFLINE'];

const STATUS_COLORS: Record<SystemStatus, string> = {
  ONLINE: '#5a7a7a',
  STRESSED: '#8b7355',
  DAMAGED: '#8b6a55',
  CRITICAL: '#8b5555',
  OFFLINE: '#5a5a5a',
};

const SHIP_STATS = [
  { key: 'thrusters', label: 'THRUSTERS' },
  { key: 'battle',    label: 'BATTLE'    },
  { key: 'systems',   label: 'SYSTEMS'   },
] as const;

export function ShipStatusPanel() {
  const [shipData, setShipData] = useState<ShipStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();
  const [newCargoItem, setNewCargoItem] = useState('');
  const [cargoLoading, setCargoLoading] = useState(false);
  const cargoInputRef = useRef<any>(null);

  const loadShipStatus = useCallback(async () => {
    try {
      const data = await gmConsoleApi.getShipStatus();
      setShipData(data);
    } catch (err) {
      console.error('Error loading ship status:', err);
      messageApi.error('Failed to load ship status');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => { loadShipStatus(); }, [loadShipStatus]);

  useEffect(() => {
    const interval = setInterval(() => { loadShipStatus(); }, 5000);
    return () => clearInterval(interval);
  }, [loadShipStatus]);

  const handleSystemChange = useCallback(async (systemName: string, newStatus: SystemStatus) => {
    if (!shipData) return;
    try {
      await gmConsoleApi.toggleShipSystem(systemName, newStatus);
      const label = shipData?.ship.systems[systemName]?.display_name ?? systemName;
      messageApi.success(`${label} set to ${newStatus}`);
      await loadShipStatus();
    } catch {
      messageApi.error('Failed to update system status');
    }
  }, [shipData, messageApi, loadShipStatus]);

  const handleConditionChange = useCallback(async (systemName: string, delta: number) => {
    if (!shipData) return;
    const sys = shipData.ship.systems[systemName];
    if (!sys) return;
    const max = sys.power?.max ?? sys.power_capacity ?? 0;
    const newVal = Math.max(0, Math.min(max, sys.condition + delta));
    try {
      await gmConsoleApi.toggleShipSystem(systemName, sys.status, newVal);
      await loadShipStatus();
    } catch {
      messageApi.error('Failed to update condition');
    }
  }, [shipData, loadShipStatus, messageApi]);

  const handlePowerChange = useCallback(async (systemName: string, delta: number) => {
    if (!shipData) return;
    const sys = shipData.ship.systems[systemName];
    if (!sys?.power) return;
    const newVal = Math.max(0, Math.min(sys.power.max, sys.power.allocated + delta));
    try {
      await gmConsoleApi.updateReactorPower(systemName, newVal);
      await loadShipStatus();
    } catch {
      messageApi.error('Failed to update power');
    }
  }, [shipData, loadShipStatus, messageApi]);

  const handleStatChange = useCallback(async (stat: string, delta: number) => {
    if (!shipData) return;
    const current = shipData.ship.stats?.[stat as keyof typeof shipData.ship.stats] ?? 0;
    const newVal = Math.max(0, (current as number) + delta);
    try {
      await gmConsoleApi.updateShipStat(stat, newVal);
      await loadShipStatus();
    } catch {
      messageApi.error('Failed to update stat');
    }
  }, [shipData, loadShipStatus, messageApi]);

  const handleCargoAdd = useCallback(async () => {
    const item = newCargoItem.trim();
    if (!item) return;
    setCargoLoading(true);
    try {
      await gmConsoleApi.updateShipCargo('add', item);
      setNewCargoItem('');
      await loadShipStatus();
      cargoInputRef.current?.focus();
    } catch {
      messageApi.error('Failed to add cargo item');
    } finally {
      setCargoLoading(false);
    }
  }, [newCargoItem, loadShipStatus, messageApi]);

  const handleDamageToggle = useCallback(async (systemName: string, index: number, active: boolean) => {
    try {
      await gmConsoleApi.updateSystemFault(systemName, index, active);
      await loadShipStatus();
    } catch {
      messageApi.error('Failed to update fault indicator');
    }
  }, [loadShipStatus, messageApi]);

  const handleCargoRemove = useCallback(async (index: number) => {
    setCargoLoading(true);
    try {
      await gmConsoleApi.updateShipCargo('remove', index);
      await loadShipStatus();
    } catch {
      messageApi.error('Failed to remove cargo item');
    } finally {
      setCargoLoading(false);
    }
  }, [loadShipStatus, messageApi]);

  if (loading) {
    return (
      <>
        {contextHolder}
        <div style={{ padding: 20, textAlign: 'center' }}>
          <Text type="secondary">Loading ship status...</Text>
        </div>
      </>
    );
  }

  if (!shipData) {
    return (
      <>
        {contextHolder}
        <Empty description={<Text type="secondary">No ship data available</Text>} style={{ padding: 40 }} />
      </>
    );
  }

  const { ship } = shipData;

  return (
    <>
      {contextHolder}

      {/* Ship Identity + Stats Card */}
      <Card size="small" style={{ marginBottom: 16, background: '#1a1a1a' }} bodyStyle={{ padding: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#5a7a7a' }}>{ship.name}</Title>
        <Text type="secondary" style={{ fontSize: 12 }}>{ship.class}</Text>

        <div style={{ marginTop: 12, marginBottom: 12, display: 'flex', gap: 24 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>CREW</Text>
            <div><Text style={{ fontSize: 13 }}>{ship.crew_count} / {ship.crew_capacity}</Text></div>
          </div>
        </div>

        {/* Ship stats — Thrusters / Battle / Systems */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SHIP_STATS.map(({ key, label }) => {
            const val = (ship.stats?.[key] as number | undefined) ?? 0;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>{label}</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Button size="small" onClick={() => handleStatChange(key, -1)} style={{ minWidth: 28, padding: '0 6px' }}>−</Button>
                  <Text style={{ fontSize: 13, minWidth: 28, textAlign: 'center', color: '#5a7a7a', fontWeight: 700 }}>
                    {String(val).padStart(2, '0')}
                  </Text>
                  <Button size="small" onClick={() => handleStatChange(key, 1)} style={{ minWidth: 28, padding: '0 6px' }}>+</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Cargo Card */}
      {ship.cargo && (
        <Card
          size="small"
          title={<Text style={{ color: '#5a7a7a' }}>CARGO ({ship.cargo.items.length})</Text>}
          style={{ marginBottom: 16, background: '#1a1a1a' }}
          bodyStyle={{ padding: 16 }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size={4}>
            {ship.cargo.items.length === 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>No cargo</Text>
            )}
            {ship.cargo.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #222' }}>
                <Text style={{ flex: 1, fontSize: 12 }}>{item}</Text>
                <Button
                  type="text" size="small" danger disabled={cargoLoading}
                  onClick={() => handleCargoRemove(idx)}
                  style={{ padding: '0 4px', minWidth: 0, fontSize: 11 }}
                >✕</Button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Input
                ref={cargoInputRef} size="small" placeholder="Add cargo item…"
                value={newCargoItem} onChange={e => setNewCargoItem(e.target.value)}
                onPressEnter={handleCargoAdd} disabled={cargoLoading}
                style={{ flex: 1, fontSize: 12 }}
              />
              <Button size="small" type="primary" disabled={cargoLoading || !newCargoItem.trim()} onClick={handleCargoAdd}>Add</Button>
            </div>
          </Space>
        </Card>
      )}

      {/* System Controls Card */}
      <Card
        size="small"
        title={<Text style={{ color: '#5a7a7a' }}>SHIP SYSTEMS</Text>}
        style={{ background: '#1a1a1a' }}
        bodyStyle={{ padding: 16 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {Object.entries(ship.systems).map(([systemKey, systemData]) => (
            <div
              key={systemKey}
              style={{ padding: 12, background: '#0f1515', border: '1px solid #303030', borderRadius: 4 }}
            >
              {/* System name + status badge */}
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: 500 }}>
                  {systemData.display_name ?? systemKey}
                </Text>
                <Text style={{ fontSize: 11, color: STATUS_COLORS[systemData.status], fontWeight: 600, letterSpacing: 1 }}>
                  {systemData.status}
                </Text>
              </div>

              {/* Status dropdown */}
              <div style={{ marginBottom: 10 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>STATUS</Text>
                <Select
                  value={systemData.status}
                  onChange={(value) => handleSystemChange(systemKey, value as SystemStatus)}
                  style={{ width: '100%', marginTop: 4 }}
                  size="small"
                >
                  {SYSTEM_STATUSES.map(status => (
                    <Option key={status} value={status}>
                      <span style={{ color: STATUS_COLORS[status] }}>{status}</span>
                    </Option>
                  ))}
                </Select>
              </div>

              {/* Condition with +/- buttons */}
              {(() => {
                const condMax = systemData.power?.max ?? systemData.power_capacity ?? 0;
                return (
                  <div style={{ marginBottom: systemData.power || systemData.warnings?.length ? 10 : 0 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>CONDITION</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Button
                        size="small"
                        disabled={systemData.condition <= 0}
                        onClick={() => handleConditionChange(systemKey, -1)}
                        style={{ minWidth: 32, padding: '0 8px' }}
                      >−</Button>
                      <Text style={{ fontSize: 13, minWidth: 40, textAlign: 'center', color: '#5a7a7a', fontWeight: 600 }}>
                        {systemData.condition}
                      </Text>
                      <Button
                        size="small"
                        disabled={systemData.condition >= condMax}
                        onClick={() => handleConditionChange(systemKey, 1)}
                        style={{ minWidth: 32, padding: '0 8px' }}
                      >+</Button>
                      <Text type="secondary" style={{ fontSize: 11 }}>/ {condMax}</Text>
                    </div>
                  </div>
                );
              })()}

              {/* Power with +/- buttons */}
              {systemData.power && (
                <div style={{ marginBottom: systemData.warnings?.length ? 10 : 0 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>POWER</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Button
                      size="small"
                      disabled={systemData.power.allocated <= 0}
                      onClick={() => handlePowerChange(systemKey, -1)}
                      style={{ minWidth: 32, padding: '0 8px' }}
                    >−</Button>
                    <Text style={{ fontSize: 13, minWidth: 40, textAlign: 'center', color: '#5a7a7a', fontWeight: 600 }}>
                      {systemData.power.allocated}
                    </Text>
                    <Button
                      size="small"
                      disabled={systemData.power.allocated >= systemData.power.max}
                      onClick={() => handlePowerChange(systemKey, 1)}
                      style={{ minWidth: 32, padding: '0 8px' }}
                    >+</Button>
                    <Text type="secondary" style={{ fontSize: 11 }}>/ {systemData.power.max}</Text>
                  </div>
                </div>
              )}

              {/* Fault indicators */}
              {systemData.faults && systemData.faults.length > 0 && (
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>FAULTS</Text>
                  {systemData.faults.map((indicator, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                      <Checkbox
                        checked={indicator.active}
                        onChange={e => handleDamageToggle(systemKey, idx, e.target.checked)}
                      />
                      <Text style={{ fontSize: 12, color: indicator.active ? '#8b6a55' : '#666' }}>
                        {indicator.label}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Space>
      </Card>
    </>
  );
}
