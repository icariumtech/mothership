import { ReactNode } from 'react';
import { Tooltip } from 'antd';
import {
  PauseCircleOutlined,
  DashboardOutlined,
  RadarChartOutlined,
  RobotOutlined,
  SendOutlined,
} from '@ant-design/icons';
import './ViewRail.css';

export type GMViewType = 'STANDBY' | 'BRIDGE' | 'ENCOUNTER' | 'CHARON';

interface ViewRailProps {
  gmView: GMViewType;
  playerView: string;
  onViewChange: (view: GMViewType) => void;
  onDisplay: () => void;
}

interface ViewItem {
  key: GMViewType;
  icon: ReactNode;
  tooltip: string;
  /** The server view_type value(s) that map to this rail icon */
  playerViewKeys: string[];
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
  },
  {
    key: 'ENCOUNTER',
    icon: <RadarChartOutlined />,
    tooltip: 'Encounter',
    playerViewKeys: ['ENCOUNTER'],
  },
  {
    key: 'CHARON',
    icon: <RobotOutlined />,
    tooltip: 'CHARON Terminal',
    playerViewKeys: ['CHARON_TERMINAL'],
  },
];

export function ViewRail({ gmView, playerView, onViewChange, onDisplay }: ViewRailProps) {
  return (
    <nav className="view-rail">
      <div className="view-rail__views">
        {VIEW_ITEMS.map((item) => {
          const isActive = gmView === item.key;
          const isPlayerView = item.playerViewKeys.includes(playerView);

          return (
            <Tooltip key={item.key} title={item.tooltip} placement="right">
              <button
                className={`view-rail__item ${isActive ? 'view-rail__item--active' : ''}`}
                onClick={() => onViewChange(item.key)}
                aria-label={item.tooltip}
              >
                {item.icon}
                {isPlayerView && <span className="view-rail__indicator" />}
              </button>
            </Tooltip>
          );
        })}
      </div>

      <Tooltip title="Push to player terminal" placement="right">
        <button className="view-rail__display" onClick={onDisplay} aria-label="Push to player terminal">
          <SendOutlined />
        </button>
      </Tooltip>
    </nav>
  );
}
