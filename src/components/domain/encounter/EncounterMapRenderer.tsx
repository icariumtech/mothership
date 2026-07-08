/**
 * EncounterMapRenderer - SVG renderer for grid-based encounter maps
 *
 * Renders GridEncounterMapData: rooms as touching wall-aligned rectangles,
 * wall-segment algorithm for exterior walls, scanline floor texture,
 * faint background grid, and GM right-click context menu for room visibility.
 *
 * Orchestrates the layer components in ./renderer/ (RoomsLayer, DoorsLayer,
 * PoiLayer, DoorSymbol, PoiInfoPopup, VentTogglePopup) — this file owns
 * shared state (pan/zoom, popovers, projection/view), the top-level SVG
 * structure, and the handlers those layers need.
 */

import React, { useMemo, useCallback, useRef } from 'react';
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
import { normalizeDoor, normalizeDoors } from './doors/doorNormalizer';
import { useRoomRevealAnimations } from './animation/useRoomRevealAnimations';
import { COLORS } from './renderer/mapColors';
import { RoomsLayer } from './renderer/RoomsLayer';
import { DoorsLayer } from './renderer/DoorsLayer';
import { PoiLayer } from './renderer/PoiLayer';
import { PoiInfoPopup } from './renderer/PoiInfoPopup';
import { VentTogglePopup } from './renderer/VentTogglePopup';
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
  /** Callback when any user left-clicks a door — used by editor preview for click-to-jump */
  onDoorClick?: (doorId: string) => void;
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

// -------------------------------------------------------------------
// All inline geometry helpers were removed in plan 21-03. They now live in:
//   - polygon2d (pointInPolygon, polygonAreaCentroid, octagonFromRect, etc.)
//   - geometry/roomGeometry (roomLabelGrid, roomWallEdges, doorEndpoints, etc.)
//   - geometry/mapView (the renderer's seam — SVG-space queries)
//   - doors/doorNormalizer (legacy → canonical Door conversion)
// Room/door/POI rendering itself lives in ./renderer/ (RoomsLayer, DoorsLayer,
// DoorSymbol, PoiLayer, PoiInfoPopup, VentTogglePopup) as of the Tier-2
// decomposition — see that directory for the render logic this file used to
// contain inline.
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// Exclusive popover discriminated union — one open slot at a time.
// Defined here (renderer module scope) so the hook stays generic.
// -------------------------------------------------------------------
type EncounterPopover =
  | { type: 'token'; payload: { id: string; pos: { x: number; y: number } } }
  | { type: 'door';  payload: { id: string; x: number; y: number; status: DoorStatus } }
  | { type: 'poi';   payload: { poi: PoiData; x: number; y: number } }
  | { type: 'room';  payload: { room: GridRoom; x: number; y: number; gridX?: number; gridY?: number } }
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
  onDoorClick,
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

  // Gated once here (not per-door) — DoorsLayer just binds this per door.
  const doorContextMenuHandler = (isGM && onDoorStatusChange) ? handleDoorClick : undefined;

  // -------------------------------------------------------------------
  // Room right-click handler — opens context menu (GM only).
  // In editor mode, also computes snapped grid coords for "Add POI".
  // -------------------------------------------------------------------
  const handleRoomContextMenu = useCallback((e: React.MouseEvent, room: GridRoom) => {
    if (!isGM) return;
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    const payload: EncounterPopover['payload'] & { room: GridRoom } = {
      room,
      x: e.clientX - (rect?.left || 0),
      y: e.clientY - (rect?.top || 0),
    };
    if (editable && onEmptyCellClick) {
      const svg = svgRef.current;
      if (svg) {
        const svgCoords = screenToSVG(svg, e.clientX, e.clientY);
        const unrotated = inverseRotatePoint(svgCoords.x, svgCoords.y, mapRotation, mapCenterX, mapCenterY);
        const snapped = snapToGrid(unrotated.x, unrotated.y, unitSize);
        payload.gridX = snapped.gridX;
        payload.gridY = snapped.gridY;
      }
    }
    openPopover({ type: 'room', payload });
  }, [isGM, editable, onEmptyCellClick, mapRotation, mapCenterX, mapCenterY, unitSize, openPopover]);

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
        onContextMenu={editable ? (e) => e.preventDefault() : undefined}
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
        <RoomsLayer
          rooms={mapData.rooms}
          isRoomVisible={isRoomVisible}
          roomAnimState={roomAnimState}
          isGM={isGM}
          view={view}
          unitSize={unitSize}
          mapRotation={mapRotation}
          onRoomContextMenu={handleRoomContextMenu}
          onRoomPointerDown={handleRoomPointerDown}
          onRoomPointerUp={handleRoomPointerUp}
        />

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
        <DoorsLayer
          doors={canonicalDoors}
          isGM={isGM}
          roomVisibility={roomVisibility}
          rooms={mapData.rooms}
          findRoomAtCell={findRoomAtCell}
          isRoomVisible={isRoomVisible}
          view={view}
          getEffectiveDoorStatus={getEffectiveDoorStatus}
          onDoorContextMenu={doorContextMenuHandler}
          onDoorClick={onDoorClick}
        />

        {/* POI layer — rendered above doors */}
        <PoiLayer
          pois={mapData.poi ?? []}
          isGM={isGM}
          isRoomVisible={isRoomVisible}
          editable={editable}
          view={view}
          svgRef={svgRef}
          containerRef={containerRef}
          mapRotation={mapRotation}
          mapCenterX={mapCenterX}
          mapCenterY={mapCenterY}
          unitSize={unitSize}
          onPoiMove={onPoiMove}
          onPoiClick={onPoiClick}
          onPoiHover={(poi, x, y) => openPopover({ type: 'poi', payload: { poi, x, y } })}
          onPoiHoverEnd={closePopover}
        />

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
        <PoiInfoPopup poi={popover.payload.poi} x={popover.payload.x} y={popover.payload.y} />
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
          onToggleVisibility={isGM && !editable ? () => {
            onRoomToggle?.(popover.payload.room.id, !isRoomVisible(popover.payload.room.id));
            closePopover();
          } : undefined}
          onAddPoi={editable && onEmptyCellClick && popover.payload.gridX !== undefined ? () => {
            onEmptyCellClick(popover.payload.gridX!, popover.payload.gridY!);
            closePopover();
          } : undefined}
          onClose={() => closePopover()}
        />
      )}

      {/* Vent context menu — GM right-click to reveal/hide all vents */}
      {popover?.type === 'vent' && isGM && onVentsToggle && (
        <VentTogglePopup
          x={popover.payload.x}
          y={popover.payload.y}
          currentlyVisible={popover.payload.currentlyVisible}
          onToggle={() => {
            onVentsToggle(!popover.payload.currentlyVisible);
            closePopover();
          }}
          onClose={closePopover}
        />
      )}

    </div>
  );
}
