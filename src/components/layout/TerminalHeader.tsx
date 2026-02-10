import { useState, useEffect, useRef } from 'react';
import './TerminalHeader.css';

interface TerminalHeaderProps {
  title: string;
  subtitle?: string;
  rightText?: string;
  hidden?: boolean;
  typewriterTitle?: boolean;
}

export function TerminalHeader({
  title,
  subtitle,
  rightText,
  hidden = false,
  typewriterTitle = false
}: TerminalHeaderProps) {
  const [displayedTitle, setDisplayedTitle] = useState(typewriterTitle ? '' : title);
  const [isTyping, setIsTyping] = useState(false);
  const targetTitleRef = useRef(title);

  useEffect(() => {
    if (!typewriterTitle) {
      setDisplayedTitle(title);
      return;
    }

    // If title changed, start typewriter effect
    if (title !== targetTitleRef.current) {
      targetTitleRef.current = title;
      setDisplayedTitle('');
      setIsTyping(true);
    }
  }, [title, typewriterTitle]);

  useEffect(() => {
    if (!typewriterTitle || !isTyping) return;

    const target = targetTitleRef.current;
    if (displayedTitle.length >= target.length) {
      setIsTyping(false);
      return;
    }

    const timeout = setTimeout(() => {
      setDisplayedTitle(target.slice(0, displayedTitle.length + 1));
    }, 50); // 50ms per character

    return () => clearTimeout(timeout);
  }, [displayedTitle, isTyping, typewriterTitle]);

  if (hidden) return null;

  return (
    <header className="terminal-header">
      <div className="terminal-header-left">
        <h1>
          {displayedTitle}
          {typewriterTitle && isTyping && <span className="typing-cursor">_</span>}
        </h1>
        {subtitle && <span className="subtitle">{subtitle}</span>}
      </div>
      <div className="terminal-header-right">
        {rightText && <span>{rightText}</span>}
      </div>
    </header>
  );
}
