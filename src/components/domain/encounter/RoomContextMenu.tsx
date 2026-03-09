/**
 * RoomContextMenu - Right-click context menu for GM room actions
 *
 * Appears on right-click of a room in GM view. Styled like DoorStatusPopup.
 * Currently shows reveal/hide toggle; extensible for future options.
 */

import { useEffect, useRef } from 'react';
import type { GridRoom } from '../../../types/encounterMap';

interface RoomContextMenuProps {
  room: GridRoom;
  isVisible?: boolean;
  x: number;
  y: number;
  onToggleVisibility?: () => void;
  onClose: () => void;
}

export function RoomContextMenu({
  room,
  isVisible,
  x,
  y,
  onToggleVisibility,
  onClose,
}: RoomContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const displayName = room.name || room.id;

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-50%, -100%) translateY(-8px)',
        background: '#0f1515',
        border: '1px solid #4a6b6b',
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        minWidth: '120px',
        fontFamily: "'Cascadia Code', 'Courier New', monospace",
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Arrow pointing down */}
      <div
        style={{
          position: 'absolute',
          bottom: -6,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid #4a6b6b',
        }}
      />

      {/* Room header */}
      <div style={{
        color: '#4a6b6b',
        fontSize: '10px',
        fontWeight: 'bold',
        letterSpacing: '1px',
        textTransform: 'uppercase',
        paddingBottom: '4px',
        borderBottom: '1px solid #2a3a3a',
        marginBottom: '2px',
      }}>
        {displayName}
      </div>

      {/* Room description if present */}
      {room.description && (
        <div style={{
          color: '#5a5a5a',
          fontSize: '9px',
          letterSpacing: '0.5px',
          marginBottom: '2px',
          maxWidth: '140px',
          wordBreak: 'break-word',
        }}>
          {room.description}
        </div>
      )}

      {/* Reveal/Hide button — GM only */}
      {onToggleVisibility && <button
        onClick={onToggleVisibility}
        style={{
          background: '#1a1a1a',
          border: `1px solid ${isVisible ? '#8b7355' : '#4a6b6b'}`,
          color: isVisible ? '#8b7355' : '#4a6b6b',
          padding: '4px 8px',
          fontSize: '10px',
          fontFamily: 'inherit',
          letterSpacing: '1px',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          textAlign: 'center',
        }}
        onMouseEnter={(e) => {
          const color = isVisible ? '#8b7355' : '#4a6b6b';
          e.currentTarget.style.background = color;
          e.currentTarget.style.color = '#0a0a0a';
        }}
        onMouseLeave={(e) => {
          const color = isVisible ? '#8b7355' : '#4a6b6b';
          e.currentTarget.style.background = '#1a1a1a';
          e.currentTarget.style.color = color;
        }}
      >
        {isVisible ? 'HIDE ROOM' : 'REVEAL ROOM'}
      </button>}
    </div>
  );
}
