import { ReactNode } from 'react';
import { Tooltip } from 'antd';
import './ToolRail.css';

export interface ToolRailButton {
  key: string;
  icon: ReactNode;
  tooltip: string;
}

interface ToolRailProps {
  tools: ToolRailButton[];
  activePanel: string | null;
  onToggle: (key: string) => void;
}

export function ToolRail({ tools, activePanel, onToggle }: ToolRailProps) {
  if (tools.length === 0) return null;

  return (
    <nav className="tool-rail">
      {tools.map((tool) => {
        const isActive = activePanel === tool.key;
        return (
          <Tooltip key={tool.key} title={tool.tooltip} placement="left">
            <button
              className={`tool-rail__item ${isActive ? 'tool-rail__item--active' : ''}`}
              onClick={() => onToggle(tool.key)}
              aria-label={tool.tooltip}
            >
              {tool.icon}
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
}
