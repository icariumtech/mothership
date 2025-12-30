import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme, Layout, message, Tabs } from 'antd';
import { RobotOutlined, NotificationOutlined } from '@ant-design/icons';
import { Location, ActiveView, BroadcastMessage } from '@/types/gmConsole';
import { gmConsoleApi } from '@/services/gmConsoleApi';
import { useTreeState } from '@/hooks/useTreeState';
import { LocationTree } from '@/components/gm/LocationTree';
import { BroadcastForm } from '@/components/gm/BroadcastForm';
import { ViewControls } from '@/components/gm/ViewControls';
import { CharonPanel } from '@/components/gm/CharonPanel';
import { charonApi } from '@/services/charonApi';

const { Content, Sider } = Layout;

function GMConsole() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const { expandedNodes, toggleNode } = useTreeState('gm-console-tree');

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

  const showStatus = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    messageApi.open({ type, content: msg });
  }, [messageApi]);

  const handleDisplayLocation = useCallback(async (slug: string) => {
    try {
      await gmConsoleApi.switchView('ENCOUNTER_MAP', slug);
      const viewData = await gmConsoleApi.getActiveView();
      setActiveView(viewData);
      showStatus(`Displaying ${slug}`);
    } catch (err) {
      console.error('Error switching view:', err);
      showStatus('Failed to switch view', 'error');
    }
  }, [showStatus]);

  const handleShowTerminal = useCallback(async (locationSlug: string, terminalSlug: string) => {
    try {
      await gmConsoleApi.showTerminal(locationSlug, terminalSlug);
      const viewData = await gmConsoleApi.getActiveView();
      setActiveView(viewData);
      showStatus(`Showing terminal ${terminalSlug}`);
    } catch (err) {
      console.error('Error showing terminal:', err);
      showStatus('Failed to show terminal', 'error');
    }
  }, [showStatus]);

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

  const handleDashboard = useCallback(async () => {
    try {
      await gmConsoleApi.switchToDashboard();
      const viewData = await gmConsoleApi.getActiveView();
      setActiveView(viewData);
      showStatus('Switched to dashboard');
    } catch (err) {
      console.error('Error switching to dashboard:', err);
      showStatus('Failed to switch to dashboard', 'error');
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
          activeLocationSlug={activeView?.location_slug || null}
          activeTerminalSlug={activeView?.overlay_terminal_slug || null}
          expandedNodes={expandedNodes}
          onToggle={toggleNode}
          onDisplayLocation={handleDisplayLocation}
          onShowTerminal={handleShowTerminal}
        />
      </Sider>
      <Content style={{ padding: 24, background: '#000' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ViewControls
            currentView={activeView?.view_type || 'STANDBY'}
            onStandby={handleStandby}
            onDashboard={handleDashboard}
            onCharon={handleCharonActivate}
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
                    CHARON TERMINAL
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
                      currentViewType={activeView?.view_type || 'STANDBY'}
                    />
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
