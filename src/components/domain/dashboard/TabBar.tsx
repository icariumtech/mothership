import { Panel } from '@components/ui/Panel';
import './TabBar.css';

export type BridgeTab = 'map' | 'personnel' | 'logs' | 'status' | 'janus';

interface TabBarProps {
  activeTab: BridgeTab;
  onTabChange: (tab: BridgeTab) => void;
  disabled?: boolean;
  janusHasMessages?: boolean;
}

export function TabBar({ activeTab, onTabChange, disabled = false, janusHasMessages = false }: TabBarProps) {
  const tabs: { id: BridgeTab; label: string }[] = [
    { id: 'status', label: 'SYSTEMS' },
    { id: 'map', label: 'NAVIGATION' },
    { id: 'personnel', label: 'PERSONNEL' },
    { id: 'logs', label: 'LOGS' },
    { id: 'janus', label: 'JANUS' },
  ];

  return (
    <Panel
      variant="dashboard"
      chamferCorners={['tl', 'tr', 'bl', 'br']}
      chamferSize={12}
      scrollable={false}
      padding={12}
      className="tab-bar-panel"
    >
      <div className={`tab-bar ${disabled ? 'disabled' : ''}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => !disabled && onTabChange(tab.id)}
            disabled={disabled}
          >
            {tab.label}
            {tab.id === 'janus' && janusHasMessages && activeTab !== 'janus' && (
              <span className="tab-indicator" />
            )}
          </button>
        ))}
      </div>
    </Panel>
  );
}
