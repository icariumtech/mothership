import { useMemo } from 'react';
import { Tree, Button, Space, Tag } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { Location } from '@/types/gmConsole';

interface LocationTreeProps {
  locations: Location[];
  selectedLocationSlug: string | null;
  activeTerminalLocationSlug: string | null;
  activeTerminalSlug: string | null;
  expandedNodes: Set<string>;
  onToggle: (slug: string) => void;
  onSelectLocation: (slug: string | null) => void;
  onShowTerminal: (locationSlug: string, terminalSlug: string) => void;
  selectionEnabled: boolean;
}

export function LocationTree({
  locations,
  selectedLocationSlug,
  activeTerminalLocationSlug,
  activeTerminalSlug,
  expandedNodes,
  onToggle,
  onSelectLocation,
  onShowTerminal,
  selectionEnabled
}: LocationTreeProps) {
  // Track which keys are selectable (all locations are now selectable)
  const selectableKeys = useMemo(() => {
    const keys = new Set<string>();

    function collectSelectableKeys(locs: Location[]) {
      for (const location of locs) {
        // All locations are selectable - locations without maps will show a "no map" message
        keys.add(location.slug);
        collectSelectableKeys(location.children);
      }
    }

    collectSelectableKeys(locations);
    return keys;
  }, [locations]);

  // Convert locations to Ant Design tree data format
  const treeData = useMemo(() => {
    function convertToTreeData(locs: Location[]): DataNode[] {
      return locs.flatMap(location => {
        // Create terminal nodes
        const terminalNodes: DataNode[] = location.terminals.map(terminal => {
          const isActive = location.slug === activeTerminalLocationSlug &&
                           terminal.slug === activeTerminalSlug;
          return {
            key: `terminal-${location.slug}-${terminal.slug}`,
            title: (
              <Space>
                <span>{terminal.name}</span>
                {terminal.owner && <Tag color="default">{terminal.owner}</Tag>}
                <Button
                  size="small"
                  type={isActive ? 'primary' : 'default'}
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
            selectable: false,
          };
        });

        // Create child location nodes
        const childNodes = convertToTreeData(location.children);

        // Check if this location can be selected
        const canSelect = selectableKeys.has(location.slug);

        return [{
          key: location.slug,
          title: (
            <Space>
              <span style={{ fontWeight: 500 }}>{location.name}</span>
              <Tag color="blue">{location.type}</Tag>
            </Space>
          ),
          children: [...terminalNodes, ...childNodes],
          selectable: selectionEnabled && canSelect,
        }];
      });
    }

    return convertToTreeData(locations);
  }, [locations, activeTerminalLocationSlug, activeTerminalSlug, onShowTerminal, selectionEnabled, selectableKeys]);

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

  const selectedKeys = useMemo(() => {
    return selectedLocationSlug ? [selectedLocationSlug] : [];
  }, [selectedLocationSlug]);

  const handleSelect = (keys: React.Key[]) => {
    if (!selectionEnabled) return;

    // If a key was selected, use it; otherwise clear selection
    if (keys.length > 0) {
      const key = String(keys[0]);
      // Only select if it's a selectable location (not a terminal)
      if (selectableKeys.has(key)) {
        onSelectLocation(key);
      }
    } else {
      onSelectLocation(null);
    }
  };

  return (
    <Tree
      treeData={treeData}
      expandedKeys={expandedKeys}
      selectedKeys={selectedKeys}
      onExpand={handleExpand}
      onSelect={handleSelect}
      showLine={{ showLeafIcon: false }}
      style={{ background: 'transparent' }}
    />
  );
}
