import { useState, useEffect } from 'react';
import { Button, Modal, Typography } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { gmConsoleApi, type CampaignDocSummary, type CampaignDoc } from '@/services/gmConsoleApi';

const { Text } = Typography;

interface DocumentsPanelProps {
  activeDocSlug: string;
}

export function DocumentsPanel({ activeDocSlug }: DocumentsPanelProps) {
  const [docs, setDocs] = useState<CampaignDocSummary[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<CampaignDoc | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    gmConsoleApi.getCampaignDocs().then(setDocs).catch(console.error);
  }, []);

  const handleSelect = async (slug: string) => {
    setLoading(true);
    try {
      const doc = await gmConsoleApi.getCampaignDoc(slug);
      setSelectedDoc(doc);
    } catch (err) {
      console.error('Failed to load doc:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShow = async () => {
    if (!selectedDoc) return;
    try {
      await gmConsoleApi.showDoc(selectedDoc.slug);
    } catch (err) {
      console.error('Failed to show doc:', err);
    }
  };

  const handleHide = async () => {
    try {
      await gmConsoleApi.hideDoc();
    } catch (err) {
      console.error('Failed to hide doc:', err);
    }
  };

  if (docs.length === 0 && !loading) {
    return (
      <Text type="secondary" style={{ fontSize: 11 }}>
        No documents found in data/campaign/docs/
      </Text>
    );
  }

  const isShown = selectedDoc ? activeDocSlug === selectedDoc.slug : false;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {docs.map(doc => {
          const active = activeDocSlug === doc.slug;
          return (
            <div
              key={doc.slug}
              onClick={() => handleSelect(doc.slug)}
              style={{
                padding: '8px 10px',
                background: '#0f1515',
                border: `1px solid ${active ? '#8b7355' : '#252525'}`,
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = '#4a6b6b'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = '#252525'; }}
            >
              <div style={{ color: active ? '#8b7355' : '#d0d0d0', fontSize: 12, fontWeight: 500 }}>
                {doc.title}
              </div>
              {active && (
                <div style={{ color: '#8b7355', fontSize: 10, marginTop: 2 }}>SHOWING TO PLAYERS</div>
              )}
            </div>
          );
        })}
      </div>

      <Modal
        title={selectedDoc?.title}
        open={!!selectedDoc}
        onCancel={() => setSelectedDoc(null)}
        width={640}
        footer={
          <Button
            type={isShown ? 'primary' : 'default'}
            style={isShown ? { background: '#8b7355', borderColor: '#8b7355' } : {}}
            onClick={isShown ? handleHide : handleShow}
          >
            {isShown ? 'HIDE FROM PLAYERS' : 'SHOW TO PLAYERS'}
          </Button>
        }
      >
        {loading ? (
          <Text type="secondary">Loading...</Text>
        ) : selectedDoc ? (
          <div style={{ fontSize: 13, lineHeight: 1.7, color: '#c0c8c8', maxHeight: '60vh', overflowY: 'auto' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {selectedDoc.content}
            </ReactMarkdown>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
