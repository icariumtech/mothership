import { useState, useEffect, useRef, useCallback } from 'react';
import { terminalApi, TerminalData, TerminalMessage, TerminalLogEntry } from '@/services/terminalApi';
import { Panel } from '@/components/ui/Panel';
import './CommTerminalDialog.css';

interface CommTerminalDialogProps {
  open: boolean;
  locationSlug: string;
  terminalSlug: string;
  onClose: () => void;
}

type ViewMode = 'inbox' | 'sent' | 'logs';
type AnimPhase = 'entering' | 'stable' | 'exiting';

export function CommTerminalDialog({ open, locationSlug, terminalSlug, onClose }: CommTerminalDialogProps) {
  const [terminalData, setTerminalData] = useState<TerminalData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('logs');
  const [selectedMessage, setSelectedMessage] = useState<TerminalMessage | null>(null);
  const [selectedLog, setSelectedLog] = useState<TerminalLogEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animPhase, setAnimPhase] = useState<AnimPhase>('entering');
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

  // Transition to entering then stable on open — stagger based on visible item count
  useEffect(() => {
    if (open) {
      setAnimPhase('entering');
      // Compute stagger duration based on visible items (default 5 if data not loaded yet)
      const itemCount = terminalData
        ? (viewMode === 'logs' ? terminalData.logs.length : viewMode === 'inbox' ? terminalData.inbox.length : terminalData.sent.length)
        : 5;
      // Duration: 60ms per line + 150ms buffer. Cap at 2000ms for very long logs.
      const staggerDuration = Math.min(itemCount * 60 + 150, 2000);
      const timer = setTimeout(() => setAnimPhase('stable'), staggerDuration);
      return () => clearTimeout(timer);
    }
  }, [open, terminalData, viewMode]);

  // Transition to exiting when closed
  useEffect(() => {
    if (!open && animPhase !== 'exiting') {
      setAnimPhase('exiting');
      const timer = setTimeout(() => {
        // Reset to entering for next open
        setAnimPhase('entering');
      }, 300); // matches commDismiss duration
      return () => clearTimeout(timer);
    }
  }, [open, animPhase]);

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

  const handleLogSelect = useCallback((log: TerminalLogEntry) => {
    setSelectedLog(log);
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

  // Keep mounted during exit animation; truly hidden only when not open and not animating
  if (!open && animPhase === 'entering') return null;

  const messages = viewMode === 'logs' ? null : (viewMode === 'inbox' ? terminalData?.inbox : terminalData?.sent);
  const title = terminalData?.owner
    ? `${terminalData.owner.toUpperCase()}'S TERMINAL`
    : 'COMM TERMINAL';

  return (
    <div className={`comm-terminal-backdrop${animPhase === 'exiting' ? ' exiting' : ''}`} onClick={handleBackdropClick}>
      <div className={`comm-terminal-container${animPhase === 'exiting' ? ' exiting' : ''}`} onClick={handlePanelClick}>
        <Panel
          title={title}
          chamferCorners={['tr', 'bl', 'br']}
          chamferSize={20}
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
                    className={`sidebar-tab ${viewMode === 'logs' ? 'active' : ''}`}
                    onClick={() => setViewMode('logs')}
                  >
                    LOGS ({terminalData.logs.length})
                  </button>
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
                  {viewMode === 'logs' ? (
                    terminalData.logs.length > 0 ? (
                      terminalData.logs.map((log, index) => (
                        <div
                          key={log.log_id}
                          className={`message-item comm-log-line${selectedLog?.log_id === log.log_id ? ' selected' : ''}${animPhase === 'entering' ? ' comm-entering' : ''}`}
                          style={animPhase === 'entering' ? { animationDelay: `${index * 60}ms` } : undefined}
                          onClick={() => handleLogSelect(log)}
                        >
                          <div className="message-subject">{log.title || log.log_id}</div>
                          {log.author && <div className="message-from">{log.author}</div>}
                          <div className="message-timestamp">{formatTimestamp(log.timestamp)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="no-messages">NO LOGS</div>
                    )
                  ) : (
                    messages && messages.length > 0 ? (
                      messages.map((msg, index) => (
                        <div
                          key={msg.message_id}
                          className={`message-item comm-log-line${selectedMessage?.message_id === msg.message_id ? ' selected' : ''} ${!msg.read ? 'unread' : ''} ${getPriorityClass(msg.priority)}${animPhase === 'entering' ? ' comm-entering' : ''}`}
                          style={animPhase === 'entering' ? { animationDelay: `${index * 60}ms` } : undefined}
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
                    )
                  )}
                </div>
              </div>

              {/* Main Area - Selected Message or Log */}
              <div className="comm-terminal-main">
                {viewMode === 'logs' ? (
                  selectedLog ? (
                    <>
                      <div className="message-header">
                        <div className="header-row">
                          <span className="header-label">TITLE:</span>
                          <span className="header-value">{selectedLog.title}</span>
                        </div>
                        {selectedLog.author && (
                          <div className="header-row">
                            <span className="header-label">AUTHOR:</span>
                            <span className="header-value">{selectedLog.author}</span>
                          </div>
                        )}
                        <div className="header-row">
                          <span className="header-label">DATE:</span>
                          <span className="header-value">{formatTimestamp(selectedLog.timestamp)}</span>
                        </div>
                      </div>
                      <div className="message-divider" />
                      <div className="message-body">
                        <pre className="message-content">{selectedLog.content}</pre>
                      </div>
                    </>
                  ) : (
                    <div className="no-message-selected">
                      <span>SELECT A LOG ENTRY TO VIEW</span>
                    </div>
                  )
                ) : (
                  selectedMessage ? (
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
                  )
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
