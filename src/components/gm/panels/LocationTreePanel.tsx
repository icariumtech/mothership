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
    />
  );
}
