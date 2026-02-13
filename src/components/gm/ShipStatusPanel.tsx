import { useState, useEffect, useCallback } from 'react';
import { Select, Typography, Space, Card, message, Empty } from 'antd';
import { gmConsoleApi } from '@/services/gmConsoleApi';
import type { ShipStatusData, SystemStatus } from '@/types/shipStatus';

const { Text, Title } = Typography;
const { Option } = Select;

const SYSTEM_STATUSES: SystemStatus[] = ['ONLINE', 'STRESSED', 'DAMAGED', 'CRITICAL', 'OFFLINE'];

const SYSTEM_LABELS: Record<string, string> = {
  life_support: 'Life Support',
  engines: 'Engines',
  weapons: 'Weapons',
  comms: 'Communications',
};

const STATUS_COLORS: Record<SystemStatus, string> = {
  ONLINE: '#5a7a7a',      // Teal - nominal
  STRESSED: '#8b7355',    // Amber - warning
  DAMAGED: '#8b6a55',     // Orange-amber
  CRITICAL: '#8b5555',    // Red-amber
  OFFLINE: '#5a5a5a',     // Gray
};

export function ShipStatusPanel() {
  const [shipData, setShipData] = useState<ShipStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

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

  // Load ship status on mount
  useEffect(() => {
    loadShipStatus();
  }, [loadShipStatus]);

  // Poll every 5 seconds to stay in sync
  useEffect(() => {
    const interval = setInterval(() => {
      loadShipStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadShipStatus]);

  const handleSystemChange = useCallback(async (systemName: string, newStatus: SystemStatus) => {
    if (!shipData) return;

    try {
      await gmConsoleApi.toggleShipSystem(systemName, newStatus);
      messageApi.success(`${SYSTEM_LABELS[systemName]} set to ${newStatus}`);
      // Refresh data immediately
      await loadShipStatus();
    } catch (err) {
      console.error('Error toggling ship system:', err);
      messageApi.error('Failed to update system status');
    }
  }, [shipData, messageApi, loadShipStatus]);

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
        <Empty
          description={
            <Text type="secondary">
              No ship data available
            </Text>
          }
          style={{ padding: 40 }}
        />
      </>
    );
  }

  const { ship } = shipData;

  return (
    <>
      {contextHolder}

      {/* Ship Identity Card */}
      <Card
        size="small"
        style={{ marginBottom: 16, background: '#1a1a1a' }}
        bodyStyle={{ padding: 16 }}
      >
        <Title level={4} style={{ margin: 0, color: '#5a7a7a' }}>
          {ship.name}
        </Title>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {ship.class}
        </Text>
        <div style={{ marginTop: 12, display: 'flex', gap: 24 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>CREW</Text>
            <div>
              <Text style={{ fontSize: 13 }}>
                {ship.crew_count} / {ship.crew_capacity}
              </Text>
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>HULL</Text>
            <div>
              <Text style={{ fontSize: 13, color: ship.hull.current < ship.hull.max * 0.3 ? '#8b5555' : '#fff' }}>
                {ship.hull.current} / {ship.hull.max}
              </Text>
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>ARMOR</Text>
            <div>
              <Text style={{ fontSize: 13, color: ship.armor.current < ship.armor.max * 0.3 ? '#8b5555' : '#fff' }}>
                {ship.armor.current} / {ship.armor.max}
              </Text>
            </div>
          </div>
        </div>
      </Card>

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
              style={{
                padding: 12,
                background: '#0f1515',
                border: '1px solid #303030',
                borderRadius: 4,
              }}
            >
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: 500 }}>
                  {SYSTEM_LABELS[systemKey]}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: STATUS_COLORS[systemData.status],
                    fontWeight: 600,
                    letterSpacing: 1,
                  }}
                >
                  {systemData.status}
                </Text>
              </div>

              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>STATUS</Text>
                <Select
                  value={systemData.status}
                  onChange={(value) => handleSystemChange(systemKey, value as SystemStatus)}
                  style={{ width: '100%', marginTop: 4 }}
                  size="small"
                >
                  {SYSTEM_STATUSES.map(status => (
                    <Option key={status} value={status}>
                      <span style={{ color: STATUS_COLORS[status] }}>
                        {status}
                      </span>
                    </Option>
                  ))}
                </Select>
              </div>

              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>CONDITION</Text>
                  <div>
                    <Text style={{ fontSize: 12 }}>
                      {systemData.condition}%
                    </Text>
                  </div>
                </div>
                {systemData.info && (
                  <div style={{ flex: 2 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>INFO</Text>
                    <div>
                      <Text style={{ fontSize: 11 }} type="secondary">
                        {systemData.info}
                      </Text>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </Space>
      </Card>
    </>
  );
}
