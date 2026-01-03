import { useState, useEffect, useRef, useCallback } from 'react';
import { terminalApi, TerminalData, TerminalMessage } from '@/services/terminalApi';
import { Panel } from '@/components/ui/Panel';
import './CommTerminalDialog.css';

interface CommTerminalDialogProps {
  open: boolean;
  locationSlug: string;
  terminalSlug: string;
  onClose: () => void;
}

type ViewMode = 'inbox' | 'sent';

export function CommTerminalDialog({ open, locationSlug, terminalSlug, onClose }: CommTerminalDialogProps) {
  const [terminalData, setTerminalData] = useState<TerminalData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('inbox');
  const [selectedMessage, setSelectedMessage] = useState<TerminalMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch terminal data when dialog opens
  useEffect(() => {
    if (!open || !locationSlug || !terminalSlug) {
      setTerminalData(null);
      setSelectedMessage(null);
      setIsLoading(false);
      return;
    }

    const fetchTerminalData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await terminalApi.getTerminalData(locationSlug, terminalSlug);
        setTerminalData(data);
        // Auto-select first unread message, or first message
        const messages = data.inbox;
        const firstUnread = messages.find(m => !m.read);
        if (firstUnread) {
          setSelectedMessage(firstUnread);
        } else if (messages.length > 0) {
          setSelectedMessage(messages[0]);
        }
      } catch (err) {
        console.error('Error fetching terminal data:', err);
        setError('Failed to load terminal data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTerminalData();
  }, [open, locationSlug, terminalSlug]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedMessage, open]);

  const handleBackdropClick = useCallback(() => {
    onClose();
  }, [onClose]);

  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleMessageSelect = useCallback((msg: TerminalMessage) => {
    setSelectedMessage(msg);
  }, []);

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } catch {
      return timestamp;
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'priority-critical';
      case 'HIGH': return 'priority-high';
      case 'LOW': return 'priority-low';
      default: return 'priority-normal';
    }
  };

  if (!open) return null;

  const messages = viewMode === 'inbox' ? terminalData?.inbox : terminalData?.sent;
  const title = terminalData?.owner
    ? `${terminalData.owner.toUpperCase()}'S TERMINAL`
    : 'COMM TERMINAL';

  return (
    <div className="comm-terminal-backdrop" onClick={handleBackdropClick}>
      <div className="comm-terminal-container" onClick={handlePanelClick}>
        <Panel
          title={title}
          chamferCorners={['tr', 'bl', 'br']}
          className="comm-terminal-panel"
        >
          {isLoading && (
            <div className="comm-terminal-loading">
              <span className="loading-text">LOADING TERMINAL DATA</span>
              <span className="loading-dots"></span>
            </div>
          )}

          {error && (
            <div className="comm-terminal-error">
              <span className="error-text">{error}</span>
            </div>
          )}

          {!isLoading && !error && terminalData && (
            <div className="comm-terminal-content">
              {/* Sidebar - Message List */}
              <div className="comm-terminal-sidebar">
                <div className="sidebar-tabs">
                  <button
                    className={`sidebar-tab ${viewMode === 'inbox' ? 'active' : ''}`}
                    onClick={() => setViewMode('inbox')}
                  >
                    INBOX ({terminalData.inbox.length})
                  </button>
                  <button
                    className={`sidebar-tab ${viewMode === 'sent' ? 'active' : ''}`}
                    onClick={() => setViewMode('sent')}
                  >
                    SENT ({terminalData.sent.length})
                  </button>
                </div>
                <div className="message-list">
                  {messages && messages.length > 0 ? (
                    messages.map((msg) => (
                      <div
                        key={msg.message_id}
                        className={`message-item ${selectedMessage?.message_id === msg.message_id ? 'selected' : ''} ${!msg.read ? 'unread' : ''} ${getPriorityClass(msg.priority)}`}
                        onClick={() => handleMessageSelect(msg)}
                      >
                        <div className="message-item-header">
                          <span className="message-from">
                            {viewMode === 'inbox' ? msg.from : `TO: ${msg.to}`}
                          </span>
                          {msg.priority !== 'NORMAL' && (
                            <span className={`priority-indicator ${getPriorityClass(msg.priority)}`}>
                              {msg.priority}
                            </span>
                          )}
                        </div>
                        <div className="message-subject">{msg.subject}</div>
                        <div className="message-timestamp">{formatTimestamp(msg.timestamp)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="no-messages">NO MESSAGES</div>
                  )}
                </div>
              </div>

              {/* Main Area - Selected Message */}
              <div className="comm-terminal-main">
                {selectedMessage ? (
                  <>
                    <div className="message-header">
                      <div className="header-row">
                        <span className="header-label">FROM:</span>
                        <span className="header-value">{selectedMessage.from}</span>
                      </div>
                      <div className="header-row">
                        <span className="header-label">TO:</span>
                        <span className="header-value">{selectedMessage.to}</span>
                      </div>
                      <div className="header-row">
                        <span className="header-label">SUBJECT:</span>
                        <span className="header-value">{selectedMessage.subject}</span>
                      </div>
                      <div className="header-row">
                        <span className="header-label">DATE:</span>
                        <span className="header-value">{formatTimestamp(selectedMessage.timestamp)}</span>
                      </div>
                      {selectedMessage.priority !== 'NORMAL' && (
                        <div className="header-row">
                          <span className="header-label">PRIORITY:</span>
                          <span className={`header-value ${getPriorityClass(selectedMessage.priority)}`}>
                            {selectedMessage.priority}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="message-divider" />
                    <div className="message-body">
                      <pre className="message-content">{selectedMessage.content}</pre>
                    </div>
                  </>
                ) : (
                  <div className="no-message-selected">
                    <span>SELECT A MESSAGE TO VIEW</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
