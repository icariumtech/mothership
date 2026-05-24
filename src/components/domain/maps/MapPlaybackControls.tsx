import { useRef, useState, useCallback } from 'react';
import './MapPlaybackControls.css';

/**
 * Map playback overlay: circular scrub ring with a play/pause button at its
 * center. The ring is shown only when `showScrub` is true (system + orbit
 * maps); the galaxy map renders just the centered button.
 *
 * Emits `onScrubDelta(deltaRadians)` — signed angular delta of the thumb
 * around the ring, positive = clockwise = forward time. One full ring
 * rotation advances all bodies by 2π radians along their orbits.
 */
export interface MapPlaybackControlsProps {
  /** Whether animation is currently playing */
  isPlaying: boolean;
  /** Toggle play/pause */
  onTogglePlay: () => void;
  /** Whether to show the scrub ring */
  showScrub: boolean;
  /** Signed angular delta in radians fired during ring drag (positive = clockwise) */
  onScrubDelta?: (deltaRadians: number) => void;
}

const RING_SIZE = 120;
const RING_RADIUS = 50;
const RING_CENTER = RING_SIZE / 2;
const RING_STROKE = 6;
const RING_HIT_STROKE = 24;
const THUMB_RADIUS = 10;

export const MapPlaybackControls: React.FC<MapPlaybackControlsProps> = ({
  isPlaying,
  onTogglePlay,
  showScrub,
  onScrubDelta,
}) => {
  const ringRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const lastAngleRef = useRef(0);
  const cumulativeAngleRef = useRef(0);
  const [thumbAngle, setThumbAngle] = useState(0);

  const getAngleFromEvent = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const rect = ringRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!onScrubDelta || isPlaying) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      lastAngleRef.current = getAngleFromEvent(e);
    },
    [onScrubDelta, isPlaying, getAngleFromEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDraggingRef.current || !onScrubDelta) return;
      const angle = getAngleFromEvent(e);
      let delta = angle - lastAngleRef.current;
      // Normalize delta across the ±π boundary so dragging across the seam
      // doesn't produce a sudden ±2π jump.
      if (delta > Math.PI) delta -= 2 * Math.PI;
      else if (delta < -Math.PI) delta += 2 * Math.PI;
      lastAngleRef.current = angle;
      cumulativeAngleRef.current += delta;
      setThumbAngle(cumulativeAngleRef.current);
      onScrubDelta(delta);
    },
    [onScrubDelta, getAngleFromEvent],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    isDraggingRef.current = false;
  }, []);

  // Thumb position on the ring
  const thumbX = RING_CENTER + RING_RADIUS * Math.cos(thumbAngle);
  const thumbY = RING_CENTER + RING_RADIUS * Math.sin(thumbAngle);

  return (
    <div
      className={`map-playback-controls${showScrub ? ' map-playback-controls--with-ring' : ''}`}
    >
      {showScrub && (
        <svg
          ref={ringRef}
          className="map-playback-controls__ring"
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          role="slider"
          aria-label="Scrub orbital time"
          aria-disabled={isPlaying}
          onPointerDown={isPlaying ? undefined : handlePointerDown}
          onPointerMove={isPlaying ? undefined : handlePointerMove}
          onPointerUp={isPlaying ? undefined : handlePointerUp}
          onPointerCancel={isPlaying ? undefined : handlePointerUp}
          style={{ touchAction: 'none' }}
        >
          {/* Wide transparent hit-target so the ring is easy to grab */}
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            fill="none"
            stroke="transparent"
            strokeWidth={RING_HIT_STROKE}
          />
          <circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={RING_RADIUS}
            fill="none"
            stroke={isPlaying ? '#2a4040' : '#4a8b8b'}
            strokeWidth={RING_STROKE}
            pointerEvents="none"
          />
          {!isPlaying && (
            <circle
              cx={thumbX}
              cy={thumbY}
              r={THUMB_RADIUS}
              fill="#c9a050"
              pointerEvents="none"
            />
          )}
        </svg>
      )}
      <button
        className="map-playback-controls__btn"
        aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
        onClick={onTogglePlay}
        type="button"
      >
        <span className="map-playback-controls__btn-frame">
          {isPlaying ? '⏸' : '▶'}
        </span>
      </button>
    </div>
  );
};
