/**
 * TokenLayer - Renders all tokens on encounter map
 *
 * Filters tokens by room visibility (players only see tokens in revealed rooms),
 * handles token selection, drag-to-move functionality, and renders TokenPopup for selected token.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TokenState, RoomData } from '../../../types/encounterMap';
import { Token } from './Token';
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
  selectedTokenId = null,
  onTokenSelect,
  mapRooms = [],
}: TokenLayerProps) {
  // Drag state for drag-to-move
  const [isDragging, setIsDragging] = useState(false);
  const [dragTokenId, setDragTokenId] = useState<string | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ gridX: number; gridY: number } | null>(null);
  const svgElementRef = useRef<SVGSVGElement | null>(null);

  // Pending drag: track mousedown before movement threshold is met
  const pendingDrag = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const DRAG_THRESHOLD = 5; // pixels before drag starts

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

  const canDrag = !!onTokenMove;

  const handleTokenDragStart = useCallback((id: string, e: React.MouseEvent) => {
    if (!onTokenMove) return;

    e.stopPropagation(); // Prevent map panning

    // Don't start drag immediately — wait for movement threshold
    pendingDrag.current = { id, startX: e.clientX, startY: e.clientY };
  }, [onTokenMove]);

  const handleTokenTouchDragStart = useCallback((id: string, e: React.TouchEvent) => {
    if (!onTokenMove) return;

    const touch = e.touches[0];
    if (!touch) return;

    e.stopPropagation();

    pendingDrag.current = { id, startX: touch.clientX, startY: touch.clientY };
  }, [onTokenMove]);

  // Shared drag logic for mouse and touch
  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    // Check pending drag threshold
    if (pendingDrag.current && !isDragging) {
      const dx = clientX - pendingDrag.current.startX;
      const dy = clientY - pendingDrag.current.startY;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        const id = pendingDrag.current.id;
        const token = tokens[id];
        pendingDrag.current = null;
        if (token) {
          setIsDragging(true);
          setDragTokenId(id);
          setGhostPosition({ gridX: token.x, gridY: token.y });
        }
      }
      return;
    }

    // Active drag — update ghost position
    if (!isDragging || !dragTokenId || !svgElementRef.current) return;
    const svgCoords = screenToSVG(svgElementRef.current, clientX, clientY);
    const snapped = snapToGrid(svgCoords.x, svgCoords.y, unitSize);
    setGhostPosition(snapped);
  }, [isDragging, dragTokenId, unitSize, tokens]);

  const handlePointerUp = useCallback(() => {
    // If pending drag never met threshold — treat as click (select handled by Token onClick)
    if (pendingDrag.current) {
      pendingDrag.current = null;
      return;
    }

    if (!isDragging || !dragTokenId) return;

    if (!svgElementRef.current || !onTokenMove || !ghostPosition) {
      setIsDragging(false);
      setDragTokenId(null);
      setGhostPosition(null);
      return;
    }

    const { gridX, gridY } = ghostPosition;

    // Validate placement (overlap prevention, room check)
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

    // Players can't drop tokens in hidden rooms (GM can)
    if (!isGM && roomVisibility && roomVisibility[room.id] !== true) {
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
  }, [isDragging, dragTokenId, onTokenMove, ghostPosition, isCellOccupied, findRoomAtCell, isGM, roomVisibility]);

  // Mouse and touch event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const handleMouseUp = () => handlePointerUp();

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      // Prevent page scroll while dragging a token
      if (pendingDrag.current || isDragging) {
        e.preventDefault();
      }
      handlePointerMove(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = () => handlePointerUp();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handlePointerMove, handlePointerUp, isDragging]);

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
            draggable={canDrag}
            selected={selectedTokenId === id}
            onSelect={handleTokenSelect}
            onDragStart={handleTokenDragStart}
            onTouchDragStart={handleTokenTouchDragStart}
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

    </g>
  );
}
