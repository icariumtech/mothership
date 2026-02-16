/**
 * TokenPopup - Inline popup for token details and GM controls
 *
 * Shows token name, type, status tags, and GM-only controls
 * (status toggles, remove button) when selected.
 */

import { TokenData, TokenStatus } from '../../../types/encounterMap';

interface TokenPopupProps {
  tokenId: string;
  data: TokenData;
  unitSize: number;
  position: { x: number; y: number };  // Center of token in SVG coords
  onClose: () => void;
  onRemove?: (id: string) => void;
  onStatusToggle?: (id: string, status: TokenStatus) => void;
  isGM?: boolean;
}

export function TokenPopup({
  tokenId,
  data,
  unitSize,
  position,
  onClose,
  onRemove,
  onStatusToggle,
  isGM = false,
}: TokenPopupProps) {
  // Position popup to the right of the token
  const popupX = position.x + unitSize * 0.6;
  const popupY = position.y - 70;

  const handleStatusToggle = (status: TokenStatus) => {
    if (onStatusToggle) {
      onStatusToggle(tokenId, status);
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove(tokenId);
    }
  };

  const isStatusActive = (status: TokenStatus) => {
    return data.status.includes(status);
  };

  return (
    <foreignObject
      x={popupX}
      y={popupY}
      width={160}
      height={180}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="token-popup">
        {/* Close button */}
        <button
          className="token-popup__close"
          onClick={onClose}
          title="Close"
        >
          ×
        </button>

        {/* Header */}
        <div className="token-popup__name">{data.name}</div>
        <div className="token-popup__type">{data.type}</div>

        {/* Current status tags */}
        {data.status.length > 0 && (
          <div style={{ marginTop: '6px', marginBottom: '4px' }}>
            {data.status.map((s) => (
              <span
                key={s}
                style={{
                  display: 'inline-block',
                  background: '#2a3a3a',
                  color: '#9a9a9a',
                  padding: '2px 4px',
                  margin: '2px',
                  fontSize: '8px',
                  textTransform: 'uppercase',
                  borderRadius: '2px',
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* GM controls */}
        {isGM && (
          <>
            <div style={{ marginTop: '8px', fontSize: '9px', color: '#5a5a5a' }}>
              STATUS
            </div>
            <div>
              <button
                className={`token-popup__status-btn ${isStatusActive('wounded') ? 'token-popup__status-btn--active' : ''}`}
                onClick={() => handleStatusToggle('wounded')}
              >
                WOUNDED
              </button>
              <button
                className={`token-popup__status-btn ${isStatusActive('dead') ? 'token-popup__status-btn--active' : ''}`}
                onClick={() => handleStatusToggle('dead')}
              >
                DEAD
              </button>
              <button
                className={`token-popup__status-btn ${isStatusActive('panicked') ? 'token-popup__status-btn--active' : ''}`}
                onClick={() => handleStatusToggle('panicked')}
              >
                PANICKED
              </button>
              <button
                className={`token-popup__status-btn ${isStatusActive('stunned') ? 'token-popup__status-btn--active' : ''}`}
                onClick={() => handleStatusToggle('stunned')}
              >
                STUNNED
              </button>
            </div>

            <button
              className="token-popup__remove-btn"
              onClick={handleRemove}
            >
              REMOVE
            </button>
          </>
        )}
      </div>
    </foreignObject>
  );
}
