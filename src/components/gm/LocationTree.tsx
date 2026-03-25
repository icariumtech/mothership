import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
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
  shipLocationSlug?: string | null;
  shipName?: string;
  shipSlug?: string | null;
}

const SHIP_NODE_KEY = '__player_ship__';

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
  shipLocationSlug,
  shipName = 'Player Ship',
  shipSlug,
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

  // Compute set of slugs that are ancestors-or-self of the ship location (for amber highlighting)
  const shipAncestorSlugs = useMemo(() => {
    const result = new Set<string>();
    if (!shipLocationSlug) return result;

    function findPath(locs: Location[], target: string, path: string[]): boolean {
      for (const loc of locs) {
        const newPath = [...path, loc.slug];
        if (loc.slug === target) {
          newPath.forEach(s => result.add(s));
          return true;
        }
        if (findPath(loc.children, target, newPath)) return true;
      }
      return false;
    }

    findPath(locations, shipLocationSlug, []);
    return result;
  }, [locations, shipLocationSlug]);

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

        // Inject player ship node if this is the ship's current location.
        // Use a synthetic key to avoid colliding with the real uscss_morrigan node
        // that appears elsewhere in the tree — duplicate keys cause Ant Design Tree
        // to spawn ghost nodes on expand/collapse.
        const shipNode: DataNode[] = shipLocationSlug === location.slug ? [{
          key: SHIP_NODE_KEY,
          title: (
            <Space>
              <span style={{ fontWeight: 500 }}>{shipName}</span>
              <Tag style={{ backgroundColor: '#8b7355', borderColor: '#8b7355', color: '#0f1515' }}>ship</Tag>
            </Space>
          ),
          isLeaf: true,
          selectable: selectionEnabled && !!shipSlug,
        }] : [];

        // Check if this location can be selected
        const canSelect = selectableKeys.has(location.slug);
        const isOnShipPath = shipAncestorSlugs.has(location.slug);

        return [{
          key: location.slug,
          title: (
            <Space>
              <span style={{ fontWeight: 500 }}>{location.name}</span>
              {isOnShipPath
                ? <Tag style={{ backgroundColor: '#8b7355', borderColor: '#8b7355', color: '#0f1515' }}>{location.type}</Tag>
                : <Tag color="blue">{location.type}</Tag>
              }
            </Space>
          ),
          children: [...terminalNodes, ...shipNode, ...childNodes],
          selectable: selectionEnabled && canSelect,
        }];
      });
    }

    return convertToTreeData(locations);
  }, [locations, activeTerminalLocationSlug, activeTerminalSlug, onShowTerminal, selectionEnabled, selectableKeys, shipLocationSlug, shipAncestorSlugs, shipName, shipSlug]);

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
    if (!selectedLocationSlug) return [];
    // When the ship's own location is selected, highlight the synthetic ship node
    if (selectedLocationSlug === shipSlug) return [SHIP_NODE_KEY];
    return [selectedLocationSlug];
  }, [selectedLocationSlug, shipSlug]);

  const handleSelect = useCallback((keys: React.Key[]) => {
    if (!selectionEnabled) return;

    if (keys.length > 0) {
      const key = String(keys[0]);
      // Ship node uses a synthetic key — map it back to the real ship slug
      if (key === SHIP_NODE_KEY) {
        if (shipSlug) onSelectLocation(shipSlug);
        return;
      }
      // Only select if it's a selectable location (not a terminal)
      if (selectableKeys.has(key)) {
        onSelectLocation(key);
      }
    } else {
      onSelectLocation(null);
    }
  }, [selectionEnabled, shipSlug, selectableKeys, onSelectLocation]);

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
