import { Button, Card, Space } from 'antd';
import { PauseCircleOutlined, DashboardOutlined, RobotOutlined } from '@ant-design/icons';

interface ViewControlsProps {
  currentView: string;
  onStandby: () => void;
  onDashboard: () => void;
  onCharon: () => void;
}

export function ViewControls({ currentView, onStandby, onDashboard, onCharon }: ViewControlsProps) {
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
          type={currentView === 'CAMPAIGN_DASHBOARD' ? 'primary' : 'default'}
          icon={<DashboardOutlined />}
          onClick={onDashboard}
        >
          DASHBOARD
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
