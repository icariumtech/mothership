import { Button, Card, Space, Badge } from 'antd';
import { PauseCircleOutlined, DashboardOutlined, RobotOutlined, GlobalOutlined } from '@ant-design/icons';

interface ViewControlsProps {
  currentView: string;
  onStandby: () => void;
  onBridge: () => void;
  onCharon: () => void;
  onEncounter: () => void;
  unreadCounts?: {
    bridge?: number;
    story?: number;
    encounter?: number;
  };
}

export function ViewControls({ currentView, onStandby, onBridge, onCharon, onEncounter, unreadCounts }: ViewControlsProps) {
  return (
    <Card title="VIEW CONTROLS" size="small">
      <Space>
        <Button
          type={currentView === 'STANDBY' ? 'primary' : 'default'}
          icon={<PauseCircleOutlined />}
          onClick={onStandby}
        >
          STANDBY
        </Button>
        <Badge count={unreadCounts?.bridge || 0} offset={[10, 5]}>
          <Button
            type={currentView === 'BRIDGE' ? 'primary' : 'default'}
            icon={<DashboardOutlined />}
            onClick={onBridge}
          >
            BRIDGE
          </Button>
        </Badge>
        <Badge count={unreadCounts?.encounter || 0} offset={[10, 5]}>
          <Button
            type={currentView === 'ENCOUNTER' ? 'primary' : 'default'}
            icon={<GlobalOutlined />}
            onClick={onEncounter}
          >
            ENCOUNTER
          </Button>
        </Badge>
        <Badge count={unreadCounts?.story || 0} offset={[10, 5]}>
          <Button
            type={currentView === 'CHARON_TERMINAL' ? 'primary' : 'default'}
            icon={<RobotOutlined />}
            onClick={onCharon}
          >
            CHARON
          </Button>
        </Badge>
      </Space>
    </Card>
  );
}
