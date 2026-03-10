import { ReactNode } from 'react';
import './SlideOutPanel.css';

interface SlideOutPanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function SlideOutPanel({ open, title, children }: SlideOutPanelProps) {
  if (!open) return null;

  return (
    <div className="slide-out-panel">
      <div className="slide-out-panel__header">
        <span className="slide-out-panel__title">{title}</span>
      </div>
      <div className="slide-out-panel__body">
        {children}
      </div>
    </div>
  );
}
