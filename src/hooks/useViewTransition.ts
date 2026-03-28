import { useRef, useCallback, useState } from 'react';

type ViewType = 'STANDBY' | 'BRIDGE' | 'ENCOUNTER' | 'COMM_TERMINAL' | 'MESSAGES' | 'SHIP_DASHBOARD';

// Per-view status labels shown during transition
const VIEW_STATUS_LABELS: Record<ViewType, string> = {
  ENCOUNTER: 'TACTICAL DISPLAY INITIALIZING...',
  BRIDGE: 'INITIALIZING BRIDGE DISPLAY...',
  STANDBY: 'STANDBY MODE ACTIVE',
  COMM_TERMINAL: 'COMM TERMINAL ONLINE',
  MESSAGES: 'BROADCAST CHANNEL OPEN',
  SHIP_DASHBOARD: 'SHIP SYSTEMS ONLINE',
};

const TYPEWRITER_RATE_MS = 55; // ms per character — must match ViewStatusOverlay

type ViewTransitionPhase = 'idle' | 'glitching-out' | 'dark' | 'fading-in';

interface UseViewTransitionResult {
  transitionPhase: ViewTransitionPhase;
  statusLabel: string | null;
  handleViewChange: <T extends { view_type?: ViewType }>(
    data: T,
    commit: (data: T) => void,
    previousViewType: ViewType | undefined
  ) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

export function useViewTransition(): UseViewTransitionResult {
  const [transitionPhase, setTransitionPhase] = useState<ViewTransitionPhase>('idle');
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const lockRef = useRef(false);
  const cancelledRef = useRef(false); // Tracks whether the current run() should abort
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Randomize glitch CSS custom properties on the content wrapper (same as StandbyView pattern)
  const randomizeGlitch = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const rand = (min: number, max: number) => (Math.random() * (max - min) + min).toFixed(0);
    el.style.setProperty('--glitch-x1', `${rand(-40, 40)}px`);
    el.style.setProperty('--glitch-y1', `${rand(-8, 8)}px`);
    el.style.setProperty('--glitch-x2', `${rand(-35, 35)}px`);
    el.style.setProperty('--glitch-y2', `${rand(-6, 6)}px`);
    el.style.setProperty('--glitch-x3', `${rand(-25, 25)}px`);
    el.style.setProperty('--glitch-y3', `${rand(-5, 5)}px`);
  }, []);

  const handleViewChange = useCallback(<T extends { view_type?: ViewType }>(
    data: T,
    commit: (data: T) => void,
    previousViewType: ViewType | undefined
  ) => {
    const newViewType = data.view_type;

    // Only animate on major view changes (not same view or missing type)
    if (!newViewType || newViewType === previousViewType) {
      commit(data);
      return;
    }

    // Drop concurrent transitions — last SSE event wins
    if (lockRef.current) {
      // Cancel in-progress: mark cancelled so the abandoned run() stops after its current await.
      // Then reset immediately and commit new data.
      cancelledRef.current = true;
      setTransitionPhase('idle');
      setStatusLabel(null);
      lockRef.current = false;
      commit(data);
      return;
    }

    lockRef.current = true;
    cancelledRef.current = false; // Fresh run — clear any prior cancellation

    const run = async () => {
      // Phase 1: glitch-out (300ms)
      randomizeGlitch();
      setTransitionPhase('glitching-out');
      await new Promise(r => setTimeout(r, 300));
      if (cancelledRef.current) return; // Abandoned — do not commit stale data

      // Phase 2: dark frame — commit new view AND start typewriter label.
      // View stays hidden (opacity: 0) until typing finishes so the label
      // completes before the new content is revealed.
      setTransitionPhase('dark');
      commit(data);  // React renders new view during dark frame
      const label = VIEW_STATUS_LABELS[newViewType] || null;
      setStatusLabel(label);
      // Wait for typewriter to finish: label.length * 55ms + small buffer
      const typingDuration = label ? label.length * TYPEWRITER_RATE_MS + 100 : 50;
      await new Promise(r => setTimeout(r, typingDuration));
      if (cancelledRef.current) return;

      // Phase 3: fade-in (150ms) — label has finished typing, now reveal view
      setTransitionPhase('fading-in');
      await new Promise(r => setTimeout(r, 150));
      if (cancelledRef.current) return;

      // Phase 4: idle — label briefly visible while view is shown, then fades out
      setTransitionPhase('idle');
      await new Promise(r => setTimeout(r, 500));
      if (cancelledRef.current) return;
      setStatusLabel(null);  // ViewStatusOverlay fades out via isExiting animation
      lockRef.current = false;
    };

    run().catch(() => {
      lockRef.current = false;
      setTransitionPhase('idle');
    });
  }, [randomizeGlitch]);

  return { transitionPhase, statusLabel, handleViewChange, contentRef };
}
