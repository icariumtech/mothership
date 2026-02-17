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

  // Calculate height based on content: header + optional statuses + GM controls
  const baseHeight = 50; // name + type + padding
  const statusTagHeight = data.status.length > 0 ? 24 : 0;
  const gmControlsHeight = isGM ? 100 : 0;
  const totalHeight = baseHeight + statusTagHeight + gmControlsHeight;

  return (
    <foreignObject
      x={popupX}
      y={popupY}
      width={140}
      height={totalHeight}
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

        {/* GM controls */}
        {isGM && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
              {(['wounded', 'dead', 'panicked', 'stunned'] as TokenStatus[]).map((status) => (
                <button
                  key={status}
                  className={`token-popup__status-btn ${isStatusActive(status) ? 'token-popup__status-btn--active' : ''}`}
                  onClick={() => handleStatusToggle(status)}
                >
                  {status.toUpperCase()}
                </button>
              ))}
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
