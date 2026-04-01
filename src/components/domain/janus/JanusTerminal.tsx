import { useState, useEffect, useRef, useCallback } from 'react';
import { janusApi } from '@/services/janusApi';
import { Panel } from '@/components/ui/Panel';
import type { JanusMessage, JanusMode } from '@/types/janus';
import './JanusTerminal.css';

interface JanusTerminalProps {
  className?: string;
  isVisible?: boolean;
}

export function JanusTerminal({ className, isVisible = true }: JanusTerminalProps) {
  const [messages, setMessages] = useState<JanusMessage[]>([]);
  const [mode, setMode] = useState<JanusMode>('DISPLAY');
  const [queryInput, setQueryInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [typedMessages, setTypedMessages] = useState<Map<string, string>>(new Map());
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const processedMessagesRef = useRef<Set<string>>(new Set());

  // Typewriter effect for JANUS messages — only processes when tab is visible.
  // Messages arriving while hidden are deferred until the tab becomes visible again.
  useEffect(() => {
    if (!isVisible) return;

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
  }, [messages, isVisible]);

  // Poll for conversation updates (using bridge channel)
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const data = await janusApi.getChannelConversation('bridge');
        setMode(data.mode);
        setMessages(data.messages);
      } catch (err) {
        console.error('Error fetching conversation:', err);
      }
    };

    fetchConversation();
    const interval = setInterval(fetchConversation, 2000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typedMessages, queryInput, isProcessing]);

  // Focus input in query mode
  useEffect(() => {
    if (mode === 'QUERY' && inputRef.current && typingMessageId === null && !isProcessing) {
      inputRef.current.focus();
    }
  }, [mode, typingMessageId, isProcessing]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!queryInput.trim() || isProcessing) return;

      const query = queryInput.trim();
      setSubmittedQuery(query);
      setQueryInput('');
      setIsProcessing(true);

      try {
        await janusApi.submitChannelQuery('bridge', query);
      } catch (err) {
        console.error('Error submitting query:', err);
        setIsProcessing(false);
        setSubmittedQuery('');
      }
    },
    [queryInput, isProcessing]
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

  const isCurrentlyTyping = typingMessageId !== null;
  const showDisplayCursor = mode === 'DISPLAY' && !isCurrentlyTyping && !isProcessing;
  const showQueryPrompt = mode === 'QUERY' && !isCurrentlyTyping && !isProcessing;
  const queryAlreadyInMessages = isProcessing && submittedQuery &&
    messages.some(m => m.role === 'user' && m.content === submittedQuery);

  return (
    <div className={`janus-terminal-wrapper ${className || ''}`}>
      <Panel
        title="JANUS"
        chamferCorners={['tl', 'tr', 'bl', 'br']}
        className="janus-terminal-panel"
      >
        <div className="janus-terminal-messages">
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
  );
}
