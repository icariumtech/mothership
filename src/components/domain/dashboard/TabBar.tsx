import { Panel } from '@components/ui/Panel';
import './TabBar.css';

export type BridgeTab = 'map' | 'crew' | 'contacts' | 'notes' | 'status';

interface TabBarProps {
  activeTab: BridgeTab;
  onTabChange: (tab: BridgeTab) => void;
  disabled?: boolean;
}

export function TabBar({ activeTab, onTabChange, disabled = false }: TabBarProps) {
  const tabs: { id: BridgeTab; label: string }[] = [
    { id: 'map', label: 'MAP' },
    { id: 'crew', label: 'CREW' },
    { id: 'contacts', label: 'CONTACTS' },
    { id: 'notes', label: 'NOTES' },
    { id: 'status', label: 'STATUS' },
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
          </button>
        ))}
      </div>
    </Panel>
  );
}
