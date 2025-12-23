import { useState, useEffect, useCallback } from 'react';

const DEFAULT_STORAGE_KEY = 'gm-console-tree-state';

export function useTreeState(storageKey: string = DEFAULT_STORAGE_KEY) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Persist to localStorage whenever expandedNodes changes
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify([...expandedNodes]));
  }, [expandedNodes, storageKey]);

  const toggleNode = useCallback((slug: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  const expandPath = useCallback((slugs: string[]) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      slugs.forEach(slug => next.add(slug));
      return next;
    });
  }, []);

  const isExpanded = useCallback((slug: string) => {
    return expandedNodes.has(slug);
  }, [expandedNodes]);

  return { expandedNodes, toggleNode, expandPath, isExpanded };
}
