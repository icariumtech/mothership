import { useState, useEffect, useRef } from 'react';
import { Panel } from '@components/ui/Panel';
import './NPCPortraitOverlay.css';

type AnimPhase = 'flicker' | 'wipe' | 'stable' | 'typing' | 'done' | 'dismissing';

interface NPCPortraitCardProps {
  npcId: string;
  name: string;
  portrait: string;  // URL path or empty string
  isDismissing: boolean;  // parent signals card is leaving
  onDismissed: (npcId: string) => void;  // called when fade-out completes
}

export function NPCPortraitCard({ npcId, name, portrait, isDismissing, onDismissed }: NPCPortraitCardProps) {
  const [animPhase, setAnimPhase] = useState<AnimPhase>('flicker');
  const [displayedName, setDisplayedName] = useState('');
  const nameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mount animation sequence: flicker → wipe → stable → typing → done
  useEffect(() => {
    let cancelled = false;

    const runSequence = async () => {
      // Phase 1: Flicker (280ms matches CSS animation)
      setAnimPhase('flicker');
      await new Promise(r => setTimeout(r, 280));
      if (cancelled) return;

      // Phase 2: Wipe (650ms matches CSS animation)
      setAnimPhase('wipe');
      await new Promise(r => setTimeout(r, 650));
      if (cancelled) return;

      // Phase 3: Stable — image fully visible
      setAnimPhase('stable');
      await new Promise(r => setTimeout(r, 200));
      if (cancelled) return;

      // Phase 4: Typing — name reveals character by character
      setAnimPhase('typing');
    };

    runSequence();
    return () => { cancelled = true; };
  }, []); // run once on mount

  // Typewriter for name
  useEffect(() => {
    if (animPhase !== 'typing') return;

    let i = 0;
    setDisplayedName('');

    nameTimerRef.current = setInterval(() => {
      i++;
      setDisplayedName(name.slice(0, i));
      if (i >= name.length) {
        clearInterval(nameTimerRef.current!);
        nameTimerRef.current = null;
        setAnimPhase('done');
      }
    }, 55); // ~55ms per character — deliberate pace

    return () => {
      if (nameTimerRef.current) {
        clearInterval(nameTimerRef.current);
        nameTimerRef.current = null;
      }
    };
  }, [animPhase, name]);

  // Dismiss animation: play fade-out then notify parent
  useEffect(() => {
    if (!isDismissing) return;

    setAnimPhase('dismissing');
    const timer = setTimeout(() => {
      onDismissed(npcId);
    }, 300); // matches portrait-dismiss animation duration

    return () => clearTimeout(timer);
  }, [isDismissing, npcId, onDismissed]);

  const imageWrapperClass = `portrait-image-wrapper phase-${animPhase}`;

  return (
    <div className="portrait-card">
      <div style={{ border: '1px solid #4a6b6b' }}>
        <Panel
          chamferCorners={['tl', 'tr', 'bl', 'br']}
          chamferSize={12}
          padding={6}
        >
          <div className={imageWrapperClass}>
            {portrait ? (
              <img
                src={portrait}
                alt={name}
                className="portrait-image"
                draggable={false}
              />
            ) : (
              <div className="portrait-placeholder">?</div>
            )}
          </div>
        </Panel>
      </div>
      <div className="portrait-name">{displayedName}</div>
    </div>
  );
}
