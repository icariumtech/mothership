import { useRef, useState, useCallback } from 'react';
import './MapPlaybackControls.css';

/**
 * Stateless overlay row for map playback: play/pause + optional scrub drag zone.
 *
 * Renders OUTSIDE the R3F Canvas as a positioned div inside the map container
 * (per Phase 25 D-13). Owns no animation state — emits onTogglePlay /
 * onScrubDelta callbacks only. All animation state lives in the parent
 * (sceneStore for galaxy autoRotate; local React state for system/orbit
 * orbital offset per D-08).
 */
export interface MapPlaybackControlsProps {
  /** Whether animation is currently playing */
  isPlaying: boolean;
  /** Toggle play/pause */
  onTogglePlay: () => void;
  /** Whether to show the scrub bar (galaxy: false, system/orbit: true) */
  showScrub: boolean;
  /** Callback fired during scrub drag with pixel delta (positive = right/forward) */
  onScrubDelta?: (deltaX: number) => void;
}

export const MapPlaybackControls: React.FC<MapPlaybackControlsProps> = ({
  isPlaying,
  onTogglePlay,
  showScrub,
  onScrubDelta,
}) => {
  // Drag refs — kept in refs so handlers don't re-bind every render
  const isDraggingRef = useRef(false);
  const lastXRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Cosmetic thumb position state (track-clamped cumulative pixels).
  // This is purely visual; the parent computes orbital offset from the raw
  // pixel deltas emitted via onScrubDelta.
  const cumulativeXRef = useRef(0);
  const [thumbX, setThumbX] = useState(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onScrubDelta || isPlaying) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      lastXRef.current = e.clientX;
    },
    [onScrubDelta, isPlaying],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !onScrubDelta) return;
      const deltaX = e.clientX - lastXRef.current;
      lastXRef.current = e.clientX;
      onScrubDelta(deltaX);

      // Update cosmetic thumb position — clamp cumulative offset to track width
      const trackWidth = trackRef.current?.getBoundingClientRect().width ?? 300;
      cumulativeXRef.current = Math.max(
        0,
        Math.min(trackWidth, cumulativeXRef.current + deltaX),
      );
      setThumbX(cumulativeXRef.current);
    },
    [onScrubDelta],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      isDraggingRef.current = false;
    },
    [],
  );

  return (
    <div className="map-playback-controls">
      <button
        className={`map-playback-controls__btn${!isPlaying ? ' map-playback-controls__btn--paused' : ''}`}
        aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
        onClick={onTogglePlay}
        type="button"
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      {showScrub && (
        <div
          ref={trackRef}
          className={`map-playback-controls__scrub${isPlaying ? ' map-playback-controls__scrub--disabled' : ''}`}
          aria-disabled={isPlaying}
          aria-label="Scrub orbital time"
          role="slider"
          onPointerDown={isPlaying ? undefined : handlePointerDown}
          onPointerMove={isPlaying ? undefined : handlePointerMove}
          onPointerUp={isPlaying ? undefined : handlePointerUp}
          onPointerCancel={isPlaying ? undefined : handlePointerUp}
          style={{ touchAction: 'none' }}
        >
          <div className="map-playback-controls__scrub-track" />
          {!isPlaying && (
            <div
              className="map-playback-controls__scrub-thumb"
              style={{ left: `${thumbX}px` }}
            />
          )}
        </div>
      )}
    </div>
  );
};
