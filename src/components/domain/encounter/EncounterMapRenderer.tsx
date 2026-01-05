/**
 * EncounterMapRenderer - SVG renderer for encounter maps
 *
 * Renders node-graph style maps where rooms are separate boxes
 * connected by path lines. Supports doors on connections,
 * terminals, and points of interest.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  EncounterMapData,
  RoomData,
  ConnectionData,
  TooltipState,
  RoomVisibilityState,
  DoorStatusState,
  DoorStatus,
} from '../../../types/encounterMap';
import { RoomTooltip } from './RoomTooltip';
import './EncounterMapRenderer.css';

interface EncounterMapRendererProps {
  mapData: EncounterMapData;
  roomVisibility?: RoomVisibilityState;
  doorStatus?: DoorStatusState;
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

// POI icon paths
const POI_ICONS: Record<string, string> = {
  objective: 'M0,-6 L5,3 L-5,3 Z',
  item: 'M-4,-4 L4,-4 L4,4 L-4,4 Z',
  hazard: 'M0,-6 L6,3 L-6,3 Z',
  npc: 'M0,-5 A5,5 0 1,1 0,5 A5,5 0 1,1 0,-5',
  player: 'M0,-6 L6,0 L0,6 L-6,0 Z',
  pod: 'M-3,-5 L3,-5 L5,0 L3,5 L-3,5 L-5,0 Z',
  warning: 'M0,-6 L6,3 L-6,3 Z',
  crate: 'M-4,-4 L4,-4 L4,4 L-4,4 Z',
  terminal: 'M-5,-4 L5,-4 L5,3 L-5,3 Z',
};

export function EncounterMapRenderer({ mapData, roomVisibility, doorStatus }: EncounterMapRendererProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    content: { title: '' },
  });

  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  // Pan and zoom state
  const [viewState, setViewState] = useState<ViewState>({
    panX: 0,
    panY: 0,
    zoom: 1,
  });

  // Refs for drag tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewStart = useRef({ panX: 0, panY: 0 });

  // Touch gesture refs
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  // Zoom limits
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;

  // Calculate SVG dimensions
  const grid = mapData.grid;
  const unitSize = grid.unit_size || 40;
  const svgWidth = grid.width * unitSize;
  const svgHeight = grid.height * unitSize;

  // Check if a room is visible (default to true if no visibility state)
  const isRoomVisible = useCallback((roomId: string): boolean => {
    if (!roomVisibility) return true;
    return roomVisibility[roomId] !== false;
  }, [roomVisibility]);

  // Get effective door status (runtime override > YAML default)
  const getEffectiveDoorStatus = useCallback((conn: ConnectionData): DoorStatus => {
    if (doorStatus && doorStatus[conn.id]) {
      return doorStatus[conn.id];
    }
    return conn.door_status || 'CLOSED';
  }, [doorStatus]);

  // Filter rooms by visibility
  const visibleRooms = useMemo(() => {
    return mapData.rooms.filter(room => isRoomVisible(room.id));
  }, [mapData.rooms, isRoomVisible]);

  // Build room lookup map for ALL rooms (used for door positioning)
  const allRoomMap = useMemo(() => {
    const map = new Map<string, RoomData>();
    for (const room of mapData.rooms) {
      map.set(room.id, room);
    }
    return map;
  }, [mapData.rooms]);

  // Build room lookup map for visible rooms only (used for connection lines)
  const roomMap = useMemo(() => {
    const map = new Map<string, RoomData>();
    for (const room of visibleRooms) {
      map.set(room.id, room);
    }
    return map;
  }, [visibleRooms]);

  // Get the best edge point for connecting two rooms (prefers cardinal directions)
  const getConnectionEdge = useCallback((room: RoomData, otherRoom: RoomData): { x: number; y: number; side: 'top' | 'bottom' | 'left' | 'right' } => {
    const roomLeft = room.x * unitSize;
    const roomRight = (room.x + room.width) * unitSize;
    const roomTop = room.y * unitSize;
    const roomBottom = (room.y + room.height) * unitSize;
    const roomCenterX = (room.x + room.width / 2) * unitSize;
    const roomCenterY = (room.y + room.height / 2) * unitSize;

    const otherCenterX = (otherRoom.x + otherRoom.width / 2) * unitSize;
    const otherCenterY = (otherRoom.y + otherRoom.height / 2) * unitSize;

    const dx = otherCenterX - roomCenterX;
    const dy = otherCenterY - roomCenterY;

    // Determine primary direction based on which axis has greater difference
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection
      if (dx > 0) {
        return { x: roomRight, y: roomCenterY, side: 'right' };
      } else {
        return { x: roomLeft, y: roomCenterY, side: 'left' };
      }
    } else {
      // Vertical connection
      if (dy > 0) {
        return { x: roomCenterX, y: roomBottom, side: 'bottom' };
      } else {
        return { x: roomCenterX, y: roomTop, side: 'top' };
      }
    }
  }, [unitSize]);

  // Generate orthogonal path with 45-degree corners between two points
  const generateOrthogonalPath = useCallback((
    fromX: number, fromY: number, fromSide: string,
    toX: number, toY: number, toSide: string
  ): string => {
    const points: { x: number; y: number }[] = [{ x: fromX, y: fromY }];

    const dx = toX - fromX;
    const dy = toY - fromY;

    // Offset from room edge before turning
    const edgeOffset = 15;

    // Calculate intermediate points based on exit directions
    if (fromSide === 'right' || fromSide === 'left') {
      // Exiting horizontally
      const exitX = fromSide === 'right' ? fromX + edgeOffset : fromX - edgeOffset;

      if (toSide === 'left' || toSide === 'right') {
        // Target also horizontal - need vertical segment
        const entryX = toSide === 'left' ? toX - edgeOffset : toX + edgeOffset;
        const midX = (exitX + entryX) / 2;

        if (Math.abs(dy) > 0) {
          // Use 45-degree angles for the turn
          const turnLength = Math.min(Math.abs(dy) / 2, Math.abs(midX - exitX));

          points.push({ x: exitX, y: fromY });
          points.push({ x: midX - (dy > 0 ? turnLength : -turnLength), y: fromY });
          points.push({ x: midX + (dy > 0 ? turnLength : -turnLength), y: toY });
          points.push({ x: entryX, y: toY });
        } else {
          // Straight horizontal line
          points.push({ x: entryX, y: toY });
        }
      } else {
        // Target is vertical
        if (Math.abs(dx) > edgeOffset * 2 && Math.abs(dy) > edgeOffset * 2) {
          // 45-degree corner
          const turnDist = Math.min(Math.abs(dx) - edgeOffset, Math.abs(dy) - edgeOffset) / 2;
          points.push({ x: exitX, y: fromY });
          points.push({ x: toX + (dx > 0 ? -turnDist : turnDist), y: fromY + (dy > 0 ? turnDist : -turnDist) });
          points.push({ x: toX, y: toY + (toSide === 'top' ? -edgeOffset : edgeOffset) });
        } else {
          points.push({ x: exitX, y: fromY });
          points.push({ x: toX, y: fromY });
          points.push({ x: toX, y: toY + (toSide === 'top' ? -edgeOffset : edgeOffset) });
        }
      }
    } else {
      // Exiting vertically
      const exitY = fromSide === 'bottom' ? fromY + edgeOffset : fromY - edgeOffset;

      if (toSide === 'top' || toSide === 'bottom') {
        // Target also vertical - need horizontal segment
        const entryY = toSide === 'top' ? toY - edgeOffset : toY + edgeOffset;
        const midY = (exitY + entryY) / 2;

        if (Math.abs(dx) > 0) {
          // Use 45-degree angles for the turn
          const turnLength = Math.min(Math.abs(dx) / 2, Math.abs(midY - exitY));

          points.push({ x: fromX, y: exitY });
          points.push({ x: fromX, y: midY - (dx > 0 ? turnLength : -turnLength) });
          points.push({ x: toX, y: midY + (dx > 0 ? turnLength : -turnLength) });
          points.push({ x: toX, y: entryY });
        } else {
          // Straight vertical line
          points.push({ x: toX, y: entryY });
        }
      } else {
        // Target is horizontal
        if (Math.abs(dx) > edgeOffset * 2 && Math.abs(dy) > edgeOffset * 2) {
          // 45-degree corner
          const turnDist = Math.min(Math.abs(dx) - edgeOffset, Math.abs(dy) - edgeOffset) / 2;
          points.push({ x: fromX, y: exitY });
          points.push({ x: fromX + (dx > 0 ? turnDist : -turnDist), y: toY + (dy > 0 ? -turnDist : turnDist) });
          points.push({ x: toX + (toSide === 'left' ? -edgeOffset : edgeOffset), y: toY });
        } else {
          points.push({ x: fromX, y: exitY });
          points.push({ x: fromX, y: toY });
          points.push({ x: toX + (toSide === 'left' ? -edgeOffset : edgeOffset), y: toY });
        }
      }
    }

    points.push({ x: toX, y: toY });

    // Build SVG path
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, []);

  // Wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const container = containerRef.current;
    if (!container) return;

    // Get mouse position relative to container
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom change
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;

    setViewState((prev) => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * zoomDelta));
      const zoomRatio = newZoom / prev.zoom;

      // Adjust pan to zoom toward mouse position
      const newPanX = mouseX - (mouseX - prev.panX) * zoomRatio;
      const newPanY = mouseY - (mouseY - prev.panY) * zoomRatio;

      return {
        panX: newPanX,
        panY: newPanY,
        zoom: newZoom,
      };
    });
  }, []);

  // Mouse down handler for pan start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan with left mouse button and not on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.encounter-map__room') ||
        target.closest('.encounter-map__terminal') ||
        target.closest('.encounter-map__poi') ||
        target.closest('.encounter-map__door')) {
      return;
    }

    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    viewStart.current = { panX: viewState.panX, panY: viewState.panY };

    // Change cursor
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
    if (e.touches.length === 1) {
      // Single finger - start panning
      isDragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      viewStart.current = { panX: viewState.panX, panY: viewState.panY };
    } else if (e.touches.length === 2) {
      // Two fingers - prepare for pinch zoom
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

  // Touch move handler
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && isDragging.current) {
      // Single finger pan
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;

      setViewState((prev) => ({
        ...prev,
        panX: viewStart.current.panX + dx,
        panY: viewStart.current.panY + dy,
      }));
    } else if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      // Pinch zoom
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

        // Adjust pan to zoom toward pinch center
        const newPanX = centerX - (centerX - prev.panX) * zoomRatio;
        const newPanY = centerY - (centerY - prev.panY) * zoomRatio;

        return {
          panX: newPanX,
          panY: newPanY,
          zoom: newZoom,
        };
      });

      lastTouchDistance.current = distance;
      lastTouchCenter.current = { x: centerX + rect.left, y: centerY + rect.top };
    }
  }, []);

  // Touch end handler
  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
  }, []);

  // Room hover handlers
  const handleRoomEnter = useCallback((room: RoomData, e: React.MouseEvent) => {
    setTooltip({
      visible: true,
      x: e.clientX + 15,
      y: e.clientY + 15,
      content: {
        title: room.name,
        description: room.description,
        status: room.status,
      },
    });
  }, []);

  const handleRoomMove = useCallback((e: React.MouseEvent) => {
    setTooltip((prev) => ({
      ...prev,
      x: e.clientX + 15,
      y: e.clientY + 15,
    }));
  }, []);

  const handleRoomLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleRoomClick = useCallback((room: RoomData) => {
    setSelectedRoom((prev) => (prev === room.id ? null : room.id));
  }, []);

  // Render a door symbol at a specific position
  const renderDoorSymbol = (
    x: number,
    y: number,
    doorType: string,
    doorStatus: string | undefined,
    style: { stroke: string; doorFill: string },
    orientation: 'horizontal' | 'vertical',
    key: string
  ) => {
    // Larger door sizes for better visibility
    const doorWidth = orientation === 'horizontal' ? 20 : 12;
    const doorHeight = orientation === 'horizontal' ? 12 : 20;
    const isOpen = doorStatus === 'OPEN';
    const isDamaged = doorStatus === 'DAMAGED';
    const isLocked = doorStatus === 'LOCKED';
    const isSealed = doorStatus === 'SEALED';

    // Build class name with door type and status
    const statusClass = doorStatus ? `encounter-map__door--${doorStatus.toLowerCase()}` : '';

    // Calculate split offset for open doors (slides apart along the wall)
    // For horizontal doors: slide left/right by half the door width + gap
    // For vertical doors: slide up/down by half the door height + gap
    const splitOffset = orientation === 'horizontal' ? doorWidth * 0.55 : doorHeight * 0.55;

    // Calculate the transform for open state
    const openTransformLeft = orientation === 'horizontal'
      ? `translateX(-${splitOffset}px)`
      : `translateY(-${splitOffset}px)`;
    const openTransformRight = orientation === 'horizontal'
      ? `translateX(${splitOffset}px)`
      : `translateY(${splitOffset}px)`;

    // Door colors based on status
    const doorFill = isDamaged ? COLORS.hazard : style.doorFill;
    const doorStroke = isLocked ? COLORS.amber : isSealed ? COLORS.hazard : COLORS.borderMain;
    const doorStrokeWidth = isLocked ? 2 : isSealed ? 2.5 : 1.5;

    return (
      <g key={key} className={`encounter-map__door encounter-map__door--${doorType} ${statusClass}`}>
        {/* Opaque background to cover path lines behind door */}
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

        {/* First door half - always rendered, slides when open */}
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

        {/* Second door half - always rendered, slides when open */}
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
            {/* Main diagonal crack */}
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
            {/* Secondary crack */}
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
            {/* Sparking effect dots */}
            <circle
              cx={x - 2}
              cy={y}
              r={1.5}
              fill={COLORS.amber}
              className="encounter-map__door-spark"
            />
          </g>
        )}

        {/* LOCKED: Lock indicator (keyhole) */}
        {isLocked && !isOpen && (
          <g className="encounter-map__door-lock">
            {/* Background to cover door seam */}
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

        {/* SEALED: Heavy duty indicator (double border + hazard stripes) */}
        {isSealed && !isOpen && (
          <g className="encounter-map__door-seal">
            {/* Inner border */}
            <rect
              x={x - doorWidth / 2 + 3}
              y={y - doorHeight / 2 + 3}
              width={doorWidth - 6}
              height={doorHeight - 6}
              fill="none"
              stroke={COLORS.hazard}
              strokeWidth={1}
            />
            {/* Hazard stripe */}
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

  // Render connection path line only (doors rendered separately above rooms)
  const renderConnectionPath = (conn: ConnectionData) => {
    const fromRoom = roomMap.get(conn.from);
    const toRoom = roomMap.get(conn.to);

    if (!fromRoom || !toRoom) return null;

    const fromEdge = getConnectionEdge(fromRoom, toRoom);
    const toEdge = getConnectionEdge(toRoom, fromRoom);

    const style = CONNECTION_STYLES[conn.door_type || 'standard'] || CONNECTION_STYLES.standard;

    // Generate orthogonal path
    const pathD = generateOrthogonalPath(
      fromEdge.x, fromEdge.y, fromEdge.side,
      toEdge.x, toEdge.y, toEdge.side
    );

    return (
      <path
        key={conn.id}
        d={pathD}
        stroke={style.stroke}
        strokeWidth={2}
        fill="none"
        className="encounter-map__path-line"
      />
    );
  };

  // Render door symbols for a connection (rendered above rooms)
  const renderConnectionDoors = (conn: ConnectionData) => {
    // Use allRoomMap to get positions for ALL rooms (including hidden ones)
    const fromRoom = allRoomMap.get(conn.from);
    const toRoom = allRoomMap.get(conn.to);

    if (!fromRoom || !toRoom || !conn.door_type) return null;

    const fromEdge = getConnectionEdge(fromRoom, toRoom);
    const toEdge = getConnectionEdge(toRoom, fromRoom);

    const style = CONNECTION_STYLES[conn.door_type || 'standard'] || CONNECTION_STYLES.standard;

    const fromOrientation = (fromEdge.side === 'left' || fromEdge.side === 'right') ? 'vertical' : 'horizontal';
    const toOrientation = (toEdge.side === 'left' || toEdge.side === 'right') ? 'vertical' : 'horizontal';

    // Only render doors on visible room edges
    const fromVisible = isRoomVisible(conn.from);
    const toVisible = isRoomVisible(conn.to);

    // Get effective status (runtime override > YAML default)
    const effectiveStatus = getEffectiveDoorStatus(conn);

    return (
      <g key={`doors-${conn.id}`}>
        {fromVisible && renderDoorSymbol(
          fromEdge.x, fromEdge.y,
          conn.door_type, effectiveStatus,
          style, fromOrientation,
          `${conn.id}-from`
        )}
        {toVisible && renderDoorSymbol(
          toEdge.x, toEdge.y,
          conn.door_type, effectiveStatus,
          style, toOrientation,
          `${conn.id}-to`
        )}
      </g>
    );
  };

  // Render a room
  const renderRoom = (room: RoomData) => {
    const x = room.x * unitSize;
    const y = room.y * unitSize;
    const width = room.width * unitSize;
    const height = room.height * unitSize;
    const isSelected = selectedRoom === room.id;

    const statusClass = room.status ? `encounter-map__room--${room.status.toLowerCase()}` : '';

    return (
      <g key={room.id} className="encounter-map__room-group">
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          className={`encounter-map__room ${statusClass} ${isSelected ? 'encounter-map__room--selected' : ''}`}
          data-room-id={room.id}
          onMouseEnter={(e) => handleRoomEnter(room, e)}
          onMouseMove={handleRoomMove}
          onMouseLeave={handleRoomLeave}
          onClick={() => handleRoomClick(room)}
        />
        <text
          x={x + width / 2}
          y={y + height / 2}
          className="encounter-map__room-label"
        >
          {room.name}
        </text>
      </g>
    );
  };

  // Render a terminal inside a room
  const renderTerminal = (terminal: any) => {
    const x = terminal.position.x * unitSize;
    const y = terminal.position.y * unitSize;

    return (
      <g
        key={terminal.id}
        className="encounter-map__terminal"
        transform={`translate(${x}, ${y})`}
        onMouseEnter={(e) => {
          setTooltip({
            visible: true,
            x: e.clientX + 15,
            y: e.clientY + 15,
            content: {
              title: terminal.name,
              type: 'Terminal',
            },
          });
        }}
        onMouseMove={handleRoomMove}
        onMouseLeave={handleRoomLeave}
      >
        <rect x={-6} y={-5} width={12} height={10} rx={1} fill={COLORS.amber} />
        <rect x={-4} y={-3} width={8} height={6} fill={COLORS.bgPrimary} />
        <rect x={-2} y={5} width={4} height={2} fill={COLORS.amber} />
      </g>
    );
  };

  // Render a POI
  const renderPoi = (poi: any) => {
    const x = poi.position.x * unitSize;
    const y = poi.position.y * unitSize;
    const iconPath = POI_ICONS[poi.icon] || POI_ICONS[poi.type] || POI_ICONS.item;

    const poiColor = poi.type === 'hazard' ? COLORS.hazard :
                     poi.type === 'objective' ? COLORS.amber :
                     COLORS.teal;

    return (
      <g
        key={poi.id}
        className={`encounter-map__poi encounter-map__poi--${poi.type}`}
        transform={`translate(${x}, ${y})`}
        onMouseEnter={(e) => {
          setTooltip({
            visible: true,
            x: e.clientX + 15,
            y: e.clientY + 15,
            content: {
              title: poi.name,
              description: poi.description,
              status: poi.status,
              type: poi.type,
            },
          });
        }}
        onMouseMove={handleRoomMove}
        onMouseLeave={handleRoomLeave}
      >
        <path d={iconPath} fill={poiColor} stroke={COLORS.bgPrimary} strokeWidth={1} />
      </g>
    );
  };

  // Get all connections from map data (support both 'connections' and 'doors' format)
  const allConnections: ConnectionData[] = useMemo(() => {
    // New format: explicit connections array
    if (mapData.connections) {
      return mapData.connections;
    }
    // Legacy format: derive from doors with room_a/room_b
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

  // Connection lines only show when BOTH rooms are visible
  const visibleConnectionLines: ConnectionData[] = useMemo(() => {
    return allConnections.filter(conn =>
      isRoomVisible(conn.from) && isRoomVisible(conn.to)
    );
  }, [allConnections, isRoomVisible]);

  // Doors show when AT LEAST ONE room is visible
  const visibleDoors: ConnectionData[] = useMemo(() => {
    return allConnections.filter(conn =>
      isRoomVisible(conn.from) || isRoomVisible(conn.to)
    );
  }, [allConnections, isRoomVisible]);

  // Filter terminals to only show those in visible rooms
  const visibleTerminals = useMemo(() => {
    if (!mapData.terminals) return [];
    return mapData.terminals.filter(terminal => isRoomVisible(terminal.room));
  }, [mapData.terminals, isRoomVisible]);

  // Filter POIs to only show those in visible rooms
  const visiblePois = useMemo(() => {
    if (!mapData.poi) return [];
    return mapData.poi.filter(poi => isRoomVisible(poi.room));
  }, [mapData.poi, isRoomVisible]);

  return (
    <div
      ref={containerRef}
      className="encounter-map-renderer"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: 'grab', touchAction: 'none' }}
    >
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="encounter-map-renderer__svg"
        preserveAspectRatio="xMidYMid meet"
        style={{
          transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Background */}
        <rect x={0} y={0} width={svgWidth} height={svgHeight} fill={COLORS.bgPrimary} />

        {/* Connection path lines (rendered first, below rooms) - only when BOTH rooms visible */}
        <g className="encounter-map__connection-paths">
          {visibleConnectionLines.map(renderConnectionPath)}
        </g>

        {/* Rooms (filtered by visibility) */}
        <g className="encounter-map__rooms">
          {visibleRooms.map(renderRoom)}
        </g>

        {/* Doors (rendered above rooms) - shown when AT LEAST ONE room visible */}
        <g className="encounter-map__doors">
          {visibleDoors.map(renderConnectionDoors)}
        </g>

        {/* Terminals (filtered by room visibility) */}
        <g className="encounter-map__terminals">
          {visibleTerminals.map(renderTerminal)}
        </g>

        {/* Points of Interest (filtered by room visibility) */}
        <g className="encounter-map__pois">
          {visiblePois.map(renderPoi)}
        </g>
      </svg>

      {/* Reset view button (shows when zoomed or panned) */}
      {(viewState.zoom !== 1 || viewState.panX !== 0 || viewState.panY !== 0) && (
        <button
          className="encounter-map__reset-btn"
          onClick={handleResetView}
          title="Reset view"
        >
          RESET VIEW
        </button>
      )}

      {/* Legend */}
      <div className="encounter-map__legend">
        <div className="encounter-map__legend-title">LEGEND</div>
        <div className="encounter-map__legend-section">
          <div className="encounter-map__legend-header">DOORS</div>
          <div className="encounter-map__legend-item">
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.teal} stroke={COLORS.borderMain} strokeWidth="1.5" />
            </svg>
            <span>Standard</span>
          </div>
          <div className="encounter-map__legend-item">
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.amber} stroke={COLORS.borderMain} strokeWidth="1.5" />
              <rect x="5" y="5" width="14" height="6" fill="none" stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span>Airlock</span>
          </div>
          <div className="encounter-map__legend-item">
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.tealBright} stroke={COLORS.borderMain} strokeWidth="1.5" />
              <line x1="5" y1="4" x2="19" y2="12" stroke={COLORS.bgPrimary} strokeWidth="1.5" />
              <line x1="19" y1="4" x2="5" y2="12" stroke={COLORS.bgPrimary} strokeWidth="1.5" />
            </svg>
            <span>Blast Door</span>
          </div>
          <div className="encounter-map__legend-item">
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.hazard} stroke={COLORS.borderMain} strokeWidth="1.5" />
            </svg>
            <span>Emergency</span>
          </div>
        </div>
        <div className="encounter-map__legend-section">
          <div className="encounter-map__legend-header">POINTS OF INTEREST</div>
          <div className="encounter-map__legend-item">
            <svg width="20" height="14" viewBox="0 0 20 14">
              <path d="M10,2 L15,10 L5,10 Z" fill={COLORS.amber} stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span>Objective</span>
          </div>
          <div className="encounter-map__legend-item">
            <svg width="20" height="14" viewBox="0 0 20 14">
              <rect x="6" y="3" width="8" height="8" fill={COLORS.teal} stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span>Item</span>
          </div>
          <div className="encounter-map__legend-item">
            <svg width="20" height="14" viewBox="0 0 20 14">
              <path d="M10,2 L16,10 L4,10 Z" fill={COLORS.hazard} stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span>Hazard</span>
          </div>
          <div className="encounter-map__legend-item">
            <svg width="20" height="14" viewBox="0 0 20 14">
              <rect x="4" y="2" width="12" height="10" rx="1" fill={COLORS.amber} stroke={COLORS.bgPrimary} strokeWidth="1" />
              <rect x="6" y="4" width="8" height="6" fill={COLORS.bgPrimary} />
            </svg>
            <span>Terminal</span>
          </div>
        </div>
      </div>

      <RoomTooltip
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        title={tooltip.content.title}
        description={tooltip.content.description}
        status={tooltip.content.status}
        type={tooltip.content.type}
      />
    </div>
  );
}
