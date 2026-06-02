import { useState, useEffect, useCallback } from 'react';
import { Tree, Tag } from 'antd';
import {
  FolderOutlined,
  FileOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { gmConsoleApi, type DataDirEntry } from '@/services/gmConsoleApi';

export interface DataFileTreeProps {
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
}

const MONOSPACE_FONT = "'Share Tech Mono', 'Cascadia Code', 'Courier New', monospace";

const TREE_STYLES = `
  .data-file-tree .ant-tree-node-content-wrapper.ant-tree-node-selected {
    background: rgba(74, 139, 139, 0.1) !important;
    border-left: 2px solid #4a8b8b !important;
  }
  .data-file-tree .ant-tree-treenode:hover .ant-tree-node-content-wrapper:not(.ant-tree-node-selected) {
    background: rgba(255, 255, 255, 0.04) !important;
  }
  .data-file-tree .ant-tree-node-content-wrapper {
    border-left: 2px solid transparent;
    transition: background 0.1s ease, border-color 0.1s ease;
  }
  .data-file-tree .ant-tree-switcher {
    color: #4a8b8b;
  }
  .data-file-tree .ant-tree-indent-unit {
    width: 16px;
  }
`;

function getFileExtension(name: string): string {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return name.slice(lastDot + 1).toLowerCase();
}

function isEditableExtension(ext: string): boolean {
  return ext === 'yaml' || ext === 'yml' || ext === 'md';
}

function buildNodeTitle(entry: DataDirEntry, _fullPath: string): React.ReactNode {
  if (entry.type === 'directory') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: MONOSPACE_FONT, fontSize: 12, color: '#7ab8b8' }}>
        <FolderOutlined style={{ color: '#4a8b8b', flexShrink: 0 }} />
        {entry.name}
      </span>
    );
  }

  const ext = getFileExtension(entry.name);
  const showBadge = ext !== '' && !isEditableExtension(ext);

  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: MONOSPACE_FONT, fontSize: 12, color: '#7ab8b8' }}>
      <FileOutlined style={{ color: '#4a7070', flexShrink: 0 }} />
      {entry.name}
      {showBadge && (
        <Tag color="default" style={{ fontSize: 10, marginLeft: 4, lineHeight: '16px', padding: '0 4px' }}>
          .{ext}
        </Tag>
      )}
    </span>
  );
}

function updateNodeChildren(
  nodes: DataNode[],
  key: string,
  children: DataNode[],
): DataNode[] {
  return nodes.map(node => {
    if (node.key === key) {
      return { ...node, children };
    }
    if (node.children) {
      return { ...node, children: updateNodeChildren(node.children, key, children) };
    }
    return node;
  });
}

function findNode(nodes: DataNode[], key: string): DataNode | null {
  for (const node of nodes) {
    if (node.key === key) return node;
    if (node.children) {
      const found = findNode(node.children, key);
      if (found) return found;
    }
  }
  return null;
}

function entriestoDataNodes(entries: DataDirEntry[], parentPath: string): DataNode[] {
  return entries.map(entry => {
    const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    return {
      key: fullPath,
      isLeaf: entry.type === 'file',
      title: buildNodeTitle(entry, fullPath),
    };
  });
}

export function DataFileTree({ selectedPath, onSelectFile }: DataFileTreeProps) {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  // Load root entries on mount
  useEffect(() => {
    gmConsoleApi.listDataDir('').then(entries => {
      setTreeData(entriestoDataNodes(entries, ''));
    }).catch(err => {
      console.error('DataFileTree: failed to load root entries', err);
    });
  }, []);

  const loadData = useCallback(async (node: DataNode): Promise<void> => {
    const parentPath = node.key as string;
    try {
      const entries = await gmConsoleApi.listDataDir(parentPath);
      const children = entriestoDataNodes(entries, parentPath);
      setTreeData(prev => updateNodeChildren(prev, parentPath, children));
    } catch (err) {
      console.error('DataFileTree: failed to load directory', parentPath, err);
    }
  }, []);

  const handleSelect = useCallback((keys: React.Key[]) => {
    if (keys.length === 0) return;
    const key = String(keys[0]);
    const node = findNode(treeData, key);
    if (node?.isLeaf) {
      onSelectFile(key);
    }
  }, [treeData, onSelectFile]);

  const handleExpand = useCallback((keys: React.Key[]) => {
    setExpandedKeys(keys as string[]);
  }, []);

  const selectedKeys = selectedPath ? [selectedPath] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111e1e', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }} className="data-file-tree">
        <style>{TREE_STYLES}</style>
        <Tree
          treeData={treeData}
          loadData={loadData}
          expandedKeys={expandedKeys}
          selectedKeys={selectedKeys}
          onExpand={handleExpand}
          onSelect={handleSelect}
          showLine={{ showLeafIcon: false }}
          style={{
            background: 'transparent',
            fontSize: 12,
            fontFamily: MONOSPACE_FONT,
            color: '#7ab8b8',
          }}
        />
      </div>
    </div>
  );
}
