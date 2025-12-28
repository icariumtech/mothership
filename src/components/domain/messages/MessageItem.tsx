import { Message } from '@/types/message';

interface MessageItemProps {
  message: Message;
  isNew?: boolean;
}

// Priority background colors
const priorityBgColors: Record<Message['priority'], string> = {
  LOW: '#4a4a4a',
  NORMAL: '#4a6b6b',
  HIGH: '#8b7355',
  CRITICAL: '#8b5555',
};

export function MessageItem({ message, isNew = false }: MessageItemProps) {
  const priorityBg = priorityBgColors[message.priority];

  return (
    <div
      style={{
        margin: '5px 0',
        background: '#0f1515',
        border: '1px solid #2a3a3a',
        cursor: 'default',
        transition: 'all 0.2s ease',
        animation: isNew ? 'fadeIn 0.5s ease-out' : undefined,
      }}
      data-message-id={message.id}
    >
      {/* Row header with sender and priority */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          gap: '10px',
        }}
      >
        {/* Sender name */}
        <div
          style={{
            color: '#9a9a9a',
            fontSize: '12px',
            letterSpacing: '1px',
            fontFamily: "'Cascadia Code', 'Courier New', monospace",
            fontWeight: 500,
          }}
        >
          {message.sender}
        </div>
        {/* Priority label with solid background */}
        <div
          style={{
            backgroundColor: priorityBg,
            color: '#0a0a0a',
            fontSize: '10px',
            letterSpacing: '1px',
            fontFamily: "'Cascadia Code', 'Courier New', monospace",
            fontWeight: 'bold',
            padding: '2px 6px',
          }}
        >
          {message.priority}
        </div>
      </div>

      {/* Message content */}
      <div
        style={{
          padding: '0 12px 10px 12px',
          whiteSpace: 'pre-wrap',
          lineHeight: 1.6,
          color: '#7a7a7a',
          fontSize: '12px',
          fontFamily: "'Cascadia Code', 'Courier New', monospace",
        }}
      >
        {message.content}
      </div>
    </div>
  );
}
