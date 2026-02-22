interface SSEConnectionToastProps {
  message?: string;
}

export function SSEConnectionToast({
  message = 'Connection lost — retrying...',
}: SSEConnectionToastProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        backgroundColor: '#5c2a2a',
        border: '1px solid #8b4444',
        color: '#cc7777',
        fontFamily: 'Cascadia Code, monospace',
        fontSize: '12px',
        padding: '6px 16px',
        letterSpacing: '0.08em',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </div>
  );
}
