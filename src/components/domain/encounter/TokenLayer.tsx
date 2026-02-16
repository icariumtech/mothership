/**
 * TokenLayer - Renders all tokens on encounter map
 *
 * Filters tokens by room visibility (players only see tokens in revealed rooms),
 * handles token selection, and renders TokenPopup for selected token.
 */

import React from 'react';
import { TokenState, TokenStatus } from '../../../types/encounterMap';
import { Token } from './Token';
import { TokenPopup } from './TokenPopup';

interface RoomVisibilityState {
  [roomId: string]: boolean;
}

interface TokenLayerProps {
  tokens: TokenState;
  unitSize: number;
  roomVisibility?: RoomVisibilityState;
  isGM?: boolean;
  onTokenMove?: (id: string, x: number, y: number) => void;
  onTokenRemove?: (id: string) => void;
  onTokenStatusToggle?: (id: string, status: TokenStatus) => void;
  selectedTokenId?: string | null;
  onTokenSelect?: (id: string | null) => void;
}

export function TokenLayer({
  tokens,
  unitSize,
  roomVisibility,
  isGM = false,
  onTokenRemove,
  onTokenStatusToggle,
  selectedTokenId = null,
  onTokenSelect,
}: TokenLayerProps) {
  // Filter tokens by visibility
  const filteredTokens = Object.entries(tokens).filter(([_id, token]) => {
    // GM sees all tokens
    if (isGM) return true;

    // Players only see tokens in revealed rooms or unassigned tokens
    if (!token.room_id || token.room_id === '') return true;

    // Check room visibility
    if (!roomVisibility) return true;
    return roomVisibility[token.room_id] !== false;
  });

  const handleTokenSelect = (id: string) => {
    if (onTokenSelect) {
      // Toggle selection: clicking same token deselects it
      onTokenSelect(selectedTokenId === id ? null : id);
    }
  };

  const handleTokenDragStart = (_id: string, e: React.MouseEvent) => {
    // Drag handling would go here (for GM view)
    // For now, just prevent default
    e.preventDefault();
  };

  return (
    <g className="encounter-map__token-layer">
      {/* Render all visible tokens */}
      {filteredTokens.map(([id, tokenData]) => (
        <Token
          key={id}
          id={id}
          data={tokenData}
          unitSize={unitSize}
          draggable={isGM}
          selected={selectedTokenId === id}
          onSelect={handleTokenSelect}
          onDragStart={handleTokenDragStart}
        />
      ))}

      {/* Render popup for selected token */}
      {selectedTokenId && tokens[selectedTokenId] && (
        <TokenPopup
          tokenId={selectedTokenId}
          data={tokens[selectedTokenId]}
          unitSize={unitSize}
          position={{
            x: tokens[selectedTokenId].x * unitSize + unitSize / 2,
            y: tokens[selectedTokenId].y * unitSize + unitSize / 2,
          }}
          onClose={() => onTokenSelect && onTokenSelect(null)}
          onRemove={onTokenRemove}
          onStatusToggle={onTokenStatusToggle}
          isGM={isGM}
        />
      )}
    </g>
  );
}
