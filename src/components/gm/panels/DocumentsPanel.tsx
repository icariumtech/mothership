import { useState, useEffect } from 'react';
import { Button, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { gmConsoleApi, type CampaignDocSummary, type CampaignDoc } from '@/services/gmConsoleApi';

const { Text } = Typography;

export function DocumentsPanel() {
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

  if (selectedDoc) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0 }}>
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => setSelectedDoc(null)}
            style={{ borderColor: '#2a3a3a' }}
          />
          <Text style={{ fontSize: 12, fontWeight: 600, color: '#8b7355' }}>
            {selectedDoc.title.toUpperCase()}
          </Text>
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
      {docs.map(doc => (
        <button
          key={doc.slug}
          onClick={() => handleSelect(doc.slug)}
          style={{
            background: 'none',
            border: '1px solid #2a3a3a',
            borderRadius: 4,
            padding: '6px 10px',
            textAlign: 'left',
            cursor: 'pointer',
            color: '#c0c8c8',
            fontSize: 12,
            fontFamily: 'inherit',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#4a6b6b')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a3a3a')}
        >
          {doc.title}
        </button>
      ))}
    </div>
  );
}
