import { useState } from 'react';
import { Button, Typography, Tooltip, message } from 'antd';
import type { NpcPortraitData } from '@/types/gmConsole';
import { gmConsoleApi } from '@/services/gmConsoleApi';

const { Text } = Typography;

interface NpcPortraitsPanelProps {
  npcs: NpcPortraitData[];
  activePortraits: string[];
  onToggle: (npcId: string) => void;
}

export function NpcPortraitsPanel({ npcs, activePortraits, onToggle }: NpcPortraitsPanelProps) {
  // Optimistic overrides for the met flag — the active-view payload that drives
  // npc.met is briefly cached server-side, so reflect clicks immediately here.
  const [metOverrides, setMetOverrides] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});

  if (npcs.length === 0) {
    return <Text type="secondary" style={{ fontSize: 11 }}>No NPCs in campaign data</Text>;
  }

  const handleToggleMet = async (npc: NpcPortraitData) => {
    const current = metOverrides[npc.id] ?? npc.met;
    const next = !current;
    setMetOverrides(prev => ({ ...prev, [npc.id]: next }));
    setPending(prev => ({ ...prev, [npc.id]: true }));
    try {
      const result = await gmConsoleApi.toggleNpcMet(npc.id, next);
      setMetOverrides(prev => ({ ...prev, [npc.id]: result.met }));
    } catch {
      // Revert on failure
      setMetOverrides(prev => ({ ...prev, [npc.id]: current }));
      message.error(`Could not update ${npc.name}`);
    } finally {
      setPending(prev => ({ ...prev, [npc.id]: false }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {npcs.map(npc => {
        const isPortraitActive = activePortraits.includes(npc.id);
        const isMet = metOverrides[npc.id] ?? npc.met;
        return (
          <div
            key={npc.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}
          >
            <Tooltip
              title={
                npc.portrait
                  ? <img src={npc.portrait} alt={npc.name} style={{ width: 120, height: 160, objectFit: 'cover', borderRadius: 2 }} />
                  : 'No portrait available'
              }
              placement="left"
              overlayInnerStyle={{ padding: 4, background: '#0a0f0f', border: '1px solid #4a6b6b' }}
            >
              <Text style={{ fontSize: 12, cursor: 'default', flex: 1, opacity: isMet ? 1 : 0.55 }}>{npc.name}</Text>
            </Tooltip>
            <div style={{ display: 'flex', gap: 4 }}>
              <Tooltip title={isMet ? 'Players have met this NPC (shown in their Personnel)' : 'Hidden from players'}>
                <Button
                  size="small"
                  loading={pending[npc.id]}
                  type={isMet ? 'primary' : 'default'}
                  style={isMet ? { background: '#4a6b6b', borderColor: '#4a6b6b' } : {}}
                  onClick={() => handleToggleMet(npc)}
                >
                  {isMet ? 'MET' : 'UNMET'}
                </Button>
              </Tooltip>
              <Button
                size="small"
                type={isPortraitActive ? 'primary' : 'default'}
                style={isPortraitActive ? { background: '#8b7355', borderColor: '#8b7355' } : {}}
                onClick={() => onToggle(npc.id)}
              >
                {isPortraitActive ? 'DISMISS' : 'SHOW'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
