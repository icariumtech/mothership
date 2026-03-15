import { useState, useEffect, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, theme, message } from 'antd';
import { Location, ActiveView } from '@/types/gmConsole';
import { gmConsoleApi } from '@/services/gmConsoleApi';
import { useTreeState } from '@/hooks/useTreeState';
import { ViewRail, GMViewType } from '@/components/gm/layout/ViewRail';
import { charonApi } from '@/services/charonApi';
import { useSSE } from '@/hooks/useSSE';
import { SSEConnectionToast } from '@/components/ui/SSEConnectionToast';
import { StandbyView } from '@/components/gm/views/StandbyView';
import { BridgeView } from '@/components/gm/views/BridgeView';
import { CharonView } from '@/components/gm/views/CharonView';
import { EncounterView } from '@/components/gm/views/EncounterView';
import './GMConsole.css';

function GMConsole() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [channelUnreads, setChannelUnreads] = useState<Record<string, number>>({});

  // GM's local view state -- independent from what players see (activeView.view_type)
  const [gmView, setGmView] = useState<GMViewType>('STANDBY');

  const { expandedNodes, toggleNode } = useTreeState('gm-console-tree');

  // Derive active CHARON channel from GM's local view (not player view)
  const activeCharonChannel = useMemo(() => {
    if (gmView === 'CHARON') return 'story';
    if (gmView === 'BRIDGE') return 'bridge';
    if (gmView === 'ENCOUNTER' && activeView?.location_slug) {
      return `encounter-${activeView.location_slug}`;
    }
    return activeView?.charon_active_channel || 'story';
  }, [gmView, activeView?.location_slug, activeView?.charon_active_channel]);

  // Load initial data (locations + one-time active-view bootstrap)
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

  // SSE subscription -- replaces 5s active-view polling
  const { connectionLost } = useSSE({
    url: '/api/active-view/stream/',
    onEvent: useCallback((rawData: unknown) => {
      setActiveView(rawData as ActiveView);
    }, []),
    failureThreshold: 2,
    retryDelayMs: 3000,
  });

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
    const bridge = channelUnreads['bridge'] || 0;
    const story = channelUnreads['story'] || 0;
    const encounter = Object.entries(channelUnreads)
      .filter(([key]) => key.startsWith('encounter-'))
      .reduce((sum, [, count]) => sum + count, 0);
    return { bridge, story, encounter };
  }, [channelUnreads]);

  const showStatus = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    messageApi.open({ type, content: msg });
  }, [messageApi]);

  // Handle DISPLAY button -- push current gmView to player terminal
  const handleDisplay = useCallback(async () => {
    try {
      switch (gmView) {
        case 'STANDBY':
          await gmConsoleApi.switchToStandby();
          break;
        case 'BRIDGE':
          await gmConsoleApi.switchToBridge();
          break;
        case 'ENCOUNTER':
          await gmConsoleApi.switchView('ENCOUNTER', activeView?.location_slug || '');
          break;
        case 'CHARON':
          await charonApi.switchToCharon();
          break;
      }
      showStatus(`Pushed ${gmView} to player terminal`);
    } catch (err) {
      console.error('Error pushing view to player terminal:', err);
      showStatus('Failed to push view', 'error');
    }
  }, [gmView, activeView?.location_slug, showStatus]);

  // -- Handlers kept for Plan 02/03 wiring --

  // Handle location selection for ENCOUNTER view
  const handleSelectLocation = useCallback(async (slug: string | null) => {
    try {
      await gmConsoleApi.switchView('ENCOUNTER', slug || '');
      if (slug) {
        showStatus(`Selected ${slug}`);
      } else {
        showStatus('Cleared selection');
      }
    } catch (err) {
      console.error('Error selecting location:', err);
      showStatus('Failed to select location', 'error');
    }
  }, [showStatus]);

  const handleShowTerminal = useCallback(async (locationSlug: string, terminalSlug: string) => {
    try {
      const isAlreadyShown = activeView?.overlay_location_slug === locationSlug &&
                             activeView?.overlay_terminal_slug === terminalSlug;

      if (isAlreadyShown) {
        await gmConsoleApi.showTerminal('', '');
        showStatus('Terminal hidden');
      } else {
        await gmConsoleApi.showTerminal(locationSlug, terminalSlug);
        showStatus(`Showing terminal ${terminalSlug}`);
      }
    } catch (err) {
      console.error('Error showing terminal:', err);
      showStatus('Failed to show terminal', 'error');
    }
  }, [showStatus, activeView?.overlay_location_slug, activeView?.overlay_terminal_slug]);

  const handleToggleCharonDialog = useCallback(async () => {
    try {
      const result = await charonApi.toggleDialog();
      showStatus(result.charon_dialog_open ? 'CHARON dialog shown' : 'CHARON dialog hidden');
    } catch (err) {
      console.error('Error toggling CHARON dialog:', err);
      showStatus('Failed to toggle CHARON dialog', 'error');
    }
  }, [showStatus]);

  // Expose retained state/handlers not yet wired to views.

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
    <div className="gm-console">
      {connectionLost && <SSEConnectionToast />}
      {contextHolder}
      <ViewRail
        gmView={gmView}
        playerView={activeView?.view_type || 'STANDBY'}
        onViewChange={setGmView}
        onDisplay={handleDisplay}
        unreadCounts={unreadCounts}
      />
      <main className="gm-console__content">
        {gmView === 'STANDBY' && <StandbyView />}
        {gmView === 'BRIDGE' && (
          <BridgeView
            activeView={activeView}
            charonChannel={activeCharonChannel}
            charonDialogOpen={activeView?.charon_dialog_open || false}
            onDialogToggle={handleToggleCharonDialog}
          />
        )}
        {gmView === 'ENCOUNTER' && (
          <EncounterView
            activeView={activeView}
            locations={locations}
            expandedNodes={expandedNodes}
            onToggleNode={toggleNode}
            onSelectLocation={handleSelectLocation}
            onShowTerminal={handleShowTerminal}
            charonChannel={activeCharonChannel}
            charonDialogOpen={activeView?.charon_dialog_open || false}
            onDialogToggle={handleToggleCharonDialog}
          />
        )}
        {gmView === 'CHARON' && (
          <CharonView
            channel={activeCharonChannel}
            currentViewType="CHARON_TERMINAL"
            charonDialogOpen={activeView?.charon_dialog_open || false}
            onDialogToggle={handleToggleCharonDialog}
          />
        )}
      </main>
    </div>
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
