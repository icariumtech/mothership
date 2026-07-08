/**
 * PoiLayer - Renders points of interest (icons + editor drag-to-move).
 * Owns its own drag state machine, mirroring TokenLayer's self-contained
 * pattern: prop-mirroring refs + document-level pointer listeners so drag
 * tracking survives the pointer leaving the POI element.
 * Extracted from EncounterMapRenderer's POI drag effect (lines 334-451) and
 * renderPoi() closure (lines 1107-1235).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PoiData } from '../../../../types/encounterMap';
import { MapView } from '../geometry/mapView';
import { ENCOUNTER_ICONS, iconSymbolId } from '../EncounterIcons';
import { screenToSVG, inverseRotatePoint, snapToGrid } from '../../../../utils/svgCoordinates';
import { COLORS } from './mapColors';

const POI_DRAG_THRESHOLD = 5;

interface PoiLayerProps {
  pois: PoiData[];
  isGM: boolean;
  isRoomVisible: (roomId: string) => boolean;
  editable: boolean;
  view: MapView;
  svgRef: React.RefObject<SVGSVGElement | null>;
  mapRotation: number;
  mapCenterX: number;
  mapCenterY: number;
  unitSize: number;
  onPoiMove?: (poiId: string, x: number, y: number) => void;
  onPoiClick?: (poiId: string) => void;
  /** Non-editor mode: hover/click opens the POI info popup (parent-controlled). */
  onPoiHover?: (poi: PoiData, screenX: number, screenY: number) => void;
  onPoiHoverEnd?: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function PoiLayer({
  pois,
  isGM,
  isRoomVisible,
  editable,
  view,
  svgRef,
  mapRotation,
  mapCenterX,
  mapCenterY,
  unitSize,
  onPoiMove,
  onPoiClick,
  onPoiHover,
  onPoiHoverEnd,
  containerRef,
}: PoiLayerProps) {
  const poiPendingDrag = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const poiIsDraggingRef = useRef(false);
  // Keeps the drop position alive until DeckplanPreviewPane's debounced re-parse
  // updates mapData. Prevents snap-back to old position during the debounce window.
  const poiCommittedPos = useRef<{ id: string; x: number; y: number } | null>(null);
  const [poiDragState, setPoiDragState] = useState<{
    id: string;
    ghostX: number;
    ghostY: number;
  } | null>(null);

  // Stable refs for editable callbacks (avoids closure staleness in document handlers)
  const editableRef = useRef(editable);
  const onPoiMoveRef = useRef(onPoiMove);
  const onPoiClickRef = useRef(onPoiClick);
  useEffect(() => { editableRef.current = editable; }, [editable]);
  useEffect(() => { onPoiMoveRef.current = onPoiMove; }, [onPoiMove]);
  useEffect(() => { onPoiClickRef.current = onPoiClick; }, [onPoiClick]);

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
          // Record drop position before clearing ghost — holds the position visible
          // until DeckplanPreviewPane's debounced re-parse updates mapData.
          poiCommittedPos.current = { id: pending.id, x: snapped.gridX, y: snapped.gridY };
          onPoiMoveRef.current(pending.id, snapped.gridX, snapped.gridY);
        }
        setPoiDragState(null);
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

  // -------------------------------------------------------------------
  // renderPoi — SVG vector icon + label for a point of interest
  // Icons sourced from @ant-design/icons-svg, colorized via fill on <use>
  //
  // Editor mode (editable=true): POI supports drag-to-move and click-to-select.
  // The drag affordance uses amber #c9a050 per UI-SPEC (vs token mode's color).
  // -------------------------------------------------------------------
  const renderPoi = (poi: PoiData) => {
    if (!isGM && !isRoomVisible(poi.room)) return null;

    // In editor mode, use the ghost position if this POI is being dragged.
    // After drop, use the committed position until mapData catches up (debounce).
    const isBeingDragged = editable && poiDragState?.id === poi.id;
    const committed = editable ? poiCommittedPos.current : null;
    const isCommitted = !isBeingDragged && committed?.id === poi.id;
    if (isCommitted && poi.position.x === committed!.x && poi.position.y === committed!.y) {
      poiCommittedPos.current = null; // mapData has caught up
    }
    const renderX = isBeingDragged ? poiDragState!.ghostX : isCommitted ? committed!.x : poi.position.x;
    const renderY = isBeingDragged ? poiDragState!.ghostY : isCommitted ? committed!.y : poi.position.y;

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
      if (!rect || !onPoiHover) return;
      onPoiHover(poi, e.clientX - rect.left, e.clientY - rect.top);
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
        onMouseLeave={() => onPoiHoverEnd?.()}
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

  if (!pois || pois.length === 0) return null;

  return (
    <g className="encounter-map__pois">
      {pois.map(renderPoi)}
    </g>
  );
}
