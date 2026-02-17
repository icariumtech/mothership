/**
 * MapPreview - Simplified SVG preview of encounter map for GM panel
 *
 * Shows all rooms with visual indication of visibility status.
 * Hidden rooms appear dimmed with dashed borders.
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import '@/components/domain/encounter/EncounterMapRenderer.css';
import type {
  EncounterMapData,
  RoomData,
  ConnectionData,
  RoomVisibilityState,
  DoorStatusState,
  DoorStatus,
  TokenState,
  TokenType,
  TokenStatus,
} from '@/types/encounterMap';
import { DoorStatusPopup } from './DoorStatusPopup';
import { TokenLayer } from '@/components/domain/encounter/TokenLayer';
import { getGridCell } from '@/utils/svgCoordinates';
import { message } from 'antd';

// Pan and zoom state
interface ViewState {
  panX: number;
  panY: number;
  zoom: number;
}

// Selected door state for popup
interface SelectedDoor {
  connectionId: string;
  x: number;
  y: number;
  currentStatus: DoorStatus;
}

interface MapPreviewProps {
  mapData: EncounterMapData;
  roomVisibility: RoomVisibilityState;
  /** Door status overrides from GM */
  doorStatus?: DoorStatusState;
  /** Callback when GM changes door status */
  onDoorStatusChange?: (connectionId: string, status: DoorStatus) => void;
  /** Fixed height in pixels. If not set, uses aspectRatio. */
  height?: number;
  /** Aspect ratio (width/height). E.g., 1 = square, 16/9 = widescreen. Defaults to map's natural ratio. */
  aspectRatio?: number;
  /** If true, show all rooms but dim hidden ones. If false, only show visible rooms. */
  showAllRooms?: boolean;
  /** Token state for rendering tokens on the map */
  tokens?: TokenState;
  /** Is this the GM view? (enables token drag-and-drop) */
  isGM?: boolean;
  /** Callback when GM places a new token */
  onTokenPlace?: (type: TokenType, name: string, x: number, y: number, imageUrl: string, roomId: string) => void;
  /** Callback when GM moves an existing token */
  onTokenMove?: (id: string, x: number, y: number) => void;
  /** Callback when GM removes a token */
  onTokenRemove?: (id: string) => void;
  /** Callback when GM toggles token status */
  onTokenStatusToggle?: (id: string, status: TokenStatus) => void;
}

// V2-1 Color palette (simplified for preview)
const COLORS = {
  bgPrimary: '#0a0a0a',
  bgRoom: '#0f1515',
  borderMain: '#4a6b6b',
  teal: '#4a6b6b',
  tealBright: '#5a7a7a',
  amber: '#8b7355',
  hazard: '#8b5555',
  pathLine: '#3a5a5a',
  textMuted: '#5a5a5a',
};

// Connection/door type styles
const CONNECTION_STYLES: Record<string, { stroke: string; doorFill: string }> = {
  standard: { stroke: COLORS.pathLine, doorFill: COLORS.teal },
  airlock: { stroke: COLORS.pathLine, doorFill: COLORS.amber },
  blast_door: { stroke: COLORS.pathLine, doorFill: COLORS.tealBright },
  emergency: { stroke: COLORS.pathLine, doorFill: COLORS.hazard },
  open: { stroke: COLORS.pathLine, doorFill: COLORS.teal },
};

export function MapPreview({
  mapData,
  roomVisibility,
  doorStatus,
  onDoorStatusChange,
  height,
  aspectRatio,
  showAllRooms = true,
  tokens,
  isGM = false,
  onTokenPlace,
  onTokenMove,
  onTokenRemove,
  onTokenStatusToggle,
}: MapPreviewProps) {
  const grid = mapData.grid;
  const unitSize = grid.unit_size || 40;
  const svgWidth = grid.width * unitSize;
  const svgHeight = grid.height * unitSize;

  // Pan and zoom state
  const [viewState, setViewState] = useState<ViewState>({
    panX: 0,
    panY: 0,
    zoom: 1,
  });

  // Selected door for popup
  const [selectedDoor, setSelectedDoor] = useState<SelectedDoor | null>(null);

  // Selected token for popup (GM console token interaction)
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);

  // Refs for drag tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewStart = useRef({ panX: 0, panY: 0 });

  const [messageApi, contextHolder] = message.useMessage();

  // Zoom limits
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;

  // Wheel zoom handler - use native event for proper preventDefault
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
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

  // Attach wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Mouse down handler for pan start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
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

  // Reset view handler
  const handleResetView = useCallback(() => {
    setViewState({ panX: 0, panY: 0, zoom: 1 });
  }, []);

  // Check if view is modified
  const isViewModified = viewState.zoom !== 1 || viewState.panX !== 0 || viewState.panY !== 0;

  // Helper: Find which room contains a grid cell
  const findRoomAtCell = useCallback((gridX: number, gridY: number): RoomData | null => {
    for (const room of mapData.rooms) {
      if (
        gridX >= room.x &&
        gridX < room.x + room.width &&
        gridY >= room.y &&
        gridY < room.y + room.height
      ) {
        return room;
      }
    }
    return null;
  }, [mapData.rooms]);

  // Helper: Check if a cell is occupied by a token
  const isCellOccupied = useCallback((gridX: number, gridY: number): boolean => {
    if (!tokens) return false;
    return Object.values(tokens).some(token => token.x === gridX && token.y === gridY);
  }, [tokens]);

  // Drag over handler - allow drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isGM || !onTokenPlace) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, [isGM, onTokenPlace]);

  // Drop handler - place token
  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!isGM || !onTokenPlace || !svgRef.current) return;

    e.preventDefault();

    // Parse template data
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    let template: { type: TokenType; name: string; imageUrl: string };
    try {
      template = JSON.parse(dataStr);
    } catch (err) {
      console.error('Failed to parse drag data:', err);
      return;
    }

    // Convert drop position to grid cell
    const { gridX, gridY } = getGridCell(svgRef.current, e.clientX, e.clientY, unitSize);

    // Overlap prevention: check if cell is occupied
    if (isCellOccupied(gridX, gridY)) {
      messageApi.warning('Cell is already occupied by another token');
      return;
    }

    // Revealed rooms only: check if cell is in a revealed room
    const room = findRoomAtCell(gridX, gridY);
    if (!room) {
      messageApi.warning('Token can only be placed inside a room');
      return;
    }

    // No room visibility restriction for GM — allow placing tokens in hidden rooms for encounter setup

    // Valid placement - call handler
    onTokenPlace(template.type, template.name, gridX, gridY, template.imageUrl || '', room.id);
  }, [isGM, onTokenPlace, unitSize, isCellOccupied, findRoomAtCell, roomVisibility, messageApi]);

  // Check if a room is visible
  const isRoomVisible = (roomId: string): boolean => {
    return roomVisibility[roomId] !== false;
  };

  // Get rooms to display - all rooms if showAllRooms, otherwise only visible
  const displayRooms = useMemo(() => {
    if (showAllRooms) {
      return mapData.rooms;
    }
    return mapData.rooms.filter(room => isRoomVisible(room.id));
  }, [mapData.rooms, roomVisibility, showAllRooms]);

  // Visible rooms only (for connection lines)
  const visibleRooms = useMemo(() => {
    return mapData.rooms.filter(room => isRoomVisible(room.id));
  }, [mapData.rooms, roomVisibility]);

  // Build room lookup for visible rooms
  const roomMap = useMemo(() => {
    const map = new Map<string, RoomData>();
    for (const room of visibleRooms) {
      map.set(room.id, room);
    }
    return map;
  }, [visibleRooms]);

  // Build room lookup for ALL rooms (for door positions)
  const allRoomMap = useMemo(() => {
    const map = new Map<string, RoomData>();
    for (const room of mapData.rooms) {
      map.set(room.id, room);
    }
    return map;
  }, [mapData.rooms]);

  // Get connection edge point
  const getConnectionEdge = (room: RoomData, otherRoom: RoomData): { x: number; y: number; side: string } => {
    const roomCenterX = (room.x + room.width / 2) * unitSize;
    const roomCenterY = (room.y + room.height / 2) * unitSize;
    const otherCenterX = (otherRoom.x + otherRoom.width / 2) * unitSize;
    const otherCenterY = (otherRoom.y + otherRoom.height / 2) * unitSize;

    const dx = otherCenterX - roomCenterX;
    const dy = otherCenterY - roomCenterY;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        return { x: (room.x + room.width) * unitSize, y: roomCenterY, side: 'right' };
      } else {
        return { x: room.x * unitSize, y: roomCenterY, side: 'left' };
      }
    } else {
      if (dy > 0) {
        return { x: roomCenterX, y: (room.y + room.height) * unitSize, side: 'bottom' };
      } else {
        return { x: roomCenterX, y: room.y * unitSize, side: 'top' };
      }
    }
  };

  // Get connections
  const allConnections: ConnectionData[] = useMemo(() => {
    if (mapData.connections) {
      return mapData.connections;
    }
    if (mapData.doors) {
      return mapData.doors
        .filter((d: any) => d.room_a && d.room_b)
        .map((d: any) => ({
          id: d.id,
          from: d.room_a,
          to: d.room_b,
          door_type: d.type,
          door_status: d.status,
        }));
    }
    return [];
  }, [mapData]);

  // Only show connections where both rooms are visible
  const visibleConnections = useMemo(() => {
    return allConnections.filter(conn =>
      isRoomVisible(conn.from) && isRoomVisible(conn.to)
    );
  }, [allConnections, roomVisibility]);

  // Doors visible when at least one room is visible
  const visibleDoors = useMemo(() => {
    return allConnections.filter(conn =>
      isRoomVisible(conn.from) || isRoomVisible(conn.to)
    );
  }, [allConnections, roomVisibility]);

  // Render simple path line
  const renderConnectionPath = (conn: ConnectionData) => {
    const fromRoom = roomMap.get(conn.from);
    const toRoom = roomMap.get(conn.to);
    if (!fromRoom || !toRoom) return null;

    const fromEdge = getConnectionEdge(fromRoom, toRoom);
    const toEdge = getConnectionEdge(toRoom, fromRoom);
    const style = CONNECTION_STYLES[conn.door_type || 'standard'] || CONNECTION_STYLES.standard;

    return (
      <line
        key={conn.id}
        x1={fromEdge.x}
        y1={fromEdge.y}
        x2={toEdge.x}
        y2={toEdge.y}
        stroke={style.stroke}
        strokeWidth={1.5}
      />
    );
  };

  // Get effective door status (runtime override > YAML default)
  const getEffectiveDoorStatus = useCallback((conn: ConnectionData): DoorStatus => {
    if (doorStatus && doorStatus[conn.id]) {
      return doorStatus[conn.id];
    }
    return conn.door_status || 'CLOSED';
  }, [doorStatus]);

  // Get door visual styling based on status
  const getDoorStatusStyle = useCallback((status: DoorStatus) => {
    switch (status) {
      case 'OPEN':
        return { opacity: 0.5, stroke: COLORS.borderMain, strokeWidth: 1, strokeDasharray: 'none' };
      case 'LOCKED':
        return { opacity: 1, stroke: COLORS.amber, strokeWidth: 2, strokeDasharray: 'none' };
      case 'SEALED':
        return { opacity: 1, stroke: COLORS.hazard, strokeWidth: 2.5, strokeDasharray: 'none' };
      case 'DAMAGED':
        return { opacity: 0.4, stroke: COLORS.hazard, strokeWidth: 1, strokeDasharray: '3 2' };
      default: // CLOSED
        return { opacity: 1, stroke: COLORS.borderMain, strokeWidth: 1, strokeDasharray: 'none' };
    }
  }, []);

  // Handle door click - open popup
  const handleDoorClick = useCallback((
    e: React.MouseEvent,
    conn: ConnectionData,
    edgeX: number,
    edgeY: number
  ) => {
    e.stopPropagation();

    // Convert SVG coordinates to container coordinates
    const container = containerRef.current;
    if (!container) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    // Get SVG viewBox dimensions
    const viewBox = svg.viewBox.baseVal;
    const svgRect = svg.getBoundingClientRect();

    // Calculate position accounting for pan and zoom
    const scaleX = svgRect.width / viewBox.width;
    const scaleY = svgRect.height / viewBox.height;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (svgRect.width - viewBox.width * scale) / 2;
    const offsetY = (svgRect.height - viewBox.height * scale) / 2;

    const popupX = offsetX + edgeX * scale * viewState.zoom + viewState.panX;
    const popupY = offsetY + edgeY * scale * viewState.zoom + viewState.panY;

    setSelectedDoor({
      connectionId: conn.id,
      x: popupX,
      y: popupY,
      currentStatus: getEffectiveDoorStatus(conn),
    });
  }, [viewState, getEffectiveDoorStatus]);

  // Handle status selection from popup
  const handleStatusSelect = useCallback((status: DoorStatus) => {
    if (selectedDoor && onDoorStatusChange) {
      onDoorStatusChange(selectedDoor.connectionId, status);
    }
    setSelectedDoor(null);
  }, [selectedDoor, onDoorStatusChange]);

  // Render door symbol (clickable with status styling)
  const renderDoor = (conn: ConnectionData) => {
    const fromRoom = allRoomMap.get(conn.from);
    const toRoom = allRoomMap.get(conn.to);
    if (!fromRoom || !toRoom || !conn.door_type) return null;

    const fromVisible = isRoomVisible(conn.from);
    const toVisible = isRoomVisible(conn.to);
    const style = CONNECTION_STYLES[conn.door_type || 'standard'] || CONNECTION_STYLES.standard;
    const effectiveStatus = getEffectiveDoorStatus(conn);
    const statusStyle = getDoorStatusStyle(effectiveStatus);
    const elements = [];

    if (fromVisible) {
      const fromEdge = getConnectionEdge(fromRoom, toRoom);
      const isHorizontal = fromEdge.side === 'top' || fromEdge.side === 'bottom';
      elements.push(
        <rect
          key={`${conn.id}-from`}
          x={fromEdge.x - (isHorizontal ? 6 : 4)}
          y={fromEdge.y - (isHorizontal ? 4 : 6)}
          width={isHorizontal ? 12 : 8}
          height={isHorizontal ? 8 : 12}
          fill={style.doorFill}
          stroke={statusStyle.stroke}
          strokeWidth={statusStyle.strokeWidth}
          strokeDasharray={statusStyle.strokeDasharray}
          opacity={statusStyle.opacity}
          style={{ cursor: onDoorStatusChange ? 'pointer' : 'default' }}
          onClick={(e) => onDoorStatusChange && handleDoorClick(e, conn, fromEdge.x, fromEdge.y)}
        />
      );
    }

    if (toVisible) {
      const toEdge = getConnectionEdge(toRoom, fromRoom);
      const isHorizontal = toEdge.side === 'top' || toEdge.side === 'bottom';
      elements.push(
        <rect
          key={`${conn.id}-to`}
          x={toEdge.x - (isHorizontal ? 6 : 4)}
          y={toEdge.y - (isHorizontal ? 4 : 6)}
          width={isHorizontal ? 12 : 8}
          height={isHorizontal ? 8 : 12}
          fill={style.doorFill}
          stroke={statusStyle.stroke}
          strokeWidth={statusStyle.strokeWidth}
          strokeDasharray={statusStyle.strokeDasharray}
          opacity={statusStyle.opacity}
          style={{ cursor: onDoorStatusChange ? 'pointer' : 'default' }}
          onClick={(e) => onDoorStatusChange && handleDoorClick(e, conn, toEdge.x, toEdge.y)}
        />
      );
    }

    return <g key={`doors-${conn.id}`}>{elements}</g>;
  };

  // Render room (simplified - no hover/click)
  const renderRoom = (room: RoomData) => {
    const x = room.x * unitSize;
    const y = room.y * unitSize;
    const width = room.width * unitSize;
    const roomHeight = room.height * unitSize;
    const visible = isRoomVisible(room.id);

    // Status color for visible rooms, muted for hidden
    const statusColor = !visible ? '#2a3a3a' :
                        room.status === 'HAZARD' ? COLORS.hazard :
                        room.status === 'WARNING' ? COLORS.amber :
                        COLORS.teal;

    // Hidden rooms: darker fill, dashed border, lower opacity
    const fillColor = visible ? COLORS.bgRoom : '#080808';
    const strokeDasharray = visible ? 'none' : '4,2';
    const opacity = visible ? 1 : 0.5;

    return (
      <g key={room.id} opacity={opacity}>
        <rect
          x={x}
          y={y}
          width={width}
          height={roomHeight}
          fill={fillColor}
          stroke={statusColor}
          strokeWidth={visible ? 1.5 : 1}
          strokeDasharray={strokeDasharray}
        />
        {/* Room label - only show if room is large enough */}
        {width > 60 && roomHeight > 40 && (
          <text
            x={x + width / 2}
            y={y + roomHeight / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={visible ? COLORS.textMuted : '#3a3a3a'}
            fontSize={12}
            fontFamily="monospace"
          >
            {room.name.length > 10 ? room.name.substring(0, 8) + '...' : room.name}
          </text>
        )}
        {/* Hidden indicator - small "X" or eye-slash icon for hidden rooms */}
        {!visible && width > 30 && roomHeight > 30 && (
          <g transform={`translate(${x + width - 10}, ${y + 8})`}>
            <line x1="-3" y1="-3" x2="3" y2="3" stroke="#5a5a5a" strokeWidth={1} />
            <line x1="3" y1="-3" x2="-3" y2="3" stroke="#5a5a5a" strokeWidth={1} />
          </g>
        )}
      </g>
    );
  };

  // Calculate natural aspect ratio from map dimensions
  const mapAspectRatio = svgWidth / svgHeight;

  // Container style - use height if provided, otherwise use map's natural aspect ratio (or override)
  const containerStyle: React.CSSProperties = {
    background: COLORS.bgPrimary,
    border: '1px solid #303030',
    overflow: 'hidden',
    position: 'relative',
    ...(height ? { height } : { aspectRatio: String(aspectRatio || mapAspectRatio) }),
  };

  // Empty state - only show if no rooms at all
  if (displayRooms.length === 0) {
    return (
      <div
        style={{
          ...containerStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ color: COLORS.textMuted, fontSize: 11 }}>
          No rooms to display
        </span>
      </div>
    );
  }

  return (
    <>
      {contextHolder}
      <div
        ref={containerRef}
        style={{ ...containerStyle, cursor: 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            width: '100%',
            height: '100%',
            transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`,
            transformOrigin: '0 0',
          }}
        >
        {/* Background */}
        <rect x={0} y={0} width={svgWidth} height={svgHeight} fill={COLORS.bgPrimary} />

        {/* Connection lines */}
        <g>
          {visibleConnections.map(renderConnectionPath)}
        </g>

        {/* Rooms - show all rooms with visibility indication */}
        <g>
          {displayRooms.map(renderRoom)}
        </g>

        {/* Doors */}
        <g>
          {visibleDoors.map(renderDoor)}
        </g>

        {/* Tokens */}
        {tokens && (
          <TokenLayer
            tokens={tokens}
            unitSize={unitSize}
            roomVisibility={roomVisibility}
            isGM={isGM}
            onTokenMove={onTokenMove}
            onTokenRemove={onTokenRemove}
            onTokenStatusToggle={onTokenStatusToggle}
            selectedTokenId={selectedTokenId}
            onTokenSelect={setSelectedTokenId}
            mapRooms={mapData.rooms}
          />
        )}
      </svg>

      {/* Reset view button */}
      {isViewModified && (
        <button
          onClick={handleResetView}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '4px 8px',
            fontSize: 9,
            fontFamily: 'monospace',
            letterSpacing: 1,
            color: COLORS.amber,
            background: 'rgba(10, 10, 10, 0.8)',
            border: `1px solid ${COLORS.amber}`,
            cursor: 'pointer',
          }}
        >
          RESET
        </button>
      )}

      {/* Deck label overlay */}
      <div
        style={{
          position: 'absolute',
          bottom: 4,
          right: 8,
          fontSize: 9,
          color: COLORS.teal,
          letterSpacing: 1,
          textTransform: 'uppercase',
          opacity: 0.7,
        }}
      >
        {mapData.name || mapData.deck_id || 'Map Preview'}
      </div>

      {/* Door status popup */}
      {selectedDoor && (
        <DoorStatusPopup
          x={selectedDoor.x}
          y={selectedDoor.y}
          currentStatus={selectedDoor.currentStatus}
          onSelect={handleStatusSelect}
          onClose={() => setSelectedDoor(null)}
        />
      )}
      </div>
    </>
  );
}
