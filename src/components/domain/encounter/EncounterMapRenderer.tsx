/**
 * EncounterMapRenderer - SVG renderer for grid-based encounter maps
 *
 * Renders GridEncounterMapData: rooms as touching wall-aligned rectangles,
 * wall-segment algorithm for exterior walls, scanline floor texture,
 * faint background grid, and GM right-click context menu for room visibility.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { message } from 'antd';
import {
  GridEncounterMapData,
  GridRoom,
  GridRect,
  DoorDef,
  DoorStatus,
  DoorStatusState,
  RoomVisibilityState,
  TokenState,
  TokenStatus,
  TokenType,
} from '../../../types/encounterMap';
import { getGridCell } from '../../../utils/svgCoordinates';
import { ENCOUNTER_ICONS, iconSymbolId } from './EncounterIcons';
import { LegendPanel } from './LegendPanel';
import { LevelIndicator } from './LevelIndicator';
import { TokenLayer, tokenTouchActive } from './TokenLayer';
import { TokenPopup } from './TokenPopup';
import { RoomContextMenu } from './RoomContextMenu';
import { DoorStatusPopup } from '../../gm/DoorStatusPopup';
import './EncounterMapRenderer.css';

interface EncounterMapRendererProps {
  mapData: GridEncounterMapData;
  roomVisibility?: RoomVisibilityState;
  /** Current deck level (1-indexed) for multi-deck maps */
  currentLevel?: number;
  /** Total number of decks */
  totalLevels?: number;
  /** Current deck name */
  deckName?: string;
  /** Token state */
  tokens?: TokenState;
  /** Is this a GM view? */
  isGM?: boolean;
  /** Callback when GM toggles room visibility */
  onRoomToggle?: (roomId: string, visible: boolean) => void;
  /** Door status overrides from GM */
  doorStatus?: DoorStatusState;
  /** Callback when GM changes door status */
  onDoorStatusChange?: (doorId: string, status: DoorStatus) => void;
  /** Token callbacks */
  onTokenPlace?: (type: TokenType, name: string, x: number, y: number, imageUrl: string, roomId: string) => void;
  onTokenMove?: (id: string, x: number, y: number) => void;
  onTokenRemove?: (id: string) => void;
  onTokenStatusToggle?: (id: string, status: TokenStatus) => void;
  /** Optional style override for the root container div (e.g. position:absolute when embedded in MapPreview) */
  style?: React.CSSProperties;
}

// Pan and zoom state
interface ViewState {
  panX: number;
  panY: number;
  zoom: number;
}

// V2-1 Color palette
const COLORS = {
  bgPrimary: '#0a0a0a',
  bgRoom: '#0f1515',
  borderMain: '#4a6b6b',
  borderSubtle: '#2a3a3a',
  teal: '#4a6b6b',
  tealBright: '#5a7a7a',
  amber: '#8b7355',
  amberBright: '#9a8065',
  textPrimary: '#9a9a9a',
  textMuted: '#5a5a5a',
  hazard: '#8b5555',
  warning: '#8b7355',
  pathLine: '#3a5a5a',
};

// Connection/door type styles
const CONNECTION_STYLES: Record<string, { stroke: string; doorFill: string }> = {
  standard: { stroke: COLORS.pathLine, doorFill: COLORS.teal },
  airlock: { stroke: COLORS.pathLine, doorFill: COLORS.amber },
  blast_door: { stroke: COLORS.pathLine, doorFill: COLORS.tealBright },
  emergency: { stroke: COLORS.pathLine, doorFill: COLORS.hazard },
  open: { stroke: COLORS.pathLine, doorFill: COLORS.teal },
};

// Zoom limits
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

// -------------------------------------------------------------------
// Wall-segment edge type
// -------------------------------------------------------------------
interface Edge { x1: number; y1: number; x2: number; y2: number; }

// -------------------------------------------------------------------
// computeBoundingBox — derive SVG canvas from room geometry
// Always computed from ALL rooms (visible and hidden) so the canvas
// doesn't shift when rooms are revealed/hidden.
// -------------------------------------------------------------------
function computeBoundingBox(rooms: GridRoom[], us: number, padding = 2) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const room of rooms) {
    for (const rect of room.rects) {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.w);
      maxY = Math.max(maxY, rect.y + rect.h);
    }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 10; maxY = 10; }
  return {
    originX: (minX - padding) * us,
    originY: (minY - padding) * us,
    svgWidth: (maxX - minX + padding * 2) * us,
    svgHeight: (maxY - minY + padding * 2) * us,
  };
}

// -------------------------------------------------------------------
// computeRoomWalls — wall-segment algorithm
// Count cell-edge occurrences; edges that appear exactly once are
// exterior wall segments (adjacent-room shared edges appear twice).
// -------------------------------------------------------------------
function computeRoomWalls(rects: GridRect[], us: number): Edge[] {
  const edgeCounts = new Map<string, number>();
  const addEdges = (rect: GridRect) => {
    for (let cx = rect.x; cx < rect.x + rect.w; cx++) {
      const top = `H:${cx}:${rect.y}`;
      const bot = `H:${cx}:${rect.y + rect.h}`;
      edgeCounts.set(top, (edgeCounts.get(top) || 0) + 1);
      edgeCounts.set(bot, (edgeCounts.get(bot) || 0) + 1);
    }
    for (let cy = rect.y; cy < rect.y + rect.h; cy++) {
      const left = `V:${rect.x}:${cy}`;
      const right = `V:${rect.x + rect.w}:${cy}`;
      edgeCounts.set(left, (edgeCounts.get(left) || 0) + 1);
      edgeCounts.set(right, (edgeCounts.get(right) || 0) + 1);
    }
  };
  for (const rect of rects) addEdges(rect);
  const walls: Edge[] = [];
  for (const [key, count] of edgeCounts) {
    if (count !== 1) continue;
    const [orient, gxStr, gyStr] = key.split(':');
    const gx = parseInt(gxStr), gy = parseInt(gyStr);
    if (orient === 'H') {
      walls.push({ x1: gx * us, y1: gy * us, x2: (gx + 1) * us, y2: gy * us });
    } else {
      walls.push({ x1: gx * us, y1: gy * us, x2: gx * us, y2: (gy + 1) * us });
    }
  }
  return walls;
}

// -------------------------------------------------------------------
// getRoomLabelPosition — center of the bounding box of all room rects
// -------------------------------------------------------------------
function getRoomLabelPosition(rects: GridRect[], us: number): { x: number; y: number } {
  const minX = Math.min(...rects.map(r => r.x));
  const minY = Math.min(...rects.map(r => r.y));
  const maxX = Math.max(...rects.map(r => r.x + r.w));
  const maxY = Math.max(...rects.map(r => r.y + r.h));
  return { x: ((minX + maxX) / 2) * us, y: ((minY + maxY) / 2) * us };
}

// -------------------------------------------------------------------
// getAdjacentCellForDoor — returns the grid cell on the other side of a door
// Used to determine if a door should be shown when the adjacent room is visible.
// -------------------------------------------------------------------
function getAdjacentCellForDoor(rects: GridRect[], door: DoorDef): { x: number; y: number } {
  if (door.wall === 'north') {
    const minY = Math.min(...rects.map(r => r.y));
    const wallRects = rects.filter(r => r.y === minY);
    const cells = wallRects.flatMap(r => Array.from({ length: r.w }, (_, i) => r.x + i)).sort((a, b) => a - b);
    const cellX = cells[door.position] ?? cells[0] ?? 0;
    return { x: cellX, y: minY - 1 };
  } else if (door.wall === 'south') {
    const maxY = Math.max(...rects.map(r => r.y + r.h));
    const wallRects = rects.filter(r => r.y + r.h === maxY);
    const cells = wallRects.flatMap(r => Array.from({ length: r.w }, (_, i) => r.x + i)).sort((a, b) => a - b);
    const cellX = cells[door.position] ?? cells[0] ?? 0;
    return { x: cellX, y: maxY };
  } else if (door.wall === 'west') {
    const minX = Math.min(...rects.map(r => r.x));
    const wallRects = rects.filter(r => r.x === minX);
    const cells = wallRects.flatMap(r => Array.from({ length: r.h }, (_, i) => r.y + i)).sort((a, b) => a - b);
    const cellY = cells[door.position] ?? cells[0] ?? 0;
    return { x: minX - 1, y: cellY };
  } else { // east
    const maxX = Math.max(...rects.map(r => r.x + r.w));
    const wallRects = rects.filter(r => r.x + r.w === maxX);
    const cells = wallRects.flatMap(r => Array.from({ length: r.h }, (_, i) => r.y + i)).sort((a, b) => a - b);
    const cellY = cells[door.position] ?? cells[0] ?? 0;
    return { x: maxX, y: cellY };
  }
}

// -------------------------------------------------------------------
// getDoorSVGPosition — map wall+position index to SVG coordinates
// -------------------------------------------------------------------
function getDoorSVGPosition(
  rects: GridRect[], door: DoorDef, us: number
): { x: number; y: number; orientation: 'horizontal' | 'vertical' } {
  if (door.wall === 'north' || door.wall === 'south') {
    const targetY = door.wall === 'north'
      ? Math.min(...rects.map(r => r.y))
      : Math.max(...rects.map(r => r.y + r.h));
    const wallY = targetY * us;
    const wallRects = rects.filter(r =>
      door.wall === 'north' ? r.y === targetY : r.y + r.h === targetY
    );
    const cells = wallRects.flatMap(r =>
      Array.from({ length: r.w }, (_, i) => r.x + i)
    ).sort((a, b) => a - b);
    const cellX = cells[door.position] ?? cells[0] ?? 0;
    return { x: (cellX + 0.5) * us, y: wallY, orientation: 'horizontal' };
  } else {
    const targetX = door.wall === 'west'
      ? Math.min(...rects.map(r => r.x))
      : Math.max(...rects.map(r => r.x + r.w));
    const wallX = targetX * us;
    const wallRects = rects.filter(r =>
      door.wall === 'west' ? r.x === targetX : r.x + r.w === targetX
    );
    const cells = wallRects.flatMap(r =>
      Array.from({ length: r.h }, (_, i) => r.y + i)
    ).sort((a, b) => a - b);
    const cellY = cells[door.position] ?? cells[0] ?? 0;
    return { x: wallX, y: (cellY + 0.5) * us, orientation: 'vertical' };
  }
}

export function EncounterMapRenderer({
  mapData,
  roomVisibility,
  currentLevel = 1,
  totalLevels = 1,
  deckName,
  tokens,
  isGM = false,
  onRoomToggle,
  doorStatus,
  onDoorStatusChange,
  onTokenPlace,
  onTokenMove,
  onTokenRemove,
  onTokenStatusToggle,
  style,
}: EncounterMapRendererProps) {
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedTokenPos, setSelectedTokenPos] = useState<{ x: number; y: number } | null>(null);

  // Door popup state
  const [selectedDoor, setSelectedDoor] = useState<{
    id: string;
    x: number;
    y: number;
    status: DoorStatus;
  } | null>(null);

  // POI hover popup state
  const [poiPopup, setPoiPopup] = useState<{
    poi: import('../../../types/encounterMap').PoiData;
    x: number;
    y: number;
  } | null>(null);

  // Room context menu state
  const [contextMenu, setContextMenu] = useState<{
    room: GridRoom;
    x: number;
    y: number;
  } | null>(null);

  // Pan and zoom state
  const [viewState, setViewState] = useState<ViewState>({
    panX: 0,
    panY: 0,
    zoom: 1,
  });

  // Refs for drag tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewStart = useRef({ panX: 0, panY: 0 });

  // Touch gesture refs
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  // SVG dimensions — always computed from ALL rooms (never filtered by visibility)
  const unitSize = mapData.unit_size ?? 40;
  const { originX, originY, svgWidth, svgHeight } = useMemo(
    () => computeBoundingBox(mapData.rooms, unitSize),
    [mapData.rooms, unitSize]
  );

  // Check if a room is visible (default to true if no visibility state)
  const isRoomVisible = useCallback((roomId: string): boolean => {
    if (!roomVisibility) return true;
    return roomVisibility[roomId] !== false;
  }, [roomVisibility]);

  // -------------------------------------------------------------------
  // Get effective door status: runtime override > YAML default
  // -------------------------------------------------------------------
  const getEffectiveDoorStatus = useCallback((room: GridRoom, doorIndex: number): DoorStatus => {
    const id = `${room.id}_door_${doorIndex}`;
    return (doorStatus?.[id] as DoorStatus) || (room.doors?.[doorIndex]?.status as DoorStatus) || 'CLOSED';
  }, [doorStatus]);

  // -------------------------------------------------------------------
  // Find room containing a grid cell
  // -------------------------------------------------------------------
  const findRoomAtCell = useCallback((gridX: number, gridY: number): GridRoom | null => {
    return mapData.rooms.find(room =>
      room.rects.some(r => gridX >= r.x && gridX < r.x + r.w && gridY >= r.y && gridY < r.y + r.h)
    ) ?? null;
  }, [mapData.rooms]);

  // -------------------------------------------------------------------
  // Check if a grid cell is occupied by a token
  // -------------------------------------------------------------------
  const isCellOccupied = useCallback((gridX: number, gridY: number): boolean => {
    if (!tokens) return false;
    return Object.values(tokens).some(t => t.x === gridX && t.y === gridY);
  }, [tokens]);

  // -------------------------------------------------------------------
  // Door right-click handler — opens DoorStatusPopup at cursor position
  // -------------------------------------------------------------------
  const handleDoorClick = useCallback((
    e: React.MouseEvent,
    room: GridRoom,
    doorIndex: number,
  ) => {
    if (!isGM || !onDoorStatusChange) return;
    e.stopPropagation();
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const id = `${room.id}_door_${doorIndex}`;
    setSelectedDoor({
      id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      status: getEffectiveDoorStatus(room, doorIndex),
    });
  }, [isGM, onDoorStatusChange, getEffectiveDoorStatus]);

  // -------------------------------------------------------------------
  // Room right-click handler — opens context menu
  // -------------------------------------------------------------------
  const handleRoomContextMenu = useCallback((e: React.MouseEvent, room: GridRoom) => {
    if (!isGM) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    setContextMenu({
      room,
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
    });
  }, [isGM]);

  // -------------------------------------------------------------------
  // Token drag-and-drop handlers
  // -------------------------------------------------------------------
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isGM || !onTokenPlace) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, [isGM, onTokenPlace]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!isGM || !onTokenPlace || !svgRef.current) return;
    e.preventDefault();

    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    let template: { type: TokenType; name: string; imageUrl: string };
    try {
      template = JSON.parse(dataStr);
    } catch {
      return;
    }

    const { gridX, gridY } = getGridCell(svgRef.current, e.clientX, e.clientY, unitSize);

    if (isCellOccupied(gridX, gridY)) {
      message.warning('Cell is already occupied by another token');
      return;
    }

    const room = findRoomAtCell(gridX, gridY);
    if (!room) {
      message.warning('Token can only be placed inside a room');
      return;
    }

    onTokenPlace(template.type, template.name, gridX, gridY, template.imageUrl || '', room.id);
  }, [isGM, onTokenPlace, unitSize, isCellOccupied, findRoomAtCell]);

  // -------------------------------------------------------------------
  // Render a door symbol at a specific SVG position
  // -------------------------------------------------------------------
  const renderDoorSymbol = (
    x: number,
    y: number,
    doorType: string,
    doorStatus: string | undefined,
    style: { stroke: string; doorFill: string },
    orientation: 'horizontal' | 'vertical',
    key: string,
    onContextMenuHandler?: (e: React.MouseEvent) => void
  ) => {
    const doorWidth = orientation === 'horizontal' ? 20 : 12;
    const doorHeight = orientation === 'horizontal' ? 12 : 20;
    const isOpen = doorStatus === 'OPEN';
    const isDamaged = doorStatus === 'DAMAGED';
    const isLocked = doorStatus === 'LOCKED';
    const isSealed = doorStatus === 'SEALED';

    const statusClass = doorStatus ? `encounter-map__door--${doorStatus.toLowerCase()}` : '';

    const splitOffset = orientation === 'horizontal' ? doorWidth * 0.55 : doorHeight * 0.55;

    const openTransformLeft = orientation === 'horizontal'
      ? `translateX(-${splitOffset}px)`
      : `translateY(-${splitOffset}px)`;
    const openTransformRight = orientation === 'horizontal'
      ? `translateX(${splitOffset}px)`
      : `translateY(${splitOffset}px)`;

    const doorFill = isDamaged ? COLORS.hazard : style.doorFill;
    const doorStroke = isLocked ? COLORS.amber : isSealed ? COLORS.hazard : COLORS.borderMain;
    const doorStrokeWidth = isLocked ? 2 : isSealed ? 2.5 : 1.5;

    return (
      <g
        key={key}
        className={`encounter-map__door encounter-map__door--${doorType} ${statusClass}`}
        onContextMenu={onContextMenuHandler}
        style={{ cursor: onContextMenuHandler ? 'context-menu' : 'default' }}
      >
        {/* Opaque background to cover wall lines behind door */}
        <rect
          x={x - doorWidth / 2 + 1}
          y={y - doorHeight / 2 + 1}
          width={doorWidth - 2}
          height={doorHeight - 2}
          fill={COLORS.bgPrimary}
          stroke="none"
        />
        {/* Door frame/gap indicator - always present, visible when open */}
        <rect
          x={x - doorWidth / 2}
          y={y - doorHeight / 2}
          width={doorWidth}
          height={doorHeight}
          fill={COLORS.bgPrimary}
          stroke={COLORS.borderSubtle}
          strokeWidth={1}
          strokeDasharray="2 2"
          className="encounter-map__door-frame"
          style={{ opacity: isOpen ? 1 : 0 }}
        />

        {/* First door half */}
        <rect
          x={x - doorWidth / 2}
          y={y - doorHeight / 2}
          width={orientation === 'horizontal' ? doorWidth / 2 : doorWidth}
          height={orientation === 'horizontal' ? doorHeight : doorHeight / 2}
          fill={doorFill}
          stroke={doorStroke}
          strokeWidth={doorStrokeWidth}
          className="encounter-map__door-half encounter-map__door-half--left"
          style={{
            transform: isOpen ? openTransformLeft : 'translate(0, 0)',
          }}
        />

        {/* Second door half */}
        <rect
          x={orientation === 'horizontal' ? x : x - doorWidth / 2}
          y={orientation === 'horizontal' ? y - doorHeight / 2 : y}
          width={orientation === 'horizontal' ? doorWidth / 2 : doorWidth}
          height={orientation === 'horizontal' ? doorHeight : doorHeight / 2}
          fill={doorFill}
          stroke={doorStroke}
          strokeWidth={doorStrokeWidth}
          className="encounter-map__door-half encounter-map__door-half--right"
          style={{
            transform: isOpen ? openTransformRight : 'translate(0, 0)',
          }}
        />

        {/* DAMAGED: Crack lines overlay */}
        {isDamaged && !isOpen && (
          <g className="encounter-map__door-damage">
            <path
              d={orientation === 'horizontal'
                ? `M${x - doorWidth / 2 + 2},${y - doorHeight / 2 + 2}
                   L${x - 2},${y}
                   L${x + doorWidth / 2 - 2},${y + doorHeight / 2 - 2}`
                : `M${x - doorWidth / 2 + 2},${y - doorHeight / 2 + 2}
                   L${x},${y - 2}
                   L${x + doorWidth / 2 - 2},${y + doorHeight / 2 - 2}`
              }
              fill="none"
              stroke={COLORS.bgPrimary}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <path
              d={orientation === 'horizontal'
                ? `M${x + 3},${y - doorHeight / 2 + 1} L${x + 1},${y - 2}`
                : `M${x + doorWidth / 2 - 1},${y - 3} L${x + 2},${y - 1}`
              }
              fill="none"
              stroke={COLORS.bgPrimary}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            <circle
              cx={x - 2}
              cy={y}
              r={1.5}
              fill={COLORS.amber}
              className="encounter-map__door-spark"
            />
          </g>
        )}

        {/* LOCKED: Lock indicator */}
        {isLocked && !isOpen && (
          <g className="encounter-map__door-lock">
            <rect
              x={orientation === 'horizontal' ? x - 4 : x - 5}
              y={y - 5}
              width={orientation === 'horizontal' ? 8 : 10}
              height={orientation === 'horizontal' ? 10 : 12}
              fill={doorFill}
              stroke="none"
            />
            <circle
              cx={x}
              cy={y - 2}
              r={2.5}
              fill={COLORS.bgPrimary}
              stroke={COLORS.amber}
              strokeWidth={1}
            />
            <rect
              x={x - 1.5}
              y={y}
              width={3}
              height={4}
              fill={COLORS.bgPrimary}
              stroke={COLORS.amber}
              strokeWidth={1}
            />
          </g>
        )}

        {/* SEALED: Heavy duty indicator */}
        {isSealed && !isOpen && (
          <g className="encounter-map__door-seal">
            <rect
              x={x - doorWidth / 2 + 3}
              y={y - doorHeight / 2 + 3}
              width={doorWidth - 6}
              height={doorHeight - 6}
              fill="none"
              stroke={COLORS.hazard}
              strokeWidth={1}
            />
            <line
              x1={x - doorWidth / 2 + 2}
              y1={y}
              x2={x + doorWidth / 2 - 2}
              y2={y}
              stroke={COLORS.bgPrimary}
              strokeWidth={2}
            />
          </g>
        )}

        {/* Door type indicators (only for non-open doors) */}
        {!isOpen && (
          <>
            {/* Airlock double rectangle */}
            {doorType === 'airlock' && !isLocked && !isSealed && (
              <rect
                x={x - doorWidth / 2 + 2}
                y={y - doorHeight / 2 + 2}
                width={doorWidth - 4}
                height={doorHeight - 4}
                fill="none"
                stroke={COLORS.bgPrimary}
                strokeWidth={1}
              />
            )}
            {/* Blast door X */}
            {doorType === 'blast_door' && !isLocked && !isSealed && !isDamaged && (
              <>
                <line
                  x1={x - doorWidth / 2 + 2}
                  y1={y - doorHeight / 2 + 2}
                  x2={x + doorWidth / 2 - 2}
                  y2={y + doorHeight / 2 - 2}
                  stroke={COLORS.bgPrimary}
                  strokeWidth={1}
                />
                <line
                  x1={x + doorWidth / 2 - 2}
                  y1={y - doorHeight / 2 + 2}
                  x2={x - doorWidth / 2 + 2}
                  y2={y + doorHeight / 2 - 2}
                  stroke={COLORS.bgPrimary}
                  strokeWidth={1}
                />
              </>
            )}
          </>
        )}
      </g>
    );
  };

  // -------------------------------------------------------------------
  // renderRoom — floor fill + exterior walls + GM context menu targets + label
  // -------------------------------------------------------------------
  const renderRoom = (room: GridRoom) => {
    const visible = isRoomVisible(room.id);
    // Players only see revealed rooms
    if (!isGM && !visible) return null;
    const roomOpacity = isGM && !visible ? 0.25 : 1.0;
    const walls = computeRoomWalls(room.rects, unitSize);
    const label = room.name ? getRoomLabelPosition(room.rects, unitSize) : null;

    return (
      <g key={room.id} className="encounter-map__room-group" opacity={roomOpacity}>
        {/* Floor fill — solid dark teal matching old encounter map style */}
        {room.rects.map((rect, i) => (
          <rect
            key={`floor-${i}`}
            x={rect.x * unitSize}
            y={rect.y * unitSize}
            width={rect.w * unitSize}
            height={rect.h * unitSize}
            fill="#1a2525"
            className="encounter-map__floor"
          />
        ))}

        {/* Exterior wall segments — teal lines */}
        {walls.map((wall, i) => (
          <line
            key={`wall-${i}`}
            x1={wall.x1} y1={wall.y1}
            x2={wall.x2} y2={wall.y2}
            stroke="#4a6b6b"
            strokeWidth={1.5}
            strokeLinecap="square"
            className="encounter-map__wall"
          />
        ))}

        {/* Invisible hit targets — GM only, right-click for context menu */}
        {isGM && room.rects.map((rect, i) => (
          <rect
            key={`hit-${i}`}
            x={rect.x * unitSize}
            y={rect.y * unitSize}
            width={rect.w * unitSize}
            height={rect.h * unitSize}
            fill="transparent"
            style={{ cursor: isGM ? 'context-menu' : 'default' }}
            onContextMenu={(e) => handleRoomContextMenu(e, room)}
            className="encounter-map__room"
          />
        ))}

        {/* Room label — centered, only for named rooms; visible to players only when revealed */}
        {label && (isGM || visible) && (
          <text
            x={label.x}
            y={label.y}
            className="encounter-map__room-label"
            fill="#8b7355"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {room.name}
          </text>
        )}
      </g>
    );
  };

  // -------------------------------------------------------------------
  // renderPoi — SVG vector icon + label for a point of interest
  // Icons sourced from @ant-design/icons-svg, colorized via fill on <use>
  // -------------------------------------------------------------------
  const renderPoi = (poi: import('../../../types/encounterMap').PoiData) => {
    if (!isGM && !isRoomVisible(poi.room)) return null;

    const cx = poi.position.x * unitSize;
    const cy = poi.position.y * unitSize;

    // Resolve icon: prefer poi.icon name, fall back to poi.type
    const iconName = ENCOUNTER_ICONS[poi.icon] ? poi.icon
      : ENCOUNTER_ICONS[poi.type] ? poi.type
      : null;

    // Color by type; currentColor in symbols inherits this via CSS `color`
    const poiColor =
      poi.type === 'hazard'    ? COLORS.hazard :
      poi.type === 'objective' ? COLORS.amber :
      poi.type === 'item'      ? COLORS.tealBright :
      COLORS.teal;

    const opacity = isGM && !isRoomVisible(poi.room) ? 0.3 : 1.0;
    const iconSize = 20;
    const half = iconSize / 2;

    const handlePoiHover = (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPoiPopup({ poi, x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    return (
      <g
        key={poi.id}
        className={`encounter-map__poi encounter-map__poi--${poi.type}`}
        opacity={opacity}
        style={{ color: poiColor, cursor: 'pointer' }}
        onMouseEnter={handlePoiHover}
        onMouseLeave={() => setPoiPopup(null)}
        onClick={handlePoiHover}
      >
        {iconName ? (
          <use
            href={`#${iconSymbolId(iconName)}`}
            x={cx - half}
            y={cy - half}
            width={iconSize}
            height={iconSize}
          />
        ) : (
          <path
            d={`M${cx},${cy - half} L${cx + half},${cy} L${cx},${cy + half} L${cx - half},${cy} Z`}
            fill={poiColor}
          />
        )}
        {/* Transparent hit target so hover works on the full icon area */}
        <rect
          x={cx - half}
          y={cy - half}
          width={iconSize}
          height={iconSize}
          fill="transparent"
        />
      </g>
    );
  };

  // -------------------------------------------------------------------
  // Pan/zoom handlers
  // -------------------------------------------------------------------

  // Wheel zoom handler — attached as native listener with { passive: false }
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;

    setViewState((prev) => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * zoomDelta));
      const zoomRatio = newZoom / prev.zoom;

      const newPanX = mouseX - (mouseX - prev.panX) * zoomRatio;
      const newPanY = mouseY - (mouseY - prev.panY) * zoomRatio;

      return { panX: newPanX, panY: newPanY, zoom: newZoom };
    });
  }, []);

  // Mouse down handler for pan start
  // Note: .encounter-map__room hit targets no longer block panning (left-click now pans)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.encounter-map__door') ||
        target.closest('.encounter-map__token')) {
      return;
    }

    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    viewStart.current = { panX: viewState.panX, panY: viewState.panY };

    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  }, [viewState.panX, viewState.panY]);

  // Mouse move handler for panning
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    setViewState((prev) => ({
      ...prev,
      panX: viewStart.current.panX + dx,
      panY: viewStart.current.panY + dy,
    }));
  }, []);

  // Mouse up handler for pan end
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }
  }, []);

  // Effect to handle mouse up outside container
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDragging.current = false;
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  // Reset view handler
  const handleResetView = useCallback(() => {
    setViewState({ panX: 0, panY: 0, zoom: 1 });
  }, []);

  // Touch start handler
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (tokenTouchActive) return;

    if (e.touches.length === 1) {
      isDragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      viewStart.current = { panX: viewState.panX, panY: viewState.panY };
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
      lastTouchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }, [viewState.panX, viewState.panY]);

  // Touch move handler — attached as native event with { passive: false } to allow preventDefault
  const touchMoveHandler = useCallback((e: TouchEvent) => {
    if (tokenTouchActive) return;

    e.preventDefault();

    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;

      setViewState((prev) => ({
        ...prev,
        panX: viewStart.current.panX + dx,
        panY: viewStart.current.panY + dy,
      }));
    } else if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const container = containerRef.current;
      if (!container || !lastTouchCenter.current) return;

      const rect = container.getBoundingClientRect();
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      const scale = distance / lastTouchDistance.current;

      setViewState((prev) => {
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * scale));
        const zoomRatio = newZoom / prev.zoom;

        const newPanX = centerX - (centerX - prev.panX) * zoomRatio;
        const newPanY = centerY - (centerY - prev.panY) * zoomRatio;

        return { panX: newPanX, panY: newPanY, zoom: newZoom };
      });

      lastTouchDistance.current = distance;
      lastTouchCenter.current = { x: centerX + rect.left, y: centerY + rect.top };
    }
  }, []);

  // Attach touchmove as native event listener with { passive: false }
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchmove', touchMoveHandler, { passive: false });
    return () => {
      container.removeEventListener('touchmove', touchMoveHandler);
    };
  }, [touchMoveHandler]);

  // Attach wheel as native event listener with { passive: false } so preventDefault works
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Touch end handler
  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
  }, []);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className="encounter-map-renderer"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: 'grab',
        touchAction: 'none',
        ...style,
      }}
    >
      {/* SVG Map */}
      <svg
        ref={svgRef}
        viewBox={`${originX} ${originY} ${svgWidth} ${svgHeight}`}
        className="encounter-map-renderer__svg"
        preserveAspectRatio="xMidYMid meet"
        style={{
          transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <defs>
          {/* POI icon symbols — Mothership RPG Map Icons (MIT, László Varga) */}
          {Object.entries(ENCOUNTER_ICONS).map(([name, content]) => (
            <symbol
              key={name}
              id={iconSymbolId(name)}
              viewBox="0 0 64 64"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ))}

          {/* Background grid pattern for void areas */}
          <pattern
            id="map-bg-grid"
            width={unitSize} height={unitSize}
            patternUnits="userSpaceOnUse"
            x={originX} y={originY}
          >
            <path
              d={`M ${unitSize} 0 L 0 0 0 ${unitSize}`}
              fill="none" stroke="#141e1e" strokeWidth={0.5}
            />
          </pattern>
        </defs>

        {/* Background — fill entire viewBox with faint grid */}
        <rect
          x={originX} y={originY}
          width={svgWidth} height={svgHeight}
          fill={COLORS.bgPrimary}
        />
        <rect
          x={originX} y={originY}
          width={svgWidth} height={svgHeight}
          fill="url(#map-bg-grid)"
        />

        {/* Rooms (with walls, floor fill, context menu targets, labels) */}
        <g className="encounter-map__rooms">
          {mapData.rooms.map(renderRoom)}
        </g>

        {/* Door symbols — rendered above room floors and walls */}
        <g className="encounter-map__doors">
          {mapData.rooms.flatMap(room =>
            (room.doors || []).map((door, i) => {
              if (!isGM) {
                // Show door if either the owning room OR the adjacent room is visible
                const adjCell = getAdjacentCellForDoor(room.rects, door);
                const adjRoom = findRoomAtCell(adjCell.x, adjCell.y);
                if (!isRoomVisible(room.id) && (!adjRoom || !isRoomVisible(adjRoom.id))) return null;
              }
              const pos = getDoorSVGPosition(room.rects, door, unitSize);
              const style = CONNECTION_STYLES[door.type] || CONNECTION_STYLES.standard;
              const contextMenuHandler = (isGM && onDoorStatusChange)
                ? (e: React.MouseEvent) => handleDoorClick(e, room, i)
                : undefined;
              return renderDoorSymbol(
                pos.x, pos.y, door.type, getEffectiveDoorStatus(room, i),
                style, pos.orientation, `door-${room.id}-${i}`, contextMenuHandler
              );
            })
          )}
        </g>

        {/* POI layer — rendered above doors */}
        {mapData.poi && mapData.poi.length > 0 && (
          <g className="encounter-map__pois">
            {mapData.poi.map(renderPoi)}
          </g>
        )}

        {/* Token layer (rendered above all other elements) */}
        {tokens && Object.keys(tokens).length > 0 && (
          <TokenLayer
            tokens={tokens}
            unitSize={unitSize}
            roomVisibility={roomVisibility}
            isGM={isGM}
            onTokenMove={onTokenMove}
            selectedTokenId={selectedTokenId}
            onTokenSelect={(id, e) => {
              if (id === null) {
                setSelectedTokenId(null);
                setSelectedTokenPos(null);
              } else {
                const token = tokens?.[id];
                const container = containerRef.current;
                const svg = svgRef.current;
                if (token && container && svg) {
                  // Token top-center in SVG (viewBox) coordinates
                  const tokenTopSvgX = token.x * unitSize + unitSize / 2;
                  const tokenTopSvgY = token.y * unitSize + unitSize / 2 - unitSize * 0.4;
                  // getScreenCTM includes viewBox + preserveAspectRatio + CSS pan/zoom transform
                  const ctm = svg.getScreenCTM();
                  if (ctm) {
                    const pt = svg.createSVGPoint();
                    pt.x = tokenTopSvgX;
                    pt.y = tokenTopSvgY;
                    const screenPt = pt.matrixTransform(ctm);
                    const rect = container.getBoundingClientRect();
                    setSelectedTokenId(id);
                    setSelectedTokenPos({ x: screenPt.x - rect.left, y: screenPt.y - rect.top });
                    return;
                  }
                }
                // Fallback: cursor position
                const rect = containerRef.current?.getBoundingClientRect();
                setSelectedTokenId(id);
                setSelectedTokenPos({ x: e.clientX - (rect?.left || 0), y: e.clientY - (rect?.top || 0) });
              }
            }}
            mapRooms={mapData.rooms as unknown as import('../../../types/encounterMap').RoomData[]}
          />
        )}
      </svg>

      {/* Overlay panels - positioned by CSS Grid */}
      <div
        className="encounter-map__overlays"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gridTemplateRows: 'auto 1fr auto',
          gridTemplateAreas: '"top-left . top-right" ". . ." "bottom-left . bottom-right"',
          padding: '20px',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {/* Reset view button - top left */}
        {(viewState.zoom !== 1 || viewState.panX !== 0 || viewState.panY !== 0) && (
          <button
            className="encounter-map__reset-btn"
            onClick={handleResetView}
            title="Reset view"
            style={{
              gridArea: 'top-left',
              alignSelf: 'start',
              justifySelf: 'start',
              pointerEvents: 'auto',
              background: 'rgba(15, 21, 21, 0.95)',
              border: '1px solid #4a6b6b',
              color: '#8b7355',
              fontFamily: "'Cascadia Code', 'Courier New', monospace",
              fontSize: '11px',
              letterSpacing: '2px',
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            RESET VIEW
          </button>
        )}

        {/* Level indicator - top right */}
        <div
          className="encounter-map__level-indicator"
          style={{ gridArea: 'top-right', alignSelf: 'start', justifySelf: 'end' }}
        >
          <LevelIndicator
            currentLevel={currentLevel}
            totalLevels={totalLevels}
            deckName={deckName}
          />
        </div>

        {/* Legend - bottom right */}
        <div
          className="encounter-map__legend"
          style={{ gridArea: 'bottom-right', alignSelf: 'end', justifySelf: 'end' }}
        >
          <LegendPanel />
        </div>
      </div>

      {/* Token popup — rendered outside SVG for proper styling */}
      {selectedTokenId && tokens?.[selectedTokenId] && selectedTokenPos && (
        <TokenPopup
          tokenId={selectedTokenId}
          data={tokens[selectedTokenId]}
          x={selectedTokenPos.x}
          y={selectedTokenPos.y}
          onClose={() => { setSelectedTokenId(null); setSelectedTokenPos(null); }}
          onRemove={onTokenRemove}
          onStatusToggle={onTokenStatusToggle}
          isGM={isGM}
        />
      )}

      {/* POI info popup — shown on hover/click */}
      {poiPopup && (
        <div
          style={{
            position: 'absolute',
            left: poiPopup.x + 14,
            top: poiPopup.y - 10,
            background: 'rgba(10, 10, 10, 0.97)',
            border: `1px solid ${
              poiPopup.poi.type === 'hazard'    ? COLORS.hazard :
              poiPopup.poi.type === 'objective' ? COLORS.amber :
              poiPopup.poi.type === 'item'      ? COLORS.tealBright :
              COLORS.teal
            }`,
            padding: '8px 12px',
            fontFamily: "'Cascadia Code', 'Courier New', monospace",
            fontSize: '11px',
            letterSpacing: '1px',
            pointerEvents: 'none',
            zIndex: 10,
            maxWidth: '220px',
            lineHeight: '1.5',
          }}
        >
          <div style={{ color: COLORS.textPrimary, marginBottom: 2, fontWeight: 'bold' }}>
            {poiPopup.poi.name}
          </div>
          {poiPopup.poi.status && (
            <div style={{ color: poiPopup.poi.type === 'hazard' ? COLORS.hazard : COLORS.amber, fontSize: '10px' }}>
              {poiPopup.poi.status}
            </div>
          )}
          {poiPopup.poi.description && (
            <div style={{ color: COLORS.textMuted, fontSize: '10px', marginTop: 4 }}>
              {poiPopup.poi.description}
            </div>
          )}
        </div>
      )}

      {/* Door status popup — rendered outside SVG */}
      {selectedDoor && onDoorStatusChange && (
        <DoorStatusPopup
          x={selectedDoor.x}
          y={selectedDoor.y}
          currentStatus={selectedDoor.status}
          onSelect={(status) => {
            onDoorStatusChange(selectedDoor.id, status);
            setSelectedDoor(null);
          }}
          onClose={() => setSelectedDoor(null)}
        />
      )}

      {/* Room context menu — rendered outside SVG */}
      {contextMenu && isGM && (
        <RoomContextMenu
          room={contextMenu.room}
          isVisible={isRoomVisible(contextMenu.room.id)}
          x={contextMenu.x}
          y={contextMenu.y}
          onToggleVisibility={() => {
            onRoomToggle?.(contextMenu.room.id, !isRoomVisible(contextMenu.room.id));
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
