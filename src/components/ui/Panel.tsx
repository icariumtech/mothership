import { ReactNode } from 'react';
import './Panel.css';

interface PanelProps {
  title?: string;
  children: ReactNode;
  isActive?: boolean;
  className?: string;
  chamferCorners?: ('tl' | 'tr' | 'bl' | 'br')[];
}

export function Panel({
  title,
  children,
  isActive = false,
  className = '',
  chamferCorners = ['tl', 'br']
}: PanelProps) {
  const chamferClasses = chamferCorners.map(c => `chamfer-${c}`).join(' ');

  return (
    <div className={`panel-wrapper ${chamferClasses} ${isActive ? 'active' : ''} ${className}`}>
      {title && (
        <div className="panel-header">
          <h3>{title}</h3>
        </div>
      )}
      <div className="panel-content">
        {children}
      </div>
    </div>
  );
}
