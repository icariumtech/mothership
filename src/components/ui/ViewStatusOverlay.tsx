import { useState, useEffect, useRef } from 'react';
import './ViewStatusOverlay.css';

interface ViewStatusOverlayProps {
  label: string | null;
}

export function ViewStatusOverlay({ label }: ViewStatusOverlayProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!label) {
      setVisible(false);
      setDisplayedText('');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

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
    <div className="view-status-overlay">
      <span className="view-status-text">{displayedText}</span>
    </div>
  );
}
