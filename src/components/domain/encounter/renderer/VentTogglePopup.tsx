/**
 * VentTogglePopup - GM-only popup (right-click on a vent) to reveal/hide
 * all vents for players. Owns its own click-outside-to-close listener
 * (self-contained, unlike the original which wired this in the parent).
 * Extracted from EncounterMapRenderer's inline vent-popover JSX block.
 */
import { useEffect, useRef } from 'react';
import { COLORS } from './mapColors';

interface VentTogglePopupProps {
  x: number;
  y: number;
  currentlyVisible: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function VentTogglePopup({ x, y, currentlyVisible, onToggle, onClose }: VentTogglePopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside — timeout defers listener attach past the opening
  // right-click's own mousedown, so it doesn't immediately close itself.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        background: 'rgba(10,10,10,0.97)',
        border: `1px solid ${COLORS.vent}`,
        fontFamily: "'Cascadia Code', 'Courier New', monospace",
        fontSize: '11px',
        letterSpacing: '1px',
        zIndex: 20,
        minWidth: 160,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        style={{
          display: 'block', width: '100%', padding: '6px 10px',
          background: 'none', border: 'none', color: currentlyVisible ? COLORS.hazard : COLORS.vent,
          fontFamily: 'inherit', fontSize: '11px', letterSpacing: '1px',
          textAlign: 'left', cursor: 'pointer', textTransform: 'uppercase',
        }}
        onClick={onToggle}
      >
        {currentlyVisible ? 'Hide vents from players' : 'Reveal vents to players'}
      </button>
    </div>
  );
}
