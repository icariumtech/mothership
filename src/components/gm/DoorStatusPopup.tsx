/**
 * DoorStatusPopup - Popup for selecting door status
 *
 * Appears near clicked door in map preview, shows 5 status buttons.
 * Color-coded to match existing door styling.
 */

import { useEffect, useRef } from 'react';
import type { DoorStatus } from '@/types/encounterMap';

interface DoorStatusPopupProps {
  x: number;
  y: number;
  currentStatus: DoorStatus;
  onSelect: (status: DoorStatus) => void;
  onClose: () => void;
}

// Door status options with colors matching V2-1 palette
const STATUS_OPTIONS: { status: DoorStatus; label: string; color: string }[] = [
  { status: 'OPEN', label: 'OPEN', color: '#4a6b6b' },      // teal (faded)
  { status: 'CLOSED', label: 'CLOSED', color: '#5a7a7a' },  // teal bright
  { status: 'LOCKED', label: 'LOCKED', color: '#8b7355' },  // amber
  { status: 'SEALED', label: 'SEALED', color: '#8b5555' },  // hazard red
  { status: 'DAMAGED', label: 'DAMAGED', color: '#6a4a4a' }, // dark red
];

export function DoorStatusPopup({
  x,
  y,
  currentStatus,
  onSelect,
  onClose,
}: DoorStatusPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to avoid immediate close
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
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      ref={popupRef}
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
        minWidth: '80px',
      }}
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

      {STATUS_OPTIONS.map(({ status, label, color }) => (
        <button
          key={status}
          onClick={() => onSelect(status)}
          style={{
            background: currentStatus === status ? color : '#1a1a1a',
            border: `1px solid ${color}`,
            color: currentStatus === status ? '#0a0a0a' : color,
            padding: '4px 8px',
            fontSize: '10px',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            textAlign: 'center',
          }}
          onMouseEnter={(e) => {
            if (currentStatus !== status) {
              e.currentTarget.style.background = color;
              e.currentTarget.style.color = '#0a0a0a';
            }
          }}
          onMouseLeave={(e) => {
            if (currentStatus !== status) {
              e.currentTarget.style.background = '#1a1a1a';
              e.currentTarget.style.color = color;
            }
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
