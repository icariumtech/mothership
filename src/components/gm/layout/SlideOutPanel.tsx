import { ReactNode } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import './SlideOutPanel.css';

interface SlideOutPanelProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function SlideOutPanel({ open, title, onClose, children }: SlideOutPanelProps) {
  return (
    <div className={`slide-out-panel ${open ? 'slide-out-panel--open' : ''}`}>
      <div className="slide-out-panel__header">
        <span className="slide-out-panel__title">{title}</span>
        <button className="slide-out-panel__close" onClick={onClose} aria-label="Close panel">
          <CloseOutlined />
        </button>
      </div>
      <div className="slide-out-panel__body">
        {children}
      </div>
    </div>
  );
}
