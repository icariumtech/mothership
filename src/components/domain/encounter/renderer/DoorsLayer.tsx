/**
 * DoorsLayer - Renders the canonical Door[] for a deck: visibility gating
 * (players only see doors adjacent to a visible room), orientation +
 * style resolution, then composes DoorSymbol per door.
 * Extracted from EncounterMapRenderer's inline door-rendering <g> block.
 */
import { Door, DoorStatus, GridRoom, RoomVisibilityState } from '../../../../types/encounterMap';
import { MapView } from '../geometry/mapView';
import { doorEndpoints } from '../geometry/roomGeometry';
import { playerDoorVisible } from '../doors/doorVisibility';
import { DoorSymbol } from './DoorSymbol';
import { CONNECTION_STYLES } from './mapColors';

interface DoorsLayerProps {
  doors: Door[];
  isGM: boolean;
  roomVisibility?: RoomVisibilityState;
  rooms: GridRoom[];
  findRoomAtCell: (gridX: number, gridY: number) => GridRoom | null;
  isRoomVisible: (roomId: string) => boolean;
  view: MapView;
  getEffectiveDoorStatus: (door: Door) => DoorStatus;
  /** Pre-gated by the caller (e.g. `isGM && onDoorStatusChange ? handleDoorClick : undefined`) —
   *  DoorsLayer just binds it per-door; it does not re-derive the gate itself. */
  onDoorContextMenu?: (e: React.MouseEvent, door: Door) => void;
  /** Click-to-jump (editor preview) — any user left-click on a door. */
  onDoorClick?: (doorId: string) => void;
}

export function DoorsLayer({
  doors,
  isGM,
  roomVisibility,
  rooms,
  findRoomAtCell,
  isRoomVisible,
  view,
  getEffectiveDoorStatus,
  onDoorContextMenu,
  onDoorClick,
}: DoorsLayerProps) {
  return (
    <g className="encounter-map__doors">
      {doors.map((door) => {
        // Visibility: door is shown when any of its endpoint rooms is visible
        // (or, for legacy single-room doors, when the cell on the other side
        // belongs to a visible room).
        if (!isGM) {
          // Common path: delegate to shared predicate (also used in tests).
          const visible = roomVisibility
            ? playerDoorVisible(door, roomVisibility)
            : true;
          if (!visible) {
            if (door.roomB === null) {
              // Legacy adapter emits exterior-style doors when the YAML
              // has only one-room nesting; spatial fallback decides if
              // the other side is a visible room/corridor.
              const [aCell, otherCell] = doorEndpoints(door, rooms);
              const candidates = otherCell ? [aCell, otherCell] : [aCell];
              const otherSideVisible = candidates.some(cell => {
                const adj = findRoomAtCell(cell.gx, cell.gy);
                return adj && adj.id !== door.roomA && isRoomVisible(adj.id);
              });
              if (!otherSideVisible) return null;
            } else {
              return null;
            }
          }
        }
        const svgPos = view.doorPosition(door);
        const orientation: 'horizontal' | 'vertical' =
          Math.abs((door.angle % 180 + 180) % 180 - 90) < 45 ? 'vertical' : 'horizontal';
        const styleEntry = CONNECTION_STYLES[door.type] || CONNECTION_STYLES.standard;
        const contextMenuHandler = onDoorContextMenu
          ? (e: React.MouseEvent) => onDoorContextMenu(e, door)
          : undefined;
        const clickHandler = onDoorClick
          ? (e: React.MouseEvent) => { e.stopPropagation(); onDoorClick(door.id); }
          : undefined;
        return (
          <DoorSymbol
            key={`door-${door.id}`}
            x={svgPos.x}
            y={svgPos.y}
            doorType={door.type}
            doorStatus={getEffectiveDoorStatus(door)}
            style={styleEntry}
            orientation={orientation}
            onContextMenuHandler={contextMenuHandler}
            widthCells={door.width ?? 1}
            onClickHandler={clickHandler}
          />
        );
      })}
    </g>
  );
}
