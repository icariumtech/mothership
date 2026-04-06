import { useState, useEffect, useRef, useCallback } from 'react';
import { janusApi } from '@/services/janusApi';
import { Panel } from '@/components/ui/Panel';
import type { JanusMessage, JanusMode } from '@/types/janus';
import './JanusDialog.css';

interface JanusDialogProps {
  open: boolean;
  onClose: () => void;
  channel?: string;
  disableClose?: boolean;
}

type AnimPhase = 'flicker' | 'wipe' | 'stable' | 'exiting';

export function JanusDialog({ open, onClose, channel = 'default', disableClose = false }: JanusDialogProps) {
  const [messages, setMessages] = useState<JanusMessage[]>([]);
  const [mode, setMode] = useState<JanusMode>('DISPLAY');
  const [queryInput, setQueryInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [typedMessages, setTypedMessages] = useState<Map<string, string>>(new Map());
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [animPhase, setAnimPhase] = useState<AnimPhase>('flicker');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const processedMessagesRef = useRef<Set<string>>(new Set());

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

  // Typewriter effect for JANUS messages
  useEffect(() => {
    if (!open) return;

    const janusMessages = messages.filter(m => m.role === 'janus');

    for (const msg of janusMessages) {
      if (!processedMessagesRef.current.has(msg.message_id)) {
        processedMessagesRef.current.add(msg.message_id);
        setTypingMessageId(msg.message_id);
        setIsProcessing(false);
        setSubmittedQuery('');

        const content = msg.content;
        let index = 0;

        const typeInterval = setInterval(() => {
          if (index < content.length) {
            setTypedMessages(prev => new Map(prev).set(msg.message_id, content.substring(0, index + 1)));
            index++;
          } else {
            setTypingMessageId(null);
            clearInterval(typeInterval);
          }
        }, 25);

        break;
      }
    }
  }, [messages, open]);

  // Poll for conversation updates when dialog is open
  useEffect(() => {
    if (!open) return;

    const fetchConversation = async () => {
      try {
        const data = await janusApi.getChannelConversation(channel);
        setMode(data.mode);
        setMessages(data.messages);
      } catch (err) {
        console.error('Error fetching conversation:', err);
      }
    };

    fetchConversation();
    const interval = setInterval(fetchConversation, 2000);
    return () => clearInterval(interval);
  }, [open, channel]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typedMessages, queryInput, isProcessing, open]);

  // Focus input in query mode
  useEffect(() => {
    if (open && mode === 'QUERY' && inputRef.current && typingMessageId === null && !isProcessing) {
      inputRef.current.focus();
    }
  }, [mode, typingMessageId, isProcessing, open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!queryInput.trim() || isProcessing) return;

      const query = queryInput.trim();
      setSubmittedQuery(query);
      setQueryInput('');
      setIsProcessing(true);

      try {
        await janusApi.submitChannelQuery(channel, query);
      } catch (err) {
        console.error('Error submitting query:', err);
        setIsProcessing(false);
        setSubmittedQuery('');
      }
    },
    [queryInput, isProcessing, channel]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    },
    [handleSubmit]
  );

  const handleBackdropClick = useCallback(() => {
    if (!disableClose) {
      onClose();
    }
  }, [onClose, disableClose]);

  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const getMessageContent = (msg: JanusMessage): string => {
    if (msg.role === 'janus') {
      if (typedMessages.has(msg.message_id) && typedMessages.get(msg.message_id) === msg.content) {
        return msg.content;
      }
      if (typedMessages.has(msg.message_id)) {
        return typedMessages.get(msg.message_id) || '';
      }
      if (!processedMessagesRef.current.has(msg.message_id)) {
        return '';
      }
      return msg.content;
    }
    return msg.content;
  };

  const isTyping = (msg: JanusMessage): boolean => {
    return msg.message_id === typingMessageId;
  };

  // Stay mounted through exit animation; unmount only after reset to initial phase
  if (!open && animPhase === 'flicker') return null;

  const isCurrentlyTyping = typingMessageId !== null;
  const showDisplayCursor = mode === 'DISPLAY' && !isCurrentlyTyping && !isProcessing;
  const showQueryPrompt = mode === 'QUERY' && !isCurrentlyTyping && !isProcessing;
  const queryAlreadyInMessages = isProcessing && submittedQuery &&
    messages.some(m => m.role === 'user' && m.content === submittedQuery);

  return (
    <div className={`janus-dialog-backdrop${animPhase === 'exiting' ? ' exiting' : ''}`} onClick={handleBackdropClick}>
      <div className={`janus-dialog-container phase-${animPhase}`} onClick={handlePanelClick}>
        <Panel
          title="JANUS"
          chamferCorners={['tl', 'tr', 'bl', 'br']}
          className="janus-dialog-panel"
        >
          <div className="janus-dialog-messages">
            {messages.map((msg) => (
              <div key={msg.message_id} className={`janus-message ${msg.role}`}>
                {msg.role === 'user' && <span className="message-prefix">&gt; </span>}
                <span className="message-content">
                  {getMessageContent(msg)}
                  {isTyping(msg) && <span className="typing-cursor">_</span>}
                </span>
              </div>
            ))}

            {isProcessing && (
              <>
                {!queryAlreadyInMessages && (
                  <div className="janus-message user">
                    <span className="message-prefix">&gt; </span>
                    <span className="message-content">{submittedQuery}</span>
                  </div>
                )}
                <div className="janus-message janus processing">
                  <span className="message-content">
                    Processing<span className="processing-dots"></span>
                  </span>
                </div>
              </>
            )}

            {showDisplayCursor && (
              <div className="janus-prompt">
                <span className="blinking-cursor">_</span>
              </div>
            )}

            {showQueryPrompt && (
              <form className="janus-prompt" onSubmit={handleSubmit}>
                <span className="query-prefix">&gt;&nbsp;</span>
                <input
                  ref={inputRef}
                  type="text"
                  className="query-input"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="off"
                  autoFocus
                />
              </form>
            )}

            <div ref={messagesEndRef} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
