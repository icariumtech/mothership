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

export function DocumentDialog({ open, docSlug, onClose }: DocumentDialogProps) {
  const [doc, setDoc] = useState<CampaignDoc | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleBackdropClick = useCallback(() => {
    gmConsoleApi.hideDoc().catch(console.error);
    onClose();
  }, [onClose]);

  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  if (!open) return null;

  return (
    <div className="doc-dialog-backdrop" onClick={handleBackdropClick}>
      <div className="doc-dialog-container" onClick={handlePanelClick}>
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
