/**
 * TokenStatusOverlay - Status indicator overlays for tokens
 *
 * Renders visual indicators for wounded, dead, panicked, stunned states
 * positioned around the token perimeter.
 */

import { TokenStatus } from '../../../types/encounterMap';

interface TokenStatusOverlayProps {
  status: TokenStatus[];
  tokenRadius: number;
}

export function TokenStatusOverlay({ status, tokenRadius }: TokenStatusOverlayProps) {
  if (!status || status.length === 0) return null;

  const hasWounded = status.includes('wounded');
  const hasDead = status.includes('dead');
  const hasPanicked = status.includes('panicked');
  const hasStunned = status.includes('stunned');

  return (
    <g className="encounter-map__token-status">
      {/* Wounded: Red dot at top-right */}
      {hasWounded && (
        <circle
          cx={tokenRadius * 0.7}
          cy={-tokenRadius * 0.7}
          r={3}
          fill="#8b5555"
          className="status-indicator--wounded"
        />
      )}

      {/* Dead: Red X across entire token */}
      {hasDead && (
        <g opacity={0.7}>
          <line
            x1={-tokenRadius}
            y1={-tokenRadius}
            x2={tokenRadius}
            y2={tokenRadius}
            stroke="#8b5555"
            strokeWidth={3}
          />
          <line
            x1={tokenRadius}
            y1={-tokenRadius}
            x2={-tokenRadius}
            y2={tokenRadius}
            stroke="#8b5555"
            strokeWidth={3}
          />
        </g>
      )}

      {/* Panicked: Dashed amber ring around token */}
      {hasPanicked && (
        <circle
          cx={0}
          cy={0}
          r={tokenRadius + 3}
          fill="none"
          stroke="#8b7355"
          strokeWidth={2}
          strokeDasharray="4 4"
          className="status-indicator--panicked"
        />
      )}

      {/* Stunned: Blue-gray dot at top-left */}
      {hasStunned && (
        <circle
          cx={-tokenRadius * 0.7}
          cy={-tokenRadius * 0.7}
          r={3}
          fill="#5a6a7a"
        />
      )}
    </g>
  );
}
