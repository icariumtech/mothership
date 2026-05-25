import { useRef, useState, useEffect, useCallback } from 'react';
import './MapPlaybackControls.css';

/**
 * Chronoscope — iPod-style click-wheel overlay on map views.
 *
 * - Center button toggles play/pause.
 * - When paused AND `onScrubDelta` is provided, dragging anywhere on the
 *   amber ring advances orbital time (positive = clockwise = forward).
 *   While dragging, an amber readout above the wheel shows cumulative drag
 *   in degrees; it resets to 0 on each new drag and fades on release.
 * - When `onScrubDelta` is omitted (galaxy map), the ring is purely
 *   decorative — visual parity, no scrub behavior.
 */
export interface MapPlaybackControlsProps {
  /** Whether animation is currently playing */
  isPlaying: boolean;
  /** Toggle play/pause */
  onTogglePlay: () => void;
  /**
   * Signed angular delta in radians fired while dragging the ring (positive
   * = clockwise). Omit to make the ring decorative-only.
   */
  onScrubDelta?: (deltaRadians: number) => void;
}

const RING_SIZE = 120;
const RING_CENTER = RING_SIZE / 2;
const RING_STROKE = 22;
const RING_RADIUS = 49;
const BUTTON_DIAMETER = 72;
const LABEL_FADE_MS = 500;

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path d="M 8 5 L 8 19 L 19 12 Z" fill="currentColor" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="8" y="5" width="3" height="14" fill="currentColor" />
    <rect x="13" y="5" width="3" height="14" fill="currentColor" />
  </svg>
);

export const MapPlaybackControls: React.FC<MapPlaybackControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onScrubDelta,
}) => {
  const ringRef = useRef<SVGSVGElement>(null);
  const isDraggingRef = useRef(false);
  const lastAngleRef = useRef(0);
  const cumulativeDragRef = useRef(0);
  const fadeTimerRef = useRef<number | null>(null);

  const [scrubDeg, setScrubDeg] = useState<number | null>(null);
  const [labelFading, setLabelFading] = useState(false);

  const scrubEnabled = !!onScrubDelta && !isPlaying;

  useEffect(
    () => () => {
      if (fadeTimerRef.current != null) window.clearTimeout(fadeTimerRef.current);
    },
    [],
  );

  const getAngleFromEvent = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const rect = ringRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!scrubEnabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      lastAngleRef.current = getAngleFromEvent(e);
      cumulativeDragRef.current = 0;
      if (fadeTimerRef.current != null) {
        window.clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
      setLabelFading(false);
      setScrubDeg(0);
    },
    [scrubEnabled, getAngleFromEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDraggingRef.current || !onScrubDelta) return;
      const angle = getAngleFromEvent(e);
      let delta = angle - lastAngleRef.current;
      // Normalize across the ±π seam so a drag past the boundary doesn't
      // produce a sudden ±2π jump.
      if (delta > Math.PI) delta -= 2 * Math.PI;
      else if (delta < -Math.PI) delta += 2 * Math.PI;
      lastAngleRef.current = angle;
      cumulativeDragRef.current += delta;
      setScrubDeg(Math.round(cumulativeDragRef.current * (180 / Math.PI)));
      onScrubDelta(delta);
    },
    [onScrubDelta, getAngleFromEvent],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setLabelFading(true);
    fadeTimerRef.current = window.setTimeout(() => {
      setScrubDeg(null);
      setLabelFading(false);
      fadeTimerRef.current = null;
    }, LABEL_FADE_MS);
  }, []);

  return (
    <div className="map-playback-controls">
      {scrubDeg !== null && (
        <div
          className={`map-playback-controls__scrub-label${labelFading ? ' fading' : ''}`}
          aria-live="polite"
        >
          {scrubDeg > 0 ? '+' : ''}
          {scrubDeg}
        </div>
      )}
      <svg
        ref={ringRef}
        className="map-playback-controls__ring"
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        role="slider"
        aria-label="Scrub orbital time"
        aria-disabled={!scrubEnabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        <circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke="#c9a050"
          strokeWidth={RING_STROKE}
        />
      </svg>
      <button
        className="map-playback-controls__btn"
        aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
        onClick={onTogglePlay}
        type="button"
        style={{ width: BUTTON_DIAMETER, height: BUTTON_DIAMETER }}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
    </div>
  );
};
