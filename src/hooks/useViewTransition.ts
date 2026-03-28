import { useRef, useCallback, useState } from 'react';

type ViewType = 'STANDBY' | 'BRIDGE' | 'ENCOUNTER' | 'COMM_TERMINAL' | 'MESSAGES' | 'SHIP_DASHBOARD';

// Per-view status labels shown during transition
const VIEW_STATUS_LABELS: Record<ViewType, string> = {
  ENCOUNTER: 'TACTICAL DISPLAY INITIALIZING...',
  BRIDGE: 'BRIDGE SYSTEMS ONLINE',
  STANDBY: 'STANDBY MODE ACTIVE',
  COMM_TERMINAL: 'COMM TERMINAL ONLINE',
  MESSAGES: 'BROADCAST CHANNEL OPEN',
  SHIP_DASHBOARD: 'SHIP SYSTEMS ONLINE',
};

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

      // Phase 2: dark frame (50ms)
      setTransitionPhase('dark');
      commit(data);  // React renders new view during dark frame
      await new Promise(r => setTimeout(r, 50));
      if (cancelledRef.current) return;

      // Phase 3: fade-in (150ms) + show status label
      setTransitionPhase('fading-in');
      setStatusLabel(VIEW_STATUS_LABELS[newViewType] || null);
      await new Promise(r => setTimeout(r, 150));
      if (cancelledRef.current) return;

      // Phase 4: idle — status label persists briefly then fades out via CSS
      setTransitionPhase('idle');
      // Clear label after 2s (matches CSS fade-out duration + typewriter)
      await new Promise(r => setTimeout(r, 2000));
      if (cancelledRef.current) return;
      setStatusLabel(null);
      lockRef.current = false;
    };

    run().catch(() => {
      lockRef.current = false;
      setTransitionPhase('idle');
    });
  }, [randomizeGlitch]);

  return { transitionPhase, statusLabel, handleViewChange, contentRef };
}
