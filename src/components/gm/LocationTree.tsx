import { useMemo } from 'react';
import { Tree, Button, Space, Tag } from 'antd';
import { DesktopOutlined, MessageOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { Location } from '@/types/gmConsole';

interface LocationTreeProps {
  locations: Location[];
  activeLocationSlug: string | null;
  activeTerminalSlug: string | null;
  expandedNodes: Set<string>;
  onToggle: (slug: string) => void;
  onDisplayLocation: (slug: string) => void;
  onShowTerminal: (locationSlug: string, terminalSlug: string) => void;
}

export function LocationTree({
  locations,
  activeLocationSlug,
  activeTerminalSlug,
  expandedNodes,
  onToggle,
  onDisplayLocation,
  onShowTerminal
}: LocationTreeProps) {
  // Convert locations to Ant Design tree data format
  const treeData = useMemo(() => {
    function convertToTreeData(locs: Location[]): DataNode[] {
      return locs.flatMap(location => {
        const isActive = location.slug === activeLocationSlug;

        // Create terminal nodes
        const terminalNodes: DataNode[] = location.terminals.map(terminal => ({
          key: `terminal-${location.slug}-${terminal.slug}`,
          title: (
            <Space>
              <span>{terminal.name}</span>
              {terminal.owner && <Tag color="default">{terminal.owner}</Tag>}
              <Button
                size="small"
                type={terminal.slug === activeTerminalSlug ? 'primary' : 'default'}
                icon={<MessageOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onShowTerminal(location.slug, terminal.slug);
                }}
              >
                Show
              </Button>
            </Space>
          ),
          isLeaf: true,
        }));

        // Create child location nodes
        const childNodes = convertToTreeData(location.children);

        return [{
          key: location.slug,
          title: (
            <Space>
              <span style={{ fontWeight: 500 }}>{location.name}</span>
              <Tag color="blue">{location.type}</Tag>
              {location.has_map && (
                <Button
                  size="small"
                  type={isActive ? 'primary' : 'default'}
                  icon={<DesktopOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDisplayLocation(location.slug);
                  }}
                >
                  Display
                </Button>
              )}
            </Space>
          ),
          children: [...terminalNodes, ...childNodes],
        }];
      });
    }

    return convertToTreeData(locations);
  }, [locations, activeLocationSlug, activeTerminalSlug, onDisplayLocation, onShowTerminal]);

  const expandedKeys = useMemo(() => Array.from(expandedNodes), [expandedNodes]);

  const handleExpand = (keys: React.Key[]) => {
    // Find the difference to determine which node was toggled
    const newKeys = new Set(keys.map(k => String(k)));
    const oldKeys = expandedNodes;

    // Find added key
    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        onToggle(key);
        return;
      }
    }

    // Find removed key
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        onToggle(key);
        return;
      }
    }
  };

  return (
    <Tree
      treeData={treeData}
      expandedKeys={expandedKeys}
      onExpand={handleExpand}
      showLine={{ showLeafIcon: false }}
      style={{ background: 'transparent' }}
    />
  );
}
