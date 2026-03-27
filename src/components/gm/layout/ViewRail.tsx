import { ReactNode } from 'react';
import { Badge, Tooltip } from 'antd';
import {
  PauseCircleOutlined,
  DashboardOutlined,
  RadarChartOutlined,
  SendOutlined,
} from '@ant-design/icons';
import './ViewRail.css';

export type GMViewType = 'STANDBY' | 'BRIDGE' | 'ENCOUNTER';

interface ViewRailProps {
  gmView: GMViewType;
  playerView: string;
  onViewChange: (view: GMViewType) => void;
  onDisplay: () => void;
  unreadCounts?: {
    bridge?: number;
    story?: number;
    encounter?: number;
  };
}

interface ViewItem {
  key: GMViewType;
  icon: ReactNode;
  tooltip: string;
  playerViewKeys: string[];
  unreadKey?: 'bridge' | 'story' | 'encounter';
}

const VIEW_ITEMS: ViewItem[] = [
  {
    key: 'STANDBY',
    icon: <PauseCircleOutlined />,
    tooltip: 'Standby',
    playerViewKeys: ['STANDBY'],
  },
  {
    key: 'BRIDGE',
    icon: <DashboardOutlined />,
    tooltip: 'Bridge',
    playerViewKeys: ['BRIDGE'],
    unreadKey: 'bridge',
  },
  {
    key: 'ENCOUNTER',
    icon: <RadarChartOutlined />,
    tooltip: 'Encounter',
    playerViewKeys: ['ENCOUNTER'],
    unreadKey: 'encounter',
  },
];

export function ViewRail({ gmView, playerView, onViewChange, onDisplay, unreadCounts }: ViewRailProps) {
  return (
    <nav className="view-rail">
      {/* DISPLAY button at the top */}
      <Tooltip title="Push view to player terminal" placement="right">
        <button className="view-rail__display" onClick={onDisplay} aria-label="Push to player terminal">
          <SendOutlined />
        </button>
      </Tooltip>

      <div className="view-rail__separator" />

      {/* View buttons */}
      <div className="view-rail__views">
        {VIEW_ITEMS.map((item) => {
          const isActive = gmView === item.key;
          const isPlayerView = item.playerViewKeys.includes(playerView);
          const unread = item.unreadKey ? (unreadCounts?.[item.unreadKey] || 0) : 0;

          return (
            <div key={item.key} className="view-rail__slot">
              <Badge count={unread} offset={[2, -2]} size="small">
                <Tooltip title={item.tooltip} placement="right">
                  <button
                    className={`view-rail__btn ${isActive ? 'view-rail__btn--active' : ''}`}
                    onClick={() => onViewChange(item.key)}
                    aria-label={item.tooltip}
                  >
                    {item.icon}
                    {isPlayerView && <span className="view-rail__dot" />}
                  </button>
                </Tooltip>
              </Badge>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
