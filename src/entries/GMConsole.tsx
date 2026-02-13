import { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme, Layout, message, Tabs } from 'antd';
import { RobotOutlined, NotificationOutlined, RadarChartOutlined, DashboardOutlined } from '@ant-design/icons';
import { Location, ActiveView, BroadcastMessage } from '@/types/gmConsole';
import { gmConsoleApi } from '@/services/gmConsoleApi';
import { useTreeState } from '@/hooks/useTreeState';
import { LocationTree } from '@/components/gm/LocationTree';
import { BroadcastForm } from '@/components/gm/BroadcastForm';
import { ViewControls } from '@/components/gm/ViewControls';
import { CharonPanel } from '@/components/gm/CharonPanel';
import { EncounterPanel } from '@/components/gm/EncounterPanel';
import { ShipStatusPanel } from '@/components/gm/ShipStatusPanel';
import { charonApi } from '@/services/charonApi';

const { Content, Sider } = Layout;

function GMConsole() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [channelUnreads, setChannelUnreads] = useState<Record<string, number>>({});

  const { expandedNodes, toggleNode } = useTreeState('gm-console-tree');

  // Derive active CHARON channel from view state
  const activeCharonChannel = useMemo(() => {
    const viewType = activeView?.view_type || 'STANDBY';
    if (viewType === 'CHARON_TERMINAL') return 'story';
    if (viewType === 'BRIDGE') return 'bridge';
    if (viewType === 'ENCOUNTER' && activeView?.location_slug) {
      return `encounter-${activeView.location_slug}`;
    }
    // Fallback: use whatever the server says, or 'story'
    return activeView?.charon_active_channel || 'story';
  }, [activeView?.view_type, activeView?.location_slug, activeView?.charon_active_channel]);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [locationsData, viewData] = await Promise.all([
          gmConsoleApi.getLocations(),
          gmConsoleApi.getActiveView()
        ]);
        setLocations(locationsData);
        setActiveView(viewData);
        setError(null);
      } catch (err) {
        setError('Failed to load data');
        console.error('Error loading GM Console data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Poll for active view updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const viewData = await gmConsoleApi.getActiveView();
        setActiveView(viewData);
      } catch (err) {
        console.error('Error polling active view:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Poll for channel unread counts
  useEffect(() => {
    const pollUnreads = async () => {
      try {
        const data = await charonApi.getChannels();
        const unreads: Record<string, number> = {};
        for (const ch of data.channels) {
          const pending = await charonApi.getChannelPending(ch.channel);
          if (pending.count > 0) {
            unreads[ch.channel] = pending.count;
          }
        }
        setChannelUnreads(unreads);
      } catch (err) {
        console.error('Failed to poll channel unreads:', err);
      }
    };

    pollUnreads();
    const interval = setInterval(pollUnreads, 5000);
    return () => clearInterval(interval);
  }, []);

  // Compute aggregate unread counts by category
  const unreadCounts = useMemo(() => {
    let bridge = channelUnreads['bridge'] || 0;
    let story = channelUnreads['story'] || 0;
    let encounter = Object.entries(channelUnreads)
      .filter(([key]) => key.startsWith('encounter-'))
      .reduce((sum, [, count]) => sum + count, 0);
    return { bridge, story, encounter };
  }, [channelUnreads]);

  const showStatus = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    messageApi.open({ type, content: msg });
  }, [messageApi]);

  // Handle location selection for ENCOUNTER view
  const handleSelectLocation = useCallback(async (slug: string | null) => {
    try {
      // Only update location if we're in ENCOUNTER view
      if (activeView?.view_type === 'ENCOUNTER') {
        await gmConsoleApi.switchView('ENCOUNTER', slug || '');
        const viewData = await gmConsoleApi.getActiveView();
        setActiveView(viewData);
        if (slug) {
          showStatus(`Selected ${slug}`);
        } else {
          showStatus('Cleared selection');
        }
      }
    } catch (err) {
      console.error('Error selecting location:', err);
      showStatus('Failed to select location', 'error');
    }
  }, [activeView?.view_type, showStatus]);

  // Switch to ENCOUNTER view
  const handleEncounter = useCallback(async () => {
    try {
      await gmConsoleApi.switchView('ENCOUNTER', activeView?.location_slug || '');
      const viewData = await gmConsoleApi.getActiveView();
      setActiveView(viewData);
      showStatus('Switched to encounter');
    } catch (err) {
      console.error('Error switching to encounter:', err);
      showStatus('Failed to switch to encounter', 'error');
    }
  }, [activeView?.location_slug, showStatus]);

  const handleShowTerminal = useCallback(async (locationSlug: string, terminalSlug: string) => {
    try {
      // Toggle: if clicking the same terminal that's already shown, hide it
      const isAlreadyShown = activeView?.overlay_location_slug === locationSlug &&
                             activeView?.overlay_terminal_slug === terminalSlug;

      if (isAlreadyShown) {
        // Hide the terminal by sending empty values
        await gmConsoleApi.showTerminal('', '');
        const viewData = await gmConsoleApi.getActiveView();
        setActiveView(viewData);
        showStatus('Terminal hidden');
      } else {
        // Show the new terminal (this automatically replaces any existing overlay)
        await gmConsoleApi.showTerminal(locationSlug, terminalSlug);
        const viewData = await gmConsoleApi.getActiveView();
        setActiveView(viewData);
        showStatus(`Showing terminal ${terminalSlug}`);
      }
    } catch (err) {
      console.error('Error showing terminal:', err);
      showStatus('Failed to show terminal', 'error');
    }
  }, [showStatus, activeView?.overlay_location_slug, activeView?.overlay_terminal_slug]);

  const handleStandby = useCallback(async () => {
    try {
      await gmConsoleApi.switchToStandby();
      const viewData = await gmConsoleApi.getActiveView();
      setActiveView(viewData);
      showStatus('Switched to standby');
    } catch (err) {
      console.error('Error switching to standby:', err);
      showStatus('Failed to switch to standby', 'error');
    }
  }, [showStatus]);

  const handleBridge = useCallback(async () => {
    try {
      await gmConsoleApi.switchToBridge();
      const viewData = await gmConsoleApi.getActiveView();
      setActiveView(viewData);
      showStatus('Switched to bridge');
    } catch (err) {
      console.error('Error switching to bridge:', err);
      showStatus('Failed to switch to bridge', 'error');
    }
  }, [showStatus]);

  const handleBroadcast = useCallback(async (msg: BroadcastMessage) => {
    try {
      await gmConsoleApi.sendBroadcast(msg);
      showStatus('Message transmitted');
    } catch (err) {
      console.error('Error sending broadcast:', err);
      showStatus('Failed to send message', 'error');
      throw err;
    }
  }, [showStatus]);

  const handleCharonActivate = useCallback(async () => {
    try {
      await charonApi.switchToCharon();
      const viewData = await gmConsoleApi.getActiveView();
      setActiveView(viewData);
      showStatus('CHARON Terminal activated');
    } catch (err) {
      console.error('Error activating CHARON:', err);
      showStatus('Failed to activate CHARON', 'error');
    }
  }, [showStatus]);

  const handleToggleCharonDialog = useCallback(async () => {
    try {
      const result = await charonApi.toggleDialog();
      const viewData = await gmConsoleApi.getActiveView();
      setActiveView(viewData);
      showStatus(result.charon_dialog_open ? 'CHARON dialog shown' : 'CHARON dialog hidden');
    } catch (err) {
      console.error('Error toggling CHARON dialog:', err);
      showStatus('Failed to toggle CHARON dialog', 'error');
    }
  }, [showStatus]);

  // Callback for EncounterPanel to refresh active view after changes
  const handleEncounterViewUpdate = useCallback(async () => {
    try {
      const viewData = await gmConsoleApi.getActiveView();
      setActiveView(viewData);
    } catch (err) {
      console.error('Error refreshing active view:', err);
    }
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#fff' }}>
        Loading GM Console...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: '#ff4d4f' }}>
        {error}
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {contextHolder}
      <Sider width={400} style={{ background: '#141414', padding: 16, overflow: 'auto' }}>
        <h2 style={{ color: '#fff', marginBottom: 16, fontSize: 16 }}>LOCATIONS</h2>
        <LocationTree
          locations={locations}
          selectedLocationSlug={activeView?.view_type === 'ENCOUNTER' ? (activeView?.location_slug || null) : null}
          activeTerminalLocationSlug={activeView?.overlay_location_slug || null}
          activeTerminalSlug={activeView?.overlay_terminal_slug || null}
          expandedNodes={expandedNodes}
          onToggle={toggleNode}
          onSelectLocation={handleSelectLocation}
          onShowTerminal={handleShowTerminal}
          selectionEnabled={activeView?.view_type === 'ENCOUNTER'}
        />
      </Sider>
      <Content style={{ padding: 24, background: '#000' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ViewControls
            currentView={activeView?.view_type || 'STANDBY'}
            onStandby={handleStandby}
            onBridge={handleBridge}
            onEncounter={handleEncounter}
            onCharon={handleCharonActivate}
            unreadCounts={unreadCounts}
          />
          <Tabs
            defaultActiveKey="charon"
            type="card"
            items={[
              {
                key: 'charon',
                label: (
                  <span>
                    <RobotOutlined style={{ marginRight: 8 }} />
                    CHARON {activeCharonChannel === 'bridge' ? '// BRIDGE' :
                            activeCharonChannel === 'story' ? '// STORY' :
                            activeCharonChannel.startsWith('encounter-') ? '// ENCOUNTER' : ''}
                  </span>
                ),
                children: (
                  <div style={{
                    padding: 16,
                    background: '#141414',
                    border: '1px solid #303030',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    marginTop: -16
                  }}>
                    <CharonPanel
                      channel={activeCharonChannel}
                      currentViewType={activeView?.view_type || 'STANDBY'}
                      charonDialogOpen={activeView?.charon_dialog_open || false}
                      onDialogToggle={handleToggleCharonDialog}
                    />
                  </div>
                ),
              },
              {
                key: 'encounter',
                label: (
                  <span>
                    <RadarChartOutlined style={{ marginRight: 8 }} />
                    ENCOUNTER
                  </span>
                ),
                children: (
                  <div style={{
                    padding: 16,
                    background: '#141414',
                    border: '1px solid #303030',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    marginTop: -16
                  }}>
                    <EncounterPanel
                      activeView={activeView}
                      onViewUpdate={handleEncounterViewUpdate}
                    />
                  </div>
                ),
              },
              {
                key: 'ship-status',
                label: (
                  <span>
                    <DashboardOutlined style={{ marginRight: 8 }} />
                    SHIP STATUS
                  </span>
                ),
                children: (
                  <div style={{
                    padding: 16,
                    background: '#141414',
                    border: '1px solid #303030',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    marginTop: -16
                  }}>
                    <ShipStatusPanel />
                  </div>
                ),
              },
              {
                key: 'broadcast',
                label: (
                  <span>
                    <NotificationOutlined style={{ marginRight: 8 }} />
                    BROADCAST MESSAGE
                  </span>
                ),
                children: (
                  <div style={{
                    padding: 16,
                    background: '#141414',
                    border: '1px solid #303030',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    marginTop: -16
                  }}>
                    <BroadcastForm onSubmit={handleBroadcast} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      </Content>
    </Layout>
  );
}

// Mount the React app with Ant Design dark theme
const container = document.getElementById('gm-console-root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1668dc',
        },
      }}
    >
      <GMConsole />
    </ConfigProvider>
  );
}
