import './TerminalHeader.css';

interface TerminalHeaderProps {
  title: string;
  subtitle?: string;
  rightText?: string;
  hidden?: boolean;
  onCharonClick?: () => void;
}

export function TerminalHeader({
  title,
  subtitle,
  rightText,
  hidden = false,
  onCharonClick
}: TerminalHeaderProps) {
  if (hidden) return null;

  return (
    <header className="terminal-header">
      <div className="terminal-header-left">
        <h1>{title}</h1>
        {subtitle && <span className="subtitle">{subtitle}</span>}
      </div>
      <div className="terminal-header-right">
        {onCharonClick && (
          <button
            className="charon-link"
            onClick={onCharonClick}
            type="button"
          >
            CHARON
          </button>
        )}
        {rightText && <span>{rightText}</span>}
      </div>
    </header>
  );
}
