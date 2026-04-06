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

type AnimPhase = 'flicker' | 'wipe' | 'stable' | 'exiting';

export function DocumentDialog({ open, docSlug, onClose }: DocumentDialogProps) {
  const [doc, setDoc] = useState<CampaignDoc | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [animPhase, setAnimPhase] = useState<AnimPhase>('flicker');

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

  // Enter: flicker (280ms) → wipe (650ms) → stable
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAnimPhase('flicker');
    const t1 = setTimeout(() => { if (!cancelled) setAnimPhase('wipe'); }, 280);
    const t2 = setTimeout(() => { if (!cancelled) setAnimPhase('stable'); }, 930);
    return () => { cancelled = true; clearTimeout(t1); clearTimeout(t2); };
  }, [open]);

  // Exit — only from stable (was fully visible)
  useEffect(() => {
    if (!open && animPhase === 'stable') {
      setAnimPhase('exiting');
      const timer = setTimeout(() => setAnimPhase('flicker'), 300);
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

  // Stay mounted through exit animation; unmount only after reset to initial phase
  if (!open && animPhase === 'flicker') return null;

  return (
    <div className={`doc-dialog-backdrop${animPhase === 'exiting' ? ' exiting' : ''}`} onClick={handleBackdropClick}>
      <div className={`doc-dialog-container phase-${animPhase}`} onClick={handlePanelClick}>
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
