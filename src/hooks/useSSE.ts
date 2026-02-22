import { useEffect, useRef, useCallback, useState } from 'react';

interface UseSSEOptions {
  url: string;
  onEvent: (data: unknown) => void;
  onConnect?: () => void;     // Called on (re)connect — optional state re-sync
  failureThreshold?: number;  // Consecutive failed reconnects before showing toast
  retryDelayMs?: number;      // Delay between manual reconnect attempts
}

export function useSSE({
  url,
  onEvent,
  onConnect,
  failureThreshold = 3,
  retryDelayMs = 3000,
}: UseSSEOptions) {
  const [connectionLost, setConnectionLost] = useState(false);
  const failureCount = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Close existing connection before opening a new one
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      failureCount.current = 0;
      setConnectionLost(false);
      onConnect?.();
    };

    // Listen for named 'activeview' events (server sends: event: activeview\ndata: {...})
    es.addEventListener('activeview', (e: MessageEvent) => {
      try {
        onEvent(JSON.parse(e.data));
      } catch {
        console.error('[SSE] Failed to parse activeview event data:', e.data);
      }
    });

    es.onerror = () => {
      // EventSource auto-reconnects, but we manage our own retry for toast tracking
      es.close();
      esRef.current = null;
      failureCount.current += 1;
      if (failureCount.current >= failureThreshold) {
        setConnectionLost(true);
      }
      retryTimer.current = setTimeout(connect, retryDelayMs);
    };
  }, [url, onEvent, onConnect, failureThreshold, retryDelayMs]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [connect]);

  return { connectionLost };
}
