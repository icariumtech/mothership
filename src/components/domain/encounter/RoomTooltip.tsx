/**
 * RoomTooltip - Hover tooltip for encounter map elements
 *
 * Displays information about rooms, doors, terminals, and POIs
 * when hovering over them on the encounter map.
 */

import './RoomTooltip.css';

interface RoomTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  description?: string;
  status?: string;
  type?: string;
}

export function RoomTooltip({
  visible,
  x,
  y,
  title,
  description,
  status,
  type,
}: RoomTooltipProps) {
  if (!visible) return null;

  const statusClass = status ? `room-tooltip__status--${status.toLowerCase()}` : '';

  return (
    <div
      className="room-tooltip"
      style={{
        left: x,
        top: y,
      }}
    >
      <div className="room-tooltip__header">
        <span className="room-tooltip__title">{title}</span>
        {type && <span className="room-tooltip__type">{type}</span>}
      </div>

      {status && (
        <div className={`room-tooltip__status ${statusClass}`}>
          {status}
        </div>
      )}

      {description && (
        <div className="room-tooltip__description">
          {description}
        </div>
      )}
    </div>
  );
}
