import { useState, useEffect, useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DashboardPanel } from '@components/ui/DashboardPanel';
import type { SessionLog } from '@/types/session';
import './Section.css';
import './LogsSection.css';

// Read sessions from window.INITIAL_DATA (loaded by Django backend)
function getSessionsData(): SessionLog[] {
  return window.INITIAL_DATA?.sessions || [];
}

// Memoized detail view component to prevent re-renders
const LogsDetailView = memo(({ session }: { session: SessionLog | null }) => {
  if (!session) {
    return (
      <div className="logs-detail-empty">
        &gt; SELECT SESSION TO VIEW LOG
      </div>
    );
  }

  // Custom styled components for markdown rendering
  const markdownComponents = {
    h1: ({ children, ...props }: any) => (
      <h1 className="logs-h1" {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 className="logs-h2" {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 className="logs-h3" {...props}>{children}</h3>
    ),
    p: ({ children, ...props }: any) => (
      <p className="logs-p" {...props}>{children}</p>
    ),
    strong: ({ children, ...props }: any) => (
      <strong className="logs-strong" {...props}>{children}</strong>
    ),
    em: ({ children, ...props }: any) => (
      <em className="logs-em" {...props}>{children}</em>
    ),
    ul: ({ children, ...props }: any) => (
      <ul className="logs-ul" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }: any) => (
      <ol className="logs-ol" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }: any) => (
      <li className="logs-li" {...props}>{children}</li>
    ),
  };

  return (
    <div className="logs-detail-body visible">
      {/* Metadata header */}
      <div className="logs-detail-header">
        <p><span className="info-label">SESSION:</span> <span className="info-value">{session.session_number}</span></p>
        <p><span className="info-label">DATE:</span> <span className="info-value">{session.date}</span></p>
        <p><span className="info-label">TITLE:</span> <span className="info-value">{session.title}</span></p>
        <p><span className="info-label">LOCATION:</span> <span className="info-value">{session.location}</span></p>
        {session.npcs && session.npcs.length > 0 && (
          <p><span className="info-label">NOTABLE NPCS:</span> <span className="info-value">{session.npcs.join(', ')}</span></p>
        )}
      </div>

      {/* Separator line */}
      <div className="logs-detail-content">
        {/* Rendered markdown body */}
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {session.body}
        </ReactMarkdown>
      </div>
    </div>
  );
});

LogsDetailView.displayName = 'LogsDetailView';

export function LogsSection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Load sessions data (already sorted newest-first by backend)
  const sessions = useMemo(() => getSessionsData(), []);

  // Auto-select first session (newest) on mount
  useEffect(() => {
    if (sessions.length > 0 && !selectedId) {
      setSelectedId(sessions[0].filename);
    }
  }, [sessions, selectedId]);

  // Find selected session
  const selectedSession = useMemo(() => {
    if (!selectedId) return null;
    return sessions.find(s => s.filename === selectedId) || null;
  }, [selectedId, sessions]);

  const handleSelect = (filename: string) => {
    setSelectedId(prev => prev === filename ? null : filename);
  };

  return (
    <div className="section-logs">
      <DashboardPanel title="CAMPAIGN LOGS" chamferCorners={['tl', 'br']} padding={0}>
        <div className="logs-split">
          {/* Left side - session list */}
          <div className="logs-list">
            {sessions.length > 0 ? (
              sessions.map(session => (
                <div
                  key={session.filename}
                  className={`logs-row ${selectedId === session.filename ? 'selected' : ''}`}
                  onClick={() => handleSelect(session.filename)}
                >
                  <div className={`logs-row-checkbox ${selectedId === session.filename ? 'checked' : ''}`} />
                  <div className="logs-row-info">
                    <div className="logs-row-title">
                      SESSION {session.session_number}: {session.title}
                    </div>
                    <div className="logs-row-date">{session.date}</div>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
                &gt; No session logs found
              </p>
            )}
          </div>

          {/* Right side - detail view */}
          <div className="logs-detail">
            <LogsDetailView session={selectedSession} />
          </div>
        </div>
      </DashboardPanel>
    </div>
  );
}
