/**
 * DoorSymbol - Pure SVG door symbol (frame, halves, damaged/locked/sealed
 * overlays, type indicators). Extracted from EncounterMapRenderer's
 * renderDoorSymbol() — a pure function of its props, no closures over
 * component state.
 */
import { COLORS } from './mapColors';

interface DoorSymbolProps {
  x: number;
  y: number;
  doorType: string;
  doorStatus: string | undefined;
  style: { stroke: string; doorFill: string };
  orientation: 'horizontal' | 'vertical';
  onContextMenuHandler?: (e: React.MouseEvent) => void;
  widthCells?: number;
  onClickHandler?: (e: React.MouseEvent) => void;
}

export function DoorSymbol({
  x,
  y,
  doorType,
  doorStatus,
  style,
  orientation,
  onContextMenuHandler,
  widthCells = 1,
  onClickHandler,
}: DoorSymbolProps) {
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
      className={`encounter-map__door encounter-map__door--${doorType} ${statusClass}`}
      onContextMenu={onContextMenuHandler}
      onClick={onClickHandler}
      style={{ cursor: onClickHandler ? 'pointer' : onContextMenuHandler ? 'context-menu' : 'default' }}
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
}
