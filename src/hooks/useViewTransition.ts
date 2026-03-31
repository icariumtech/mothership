import { useRef, useCallback, useState, MutableRefObject } from 'react';

type ViewType = 'STANDBY' | 'BRIDGE' | 'ENCOUNTER' | 'COMM_TERMINAL' | 'MESSAGES' | 'SHIP_DASHBOARD';

// Per-view status labels shown during transition
const VIEW_STATUS_LABELS: Record<ViewType, string> = {
  ENCOUNTER: 'TACTICAL DISPLAY INITIALIZING...',
  BRIDGE: 'COMMAND SYSTEMS INITIALIZING...',
  STANDBY: 'STANDBY MODE ACTIVE',
  COMM_TERMINAL: 'COMM TERMINAL ONLINE',
  MESSAGES: 'BROADCAST CHANNEL OPEN',
  SHIP_DASHBOARD: 'SHIP SYSTEMS ONLINE',
};

const TYPEWRITER_RATE_MS = 55; // ms per character — must match ViewStatusOverlay

type ViewTransitionPhase = 'idle' | 'glitching-out' | 'dark' | 'glitching-in';

interface UseViewTransitionResult {
  transitionPhase: ViewTransitionPhase;
  statusLabel: string | null;
  handleViewChange: <T extends { view_type?: ViewType }>(
    data: T,
    commit: (data: T) => void,
    previousViewType: ViewType | undefined
  ) => void;
  contentRef: React.RefObject<HTMLDivElement | null>;
  onOverlayComplete: () => void;
}

export function useViewTransition(): UseViewTransitionResult {
  const [transitionPhase, setTransitionPhase] = useState<ViewTransitionPhase>('idle');
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const lockRef = useRef(false);
  const cancelledRef = useRef(false); // Tracks whether the current run() should abort
  const contentRef = useRef<HTMLDivElement | null>(null);
  const typewriterResolveRef: MutableRefObject<(() => void) | null> = useRef(null);

  const onOverlayComplete = useCallback(() => {
    if (typewriterResolveRef.current) {
      typewriterResolveRef.current();
      typewriterResolveRef.current = null;
    }
  }, []);

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

    // Skip animation entirely for same-view or unknown view type
    if (!newViewType || newViewType === previousViewType) {
      commit(data);
      return;
    }

    // Drop concurrent transitions — last SSE event wins
    if (lockRef.current) {
      cancelledRef.current = true;
      typewriterResolveRef.current = null;
      setTransitionPhase('idle');
      setStatusLabel(null);
      lockRef.current = false;
      commit(data);
      return;
    }

    lockRef.current = true;
    cancelledRef.current = false;

    const run = async () => {
      // Phase 1: glitch-out (300ms)
      randomizeGlitch();
      setTransitionPhase('glitching-out');
      await new Promise(r => setTimeout(r, 300));
      if (cancelledRef.current) return;

      // Standby: glitch-only path — no overlay, no typewriter
      if (newViewType === 'STANDBY') {
        setTransitionPhase('dark');
        commit(data);
        await new Promise(r => setTimeout(r, 80));
        if (cancelledRef.current) return;
        randomizeGlitch();
        setTransitionPhase('glitching-in');
        await new Promise(r => setTimeout(r, 300));
        if (cancelledRef.current) return;
        setTransitionPhase('idle');
        lockRef.current = false;
        return;
      }

      // Phase 2: dark frame — commit new view AND start typewriter label.
      setTransitionPhase('dark');
      commit(data);
      const label = VIEW_STATUS_LABELS[newViewType] || null;
      setStatusLabel(label);
      if (label) {
        await new Promise<void>(resolve => {
          typewriterResolveRef.current = resolve;
          setTimeout(resolve, label.length * TYPEWRITER_RATE_MS + 500);
        });
      } else {
        await new Promise(r => setTimeout(r, 50));
      }
      if (cancelledRef.current) return;

      // Phase 3: hold 2s with text still visible, then dismiss label
      await new Promise(r => setTimeout(r, 2000));
      if (cancelledRef.current) return;
      setStatusLabel(null);

      // Wait for overlay glitch-out to complete before revealing view
      await new Promise(r => setTimeout(r, 300));
      if (cancelledRef.current) return;

      // Phase 4: glitch-in the new view (300ms)
      randomizeGlitch();
      setTransitionPhase('glitching-in');
      await new Promise(r => setTimeout(r, 300));
      if (cancelledRef.current) return;

      setTransitionPhase('idle');
      lockRef.current = false;
    };

    run().catch(() => {
      lockRef.current = false;
      setTransitionPhase('idle');
    });
  }, [randomizeGlitch]);

  return { transitionPhase, statusLabel, handleViewChange, contentRef, onOverlayComplete };
}
