/**
 * RoomsLayer - Renders all rooms for a deck: floor fill + exterior walls +
 * GM/player hit targets + labels, for the three room-shape variants
 * (rect w/ optional chamfer, circle, freeform polygon w/ optional holes).
 * Extracted from EncounterMapRenderer's renderRoom() closure.
 *
 * Chamfered rects (chamfer > 0): rendered as octagons via <polygon>.
 * Plain rects: rendered as <rect> with exterior wall segments from the
 * wall-segment algorithm (shared edges cancel out, only exterior drawn).
 * This hybrid approach keeps correct wall sharing for plain multi-rect rooms
 * while giving chamfered rooms clean diagonal corners.
 */
import { GridRoom } from '../../../../types/encounterMap';
import { MapView } from '../geometry/mapView';
import { RoomAnimEntry } from '../animation/useRoomRevealAnimations';
import { COLORS, WALL_THICKNESS } from './mapColors';

interface RoomsLayerProps {
  rooms: GridRoom[];
  isRoomVisible: (roomId: string) => boolean;
  roomAnimState: Map<string, RoomAnimEntry>;
  isGM: boolean;
  view: MapView;
  unitSize: number;
  mapRotation: number;
  onRoomContextMenu: (e: React.MouseEvent, room: GridRoom) => void;
  onRoomPointerDown: (e: React.PointerEvent) => void;
  onRoomPointerUp: (e: React.PointerEvent, room: GridRoom) => void;
}

export function RoomsLayer({
  rooms,
  isRoomVisible,
  roomAnimState,
  isGM,
  view,
  unitSize,
  mapRotation,
  onRoomContextMenu,
  onRoomPointerDown,
  onRoomPointerUp,
}: RoomsLayerProps) {
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
              onContextMenu={(e) => onRoomContextMenu(e, room)}
              onPointerDown={onRoomPointerDown}
              onPointerUp={(e) => onRoomPointerUp(e, room)}
              className="encounter-map__room"
            />
          ) : room.name && (
            <circle
              cx={svgCx} cy={svgCy} r={svgR}
              fill="transparent"
              pointerEvents="all"
              style={{ cursor: 'pointer' }}
              onPointerDown={onRoomPointerDown}
              onPointerUp={(e) => onRoomPointerUp(e, room)}
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
                onContextMenu={(e) => onRoomContextMenu(e, room)}
                onPointerDown={onRoomPointerDown}
                onPointerUp={(e) => onRoomPointerUp(e, room)}
                className="encounter-map__room"
              />
            ) : (
              <polygon
                points={outerPts}
                fill="transparent"
                style={{ cursor: 'context-menu' }}
                onContextMenu={(e) => onRoomContextMenu(e, room)}
                onPointerDown={onRoomPointerDown}
                onPointerUp={(e) => onRoomPointerUp(e, room)}
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
                onPointerDown={onRoomPointerDown}
                onPointerUp={(e) => onRoomPointerUp(e, room)}
                className="encounter-map__room"
              />
            ) : (
              <polygon
                points={outerPts}
                fill="transparent"
                pointerEvents="all"
                style={{ cursor: 'pointer' }}
                onPointerDown={onRoomPointerDown}
                onPointerUp={(e) => onRoomPointerUp(e, room)}
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
            onContextMenu={(e) => onRoomContextMenu(e, room)}
            onPointerDown={onRoomPointerDown}
            onPointerUp={(e) => onRoomPointerUp(e, room)}
            className="encounter-map__room"
          />
        ))}
        {isGM && chamferedRects.map((rect, i) => (
          <polygon
            key={`hit-c-${i}`}
            points={view.roomChamferedPolygonPoints(rect)}
            fill="transparent"
            style={{ cursor: 'context-menu' }}
            onContextMenu={(e) => onRoomContextMenu(e, room)}
            onPointerDown={onRoomPointerDown}
            onPointerUp={(e) => onRoomPointerUp(e, room)}
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
            onPointerDown={onRoomPointerDown}
            onPointerUp={(e) => onRoomPointerUp(e, room)}
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
            onPointerDown={onRoomPointerDown}
            onPointerUp={(e) => onRoomPointerUp(e, room)}
            className="encounter-map__room"
          />
        ))}

        {labelEl}
      </g>
    );
  };

  return (
    <g className="encounter-map__rooms">
      {rooms.map(renderRoom)}
    </g>
  );
}
