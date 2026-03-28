import { useState, useCallback, useMemo } from 'react';
import { RobotOutlined, UserOutlined, FileTextOutlined } from '@ant-design/icons';
import { ToolRail } from '@/components/gm/layout/ToolRail';
import { SlideOutPanel } from '@/components/gm/layout/SlideOutPanel';
import { CharonPanel } from '@/components/gm/CharonPanel';
import { NpcPortraitsPanel } from '@/components/gm/panels/NpcPortraitsPanel';
import { DocumentsPanel } from '@/components/gm/panels/DocumentsPanel';
import { NPCPortraitOverlay } from '@/components/domain/encounter/NPCPortraitOverlay';
import { encounterApi } from '@/services/encounterApi';
import type { ActiveView } from '@/types/gmConsole';
import './StandbyView.css';

interface StandbyViewProps {
  activeView: ActiveView | null;
  charonChannel: string;
  charonDialogOpen: boolean;
  onDialogToggle: () => void;
}

const STANDBY_TOOLS = [
  { key: 'portraits', icon: <UserOutlined />, tooltip: 'NPC Portraits' },
  { key: 'documents', icon: <FileTextOutlined />, tooltip: 'Documents' },
  { key: 'charon', icon: <RobotOutlined />, tooltip: 'CHARON' },
];

export function StandbyView({ activeView, charonChannel, charonDialogOpen, onDialogToggle }: StandbyViewProps) {
  const [activePanel, setActivePanel] = useState<string | null>(null);

  const handleToggle = useCallback((key: string) => {
    setActivePanel(prev => prev === key ? null : key);
  }, []);

  const closePanel = useCallback(() => setActivePanel(null), []);

  const handleTogglePortrait = useCallback(async (npcId: string) => {
    try {
      await encounterApi.togglePortrait(npcId);
    } catch (err) {
      console.error('Error toggling portrait:', err);
    }
  }, []);

  const npcs = useMemo(
    () => Object.values(activeView?.encounter_npc_data || {}),
    [activeView?.encounter_npc_data]
  );

  const activePortraitIds = activeView?.encounter_active_portraits || [];
  const npcData = activeView?.encounter_npc_data || {};

  return (
    <div className="gm-standby-view">
      <div className="gm-standby-view__content">
        <div className="gm-standby-view__label">STANDBY</div>
        <div className="gm-standby-view__hint">Select a view from the rail to begin</div>
      </div>

      {/* Portrait overlay — contained within content area, right:48px keeps it clear of the tool rail */}
      <div className="gm-standby-view__overlay-trap">
        <NPCPortraitOverlay activePortraitIds={activePortraitIds} npcData={npcData} />
      </div>

      <div className="gm-standby-view__right">
        <ToolRail tools={STANDBY_TOOLS} activePanel={activePanel} onToggle={handleToggle} />

        <SlideOutPanel open={activePanel === 'portraits'} title="NPC Portraits" onClose={closePanel}>
          <NpcPortraitsPanel
            npcs={npcs}
            activePortraits={activePortraitIds}
            onToggle={handleTogglePortrait}
          />
        </SlideOutPanel>

        <SlideOutPanel open={activePanel === 'documents'} title="Documents" onClose={closePanel}>
          <DocumentsPanel activeDocSlug={activeView?.overlay_doc_slug || ''} />
        </SlideOutPanel>

        <SlideOutPanel open={activePanel === 'charon'} title="CHARON" onClose={closePanel}>
          <CharonPanel
            channel={charonChannel}
            currentViewType="STANDBY"
            charonDialogOpen={charonDialogOpen}
            onDialogToggle={onDialogToggle}
          />
        </SlideOutPanel>
      </div>
    </div>
  );
}
