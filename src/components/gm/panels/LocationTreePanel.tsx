import type { Location } from '@/types/gmConsole';
import { LocationTree } from '../LocationTree';

interface LocationTreePanelProps {
  locations: Location[];
  selectedLocationSlug: string | null;
  activeTerminalLocationSlug: string | null;
  activeTerminalSlug: string | null;
  expandedNodes: Set<string>;
  onToggleNode: (key: string) => void;
  onSelectLocation: (slug: string | null) => void;
  onShowTerminal: (locationSlug: string, terminalSlug: string) => void;
  selectionEnabled?: boolean;
  onSetShipLocation?: (slug: string) => void;
  shipLocationSlug?: string | null;
  shipName?: string;
  shipSlug?: string | null;
}

export function LocationTreePanel({
  locations,
  selectedLocationSlug,
  activeTerminalLocationSlug,
  activeTerminalSlug,
  expandedNodes,
  onToggleNode,
  onSelectLocation,
  onShowTerminal,
  selectionEnabled = true,
  onSetShipLocation,
  shipLocationSlug,
  shipName,
  shipSlug,
}: LocationTreePanelProps) {
  return (
    <LocationTree
      locations={locations}
      selectedLocationSlug={selectedLocationSlug}
      activeTerminalLocationSlug={activeTerminalLocationSlug}
      activeTerminalSlug={activeTerminalSlug}
      expandedNodes={expandedNodes}
      onToggle={onToggleNode}
      onSelectLocation={onSelectLocation}
      onShowTerminal={onShowTerminal}
      selectionEnabled={selectionEnabled}
      onSetShipLocation={onSetShipLocation}
      shipLocationSlug={shipLocationSlug}
      shipName={shipName}
      shipSlug={shipSlug}
    />
  );
}
