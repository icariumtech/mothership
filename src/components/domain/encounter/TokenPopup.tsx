/**
 * TokenPopup - Popup for token details and GM controls
 *
 * Rendered outside SVG as absolutely positioned div (same pattern as DoorStatusPopup).
 * Shows token name, type, status toggles, and remove button.
 */

import { useEffect, useRef } from 'react';
import { TokenData, TokenStatus } from '../../../types/encounterMap';

interface TokenPopupProps {
  tokenId: string;
  data: TokenData;
  /** Position in container pixel coordinates (not SVG coords) */
  x: number;
  y: number;
  onClose: () => void;
  onRemove?: (id: string) => void;
  onStatusToggle?: (id: string, status: TokenStatus) => void;
  isGM?: boolean;
}

const COLORS = {
  bg: '#0f1515',
  border: '#4a6b6b',
  teal: '#4a6b6b',
  tealBright: '#5a7a7a',
  amber: '#8b7355',
  hazard: '#8b5555',
  text: '#9a9a9a',
  textMuted: '#5a5a5a',
  btnBg: '#1a1a1a',
  dark: '#0a0a0a',
};

const STATUS_OPTIONS: { status: TokenStatus; label: string }[] = [
  { status: 'wounded', label: 'WOUNDED' },
  { status: 'dead', label: 'DEAD' },
  { status: 'panicked', label: 'PANICKED' },
  { status: 'stunned', label: 'STUNNED' },
];

export function TokenPopup({
  tokenId,
  data,
  x,
  y,
  onClose,
  onRemove,
  onStatusToggle,
  isGM = false,
}: TokenPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
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

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const isStatusActive = (status: TokenStatus) => data.status.includes(status);

  return (
    <div
      ref={popupRef}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(8px, -50%)',
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        zIndex: 100,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        minWidth: '100px',
        fontFamily: "'Cascadia Code', monospace",
        fontSize: '10px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ color: COLORS.tealBright, fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.5px' }}>
        {data.name}
      </div>
      <div style={{ color: COLORS.textMuted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        {data.type}
      </div>

      {/* GM controls */}
      {isGM && (
        <>
          {STATUS_OPTIONS.map(({ status, label }) => {
            const active = isStatusActive(status);
            return (
              <button
                key={status}
                onClick={() => onStatusToggle && onStatusToggle(tokenId, status)}
                style={{
                  background: active ? COLORS.teal : COLORS.btnBg,
                  border: `1px solid ${COLORS.teal}`,
                  color: active ? COLORS.dark : COLORS.teal,
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontFamily: 'inherit',
                  letterSpacing: '1px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = COLORS.teal;
                    e.currentTarget.style.color = COLORS.dark;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = COLORS.btnBg;
                    e.currentTarget.style.color = COLORS.teal;
                  }
                }}
              >
                {label}
              </button>
            );
          })}

          <button
            onClick={() => onRemove && onRemove(tokenId)}
            style={{
              background: COLORS.btnBg,
              border: `1px solid ${COLORS.hazard}`,
              color: COLORS.hazard,
              padding: '4px 8px',
              marginTop: '2px',
              fontSize: '10px',
              fontFamily: 'inherit',
              letterSpacing: '1px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textAlign: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = COLORS.hazard;
              e.currentTarget.style.color = COLORS.dark;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = COLORS.btnBg;
              e.currentTarget.style.color = COLORS.hazard;
            }}
          >
            REMOVE
          </button>
        </>
      )}
    </div>
  );
}
