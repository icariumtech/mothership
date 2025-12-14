import './TerminalHeader.css';

interface TerminalHeaderProps {
  title: string;
  subtitle?: string;
  rightText?: string;
  hidden?: boolean;
}

export function TerminalHeader({
  title,
  subtitle,
  rightText,
  hidden = false
}: TerminalHeaderProps) {
  if (hidden) return null;

  return (
    <header className="terminal-header">
      <div className="terminal-header-left">
        <h1>{title}</h1>
        {subtitle && <span className="subtitle">{subtitle}</span>}
      </div>
      {rightText && (
        <div className="terminal-header-right">{rightText}</div>
      )}
    </header>
  );
}
