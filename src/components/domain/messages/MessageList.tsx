import { useMessages } from '@/hooks/useMessages';
import { MessageItem } from './MessageItem';

interface MessageListProps {
  pollInterval?: number;
}

export function MessageList({ pollInterval = 3000 }: MessageListProps) {
  const { messages, newMessageCount, loading } = useMessages(pollInterval);

  return (
    <>
      {/* New message alert */}
      {newMessageCount > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '70px',
            right: '50px',
            backgroundColor: '#8b7355',
            color: '#0a0a0a',
            padding: '12px 20px',
            fontWeight: 'bold',
            letterSpacing: '2px',
            fontSize: '11px',
            boxShadow: '0 0 15px rgba(139, 115, 85, 0.6)',
            zIndex: 2000,
            animation: 'slideIn 0.3s ease-out',
            fontFamily: "'Cascadia Code', 'Courier New', monospace",
          }}
        >
          NEW MESSAGE{newMessageCount > 1 ? 'S' : ''} RECEIVED
        </div>
      )}

      {/* Panel wrapper */}
      <div
        style={{
          position: 'relative',
          backgroundColor: '#1a2525',
          clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
          boxShadow: 'inset 0 2px 0 0 #4a6b6b, inset -2px 0 0 0 #4a6b6b, inset 0 -2px 0 0 #4a6b6b, inset 2px 0 0 0 #4a6b6b',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,  // Allow flexbox shrinking
          overflow: 'hidden',
        }}
      >
        {/* Top-left corner diagonal */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '12px',
            height: '12px',
            background: 'linear-gradient(to bottom right, transparent calc(50% - 2px), #4a6b6b calc(50% - 2px), #4a6b6b calc(50% + 2px), transparent calc(50% + 2px))',
          }}
        />
        {/* Bottom-right corner diagonal */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '12px',
            height: '12px',
            background: 'linear-gradient(to bottom right, transparent calc(50% - 2px), #4a6b6b calc(50% - 2px), #4a6b6b calc(50% + 2px), transparent calc(50% + 2px))',
          }}
        />

        {/* Panel header */}
        <div
          style={{
            padding: '12px 2px 0 2px',
            flexShrink: 0,
          }}
        >
          <h3
            style={{
              color: '#4a6b6b',
              fontSize: '13px',
              letterSpacing: '2px',
              margin: 0,
              padding: '0 22px 5px 22px',
              borderBottom: '1px solid #2a3a3a',
              fontFamily: "'Cascadia Code', 'Courier New', monospace",
              fontWeight: 'normal',
            }}
          >
            INCOMING MESSAGES
          </h3>
        </div>

        {/* Scrollable content area */}
        <div
          style={{
            flex: 1,
            minHeight: 0,  // Allow flexbox shrinking
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '12px',
            margin: '2px 5px 2px 2px',
            backgroundColor: '#171717',
            backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 2px, #1a1a1a 2px, #1a1a1a 3px)',
            fontSize: '12px',
            lineHeight: 1.6,
          }}
        >
          {loading ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: '#5a5a5a',
                fontSize: '14px',
                fontFamily: "'Cascadia Code', 'Courier New', monospace",
              }}
            >
              <p>&gt; LOADING MESSAGES...</p>
              <p className="blink">&gt; _</p>
            </div>
          ) : messages.length > 0 ? (
            messages.map((message, index) => (
              <MessageItem
                key={message.id}
                message={message}
                isNew={index < newMessageCount}
              />
            ))
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: '#5a5a5a',
                fontSize: '14px',
                fontFamily: "'Cascadia Code', 'Courier New', monospace",
              }}
            >
              <p>&gt; NO NEW MESSAGES</p>
              <p>&gt; SYSTEM STANDBY</p>
              <p className="blink">&gt; _</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
