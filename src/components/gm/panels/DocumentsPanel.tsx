import { useState, useEffect } from 'react';
import { Button, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
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

  if (selectedDoc) {
    const isShown = activeDocSlug === selectedDoc.slug;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0 }}>
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => setSelectedDoc(null)}
            style={{ borderColor: '#2a3a3a' }}
          />
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#8b7355', flex: 1 }}>
            {selectedDoc.title.toUpperCase()}
          </Text>
          <Button
            size="small"
            type={isShown ? 'primary' : 'default'}
            style={isShown ? { background: '#8b7355', borderColor: '#8b7355' } : {}}
            onClick={isShown ? handleHide : handleShow}
          >
            {isShown ? 'HIDE' : 'SHOW'}
          </Button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', fontSize: 12, lineHeight: 1.6, color: '#c0c8c8' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {selectedDoc.content}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  if (docs.length === 0 && !loading) {
    return (
      <Text type="secondary" style={{ fontSize: 11 }}>
        No documents found in data/campaign/docs/
      </Text>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {docs.map(doc => {
        const isShown = activeDocSlug === doc.slug;
        return (
          <div
            key={doc.slug}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <button
              onClick={() => handleSelect(doc.slug)}
              style={{
                flex: 1,
                background: 'none',
                border: `1px solid ${isShown ? '#8b7355' : '#2a3a3a'}`,
                borderRadius: 4,
                padding: '6px 10px',
                textAlign: 'left',
                cursor: 'pointer',
                color: isShown ? '#8b7355' : '#c0c8c8',
                fontSize: 12,
                fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => { if (!isShown) e.currentTarget.style.borderColor = '#4a6b6b'; }}
              onMouseLeave={e => { if (!isShown) e.currentTarget.style.borderColor = '#2a3a3a'; }}
            >
              {doc.title}
            </button>
            {isShown && (
              <Button size="small" onClick={handleHide} style={{ flexShrink: 0 }}>
                HIDE
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
