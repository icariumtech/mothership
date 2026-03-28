import { useState, useEffect, useRef } from 'react';
import './ViewStatusOverlay.css';

interface ViewStatusOverlayProps {
  label: string | null;
}

export function ViewStatusOverlay({ label }: ViewStatusOverlayProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [visible, setVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false); // Stable reference to visible without causing re-renders

  useEffect(() => {
    if (!label) {
      // Cancel typewriter if still running
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Only fade out if currently visible
      if (!visibleRef.current) return;
      setIsExiting(true);
      exitTimerRef.current = setTimeout(() => {
        visibleRef.current = false;
        setVisible(false);
        setIsExiting(false);
        setDisplayedText('');
      }, 400);
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
    <div className={`view-status-overlay${isExiting ? ' exiting' : ''}`}>
      <span className="view-status-text">{displayedText}</span>
    </div>
  );
}
