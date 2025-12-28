import { useState, useEffect, useCallback, useRef } from 'react';
import { Message } from '@/types/message';
import { getMessages } from '@/services/messageApi';

export function useMessages(pollInterval: number = 3000) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageCount, setNewMessageCount] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const lastMessageIdRef = useRef<number>(0);
  const isFirstFetchRef = useRef<boolean>(true);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await getMessages(lastMessageIdRef.current);

      if (isFirstFetchRef.current) {
        // Initial load - set all messages
        setMessages(data.messages);
        if (data.messages.length > 0) {
          lastMessageIdRef.current = Math.max(...data.messages.map(m => m.id));
        }
        isFirstFetchRef.current = false;
        setLoading(false);
      } else if (data.count > 0) {
        // Subsequent polls - prepend new messages
        setMessages(prev => [...data.messages.reverse(), ...prev]);
        setNewMessageCount(data.count);
        lastMessageIdRef.current = Math.max(...data.messages.map(m => m.id));

        // Clear new message count after 3 seconds
        setTimeout(() => setNewMessageCount(0), 3000);
      }
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch messages:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages(); // Initial fetch
    const interval = setInterval(fetchMessages, pollInterval);
    return () => clearInterval(interval);
  }, [fetchMessages, pollInterval]);

  return { messages, newMessageCount, error, loading };
}
