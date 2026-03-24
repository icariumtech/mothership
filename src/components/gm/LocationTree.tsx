import { useMemo, useState, useEffect, useRef } from 'react';
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
  onSetShipLocation?: (slug: string) => void;
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
  selectionEnabled,
  onSetShipLocation,
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

  const [contextMenu, setContextMenu] = useState<{ slug: string; name: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleEsc);
    }, 0);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

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

  const handleRightClick = ({ event, node }: { event: React.MouseEvent; node: { key: React.Key } }) => {
    if (!onSetShipLocation) return;
    const key = String(node.key);
    // Skip terminal pseudo-nodes
    if (key.startsWith('terminal-')) return;
    event.preventDefault();

    // Find location name by slug
    function findName(locs: Location[], slug: string): string {
      for (const loc of locs) {
        if (loc.slug === slug) return loc.name;
        const found = findName(loc.children, slug);
        if (found) return found;
      }
      return slug;
    }

    const containerRect = (event.currentTarget as HTMLElement).closest('.location-tree-container')?.getBoundingClientRect();
    const x = containerRect ? event.clientX - containerRect.left : event.clientX;
    const y = containerRect ? event.clientY - containerRect.top : event.clientY;
    setContextMenu({ slug: key, name: findName(locations, key), x, y });
  };

  return (
    <div className="location-tree-container" style={{ position: 'relative' }}>
      <Tree
        treeData={treeData}
        expandedKeys={expandedKeys}
        selectedKeys={selectedKeys}
        onExpand={handleExpand}
        onSelect={handleSelect}
        onRightClick={handleRightClick}
        showLine={{ showLeafIcon: false }}
        style={{ background: 'transparent' }}
      />
      {contextMenu && onSetShipLocation && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#0f1515',
            border: '1px solid #4a6b6b',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            minWidth: '140px',
            fontFamily: "'Cascadia Code', 'Courier New', monospace",
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div style={{
            color: '#4a6b6b',
            fontSize: '10px',
            fontWeight: 'bold',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            paddingBottom: '4px',
            borderBottom: '1px solid #2a3a3a',
            marginBottom: '2px',
          }}>
            {contextMenu.name}
          </div>
          <button
            onClick={() => {
              onSetShipLocation(contextMenu.slug);
              setContextMenu(null);
            }}
            style={{
              background: '#1a1a1a',
              border: '1px solid #8b7355',
              color: '#8b7355',
              padding: '4px 8px',
              fontSize: '10px',
              fontFamily: 'inherit',
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#8b7355';
              e.currentTarget.style.color = '#0a0a0a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#1a1a1a';
              e.currentTarget.style.color = '#8b7355';
            }}
          >
            SET SHIP HERE
          </button>
        </div>
      )}
    </div>
  );
}
