/**
 * EncounterMapRenderer - SVG renderer for grid-based encounter maps
 *
 * Renders GridEncounterMapData: rooms as touching wall-aligned rectangles,
 * wall-segment algorithm for exterior walls, scanline floor texture,
 * faint background grid, and GM right-click context menu for room visibility.
 */

import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { usePanZoom } from '../../../hooks/usePanZoom';
import { useExclusivePopover } from '../../../hooks/useExclusivePopover';
import { useTokenPlacement } from '../../../hooks/useTokenPlacement';
import { screenToSVG, inverseRotatePoint, snapToGrid } from '../../../utils/svgCoordinates';
import {
  Door,
  GridEncounterMapData,
  GridRoom,
  DoorStatus,
  DoorStatusState,
  HullDef,
  PoiData,
  RoomVisibilityState,
  TokenState,
  TokenStatus,
  TokenType,
} from '../../../types/encounterMap';
import { pointInPolygon } from '../../../utils/polygon2d';
import { ENCOUNTER_ICONS, iconSymbolId } from './EncounterIcons';
import { LegendPanel } from './LegendPanel';
import { LevelIndicator } from './LevelIndicator';
import { TokenLayer } from './TokenLayer';
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
  /** Callback when any user clicks (taps) a room — used by editor preview for click-to-jump */
  onRoomClick?: (roomId: string) => void;
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
  /** Whether vents are visible to players */
  ventsVisible?: boolean;
  /** Callback when GM right-clicks a vent to toggle all vents */
  onVentsToggle?: (visible: boolean) => void;
  // ----------------------------------------------------------------
  // Editor-mode props (Plan 29-03) — all four are inert unless `editable` is true.
  // Wiring these callbacks to Monaco edits is Plan 29-04.
  // ----------------------------------------------------------------
  /** Enable editor-mode POI interactions (click-to-select, drag-to-move, empty-cell-click). */
  editable?: boolean;
  /** Called when the user clicks a POI in editor mode (no drag occurred). */
  onPoiClick?: (poiId: string) => void;
  /** Called when the user drags a POI in editor mode; (gridX, gridY) are the snapped drop cell. */
  onPoiMove?: (poiId: string, x: number, y: number) => void;
  /** Called when the user clicks an empty grid cell (no room/POI hit) in editor mode. */
  onEmptyCellClick?: (x: number, y: number) => void;
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
  vent: '#2d7a5a',
  ventHidden: '#1a4a35',
};

// Connection/door type styles
const CONNECTION_STYLES: Record<string, { stroke: string; doorFill: string }> = {
  standard: { stroke: COLORS.pathLine, doorFill: COLORS.teal },
  airlock: { stroke: COLORS.pathLine, doorFill: COLORS.amber },
  blast_door: { stroke: COLORS.pathLine, doorFill: COLORS.tealBright },
  emergency: { stroke: COLORS.pathLine, doorFill: COLORS.hazard },
  open: { stroke: COLORS.pathLine, doorFill: COLORS.teal },
};

// Wall stroke thickness in pixels (creates the heavy-wall aesthetic)
const WALL_THICKNESS = 5;

// -------------------------------------------------------------------
// All inline geometry helpers were removed in plan 21-03. They now live in:
//   - polygon2d (pointInPolygon, polygonAreaCentroid, octagonFromRect, etc.)
//   - geometry/roomGeometry (roomLabelGrid, roomWallEdges, doorEndpoints, etc.)
//   - geometry/mapView (the renderer's seam — SVG-space queries)
//   - doors/doorNormalizer (legacy → canonical Door conversion)
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// Exclusive popover discriminated union — one open slot at a time.
// Defined here (renderer module scope) so the hook stays generic.
// -------------------------------------------------------------------
type EncounterPopover =
  | { type: 'token'; payload: { id: string; pos: { x: number; y: number } } }
  | { type: 'door';  payload: { id: string; x: number; y: number; status: DoorStatus } }
  | { type: 'poi';   payload: { poi: PoiData; x: number; y: number } }
  | { type: 'room';  payload: { room: GridRoom; x: number; y: number } }
  | { type: 'vent';  payload: { x: number; y: number; currentlyVisible: boolean } }

export function EncounterMapRenderer({
  mapData,
  roomVisibility,
  currentLevel = 1,
  totalLevels = 1,
  deckName,
  tokens,
  isGM = false,
  onRoomToggle,
  onRoomClick,
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
  ventsVisible,
  onVentsToggle,
  editable = false,
  onPoiClick,
  onPoiMove,
  onEmptyCellClick,
}: EncounterMapRendererProps) {
  // Hull override (manifest-level) takes precedence over per-deck hull
  const effectiveHull = hullProp ?? mapData.hull;

  // Single exclusive-popover state — opening any slot closes all others.
  const { popover, open: openPopover, close: closePopover } = useExclusivePopover<EncounterPopover>();

  // Close vent popup on click outside
  const ventPopupRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (popover?.type !== 'vent') return;
    const handler = (e: MouseEvent) => {
      if (ventPopupRef.current && !ventPopupRef.current.contains(e.target as Node)) {
        closePopover();
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [popover?.type, closePopover]);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { viewState, containerHandlers, resetView: handleResetView } = usePanZoom(containerRef);

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

  // Fixed map rotation (YAML-authored, not user-controlled)
  const mapRotation = mapData.rotation ?? 0;
  const mapCenterX = originX + svgWidth / 2;
  const mapCenterY = originY + svgHeight / 2;
  // For 90/270° rotations the effective bounding box flips W↔H
  const rotIs90or270 = mapRotation === 90 || mapRotation === 270;
  const rotViewBoxX = rotIs90or270 ? mapCenterX - svgHeight / 2 : originX;
  const rotViewBoxY = rotIs90or270 ? mapCenterY - svgWidth / 2 : originY;
  const rotViewBoxW = rotIs90or270 ? svgHeight : svgWidth;
  const rotViewBoxH = rotIs90or270 ? svgWidth : svgHeight;

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
  // Editor-mode POI drag state (Plan 29-03)
  // Mirrors TokenLayer's pendingDrag/DRAG_THRESHOLD pattern.
  // Uses document-level pointer events (same as TokenLayer) for reliable
  // drag tracking even when pointer leaves the POI element.
  // Active only when editable=true; inert otherwise.
  // -------------------------------------------------------------------
  const POI_DRAG_THRESHOLD = 5;
  const poiPendingDrag = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const poiIsDraggingRef = useRef(false);
  const [poiDragState, setPoiDragState] = useState<{
    id: string;
    ghostX: number;
    ghostY: number;
  } | null>(null);
  const poiDragStateRef = useRef<typeof poiDragState>(null);

  // Keep ref in sync with state for stable callbacks
  useEffect(() => {
    poiDragStateRef.current = poiDragState;
  }, [poiDragState]);

  // Stable refs for editable callbacks (avoids closure staleness in document handlers)
  const editableRef = useRef(editable);
  const onPoiMoveRef = useRef(onPoiMove);
  const onPoiClickRef = useRef(onPoiClick);
  const onEmptyCellClickRef = useRef(onEmptyCellClick);
  useEffect(() => { editableRef.current = editable; }, [editable]);
  useEffect(() => { onPoiMoveRef.current = onPoiMove; }, [onPoiMove]);
  useEffect(() => { onPoiClickRef.current = onPoiClick; }, [onPoiClick]);
  useEffect(() => { onEmptyCellClickRef.current = onEmptyCellClick; }, [onEmptyCellClick]);

  // Stable refs for map geometry (needed in document-level handlers)
  const mapRotationRef = useRef(mapRotation);
  const mapCenterXRef = useRef(mapCenterX);
  const mapCenterYRef = useRef(mapCenterY);
  const unitSizeRef = useRef(unitSize);
  useEffect(() => { mapRotationRef.current = mapRotation; }, [mapRotation]);
  useEffect(() => { mapCenterXRef.current = mapCenterX; }, [mapCenterX]);
  useEffect(() => { mapCenterYRef.current = mapCenterY; }, [mapCenterY]);
  useEffect(() => { unitSizeRef.current = unitSize; }, [unitSize]);

  // Document-level POI drag handlers (attached only when editable)
  useEffect(() => {
    if (!editable) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!poiPendingDrag.current && !poiIsDraggingRef.current) return;
      if (poiPendingDrag.current && !poiIsDraggingRef.current) {
        // Check drag threshold
        const dx = e.clientX - poiPendingDrag.current.startX;
        const dy = e.clientY - poiPendingDrag.current.startY;
        if (Math.sqrt(dx * dx + dy * dy) < POI_DRAG_THRESHOLD) return;
        // Threshold crossed — enter drag mode
        poiIsDraggingRef.current = true;
      }
      if (!poiIsDraggingRef.current) return;
      const svg = svgRef.current;
      if (!svg) return;
      const svgCoords = screenToSVG(svg, e.clientX, e.clientY);
      const unrotated = inverseRotatePoint(
        svgCoords.x, svgCoords.y,
        mapRotationRef.current, mapCenterXRef.current, mapCenterYRef.current,
      );
      const snapped = snapToGrid(unrotated.x, unrotated.y, unitSizeRef.current);
      const pending = poiPendingDrag.current;
      if (pending) {
        setPoiDragState({ id: pending.id, ghostX: snapped.gridX, ghostY: snapped.gridY });
        poiDragStateRef.current = { id: pending.id, ghostX: snapped.gridX, ghostY: snapped.gridY };
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const pending = poiPendingDrag.current;
      const wasDragging = poiIsDraggingRef.current;
      poiPendingDrag.current = null;
      poiIsDraggingRef.current = false;
      if (wasDragging) {
        // Commit drag move
        const svg = svgRef.current;
        if (svg && onPoiMoveRef.current && pending) {
          const svgCoords = screenToSVG(svg, e.clientX, e.clientY);
          const unrotated = inverseRotatePoint(
            svgCoords.x, svgCoords.y,
            mapRotationRef.current, mapCenterXRef.current, mapCenterYRef.current,
          );
          const snapped = snapToGrid(unrotated.x, unrotated.y, unitSizeRef.current);
          onPoiMoveRef.current(pending.id, snapped.gridX, snapped.gridY);
        }
        setPoiDragState(null);
        poiDragStateRef.current = null;
      } else if (pending) {
        // Was a tap/click — call onPoiClick
        if (onPoiClickRef.current) onPoiClickRef.current(pending.id);
      }
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
    };
  }, [editable]); // stable — reads all geometry from refs

  const handlePoiPointerDown = useCallback((e: React.PointerEvent, poiId: string) => {
    if (!editable) return;
    e.stopPropagation(); // Prevent pan from starting
    poiPendingDrag.current = { id: poiId, startX: e.clientX, startY: e.clientY };
    poiIsDraggingRef.current = false;
  }, [editable]);

  // Handle click on SVG background for empty-cell detection (editor mode)
  const handleSvgBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (!editable || !onEmptyCellClick) return;
    // Only handle clicks that bubbled from the background (not rooms/POIs)
    const target = e.target as Element;
    const isBackground = target.closest('.encounter-map__rooms') === null
      && target.closest('.encounter-map__pois') === null
      && target.closest('.encounter-map__doors') === null
      && target.closest('.encounter-map__token-layer') === null;
    if (!isBackground) return;
    const svg = svgRef.current;
    if (!svg) return;
    const svgCoords = screenToSVG(svg, e.clientX, e.clientY);
    const unrotated = inverseRotatePoint(svgCoords.x, svgCoords.y, mapRotation, mapCenterX, mapCenterY);
    const snapped = snapToGrid(unrotated.x, unrotated.y, unitSize);
    onEmptyCellClick(snapped.gridX, snapped.gridY);
  }, [editable, onEmptyCellClick, mapRotation, mapCenterX, mapCenterY, unitSize]);

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
    openPopover({ type: 'door', payload: {
      id: door.id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      status: getEffectiveDoorStatus(door),
    } });
  }, [isGM, onDoorStatusChange, getEffectiveDoorStatus, openPopover]);

  // -------------------------------------------------------------------
  // Room right-click handler — opens context menu (GM only)
  // -------------------------------------------------------------------
  const handleRoomContextMenu = useCallback((e: React.MouseEvent, room: GridRoom) => {
    if (!isGM) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    openPopover({ type: 'room', payload: {
      room,
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
    } });
  }, [isGM, openPopover]);

  // -------------------------------------------------------------------
  // Room tap handler — shows info popup (player terminal only)
  // Uses pointerdown+pointerup for reliable touch+mouse support.
  // -------------------------------------------------------------------
  const roomTapStart = useRef<{ x: number; y: number } | null>(null);

  const handleRoomPointerDown = useCallback((e: React.PointerEvent) => {
    roomTapStart.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleRoomPointerUp = useCallback((e: React.PointerEvent, room: GridRoom) => {
    const start = roomTapStart.current;
    roomTapStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.sqrt(dx * dx + dy * dy) > 8) return; // was a drag, not a tap
    onRoomClick?.(room.id);
    if (isGM) return;
    e.stopPropagation();
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    openPopover({ type: 'room', payload: {
      room,
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
    } });
  }, [isGM, onRoomClick, openPopover]);

  const { handleDragOver, handleDrop } = useTokenPlacement({
    svgRef,
    unitSize,
    isGM,
    onTokenPlace,
    isCellOccupied,
    findRoomAtCell,
    mapRotation,
    mapCenterX: mapCenterX,
    mapCenterY: mapCenterY,
  });

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
    onContextMenuHandler?: (e: React.MouseEvent) => void,
    widthCells: number = 1
  ) => {
    const doorWidth = orientation === 'horizontal' ? 20 * widthCells : 12;
    const doorHeight = orientation === 'horizontal' ? 12 : 20 * widthCells;
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
    const labelEl = label && (isGM || visible) ? (() => {
      const [odx, ody] = room.label_offset ?? [0, 0];
      const lx = label.x + odx * unitSize;
      const ly = label.y + ody * unitSize;
      // Counter-rotate so label stays upright on maps with a fixed rotation
      const transform = mapRotation !== 0
        ? `rotate(${-mapRotation}, ${lx}, ${ly})`
        : undefined;
      // SVG <text> ignores newlines — split into tspans, vertically centered on ly
      const lines = room.name!.split('\n');
      return (
        <text
          x={lx}
          y={ly}
          className="encounter-map__room-label"
          fontSize={view.unitSize * 0.45}
          fill="#8b7355"
          textAnchor="middle"
          dominantBaseline="middle"
          transform={transform}
        >
          {lines.map((line, i) => (
            <tspan
              key={i}
              x={lx}
              dy={i === 0 ? `${-(lines.length - 1) * 0.55}em` : '1.1em'}
            >
              {line}
            </tspan>
          ))}
        </text>
      );
    })() : null;

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
      const toSvgPts = (verts: [number, number][]) =>
        verts.map(([x, y]) => { const sp = view.project({ gx: x, gy: y }); return `${sp.x},${sp.y}`; }).join(' ');

      const outerPts = toSvgPts(room.polygon);
      const hasHoles = room.holes && room.holes.length > 0;
      const holesPts = hasHoles ? room.holes!.map(toSvgPts) : [];
      const floorPath = hasHoles
        ? `M ${outerPts} Z ` + holesPts.map(hp => `M ${hp} Z`).join(' ')
        : null;

      return (
        <g
          key={room.id}
          className={roomGroupClass}
          opacity={svgOpacity}
          style={animState ? { animationDelay: `${staggerDelay}ms` } : undefined}
        >
          {hasHoles ? (
            <path d={floorPath!} fillRule="evenodd" fill={COLORS.bgRoom} className="encounter-map__floor" />
          ) : (
            <polygon points={outerPts} fill={COLORS.bgRoom} className="encounter-map__floor" />
          )}
          <polygon points={outerPts} fill="none" stroke={COLORS.hullFill} strokeWidth={WALL_THICKNESS} strokeLinejoin="miter" className="encounter-map__wall" />
          {holesPts.map((hp, i) => (
            <polygon key={`hole-wall-${i}`} points={hp} fill="none" stroke={COLORS.hullFill} strokeWidth={WALL_THICKNESS} strokeLinejoin="miter" className="encounter-map__wall" />
          ))}
          {isGM ? (
            hasHoles ? (
              <path
                d={floorPath!}
                fillRule="evenodd"
                fill="transparent"
                style={{ cursor: 'context-menu' }}
                onContextMenu={(e) => handleRoomContextMenu(e, room)}
                className="encounter-map__room"
              />
            ) : (
              <polygon
                points={outerPts}
                fill="transparent"
                style={{ cursor: 'context-menu' }}
                onContextMenu={(e) => handleRoomContextMenu(e, room)}
                className="encounter-map__room"
              />
            )
          ) : room.name && (
            hasHoles ? (
              <path
                d={floorPath!}
                fillRule="evenodd"
                fill="transparent"
                pointerEvents="all"
                style={{ cursor: 'pointer' }}
                onPointerDown={handleRoomPointerDown}
                onPointerUp={(e) => handleRoomPointerUp(e, room)}
                className="encounter-map__room"
              />
            ) : (
              <polygon
                points={outerPts}
                fill="transparent"
                pointerEvents="all"
                style={{ cursor: 'pointer' }}
                onPointerDown={handleRoomPointerDown}
                onPointerUp={(e) => handleRoomPointerUp(e, room)}
                className="encounter-map__room"
              />
            )
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
  //
  // Editor mode (editable=true): POI supports drag-to-move and click-to-select.
  // The drag affordance uses amber #c9a050 per UI-SPEC (vs token mode's color).
  // -------------------------------------------------------------------
  const renderPoi = (poi: PoiData) => {
    if (!isGM && !isRoomVisible(poi.room)) return null;

    // In editor mode, use the ghost position if this POI is being dragged
    const isBeingDragged = editable && poiDragState?.id === poi.id;
    const renderX = isBeingDragged ? poiDragState!.ghostX : poi.position.x;
    const renderY = isBeingDragged ? poiDragState!.ghostY : poi.position.y;

    const center = view.project({ gx: renderX, gy: renderY });
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
      if (editable) return; // Editor mode: no hover popover; use onPoiClick instead
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      openPopover({ type: 'poi', payload: { poi, x: e.clientX - rect.left, y: e.clientY - rect.top } });
    };

    // Editor-mode: amber drag outline when actively dragging this POI
    const editorDragOutline = isBeingDragged ? (
      <rect
        x={cx - half - 3}
        y={cy - half - 3}
        width={iconSize + 6}
        height={iconSize + 6}
        fill="none"
        stroke="#c9a050"
        strokeWidth={2}
        rx={2}
        pointerEvents="none"
      />
    ) : null;

    if (editable) {
      // Editor mode: use pointer events for drag-to-move; suppress hover popover.
      // Move/up are handled at document level (see useEffect above).
      return (
        <g
          key={poi.id}
          className={`encounter-map__poi encounter-map__poi--${poi.type}`}
          opacity={opacity}
          style={{ color: poiColor, cursor: 'pointer' }}
          onPointerDown={(e) => handlePoiPointerDown(e, poi.id)}
        >
          {editorDragOutline}
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
          {/* Transparent hit target for reliable pointer events */}
          <rect
            x={cx - half}
            y={cy - half}
            width={iconSize}
            height={iconSize}
            fill="transparent"
          />
        </g>
      );
    }

    return (
      <g
        key={poi.id}
        className={`encounter-map__poi encounter-map__poi--${poi.type}`}
        opacity={opacity}
        style={{ color: poiColor, cursor: 'pointer' }}
        onMouseEnter={handlePoiHover}
        onMouseLeave={() => closePopover()}
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
  // Render
  // -------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      className="encounter-map-renderer"
      {...containerHandlers}
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
        viewBox={`${rotViewBoxX} ${rotViewBoxY} ${rotViewBoxW} ${rotViewBoxH}`}
        className="encounter-map-renderer__svg"
        preserveAspectRatio="xMidYMid meet"
        style={{
          transform: `translate(${viewState.panX}px, ${viewState.panY}px) scale(${viewState.zoom})`,
          transformOrigin: '0 0',
        }}
        onClick={editable ? handleSvgBackgroundClick : undefined}
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

        {/* Fixed rotation wrapper — rotates all map content around its center.
            mapRotation is YAML-authored (e.g. 90 for a horizontally-oriented ship). */}
        <g transform={mapRotation !== 0 ? `rotate(${mapRotation}, ${mapCenterX}, ${mapCenterY})` : undefined}>

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

        {/* Vent paths — dashed lines, GM-only until revealed */}
        {mapData.vents && mapData.vents.length > 0 && (isGM || ventsVisible) && (
          <g className="encounter-map__vents">
            {mapData.vents.map((vent) => {
              const pts = vent.points.map(([x, y]) => `${x * unitSize},${y * unitSize}`).join(' ');
              return (
                <g key={vent.id}>
                  <polyline
                    points={pts}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={unitSize * 0.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ cursor: isGM ? 'context-menu' : 'default', pointerEvents: isGM ? 'stroke' : 'none' }}
                    onContextMenu={isGM ? (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const rect = containerRef.current?.getBoundingClientRect();
                      openPopover({ type: 'vent', payload: { x: rect ? e.clientX - rect.left : e.clientX, y: rect ? e.clientY - rect.top : e.clientY, currentlyVisible: ventsVisible ?? false } });
                    } : undefined}
                  />
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={ventsVisible ? COLORS.vent : COLORS.ventHidden}
                    strokeWidth={unitSize * 0.18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={`${unitSize * 0.3} ${unitSize * 0.15}`}
                    opacity={isGM && !ventsVisible ? 0.4 : 1}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </g>
        )}

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
              styleEntry, orientation, `door-${door.id}`, contextMenuHandler,
              door.width ?? 1
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
            selectedTokenId={popover?.type === 'token' ? popover.payload.id : null}
            onTokenSelect={(id, e) => {
              if (id === null) {
                closePopover();
              } else {
                const token = tokens?.[id];
                const container = containerRef.current;
                const svg = svgRef.current;
                if (token && container && svg) {
                  // Token top-center in original grid-space SVG coordinates
                  let tokenTopSvgX = token.x * unitSize + unitSize / 2;
                  let tokenTopSvgY = token.y * unitSize + unitSize / 2 - unitSize * 0.4;
                  // Apply map rotation so the point is in viewBox space (the <g> rotates it visually)
                  if (mapRotation !== 0) {
                    const rad = (mapRotation * Math.PI) / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    const dx = tokenTopSvgX - mapCenterX;
                    const dy = tokenTopSvgY - mapCenterY;
                    tokenTopSvgX = mapCenterX + dx * cos - dy * sin;
                    tokenTopSvgY = mapCenterY + dx * sin + dy * cos;
                  }
                  // getScreenCTM includes viewBox + preserveAspectRatio + CSS pan/zoom transform
                  const ctm = svg.getScreenCTM();
                  if (ctm) {
                    const pt = svg.createSVGPoint();
                    pt.x = tokenTopSvgX;
                    pt.y = tokenTopSvgY;
                    const screenPt = pt.matrixTransform(ctm);
                    const rect = container.getBoundingClientRect();
                    openPopover({ type: 'token', payload: { id, pos: { x: screenPt.x - rect.left, y: screenPt.y - rect.top } } });
                    return;
                  }
                }
                // Fallback: center of container
                const rect = containerRef.current?.getBoundingClientRect();
                openPopover({ type: 'token', payload: { id, pos: {
                  x: e ? e.clientX - (rect?.left || 0) : (rect?.width || 0) / 2,
                  y: e ? e.clientY - (rect?.top || 0) : (rect?.height || 0) / 3,
                } } });
              }
            }}
            mapRooms={mapData.rooms as unknown as import('../../../types/encounterMap').RoomData[]}
            mapRotation={mapRotation}
            mapCenterX={mapCenterX}
            mapCenterY={mapCenterY}
          />
        )}

        </g>{/* end fixed rotation wrapper */}
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
      {popover?.type === 'token' && tokens?.[popover.payload.id] && (
        <TokenPopup
          tokenId={popover.payload.id}
          data={tokens[popover.payload.id]}
          x={popover.payload.pos.x}
          y={popover.payload.pos.y}
          onClose={() => closePopover()}
          onRemove={onTokenRemove}
          onStatusToggle={onTokenStatusToggle}
          isGM={isGM}
        />
      )}

      {/* POI info popup — shown on hover/click */}
      {popover?.type === 'poi' && (
        <div
          style={{
            position: 'absolute',
            left: popover.payload.x + 14,
            top: popover.payload.y - 10,
            background: 'rgba(10, 10, 10, 0.97)',
            border: `1px solid ${
              popover.payload.poi.type === 'hazard'    ? COLORS.hazard :
              popover.payload.poi.type === 'objective' ? COLORS.amber :
              popover.payload.poi.type === 'item'      ? COLORS.tealBright :
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
            {popover.payload.poi.name}
          </div>
          {popover.payload.poi.status && (
            <div style={{ color: popover.payload.poi.type === 'hazard' ? COLORS.hazard : COLORS.amber, fontSize: '10px' }}>
              {popover.payload.poi.status}
            </div>
          )}
          {popover.payload.poi.description && (
            <div style={{ color: COLORS.textMuted, fontSize: '10px', marginTop: 4 }}>
              {popover.payload.poi.description}
            </div>
          )}
        </div>
      )}

      {/* Door status popup — rendered outside SVG */}
      {popover?.type === 'door' && onDoorStatusChange && (
        <DoorStatusPopup
          x={popover.payload.x}
          y={popover.payload.y}
          currentStatus={popover.payload.status}
          onSelect={(status) => {
            onDoorStatusChange(popover.payload.id, status);
            closePopover();
          }}
          onClose={() => closePopover()}
        />
      )}

      {/* Room context menu — GM right-click (with toggle) or player tap (info only) */}
      {popover?.type === 'room' && (
        <RoomContextMenu
          room={popover.payload.room}
          isVisible={isGM ? isRoomVisible(popover.payload.room.id) : undefined}
          x={popover.payload.x}
          y={popover.payload.y}
          onToggleVisibility={isGM ? () => {
            onRoomToggle?.(popover.payload.room.id, !isRoomVisible(popover.payload.room.id));
            closePopover();
          } : undefined}
          onClose={() => closePopover()}
        />
      )}

      {/* Vent context menu — GM right-click to reveal/hide all vents */}
      {popover?.type === 'vent' && isGM && onVentsToggle && (
        <div
          ref={ventPopupRef}
          style={{
            position: 'absolute',
            left: popover.payload.x,
            top: popover.payload.y,
            background: 'rgba(10,10,10,0.97)',
            border: `1px solid ${COLORS.vent}`,
            fontFamily: "'Cascadia Code', 'Courier New', monospace",
            fontSize: '11px',
            letterSpacing: '1px',
            zIndex: 20,
            minWidth: 160,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            style={{
              display: 'block', width: '100%', padding: '6px 10px',
              background: 'none', border: 'none', color: popover.payload.currentlyVisible ? COLORS.hazard : COLORS.vent,
              fontFamily: 'inherit', fontSize: '11px', letterSpacing: '1px',
              textAlign: 'left', cursor: 'pointer', textTransform: 'uppercase',
            }}
            onClick={() => {
              onVentsToggle(!popover.payload.currentlyVisible);
              closePopover();
            }}
          >
            {popover.payload.currentlyVisible ? 'Hide vents from players' : 'Reveal vents to players'}
          </button>
        </div>
      )}
    </div>
  );
}
