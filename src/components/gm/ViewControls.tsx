import { Button, Card, Space } from 'antd';
import { PauseCircleOutlined, DashboardOutlined } from '@ant-design/icons';

interface ViewControlsProps {
  currentView: string;
  onStandby: () => void;
  onDashboard: () => void;
}

export function ViewControls({ currentView, onStandby, onDashboard }: ViewControlsProps) {
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
      </Space>
    </Card>
  );
}
