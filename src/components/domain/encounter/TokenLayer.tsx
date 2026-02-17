/**
 * TokenLayer - Renders all tokens on encounter map
 *
 * Filters tokens by room visibility (players only see tokens in revealed rooms),
 * handles token selection, drag-to-move functionality, and renders TokenPopup for selected token.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TokenState, TokenStatus, RoomData } from '../../../types/encounterMap';
import { Token } from './Token';
import { TokenPopup } from './TokenPopup';
import { screenToSVG, snapToGrid } from '@/utils/svgCoordinates';

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
  mapRooms?: RoomData[];
}

export function TokenLayer({
  tokens,
  unitSize,
  roomVisibility,
  isGM = false,
  onTokenMove,
  onTokenRemove,
  onTokenStatusToggle,
  selectedTokenId = null,
  onTokenSelect,
  mapRooms = [],
}: TokenLayerProps) {
  // Drag state for drag-to-move
  const [isDragging, setIsDragging] = useState(false);
  const [dragTokenId, setDragTokenId] = useState<string | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ gridX: number; gridY: number } | null>(null);
  const svgElementRef = useRef<SVGSVGElement | null>(null);

  // Get parent SVG element on mount
  useEffect(() => {
    const tokenLayerElement = document.querySelector('.encounter-map__token-layer');
    if (tokenLayerElement) {
      const svgElement = tokenLayerElement.closest('svg') as SVGSVGElement;
      svgElementRef.current = svgElement;
    }
  }, []);

  // Filter tokens by visibility
  const filteredTokens = Object.entries(tokens).filter(([_id, token]) => {
    // GM sees all tokens
    if (isGM) return true;

    // Players only see tokens in revealed rooms or unassigned tokens
    if (!token.room_id || token.room_id === '') return true;

    // Check room visibility - require explicit true to show token
    if (!roomVisibility) return true;
    return roomVisibility[token.room_id] === true;
  });

  // Helper: Find which room contains a grid cell
  const findRoomAtCell = useCallback((gridX: number, gridY: number): RoomData | null => {
    for (const room of mapRooms) {
      if (
        gridX >= room.x &&
        gridX < room.x + room.width &&
        gridY >= room.y &&
        gridY < room.y + room.height
      ) {
        return room;
      }
    }
    return null;
  }, [mapRooms]);

  // Helper: Check if a cell is occupied by a token (excluding the dragging token)
  const isCellOccupied = useCallback((gridX: number, gridY: number, excludeTokenId?: string): boolean => {
    return Object.entries(tokens).some(([id, token]) => {
      if (id === excludeTokenId) return false;
      return token.x === gridX && token.y === gridY;
    });
  }, [tokens]);

  const handleTokenSelect = (id: string) => {
    if (onTokenSelect) {
      // Toggle selection: clicking same token deselects it
      onTokenSelect(selectedTokenId === id ? null : id);
    }
  };

  const handleTokenDragStart = useCallback((id: string, e: React.MouseEvent) => {
    if (!isGM || !onTokenMove) return;

    e.stopPropagation(); // Prevent map panning
    setIsDragging(true);
    setDragTokenId(id);

    // Initial ghost position is current token position
    const token = tokens[id];
    if (token) {
      setGhostPosition({ gridX: token.x, gridY: token.y });
    }
  }, [isGM, onTokenMove, tokens]);

  // Mouse move handler for dragging
  useEffect(() => {
    if (!isDragging || !dragTokenId || !svgElementRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!svgElementRef.current) return;

      // Convert screen coordinates to SVG coordinates and snap to grid
      const svgCoords = screenToSVG(svgElementRef.current, e.clientX, e.clientY);
      const snapped = snapToGrid(svgCoords.x, svgCoords.y, unitSize);

      setGhostPosition(snapped);
    };

    const handleMouseUp = () => {
      if (!svgElementRef.current || !onTokenMove || !ghostPosition) {
        setIsDragging(false);
        setDragTokenId(null);
        setGhostPosition(null);
        return;
      }

      const { gridX, gridY } = ghostPosition;

      // Validate placement (overlap prevention, revealed room check)
      if (isCellOccupied(gridX, gridY, dragTokenId)) {
        console.warn('Cannot move token: cell is occupied');
        setIsDragging(false);
        setDragTokenId(null);
        setGhostPosition(null);
        return;
      }

      const room = findRoomAtCell(gridX, gridY);
      if (!room) {
        console.warn('Cannot move token: not inside a room');
        setIsDragging(false);
        setDragTokenId(null);
        setGhostPosition(null);
        return;
      }

      if (roomVisibility && roomVisibility[room.id] === false) {
        console.warn('Cannot move token: room is not revealed');
        setIsDragging(false);
        setDragTokenId(null);
        setGhostPosition(null);
        return;
      }

      // Valid move - call handler
      onTokenMove(dragTokenId, gridX, gridY);

      setIsDragging(false);
      setDragTokenId(null);
      setGhostPosition(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragTokenId, unitSize, onTokenMove, ghostPosition, isCellOccupied, findRoomAtCell, roomVisibility]);

  return (
    <g className="encounter-map__token-layer">
      {/* Render all visible tokens */}
      {filteredTokens.map(([id, tokenData]) => {
        // Hide the token being dragged (show ghost instead)
        if (isDragging && id === dragTokenId) return null;

        return (
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
        );
      })}

      {/* Ghost token during drag */}
      {isDragging && dragTokenId && ghostPosition && tokens[dragTokenId] && (
        <Token
          key={`ghost-${dragTokenId}`}
          id={`ghost-${dragTokenId}`}
          data={{
            ...tokens[dragTokenId],
            x: ghostPosition.gridX,
            y: ghostPosition.gridY,
          }}
          unitSize={unitSize}
          draggable={false}
          selected={false}
          onSelect={() => {}}
        />
      )}

      {/* Render popup for selected token */}
      {selectedTokenId && tokens[selectedTokenId] && !isDragging && (
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
