import type { ActiveView } from '@/types/gmConsole';
import type { TokenState, EncounterMapData, GridEncounterMapData, RoomVisibilityState } from '@/types/encounterMap';
import { TokenPalette } from '../TokenPalette';

interface TokenPalettePanelProps {
  activeView: ActiveView | null;
  tokens: TokenState;
  onTokensChange: (tokens: TokenState) => void;
  mapData: EncounterMapData | GridEncounterMapData | null;
  roomVisibility: RoomVisibilityState;
}

export function TokenPalettePanel({
  activeView,
  tokens,
  onTokensChange,
  mapData,
  roomVisibility,
}: TokenPalettePanelProps) {
  return (
    <TokenPalette
      activeView={activeView}
      tokens={tokens}
      onTokensChange={onTokensChange}
      onViewUpdate={() => {}}
      mapData={mapData}
      roomVisibility={roomVisibility}
    />
  );
}
