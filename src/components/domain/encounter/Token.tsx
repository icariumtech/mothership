/**
 * Token - Individual token on encounter map
 *
 * Circular image token with type-colored glow, initial/full name label,
 * status overlays, and drag support.
 */

import React from 'react';
import { TokenData } from '../../../types/encounterMap';
import { TokenStatusOverlay } from './TokenStatusOverlay';

interface TokenProps {
  id: string;
  data: TokenData;
  unitSize: number;
  draggable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onPointerDragStart?: (id: string, e: React.PointerEvent<Element>) => void;
}

// Type-based glow colors (per user decision)
const GLOW_COLORS = {
  player: '#8b7355',    // amber
  npc: '#4a6b6b',       // teal
  creature: '#6b4a4a',  // burgundy
  object: '#5a5a5a',    // gray
};

export function Token({
  id,
  data,
  unitSize,
  draggable = false,
  onSelect,
  onPointerDragStart,
}: TokenProps) {
  // Calculate center position
  const centerX = data.x * unitSize + unitSize / 2;
  const centerY = data.y * unitSize + unitSize / 2;

  // Token radius: 80% of cell (per user decision)
  const tokenRadius = unitSize * 0.4;

  // Glow radius (slightly larger for glow effect)
  const glowRadius = tokenRadius + 4;

  const handlePointerDown = (e: React.PointerEvent<Element>) => {
    if (draggable && onPointerDragStart) {
      // Capture pointer so pointermove/pointerup route here even if finger moves off-element.
      // Also prevents the browser from converting the touch into simulated mouse events.
      e.currentTarget.setPointerCapture(e.pointerId);
      onPointerDragStart(id, e);
      e.stopPropagation();
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(id);
    }
  };

  const glowColor = GLOW_COLORS[data.type];
  const hasImage = data.image_url && data.image_url.trim() !== '';

  // Fallback color for tokens without images
  const fallbackColor = GLOW_COLORS[data.type];

  // Initial letter for label
  const initial = data.name.charAt(0).toUpperCase();

  // Build className
  const isHidden = data.status.includes('hidden');
  const className = `encounter-map__token encounter-map__token--${data.type}${isHidden ? ' encounter-map__token--hidden' : ''}`;

  return (
    <g
      className={className}
      transform={`translate(${centerX}, ${centerY})`}
      data-token-id={id}
      data-draggable={draggable}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      style={{ cursor: draggable ? 'grab' : 'pointer', touchAction: draggable ? 'none' : 'auto' }}
    >
      {/* Define filters for glow effect */}
      <defs>
        <filter id={`token-glow-${data.type}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
        </filter>

        {/* Clip path for circular image */}
        {hasImage && (
          <clipPath id={`token-clip-${id}`}>
            <circle cx={0} cy={0} r={tokenRadius} />
          </clipPath>
        )}
      </defs>

      {/* Glow circle behind token */}
      <circle
        cx={0}
        cy={0}
        r={glowRadius}
        fill={glowColor}
        opacity={0.4}
        filter={`url(#token-glow-${data.type})`}
      />

      {/* Token body - image or fallback circle */}
      {hasImage ? (
        <>
          {/* Clipped image */}
          <g clipPath={`url(#token-clip-${id})`}>
            <image
              href={data.image_url}
              x={-tokenRadius}
              y={-tokenRadius}
              width={tokenRadius * 2}
              height={tokenRadius * 2}
              preserveAspectRatio="xMidYMid slice"
            />
          </g>
          {/* Border around image */}
          <circle
            cx={0}
            cy={0}
            r={tokenRadius}
            fill="none"
            stroke={glowColor}
            strokeWidth={2}
          />
        </>
      ) : (
        <>
          {/* Fallback: colored circle with initial */}
          <circle
            cx={0}
            cy={0}
            r={tokenRadius}
            fill={fallbackColor}
            stroke={glowColor}
            strokeWidth={2}
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#d0d0d0"
            fontSize={tokenRadius * 1.2}
            fontFamily="Cascadia Code, monospace"
            fontWeight="bold"
            pointerEvents="none"
          >
            {initial}
          </text>
        </>
      )}

      {/* Status overlays */}
      <TokenStatusOverlay status={data.status} tokenRadius={tokenRadius} />

    </g>
  );
}
