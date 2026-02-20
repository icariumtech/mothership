import { useState, useCallback, useEffect, useRef } from 'react';
import { NPCPortraitCard } from './NPCPortraitCard';
import './NPCPortraitOverlay.css';

interface NpcData {
  id: string;
  name: string;
  portrait: string;
}

interface NPCPortraitOverlayProps {
  activePortraitIds: string[];
  npcData: { [id: string]: NpcData };
}

export function NPCPortraitOverlay({ activePortraitIds, npcData }: NPCPortraitOverlayProps) {
  const [displayedIds, setDisplayedIds] = useState<string[]>(activePortraitIds);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const prevIdsRef = useRef<string[]>(activePortraitIds);

  useEffect(() => {
    const prevIds = prevIdsRef.current;
    const removed = prevIds.filter(id => !activePortraitIds.includes(id));
    const added = activePortraitIds.filter(id => !prevIds.includes(id));

    if (removed.length > 0) {
      setDismissingIds(prev => {
        const next = new Set(prev);
        removed.forEach(id => next.add(id));
        return next;
      });
    }

    if (added.length > 0) {
      setDisplayedIds(prev => {
        const withAdded = [...prev.filter(id => !removed.includes(id) || dismissingIds.has(id))];
        added.forEach(id => { if (!withAdded.includes(id)) withAdded.push(id); });
        return withAdded;
      });
    }

    prevIdsRef.current = activePortraitIds;
  }, [activePortraitIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismissed = useCallback((npcId: string) => {
    setDisplayedIds(prev => prev.filter(id => id !== npcId));
    setDismissingIds(prev => {
      const next = new Set(prev);
      next.delete(npcId);
      return next;
    });
  }, []);

  if (displayedIds.length === 0) return null;

  return (
    <div className="portrait-overlay">
      <div className="portrait-overlay-backdrop" />
      <div className="portrait-overlay-tray">
        {displayedIds.map(npcId => {
          const npc = npcData[npcId];
          if (!npc) return null;
          return (
            <NPCPortraitCard
              key={npcId}
              npcId={npcId}
              name={npc.name}
              portrait={npc.portrait || ''}
              isDismissing={dismissingIds.has(npcId)}
              onDismissed={handleDismissed}
            />
          );
        })}
      </div>
    </div>
  );
}
