import { useState, useRef, useCallback, useEffect, RefObject } from 'react';
import { tokenTouchActive } from '../components/domain/encounter/TokenLayer';

interface ViewState {
  panX: number;
  panY: number;
  zoom: number;
}

interface PanZoomHandlers {
  onMouseDown: React.MouseEventHandler<HTMLElement>;
  onMouseMove: React.MouseEventHandler<HTMLElement>;
  onMouseUp: React.MouseEventHandler<HTMLElement>;
  onTouchStart: React.TouchEventHandler<HTMLElement>;
  onTouchEnd: React.TouchEventHandler<HTMLElement>;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;

/**
 * Manages pan and zoom state for an SVG map container.
 *
 * Pass containerRef (owned by the caller) so other code can share the same
 * ref for hit-testing (door popups, context menus, etc.). Spread the returned
 * containerHandlers onto the container div, and apply viewState to the SVG
 * transform.
 */
export function usePanZoom(containerRef: RefObject<HTMLDivElement | null>) {
  const [viewState, setViewState] = useState<ViewState>({ panX: 0, panY: 0, zoom: 1 });

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const viewStart = useRef({ panX: 0, panY: 0 });
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const resetView = useCallback(() => {
    setViewState({ panX: 0, panY: 0, zoom: 1 });
  }, []);

  // Wheel zoom — registered as a native listener so preventDefault works.
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewState((prev) => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * zoomDelta));
      const zoomRatio = newZoom / prev.zoom;
      return {
        panX: mouseX - (mouseX - prev.panX) * zoomRatio,
        panY: mouseY - (mouseY - prev.panY) * zoomRatio,
        zoom: newZoom,
      };
    });
  }, [containerRef]);

  // Touch move — registered native so preventDefault works.
  const touchMoveHandler = useCallback((e: TouchEvent) => {
    if (tokenTouchActive) return;
    e.preventDefault();
    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setViewState((prev) => ({
        ...prev,
        panX: viewStart.current.panX + dx,
        panY: viewStart.current.panY + dy,
      }));
    } else if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const container = containerRef.current;
      if (!container || !lastTouchCenter.current) return;
      const rect = container.getBoundingClientRect();
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const scale = distance / lastTouchDistance.current;
      setViewState((prev) => {
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * scale));
        const zoomRatio = newZoom / prev.zoom;
        return {
          panX: centerX - (centerX - prev.panX) * zoomRatio,
          panY: centerY - (centerY - prev.panY) * zoomRatio,
          zoom: newZoom,
        };
      });
      lastTouchDistance.current = distance;
      lastTouchCenter.current = { x: centerX + (containerRef.current?.getBoundingClientRect().left ?? 0), y: centerY + (containerRef.current?.getBoundingClientRect().top ?? 0) };
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchmove', touchMoveHandler, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchmove', touchMoveHandler);
    };
  }, [containerRef, handleWheel, touchMoveHandler]);

  // Global mouse-up so panning stops even when the cursor leaves the container.
  useEffect(() => {
    const onGlobalMouseUp = () => {
      isDragging.current = false;
      if (containerRef.current) containerRef.current.style.cursor = 'grab';
    };
    window.addEventListener('mouseup', onGlobalMouseUp);
    return () => window.removeEventListener('mouseup', onGlobalMouseUp);
  }, [containerRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.encounter-map__door') || target.closest('.encounter-map__token')) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    viewStart.current = { panX: viewState.panX, panY: viewState.panY };
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
  }, [viewState.panX, viewState.panY, containerRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setViewState((prev) => ({ ...prev, panX: viewStart.current.panX + dx, panY: viewStart.current.panY + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    if (containerRef.current) containerRef.current.style.cursor = 'grab';
  }, [containerRef]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (tokenTouchActive) return;
    if (e.touches.length === 1) {
      isDragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      viewStart.current = { panX: viewState.panX, panY: viewState.panY };
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
      lastTouchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
    }
  }, [viewState.panX, viewState.panY]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
  }, []);

  const containerHandlers: PanZoomHandlers = {
    onMouseDown: handleMouseDown as React.MouseEventHandler<HTMLElement>,
    onMouseMove: handleMouseMove as React.MouseEventHandler<HTMLElement>,
    onMouseUp: handleMouseUp as React.MouseEventHandler<HTMLElement>,
    onTouchStart: handleTouchStart as React.TouchEventHandler<HTMLElement>,
    onTouchEnd: handleTouchEnd as React.TouchEventHandler<HTMLElement>,
  };

  return { viewState, containerHandlers, resetView };
}
