import { Button, Typography, Tooltip } from 'antd';
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
            <Tooltip
              title={
                npc.portrait
                  ? <img src={npc.portrait} alt={npc.name} style={{ width: 120, height: 160, objectFit: 'cover', borderRadius: 2 }} />
                  : 'No portrait available'
              }
              placement="left"
              overlayInnerStyle={{ padding: 4, background: '#0a0f0f', border: '1px solid #4a6b6b' }}
            >
              <Text style={{ fontSize: 12, cursor: 'default' }}>{npc.name}</Text>
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
        );
      })}
    </div>
  );
}
