import { useState, useEffect, useRef } from 'react';
import './ViewStatusOverlay.css';

interface CorporationData {
  name: string;
  motto: string;
  logo_url: string;
  version: string;
  firmware: string;
}

interface ViewStatusOverlayProps {
  label: string | null;
  onComplete?: () => void;
  corporation?: CorporationData | null;
}

export function ViewStatusOverlay({ label, onComplete, corporation }: ViewStatusOverlayProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!label) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (!visibleRef.current) return;

      // Randomize glitch offsets before exit animation
      const el = overlayRef.current;
      if (el) {
        const rand = (min: number, max: number) =>
          `${(Math.random() * (max - min) + min).toFixed(0)}px`;
        el.style.setProperty('--overlay-glitch-x1', rand(-30, 30));
        el.style.setProperty('--overlay-glitch-x2', rand(-25, 25));
        el.style.setProperty('--overlay-glitch-x3', rand(-20, 20));
      }

      setIsExiting(true);
      exitTimerRef.current = setTimeout(() => {
        visibleRef.current = false;
        setVisible(false);
        setIsExiting(false);
        setDisplayedText('');
      }, 300); // matches overlayGlitchOut duration
      return () => {
        if (exitTimerRef.current) { clearTimeout(exitTimerRef.current); exitTimerRef.current = null; }
      };
    }

    // New label — cancel any in-flight exit
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsExiting(false);
    visibleRef.current = true;
    setVisible(true);
    setDisplayedText('');
    let i = 0;

    timerRef.current = setInterval(() => {
      i++;
      setDisplayedText(label.slice(0, i));
      if (i >= label.length) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
        onComplete?.();
      }
    }, 55); // 55ms/char — established rate

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [label]);

  if (!visible) return null;

  return (
    <div ref={overlayRef} className={`view-status-overlay${isExiting ? ' exiting' : ''}`}>
      {corporation && (
        <>
          <div className="view-status-corp-name">{corporation.name}</div>
          <img
            className="view-status-logo-img"
            src={corporation.logo_url}
            alt={corporation.name}
          />
          <div className="view-status-motto">{corporation.motto}</div>
          <div className="view-status-meta">
            <span>VERSION: {corporation.version}</span>
            <span>FIRMWARE {corporation.firmware}</span>
          </div>
        </>
      )}
      <span className="view-status-text">{displayedText}</span>
    </div>
  );
}
