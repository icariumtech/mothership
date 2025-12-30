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
  const useCornerElements = chamferCorners.length > 2;

  return (
    <div className={`panel-wrapper ${chamferClasses} ${isActive ? 'active' : ''} ${className}`}>
      {/* Corner elements for 4-corner panels (pseudo-elements only work for 2 corners) */}
      {useCornerElements && chamferCorners.includes('tl') && <div className="corner-tl" />}
      {useCornerElements && chamferCorners.includes('tr') && <div className="corner-tr" />}
      {useCornerElements && chamferCorners.includes('bl') && <div className="corner-bl" />}
      {useCornerElements && chamferCorners.includes('br') && <div className="corner-br" />}

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
