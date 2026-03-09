import { useState, useCallback } from 'react';
import { Button, Input, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { charonApi } from '@/services/charonApi';

const { TextArea } = Input;

interface CharonQuickSendProps {
  channel: string;
}

export function CharonQuickSend({ channel }: CharonQuickSendProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleSend = useCallback(async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      await charonApi.sendChannelMessage(channel, content.trim());
      setContent('');
      messageApi.success('Message sent');
    } catch (err) {
      console.error('Error sending CHARON message:', err);
      messageApi.error('Failed to send message');
    } finally {
      setSending(false);
    }
  }, [content, channel, messageApi]);

  return (
    <div style={{ padding: 4 }}>
      {contextHolder}
      <div style={{ color: '#888', fontSize: 11, marginBottom: 8 }}>
        Channel: <span style={{ color: '#8b7355' }}>{channel.toUpperCase()}</span>
      </div>
      <TextArea
        placeholder="Type message for CHARON terminal..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoSize={{ minRows: 3, maxRows: 6 }}
        style={{ marginBottom: 8 }}
      />
      <Button
        type="primary"
        icon={<SendOutlined />}
        onClick={handleSend}
        disabled={!content.trim()}
        loading={sending}
        block
      >
        SEND
      </Button>
    </div>
  );
}
