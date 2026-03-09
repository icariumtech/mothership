import { Button, Typography } from 'antd';
import type { NpcPortraitData } from '@/types/gmConsole';

const { Text } = Typography;

interface NpcPortraitsPanelProps {
  npcs: NpcPortraitData[];
  activePortraits: string[];
  onToggle: (npcId: string) => void;
}

export function NpcPortraitsPanel({ npcs, activePortraits, onToggle }: NpcPortraitsPanelProps) {
  if (npcs.length === 0) {
    return <Text type="secondary" style={{ fontSize: 11 }}>No NPCs in campaign data</Text>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {npcs.map(npc => {
        const isPortraitActive = activePortraits.includes(npc.id);
        return (
          <div
            key={npc.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ fontSize: 12 }}>{npc.name}</Text>
            <Button
              size="small"
              type={isPortraitActive ? 'primary' : 'default'}
              style={isPortraitActive ? { background: '#8b7355', borderColor: '#8b7355' } : {}}
              onClick={() => onToggle(npc.id)}
            >
              {isPortraitActive ? 'DISMISS' : 'SHOW'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
