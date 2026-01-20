import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook for managing collapsible panel state
 */
export function usePanelCollapse(initialCollapsed = false) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);

  const toggle = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const collapse = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  const expand = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  return {
    isCollapsed,
    toggle,
    collapse,
    expand,
  };
}

/**
 * Hook for tracking panel resize with ResizeObserver
 */
export function usePanelResize(callback?: (width: number, height: number) => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!panelRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
        callback?.(width, height);
      }
    });

    resizeObserver.observe(panelRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [callback]);

  return {
    panelRef,
    width: dimensions.width,
    height: dimensions.height,
  };
}

/**
 * Hook for managing draggable panel position (future feature)
 */
export function usePanelDrag(initialPosition = { x: 0, y: 0 }) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const panelStartPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;

    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    panelStartPos.current = { ...position };
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;

    setPosition({
      x: panelStartPos.current.x + deltaX,
      y: panelStartPos.current.y + deltaY,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return {
    dragRef,
    position,
    isDragging,
    handleMouseDown,
    resetPosition: () => setPosition(initialPosition),
  };
}

/**
 * Hook for managing panel visibility with animation
 */
export function usePanelVisibility(initialVisible = false, animationDuration = 300) {
  const [isVisible, setIsVisible] = useState(initialVisible);
  const [isAnimating, setIsAnimating] = useState(false);

  const show = useCallback(() => {
    setIsAnimating(true);
    setIsVisible(true);
    setTimeout(() => setIsAnimating(false), animationDuration);
  }, [animationDuration]);

  const hide = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsAnimating(false);
    }, animationDuration);
  }, [animationDuration]);

  const toggle = useCallback(() => {
    if (isVisible) {
      hide();
    } else {
      show();
    }
  }, [isVisible, show, hide]);

  return {
    isVisible,
    isAnimating,
    show,
    hide,
    toggle,
  };
}
