import { Button, Card, Space } from 'antd';
import { PauseCircleOutlined, DashboardOutlined, RobotOutlined, GlobalOutlined } from '@ant-design/icons';

interface ViewControlsProps {
  currentView: string;
  onStandby: () => void;
  onBridge: () => void;
  onCharon: () => void;
  onEncounter: () => void;
}

export function ViewControls({ currentView, onStandby, onBridge, onCharon, onEncounter }: ViewControlsProps) {
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
        <Button
          type={currentView === 'BRIDGE' ? 'primary' : 'default'}
          icon={<DashboardOutlined />}
          onClick={onBridge}
        >
          BRIDGE
        </Button>
        <Button
          type={currentView === 'ENCOUNTER' ? 'primary' : 'default'}
          icon={<GlobalOutlined />}
          onClick={onEncounter}
        >
          ENCOUNTER
        </Button>
        <Button
          type={currentView === 'CHARON_TERMINAL' ? 'primary' : 'default'}
          icon={<RobotOutlined />}
          onClick={onCharon}
        >
          CHARON
        </Button>
      </Space>
    </Card>
  );
}
