import { useRef, useEffect, ReactNode } from 'react';
import gsap from 'gsap';
import './MapSection.css';

interface MapSectionProps {
  visible: boolean;
  children: ReactNode;
  onVisibilityChange?: (visible: boolean) => void;
}

export function MapSection({ visible, children, onVisibilityChange }: MapSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (visible) {
      // Fade in
      gsap.to(containerRef.current, {
        opacity: 1,
        duration: 0.3,
        pointerEvents: 'auto',
      });
    } else {
      // Fade out
      gsap.to(containerRef.current, {
        opacity: 0,
        duration: 0.3,
        pointerEvents: 'none',
      });
    }

    // Notify parent of visibility change
    onVisibilityChange?.(visible);
  }, [visible, onVisibilityChange]);

  return (
    <div
      ref={containerRef}
      className="map-section"
      style={{ display: visible ? 'block' : 'none' }}
    >
      {children}
    </div>
  );
}
