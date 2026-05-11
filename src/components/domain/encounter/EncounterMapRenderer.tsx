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
  Door,
  GridEncounterMapData,
  GridRoom,
  DoorStatus,
  DoorStatusState,
  HullDef,
  RoomVisibilityState,
  TokenState,
  TokenStatus,
  TokenType,
} from '../../../types/encounterMap';
import { getGridCell } from '../../../utils/svgCoordinates';
import { pointInPolygon } from '../../../utils/polygon2d';
import { ENCOUNTER_ICONS, iconSymbolId } from './EncounterIcons';
import { LegendPanel } from './LegendPanel';
import { LevelIndicator } from './LevelIndicator';
import { TokenLayer, tokenTouchActive } from './TokenLayer';
import { TokenPopup } from './TokenPopup';
import { RoomContextMenu } from './RoomContextMenu';
import { DoorStatusPopup } from '../../gm/DoorStatusPopup';
import { topDownProjection } from './geometry/gridProjection';
import { makeMapView } from './geometry/mapView';
import { doorEndpoints } from './geometry/roomGeometry';
import { normalizeDoor, normalizeDoors } from './doors/doorNormalizer';
import { playerDoorVisible } from './doors/doorVisibility';
import { useRoomRevealAnimations } from './animation/useRoomRevealAnimations';
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
  onTokenMove?: (id: string, x: number, y: number, roomId: string) => void;
  onTokenRemove?: (id: string) => void;
  onTokenStatusToggle?: (id: string, status: TokenStatus) => void;
  /** Hull polygon override — takes precedence over mapData.hull.
   *  For multi-deck maps, pass the manifest hull here so every deck shows
   *  the same ship silhouette regardless of which level is active. */
  hull?: HullDef;
  /** Optional style override for the root container div (e.g. position:absolute when embedded in MapPreview) */
  style?: React.CSSProperties;
  /** Extra grid-cell padding around map in the SVG viewBox — increases effective "zoom out" at default zoom:1 */
  viewPadding?: number;
  /** Whether to show the legend panel (default true) */
  showLegend?: boolean;
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
  bgRoom: '#0a1010',
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
  hullFill: '#142020',
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

// Wall stroke thickness in pixels (creates the heavy-wall aesthetic)
const WALL_THICKNESS = 5;

// -------------------------------------------------------------------
// All inline geometry helpers were removed in plan 21-03. They now live in:
//   - polygon2d (pointInPolygon, polygonAreaCentroid, octagonFromRect, etc.)
//   - geometry/roomGeometry (roomLabelGrid, roomWallEdges, doorEndpoints, etc.)
//   - geometry/mapView (the renderer's seam — SVG-space queries)
//   - doors/doorNormalizer (legacy → canonical Door conversion)
// -------------------------------------------------------------------

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
  hull: hullProp,
  style,
  viewPadding = 2,
  showLegend = true,
}: EncounterMapRendererProps) {
  // Hull override (manifest-level) takes precedence over per-deck hull
  const effectiveHull = hullProp ?? mapData.hull;
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

  // unit_size — pixels per grid cell (default 40 if YAML omits it)
  const unitSize = mapData.unit_size ?? 40;

  // Projection + mapView — the renderer's seam to all SVG-space queries.
  // After plan 21-03 the renderer never multiplies by unitSize directly;
  // everything goes through `view`. Switching to an iso projection later
  // is a one-line constructor change here.
  const projection = useMemo(
    () => topDownProjection({ unitSize }),
    [unitSize]
  );
  const view = useMemo(() => makeMapView(projection), [projection]);

  // Canonical Door[] derived from top-level mapData.doors via doorNormalizer.
  // After plan 21-04 the YAML carries `doors:` at the map root (canonical
  // AuthoredDoor shape); the legacy nested room.doors[] adapter is gone.
  const canonicalDoors: Door[] = useMemo(() => {
    if (!mapData.rooms || mapData.rooms.length === 0) return [];
    const authored = mapData.doors ?? [];
    if (authored.length === 0) return [];
    try {
      return normalizeDoors(authored, mapData.rooms);
    } catch (err) {
      // Defensive: a single bad authored entry should not blank the map.
      // Fall back to per-door normalization, dropping bad entries.
      const out: Door[] = [];
      for (let i = 0; i < authored.length; i++) {
        try {
          // normalizeDoors enforces overlap detection across the whole
          // set; per-entry path here uses normalizeDoor (no overlap check)
          // for resilience against single bad entries.
          out.push(normalizeDoor(authored[i], mapData.rooms, i));
        } catch {
          // skip the bad door rather than blank the entire map
        }
      }
      console.error(
        `[EncounterMapRenderer] ${authored.length - out.length} door(s) dropped due to normalization errors:`,
        err,
      );
      return out;
    }
  }, [mapData.rooms, mapData.doors]);

  // SVG dimensions — always computed from ALL rooms + hull (never filtered by visibility)
  const { originX, originY, svgWidth, svgHeight } = useMemo(() => {
    const bb = view.bbox(mapData.rooms, effectiveHull, viewPadding);
    return {
      originX: bb.originX,
      originY: bb.originY,
      svgWidth: bb.width,
      svgHeight: bb.height,
    };
  }, [view, mapData.rooms, effectiveHull, viewPadding]);

  // Hull SVG polygon points string — projected via mapView
  const hullSvgPoints = useMemo(() => {
    if (!effectiveHull) return null;
    return effectiveHull.polygon
      .map(([x, y]) => {
        const sp = view.project({ gx: x, gy: y });
        return `${sp.x},${sp.y}`;
      })
      .join(' ');
  }, [effectiveHull, view]);

  // Check if a room is visible (default to true if no visibility state)
  const isRoomVisible = useCallback((roomId: string): boolean => {
    if (!roomVisibility) return true;
    return roomVisibility[roomId] !== false;
  }, [roomVisibility]);

  // Room reveal/hide cascade — extracted to animation/useRoomRevealAnimations.
  // scheduleReveal (pure) computes the per-room steps; the hook owns the timers.
  // enabled=false (GM view) returns an empty Map and runs no timers.
  const mapIdentity = `${mapData.deck_id ?? ''}|${mapData.name}`;
  const roomAnimState = useRoomRevealAnimations({
    visibility: roomVisibility,
    rooms: mapData.rooms,
    mapIdentity,
    enabled: !isGM,
  });

  // -------------------------------------------------------------------
  // Get effective door status: runtime override > authored default.
  // Door id is canonical. Plan 21-04's migration preserved the legacy
  // `${room.id}_door_${index}` id form on every existing map so any
  // persisted runtime overrides in DoorStatusState continue to resolve
  // after the data layer flipped to the top-level `doors:` shape.
  // -------------------------------------------------------------------
  const getEffectiveDoorStatus = useCallback((door: Door): DoorStatus => {
    return (doorStatus?.[door.id] as DoorStatus) || door.status || 'CLOSED';
  }, [doorStatus]);

  // -------------------------------------------------------------------
  // Find room containing a grid cell. Uses pointInPolygon from polygon2d.
  // -------------------------------------------------------------------
  const findRoomAtCell = useCallback((gridX: number, gridY: number): GridRoom | null => {
    // Cell center point for circle/polygon containment tests
    const px = gridX + 0.5;
    const py = gridY + 0.5;
    return mapData.rooms.find(room => {
      if (room.circle) {
        const { cx, cy, r } = room.circle;
        return (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
      }
      if (room.polygon && room.polygon.length > 0) {
        const poly = room.polygon.map(([x, y]) => ({ x, y }));
        return pointInPolygon({ x: px, y: py }, poly);
      }
      return (room.rects ?? []).some(r => gridX >= r.x && gridX < r.x + r.w && gridY >= r.y && gridY < r.y + r.h);
    }) ?? null;
  }, [mapData.rooms]);

  // -------------------------------------------------------------------
  // Check if a grid cell is occupied by a token
  // -------------------------------------------------------------------
  const isCellOccupied = useCallback((gridX: number, gridY: number): boolean => {
    if (!tokens) return false;
    return Object.values(tokens).some(t => t.x === gridX && t.y === gridY);
  }, [tokens]);

  // -------------------------------------------------------------------
  // Door right-click handler — opens DoorStatusPopup at cursor position.
  // Operates on the canonical Door (door.id is the persisted identifier).
  // -------------------------------------------------------------------
  const handleDoorClick = useCallback((
    e: React.MouseEvent,
    door: Door,
  ) => {
    if (!isGM || !onDoorStatusChange) return;
    e.stopPropagation();
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setSelectedDoor({
      id: door.id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      status: getEffectiveDoorStatus(door),
    });
  }, [isGM, onDoorStatusChange, getEffectiveDoorStatus]);

  // -------------------------------------------------------------------
  // Room right-click handler — opens context menu (GM only)
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
  // Room tap handler — shows info popup (player terminal only)
  // Uses pointerdown+pointerup for reliable touch+mouse support.
  // -------------------------------------------------------------------
  const roomTapStart = useRef<{ x: number; y: number } | null>(null);

  const handleRoomPointerDown = useCallback((e: React.PointerEvent) => {
    if (isGM) return;
    roomTapStart.current = { x: e.clientX, y: e.clientY };
  }, [isGM]);

  const handleRoomPointerUp = useCallback((e: React.PointerEvent, room: GridRoom) => {
    if (isGM) return;
    const start = roomTapStart.current;
    roomTapStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.sqrt(dx * dx + dy * dy) > 8) return; // was a drag, not a tap
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
  //
  // Chamfered rects (chamfer > 0): rendered as octagons via <polygon>.
  // Plain rects: rendered as <rect> with exterior wall segments from the
  // wall-segment algorithm (shared edges cancel out, only exterior drawn).
  // This hybrid approach keeps correct wall sharing for plain multi-rect rooms
  // while giving chamfered rooms clean diagonal corners.
  // -------------------------------------------------------------------
  const renderRoom = (room: GridRoom) => {
    const visible = isRoomVisible(room.id);
    const animEntry = roomAnimState.get(room.id);
    const animState = animEntry?.anim;  // 'revealing' | 'hiding' | undefined
    // Players only see revealed rooms — but keep room in DOM during hide animation
    if (!isGM && !visible && !animEntry) return null;
    const roomOpacity = isGM && !visible ? 0.25 : 1.0;
    // animEntry.delayMs is the cascade stagger baked by scheduleReveal
    const staggerDelay = animEntry ? animEntry.delayMs : 0;

    // During animation: omit the opacity prop so CSS animation can control it
    // After animation: restore normal opacity
    const svgOpacity = animEntry ? undefined : roomOpacity;

    // Build className for the <g> group
    const roomGroupClass = [
      'encounter-map__room-group',
      animState === 'revealing' ? 'room-revealing' : '',
      animState === 'hiding' ? 'room-hiding' : '',
      // GM dim: apply when no animation and room is hidden
      (isGM && !animState && !visible) ? 'room-gm-dim' : '',
    ].filter(Boolean).join(' ');

    const label = room.name ? view.labelPosition(room) : null;
    const labelEl = label && (isGM || visible) ? (
      <text
        x={label.x}
        y={label.y}
        className="encounter-map__room-label"
        fontSize={view.unitSize * 0.45}
        fill="#8b7355"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {room.name}
      </text>
    ) : null;

    // === Circular room ===
    if (room.circle) {
      const center = view.project({ gx: room.circle.cx, gy: room.circle.cy });
      // Circle radius scales with horizontal unit size (top-down projection;
      // for iso projections circles would render as ellipses — out of scope).
      const svgCx = center.x;
      const svgCy = center.y;
      const svgR = room.circle.r * view.unitSize;
      return (
        <g
          key={room.id}
          className={roomGroupClass}
          opacity={svgOpacity}
          style={animState ? { animationDelay: `${staggerDelay}ms` } : undefined}
        >
          <circle cx={svgCx} cy={svgCy} r={svgR} fill={COLORS.bgRoom} className="encounter-map__floor" />
          <circle cx={svgCx} cy={svgCy} r={svgR} fill="none" stroke={COLORS.hullFill} strokeWidth={WALL_THICKNESS} className="encounter-map__wall" />
          {isGM ? (
            <circle
              cx={svgCx} cy={svgCy} r={svgR}
              fill="transparent"
              style={{ cursor: 'context-menu' }}
              onContextMenu={(e) => handleRoomContextMenu(e, room)}
              className="encounter-map__room"
            />
          ) : room.name && (
            <circle
              cx={svgCx} cy={svgCy} r={svgR}
              fill="transparent"
              pointerEvents="all"
              style={{ cursor: 'pointer' }}
              onPointerDown={handleRoomPointerDown}
              onPointerUp={(e) => handleRoomPointerUp(e, room)}
              className="encounter-map__room"
            />
          )}
          {labelEl}
        </g>
      );
    }

    // === Freeform polygon room ===
    if (room.polygon && room.polygon.length > 0) {
      const points = room.polygon
        .map(([x, y]) => {
          const sp = view.project({ gx: x, gy: y });
          return `${sp.x},${sp.y}`;
        })
        .join(' ');
      return (
        <g
          key={room.id}
          className={roomGroupClass}
          opacity={svgOpacity}
          style={animState ? { animationDelay: `${staggerDelay}ms` } : undefined}
        >
          <polygon points={points} fill={COLORS.bgRoom} className="encounter-map__floor" />
          <polygon points={points} fill="none" stroke={COLORS.hullFill} strokeWidth={WALL_THICKNESS} strokeLinejoin="miter" className="encounter-map__wall" />
          {isGM ? (
            <polygon
              points={points}
              fill="transparent"
              style={{ cursor: 'context-menu' }}
              onContextMenu={(e) => handleRoomContextMenu(e, room)}
              className="encounter-map__room"
            />
          ) : room.name && (
            <polygon
              points={points}
              fill="transparent"
              pointerEvents="all"
              style={{ cursor: 'pointer' }}
              onPointerDown={handleRoomPointerDown}
              onPointerUp={(e) => handleRoomPointerUp(e, room)}
              className="encounter-map__room"
            />
          )}
          {labelEl}
        </g>
      );
    }

    // === Rect room (plain + chamfered) ===
    const plainRects = (room.rects ?? []).filter(r => (r.chamfer ?? 0) === 0);
    const chamferedRects = (room.rects ?? []).filter(r => (r.chamfer ?? 0) > 0);
    const walls = view.wallEdges(plainRects);

    // Pre-compute SVG coords for each rect (used by floor + hit targets)
    const plainRectSvg = plainRects.map((rect) => {
      const tl = view.project({ gx: rect.x, gy: rect.y });
      const br = view.project({ gx: rect.x + rect.w, gy: rect.y + rect.h });
      return {
        x: Math.min(tl.x, br.x),
        y: Math.min(tl.y, br.y),
        w: Math.abs(br.x - tl.x),
        h: Math.abs(br.y - tl.y),
      };
    });

    return (
      <g
        key={room.id}
        className={roomGroupClass}
        opacity={svgOpacity}
        style={animState ? { animationDelay: `${staggerDelay}ms` } : undefined}
      >
        {/* Floor fill — plain rects */}
        {plainRectSvg.map((r, i) => (
          <rect
            key={`floor-p-${i}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill={COLORS.bgRoom}
            className="encounter-map__floor"
          />
        ))}

        {/* Floor fill — chamfered rects (octagon polygon) */}
        {chamferedRects.map((rect, i) => (
          <polygon
            key={`floor-c-${i}`}
            points={view.roomChamferedPolygonPoints(rect)}
            fill={COLORS.bgRoom}
            className="encounter-map__floor"
          />
        ))}

        {/* Exterior wall segments — plain rects */}
        {walls.map((wall, i) => (
          <line
            key={`wall-${i}`}
            x1={wall.from.x} y1={wall.from.y}
            x2={wall.to.x}   y2={wall.to.y}
            stroke={COLORS.hullFill}
            strokeWidth={WALL_THICKNESS}
            strokeLinecap="square"
            className="encounter-map__wall"
          />
        ))}

        {/* Wall outlines — chamfered rects (polygon stroke) */}
        {chamferedRects.map((rect, i) => (
          <polygon
            key={`wall-c-${i}`}
            points={view.roomChamferedPolygonPoints(rect)}
            fill="none"
            stroke={COLORS.hullFill}
            strokeWidth={WALL_THICKNESS}
            strokeLinejoin="miter"
            className="encounter-map__wall"
          />
        ))}

        {/* Invisible hit targets — GM right-click, player tap (only if description) */}
        {isGM && plainRectSvg.map((r, i) => (
          <rect
            key={`hit-p-${i}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill="transparent"
            style={{ cursor: 'context-menu' }}
            onContextMenu={(e) => handleRoomContextMenu(e, room)}
            className="encounter-map__room"
          />
        ))}
        {isGM && chamferedRects.map((rect, i) => (
          <polygon
            key={`hit-c-${i}`}
            points={view.roomChamferedPolygonPoints(rect)}
            fill="transparent"
            style={{ cursor: 'context-menu' }}
            onContextMenu={(e) => handleRoomContextMenu(e, room)}
            className="encounter-map__room"
          />
        ))}
        {!isGM && room.name && plainRectSvg.map((r, i) => (
          <rect
            key={`hit-p-${i}`}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            fill="transparent"
            pointerEvents="all"
            style={{ cursor: 'pointer' }}
            onPointerDown={handleRoomPointerDown}
            onPointerUp={(e) => handleRoomPointerUp(e, room)}
            className="encounter-map__room"
          />
        ))}
        {!isGM && room.name && chamferedRects.map((rect, i) => (
          <polygon
            key={`hit-c-${i}`}
            points={view.roomChamferedPolygonPoints(rect)}
            fill="transparent"
            pointerEvents="all"
            style={{ cursor: 'pointer' }}
            onPointerDown={handleRoomPointerDown}
            onPointerUp={(e) => handleRoomPointerUp(e, room)}
            className="encounter-map__room"
          />
        ))}

        {labelEl}
      </g>
    );
  };

  // -------------------------------------------------------------------
  // renderPoi — SVG vector icon + label for a point of interest
  // Icons sourced from @ant-design/icons-svg, colorized via fill on <use>
  // -------------------------------------------------------------------
  const renderPoi = (poi: import('../../../types/encounterMap').PoiData) => {
    if (!isGM && !isRoomVisible(poi.room)) return null;

    const center = view.project({ gx: poi.position.x, gy: poi.position.y });
    const cx = center.x;
    const cy = center.y;

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

        {/* Hull polygon — ship/structure outer frame.
            Filled with hull-interior color so the space between rooms
            reads as solid hull material rather than empty void.
            Rendered above the background grid but below room floors. */}
        {hullSvgPoints && (
          <g className="encounter-map__hull">
            <polygon
              points={hullSvgPoints}
              fill={COLORS.hullFill}
              className="encounter-map__hull-fill"
            />
            <polygon
              points={hullSvgPoints}
              fill="none"
              stroke={COLORS.hullFill}
              strokeWidth={4}
              strokeLinejoin="miter"
              className="encounter-map__hull-outline"
            />
          </g>
        )}

        {/* Rooms (with walls, floor fill, context menu targets, labels) */}
        <g className="encounter-map__rooms">
          {mapData.rooms.map(renderRoom)}
        </g>

        {/* Door symbols — rendered above room floors and walls.
            Iterates the canonical Door[] (normalized from top-level
            mapData.doors by doorNormalizer at load).
            Door visibility uses ref-by-id checks against roomA/roomB —
            no spatial lookup. If a door's roomB is null (exterior) the
            doorEndpoints helper resolves the cell on the other side. */}
        <g className="encounter-map__doors">
          {canonicalDoors.map((door) => {
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
                  const [aCell, otherCell] = doorEndpoints(door, mapData.rooms);
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
            const contextMenuHandler = (isGM && onDoorStatusChange)
              ? (e: React.MouseEvent) => handleDoorClick(e, door)
              : undefined;
            return renderDoorSymbol(
              svgPos.x, svgPos.y, door.type, getEffectiveDoorStatus(door),
              styleEntry, orientation, `door-${door.id}`, contextMenuHandler
            );
          })}
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
                // Fallback: center of container
                const rect = containerRef.current?.getBoundingClientRect();
                setSelectedTokenId(id);
                setSelectedTokenPos({
                  x: e ? e.clientX - (rect?.left || 0) : (rect?.width || 0) / 2,
                  y: e ? e.clientY - (rect?.top || 0) : (rect?.height || 0) / 3,
                });
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
        {/* Reset view button - top center */}
        {(viewState.zoom !== 1 || viewState.panX !== 0 || viewState.panY !== 0) && (
          <button
            className="encounter-map__reset-btn"
            onClick={handleResetView}
            title="Reset view"
            style={{
              gridArea: 'top-center',
              alignSelf: 'start',
              justifySelf: 'center',
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
        {showLegend && (
          <div
            className="encounter-map__legend"
            style={{ gridArea: 'bottom-right', alignSelf: 'end', justifySelf: 'end' }}
          >
            <LegendPanel />
          </div>
        )}
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

      {/* Room context menu — GM right-click (with toggle) or player tap (info only) */}
      {contextMenu && (
        <RoomContextMenu
          room={contextMenu.room}
          isVisible={isGM ? isRoomVisible(contextMenu.room.id) : undefined}
          x={contextMenu.x}
          y={contextMenu.y}
          onToggleVisibility={isGM ? () => {
            onRoomToggle?.(contextMenu.room.id, !isRoomVisible(contextMenu.room.id));
            setContextMenu(null);
          } : undefined}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
