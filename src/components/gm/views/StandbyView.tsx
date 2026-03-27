import { useState } from 'react';
import { RobotOutlined } from '@ant-design/icons';
import { ToolRail } from '@/components/gm/layout/ToolRail';
import { SlideOutPanel } from '@/components/gm/layout/SlideOutPanel';
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

      <div className="gm-standby-view__right">
        <ToolRail tools={STANDBY_TOOLS} activePanel={activePanel} onToggle={handleToggle} />
        <SlideOutPanel open={activePanel === 'charon'} title="CHARON" onClose={() => setActivePanel(null)}>
          <CharonPanel
            channel={charonChannel}
            currentViewType="STANDBY"
            charonDialogOpen={charonDialogOpen}
            onDialogToggle={onDialogToggle}
          />
        </SlideOutPanel>
      </div>
    </div>
  );
}
