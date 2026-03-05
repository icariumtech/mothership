/**
 * TokenLayer - Renders all tokens on encounter map
 *
 * Filters tokens by room visibility (players only see tokens in revealed rooms),
 * handles token selection, drag-to-move functionality, and renders TokenPopup for selected token.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TokenState, RoomData, GridRoom } from '../../../types/encounterMap';
import { Token } from './Token';
import { screenToSVG, snapToGrid } from '@/utils/svgCoordinates';

// Ray-casting point-in-polygon test (grid coords)
function pointInPolygon(px: number, py: number, polygon: [number, number][]): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

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
  onTokenMove?: (id: string, x: number, y: number, roomId: string) => void;
  selectedTokenId?: string | null;
  onTokenSelect?: (id: string | null, e: React.MouseEvent) => void;
  mapRooms?: (RoomData | GridRoom)[];
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

  // Filter tokens by visibility:
  // - GM always sees all tokens (for setup/management)
  // - Players see tokens only in visible rooms (roomVisibility[room] !== false)
  // - Rooms not in the visibility dict are visible by default (same logic as isRoomVisible)
  const filteredTokens = Object.entries(tokens).filter(([_id, token]) => {
    if (isGM) return true;
    if (!token.room_id || token.room_id === '') return true;
    if (!roomVisibility) return true;
    return roomVisibility[token.room_id] !== false;
  });

  const findRoomAtCell = (gridX: number, gridY: number): RoomData | GridRoom | null => {
    if (!mapRoomsRef.current) return null;
    // Cell center for circle/polygon containment tests
    const px = gridX + 0.5;
    const py = gridY + 0.5;
    for (const room of mapRoomsRef.current) {
      const gr = room as GridRoom;
      if (gr.circle) {
        const { cx, cy, r } = gr.circle;
        if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) return room;
      } else if (gr.polygon && gr.polygon.length > 0) {
        if (pointInPolygon(px, py, gr.polygon)) return room;
      } else if ('rects' in room) {
        const hit = (gr.rects ?? []).some(r =>
          gridX >= r.x && gridX < r.x + r.w &&
          gridY >= r.y && gridY < r.y + r.h
        );
        if (hit) return room;
      } else {
        // Legacy RoomData format (x, y, width, height)
        const r = room as RoomData;
        if (gridX >= r.x && gridX < r.x + r.width &&
            gridY >= r.y && gridY < r.y + r.height) {
          return r;
        }
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
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= DRAG_THRESHOLD) {
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

    if (!isDraggingRef.current || !dragTokenIdRef.current) {
      return;
    }

    const ghost = ghostPositionRef.current;
    if (!svgElementRef.current || !onTokenMoveRef.current || !ghost) {
      stopDrag();
      return;
    }

    const { gridX, gridY } = ghost;
    const tokenId = dragTokenIdRef.current;

    const occupied = isCellOccupied(gridX, gridY, tokenId ?? undefined);
    if (occupied) {
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

    onTokenMoveRef.current(tokenId, gridX, gridY, room.id);
    stopDrag();
  }, []); // stable — reads all values from refs

  // Single useEffect for event listeners — stable handlers never need re-attachment
  // Uses Pointer Events API to unify mouse, touch, and pen input, which prevents
  // the browser from converting mid-drag touch into simulated mouse events.
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      // Prevent browser scroll/pan from taking over while drag is active
      if (pendingDrag.current || isDraggingRef.current) e.preventDefault();
      handlePointerMove(e.clientX, e.clientY);
    };

    const onPointerUp = () => handlePointerUp();

    const onPointerCancel = () => {
      tokenTouchActive = false;
      pendingDrag.current = null;
      stopDrag();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, []); // stable — never re-attaches

  const canDrag = !!onTokenMove;

  const handleTokenSelect = (id: string, e: React.MouseEvent) => {
    if (onTokenSelect) {
      onTokenSelect(selectedTokenId === id ? null : id, e);
    }
  };

  const handleTokenPointerDragStart = useCallback((id: string, e: React.PointerEvent) => {
    if (!onTokenMove) return;
    // For touch/pen, set flag so EncounterMapRenderer skips touch pan handling
    if (e.pointerType !== 'mouse') tokenTouchActive = true;
    pendingDrag.current = { id, startX: e.clientX, startY: e.clientY };
  }, [onTokenMove]);

  return (
    <g className="encounter-map__token-layer">
      {filteredTokens.map(([id, tokenData]) => {
        const isActiveDrag = isDragging && id === dragTokenId;

        // Always wrap Token in <g key={id}> so key always corresponds to the same element type.
        // This preserves the inner Token's <g> DOM node (and its pointer capture) across the
        // transition from "idle" to "active drag" — prevents pointercancel from firing.
        return (
          <g key={id} style={{ opacity: isActiveDrag ? 0 : 1 }}>
            <Token
              id={id}
              data={tokenData}
              unitSize={unitSize}
              draggable={!isActiveDrag && canDrag}
              selected={!isActiveDrag && selectedTokenId === id}
              onSelect={isActiveDrag ? undefined : handleTokenSelect}
              onPointerDragStart={isActiveDrag ? undefined : handleTokenPointerDragStart}
            />
          </g>
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
