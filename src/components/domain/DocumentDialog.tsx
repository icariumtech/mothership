import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Panel } from '@/components/ui/Panel';
import { gmConsoleApi, type CampaignDoc } from '@/services/gmConsoleApi';
import './DocumentDialog.css';

interface DocumentDialogProps {
  open: boolean;
  docSlug: string;
  onClose: () => void;
}

type AnimPhase = 'entering' | 'stable' | 'exiting';

export function DocumentDialog({ open, docSlug, onClose }: DocumentDialogProps) {
  const [doc, setDoc] = useState<CampaignDoc | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [animPhase, setAnimPhase] = useState<AnimPhase>('entering');

  useEffect(() => {
    if (!open || !docSlug) {
      setDoc(null);
      return;
    }
    setIsLoading(true);
    gmConsoleApi.getCampaignDoc(docSlug)
      .then(setDoc)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [open, docSlug]);

  // Transition to entering then stable on open
  useEffect(() => {
    if (open) {
      setAnimPhase('entering');
      // Transition to stable after scan animation completes (500ms)
      const timer = setTimeout(() => setAnimPhase('stable'), 500);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Transition to exiting when closed — only from stable (was actually visible)
  useEffect(() => {
    if (!open && animPhase === 'stable') {
      setAnimPhase('exiting');
      const timer = setTimeout(() => {
        setAnimPhase('entering');
      }, 300); // matches docDismiss duration
      return () => clearTimeout(timer);
    }
  }, [open, animPhase]);

  const handleBackdropClick = useCallback(() => {
    gmConsoleApi.hideDoc().catch(console.error);
    onClose();
  }, [onClose]);

  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // Hidden unless actively animating out
  if (!open && animPhase !== 'exiting') return null;

  return (
    <div className={`doc-dialog-backdrop${animPhase === 'exiting' ? ' exiting' : ''}`} onClick={handleBackdropClick}>
      <div className={`doc-dialog-container${animPhase === 'exiting' ? ' exiting' : ''}`} onClick={handlePanelClick}>
        <Panel
          title={doc?.title?.toUpperCase() || 'DOCUMENT'}
          chamferCorners={['tr', 'bl', 'br']}
          chamferSize={20}
          className="doc-dialog-panel"
          padding={0}
        >
          {isLoading && (
            <div className="doc-dialog-loading">
              <span className="loading-text">LOADING</span>
              <span className="loading-dots"></span>
            </div>
          )}
          {!isLoading && doc && (
            <div className="doc-dialog-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {doc.content}
              </ReactMarkdown>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
