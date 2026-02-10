import { useState, useEffect, useRef, useCallback } from 'react';
import { charonApi } from '@/services/charonApi';
import { Panel } from '@/components/ui/Panel';
import type { CharonMessage, CharonMode } from '@/types/charon';
import './CharonTerminal.css';

interface CharonTerminalProps {
  className?: string;
  isVisible?: boolean;
}

export function CharonTerminal({ className, isVisible = true }: CharonTerminalProps) {
  const [messages, setMessages] = useState<CharonMessage[]>([]);
  const [mode, setMode] = useState<CharonMode>('DISPLAY');
  const [queryInput, setQueryInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [typedMessages, setTypedMessages] = useState<Map<string, string>>(new Map());
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const processedMessagesRef = useRef<Set<string>>(new Set());

  // Typewriter effect for CHARON messages — only processes when tab is visible.
  // Messages arriving while hidden are deferred until the tab becomes visible again.
  useEffect(() => {
    if (!isVisible) return;

    const charonMessages = messages.filter(m => m.role === 'charon');

    for (const msg of charonMessages) {
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
        const data = await charonApi.getChannelConversation('bridge');
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
        await charonApi.submitChannelQuery('bridge', query);
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

  const getMessageContent = (msg: CharonMessage): string => {
    if (msg.role === 'charon') {
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

  const isTyping = (msg: CharonMessage): boolean => {
    return msg.message_id === typingMessageId;
  };

  const isCurrentlyTyping = typingMessageId !== null;
  const showDisplayCursor = mode === 'DISPLAY' && !isCurrentlyTyping && !isProcessing;
  const showQueryPrompt = mode === 'QUERY' && !isCurrentlyTyping && !isProcessing;
  const queryAlreadyInMessages = isProcessing && submittedQuery &&
    messages.some(m => m.role === 'user' && m.content === submittedQuery);

  return (
    <div className={`charon-terminal-wrapper ${className || ''}`}>
      <Panel
        title="CHARON"
        chamferCorners={['tl', 'tr', 'bl', 'br']}
        className="charon-terminal-panel"
      >
        <div className="charon-terminal-messages">
          {messages.map((msg) => (
            <div key={msg.message_id} className={`charon-message ${msg.role}`}>
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
                <div className="charon-message user">
                  <span className="message-prefix">&gt; </span>
                  <span className="message-content">{submittedQuery}</span>
                </div>
              )}
              <div className="charon-message charon processing">
                <span className="message-content">
                  Processing<span className="processing-dots"></span>
                </span>
              </div>
            </>
          )}

          {showDisplayCursor && (
            <div className="charon-prompt">
              <span className="blinking-cursor">_</span>
            </div>
          )}

          {showQueryPrompt && (
            <form className="charon-prompt" onSubmit={handleSubmit}>
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
