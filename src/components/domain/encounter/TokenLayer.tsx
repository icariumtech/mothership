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

// Module-level flag: signals to parent components that a token touch is active
// This avoids relying on stopPropagation across SVG/HTML boundary on touch devices
export let tokenTouchActive = false;

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
  // Rendering state (drives JSX)
  const [isDragging, setIsDragging] = useState(false);
  const [dragTokenId, setDragTokenId] = useState<string | null>(null);
  const [ghostPosition, setGhostPosition] = useState<{ gridX: number; gridY: number } | null>(null);

  // Refs mirroring drag state — event handlers always read from refs to avoid stale closures
  const isDraggingRef = useRef(false);
  const dragTokenIdRef = useRef<string | null>(null);
  const ghostPositionRef = useRef<{ gridX: number; gridY: number } | null>(null);

  // Keep refs in sync with state
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
  useEffect(() => { dragTokenIdRef.current = dragTokenId; }, [dragTokenId]);
  useEffect(() => { ghostPositionRef.current = ghostPosition; }, [ghostPosition]);

  // Stable refs for props that event handlers need
  const tokensRef = useRef(tokens);
  const onTokenMoveRef = useRef(onTokenMove);
  const mapRoomsRef = useRef(mapRooms);
  const roomVisibilityRef = useRef(roomVisibility);
  const isGMRef = useRef(isGM);
  const unitSizeRef = useRef(unitSize);

  useEffect(() => { tokensRef.current = tokens; }, [tokens]);
  useEffect(() => { onTokenMoveRef.current = onTokenMove; }, [onTokenMove]);
  useEffect(() => { mapRoomsRef.current = mapRooms; }, [mapRooms]);
  useEffect(() => { roomVisibilityRef.current = roomVisibility; }, [roomVisibility]);
  useEffect(() => { isGMRef.current = isGM; }, [isGM]);
  useEffect(() => { unitSizeRef.current = unitSize; }, [unitSize]);

  const svgElementRef = useRef<SVGSVGElement | null>(null);
  const pendingDrag = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const DRAG_THRESHOLD = 5;

  // Get parent SVG element on mount
  useEffect(() => {
    const tokenLayerElement = document.querySelector('.encounter-map__token-layer');
    if (tokenLayerElement) {
      svgElementRef.current = tokenLayerElement.closest('svg') as SVGSVGElement;
    }
  }, []);

  // Filter tokens by visibility
  const filteredTokens = Object.entries(tokens).filter(([_id, token]) => {
    if (isGM) return true;
    if (!token.room_id || token.room_id === '') return true;
    if (!roomVisibility) return true;
    return roomVisibility[token.room_id] === true;
  });

  const findRoomAtCell = (gridX: number, gridY: number): RoomData | null => {
    for (const room of mapRoomsRef.current) {
      if (gridX >= room.x && gridX < room.x + room.width &&
          gridY >= room.y && gridY < room.y + room.height) {
        return room;
      }
    }
    return null;
  };

  const isCellOccupied = (gridX: number, gridY: number, excludeTokenId?: string): boolean => {
    return Object.entries(tokensRef.current).some(([id, token]) => {
      if (id === excludeTokenId) return false;
      return token.x === gridX && token.y === gridY;
    });
  };

  const stopDrag = () => {
    isDraggingRef.current = false;
    dragTokenIdRef.current = null;
    ghostPositionRef.current = null;
    setIsDragging(false);
    setDragTokenId(null);
    setGhostPosition(null);
  };

  // Stable event handlers — read all values from refs, never from closure
  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    // Pending drag threshold check
    if (pendingDrag.current && !isDraggingRef.current) {
      const dx = clientX - pendingDrag.current.startX;
      const dy = clientY - pendingDrag.current.startY;
      if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        const id = pendingDrag.current.id;
        const token = tokensRef.current[id];
        pendingDrag.current = null;
        if (token) {
          isDraggingRef.current = true;
          dragTokenIdRef.current = id;
          ghostPositionRef.current = { gridX: token.x, gridY: token.y };
          setIsDragging(true);
          setDragTokenId(id);
          setGhostPosition({ gridX: token.x, gridY: token.y });
        }
      }
      return;
    }

    // Active drag — update ghost position
    if (!isDraggingRef.current || !dragTokenIdRef.current || !svgElementRef.current) return;
    const svgCoords = screenToSVG(svgElementRef.current, clientX, clientY);
    const snapped = snapToGrid(svgCoords.x, svgCoords.y, unitSizeRef.current);
    ghostPositionRef.current = snapped;
    setGhostPosition(snapped);
  }, []); // stable — reads all values from refs

  const handlePointerUp = useCallback(() => {
    tokenTouchActive = false;

    // Tap without movement — click will handle selection
    if (pendingDrag.current) {
      pendingDrag.current = null;
      return;
    }

    if (!isDraggingRef.current || !dragTokenIdRef.current) return;

    const ghost = ghostPositionRef.current;
    if (!svgElementRef.current || !onTokenMoveRef.current || !ghost) {
      stopDrag();
      return;
    }

    const { gridX, gridY } = ghost;
    const tokenId = dragTokenIdRef.current;

    if (isCellOccupied(gridX, gridY, tokenId)) {
      console.warn('Cannot move token: cell is occupied');
      stopDrag();
      return;
    }

    const room = findRoomAtCell(gridX, gridY);
    if (!room) {
      console.warn('Cannot move token: not inside a room');
      stopDrag();
      return;
    }

    if (!isGMRef.current && roomVisibilityRef.current && roomVisibilityRef.current[room.id] !== true) {
      console.warn('Cannot move token: room is not revealed');
      stopDrag();
      return;
    }

    onTokenMoveRef.current(tokenId, gridX, gridY);
    stopDrag();
  }, []); // stable — reads all values from refs

  // Single useEffect for event listeners — stable handlers never need re-attachment
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const onMouseUp = () => handlePointerUp();

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      if (isDraggingRef.current) e.preventDefault();
      handlePointerMove(touch.clientX, touch.clientY);
    };

    const onTouchEnd = () => handlePointerUp();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []); // stable — never re-attaches

  const canDrag = !!onTokenMove;

  const handleTokenSelect = (id: string) => {
    if (onTokenSelect) {
      onTokenSelect(selectedTokenId === id ? null : id);
    }
  };

  const handleTokenDragStart = useCallback((id: string, e: React.MouseEvent) => {
    if (!onTokenMove) return;
    e.stopPropagation();
    pendingDrag.current = { id, startX: e.clientX, startY: e.clientY };
  }, [onTokenMove]);

  const handleTokenTouchDragStart = useCallback((id: string, e: React.TouchEvent) => {
    if (!onTokenMove) return;
    const touch = e.touches[0];
    if (!touch) return;
    e.stopPropagation();
    tokenTouchActive = true;
    pendingDrag.current = { id, startX: touch.clientX, startY: touch.clientY };
  }, [onTokenMove]);

  return (
    <g className="encounter-map__token-layer">
      {filteredTokens.map(([id, tokenData]) => {
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
