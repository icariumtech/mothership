import { Button, Card, Space } from 'antd';
import { PauseCircleOutlined, DashboardOutlined, RobotOutlined } from '@ant-design/icons';

interface ViewControlsProps {
  currentView: string;
  onStandby: () => void;
  onBridge: () => void;
  onCharon: () => void;
}

export function ViewControls({ currentView, onStandby, onBridge, onCharon }: ViewControlsProps) {
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
