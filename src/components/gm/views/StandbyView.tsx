import { useState } from 'react';
import { RobotOutlined } from '@ant-design/icons';
import { ToolRail } from '@/components/gm/layout/ToolRail';
import { CharonPanel } from '@/components/gm/CharonPanel';
import './StandbyView.css';

interface StandbyViewProps {
  charonChannel: string;
  charonDialogOpen: boolean;
  onDialogToggle: () => void;
}

const STANDBY_TOOLS = [
  { key: 'charon', icon: <RobotOutlined />, tooltip: 'CHARON' },
];

export function StandbyView({ charonChannel, charonDialogOpen, onDialogToggle }: StandbyViewProps) {
  const [activePanel, setActivePanel] = useState<string | null>(null);

  function handleToggle(key: string) {
    setActivePanel(prev => prev === key ? null : key);
  }

  return (
    <div className="gm-standby-view">
      <div className="gm-standby-view__content">
        <div className="gm-standby-view__label">STANDBY</div>
        <div className="gm-standby-view__hint">Select a view from the rail to begin</div>
      </div>

      {activePanel === 'charon' && (
        <div className="gm-standby-view__overlay">
          <CharonPanel
            channel={charonChannel}
            currentViewType="CHARON_TERMINAL"
            charonDialogOpen={charonDialogOpen}
            onDialogToggle={onDialogToggle}
          />
        </div>
      )}

      <ToolRail tools={STANDBY_TOOLS} activePanel={activePanel} onToggle={handleToggle} />
    </div>
  );
}
