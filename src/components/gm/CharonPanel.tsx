import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Input,
  Space,
  List,
  Typography,
  Divider,
  Badge,
  Modal,
  message,
  Tooltip,
} from 'antd';
import {
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  ClearOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { charonApi } from '@/services/charonApi';
import type { CharonMode, PendingResponse, CharonMessage } from '@/types/charon';

const { TextArea } = Input;
const { Text } = Typography;

interface CharonPanelProps {
  channel: string;
  currentViewType: string;
  charonDialogOpen?: boolean;
  onDialogToggle?: () => void;
}

export function CharonPanel({ channel, currentViewType, charonDialogOpen = false, onDialogToggle }: CharonPanelProps) {
  const [mode, setMode] = useState<CharonMode>('DISPLAY');
  const [messageContent, setMessageContent] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [contextOverride, setContextOverride] = useState('');
  const [pendingResponses, setPendingResponses] = useState<PendingResponse[]>([]);
  const [conversation, setConversation] = useState<CharonMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingResponse, setEditingResponse] = useState<PendingResponse | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [messageApi, contextHolder] = message.useMessage();

  // CHARON panel is active when the terminal view is displayed, the dialog is open,
  // or we're in a view that has a CHARON channel (bridge, encounter)
  const isActive = currentViewType === 'CHARON_TERMINAL' || currentViewType === 'BRIDGE' || currentViewType === 'ENCOUNTER' || charonDialogOpen;

  // Channel label for display
  const channelLabel = useMemo(() => {
    if (channel === 'story') return 'STORY';
    if (channel === 'bridge') return 'BRIDGE';
    if (channel.startsWith('encounter-')) {
      const slug = channel.slice('encounter-'.length);
      return `ENCOUNTER: ${slug.toUpperCase().replace(/_/g, ' ')}`;
    }
    return channel.toUpperCase();
  }, [channel]);

  // Show visibility toggle only for story and encounter channels, not when CHARON_TERMINAL is the active view (always showing)
  const showVisibilityToggle = useMemo(() => {
    if (currentViewType === 'CHARON_TERMINAL') return false;
    return channel === 'story' || channel.startsWith('encounter-');
  }, [channel, currentViewType]);

  // Unread count
  const unreadCount = pendingResponses.length;

  // Reset state when channel changes
  useEffect(() => {
    setConversation([]);
    setPendingResponses([]);
    setContextOverride('');
    setMessageContent('');
    setAiPrompt('');
  }, [channel]);

  // Poll for updates when CHARON terminal is active
  useEffect(() => {
    if (!isActive) return;

    const fetchData = async () => {
      try {
        const [convData, pendingData] = await Promise.all([
          charonApi.getChannelConversation(channel),
          charonApi.getChannelPending(channel),
        ]);
        setMode(convData.mode);
        setConversation(convData.messages);
        setPendingResponses(pendingData.pending);
      } catch (err) {
        console.error('Error fetching CHARON data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [isActive, channel]);

  const handleModeChange = useCallback(
    async (newMode: CharonMode) => {
      if (newMode === mode) return;
      try {
        await charonApi.switchMode(newMode);
        setMode(newMode);
        messageApi.success(`CHARON mode: ${newMode}`);
      } catch (err) {
        messageApi.error('Failed to switch mode');
      }
    },
    [mode, messageApi]
  );

  const handleSendMessage = useCallback(async () => {
    if (!messageContent.trim()) return;
    setIsSubmitting(true);
    try {
      await charonApi.sendChannelMessage(channel, messageContent);
      setMessageContent('');
      messageApi.success('Message sent to terminal');
      // Refresh conversation
      const convData = await charonApi.getChannelConversation(channel);
      setConversation(convData.messages);
    } catch (err) {
      messageApi.error('Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  }, [messageContent, channel, messageApi]);

  const handleGenerateResponse = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      await charonApi.generateChannelResponse(channel, aiPrompt, contextOverride);
      setAiPrompt('');
      messageApi.success('AI response generated - review in pending');
      // Refresh pending responses
      const pendingData = await charonApi.getChannelPending(channel);
      setPendingResponses(pendingData.pending);
    } catch (err) {
      messageApi.error('Failed to generate AI response');
    } finally {
      setIsGenerating(false);
    }
  }, [aiPrompt, contextOverride, channel, messageApi]);

  const handleApprove = useCallback(
    async (pending: PendingResponse) => {
      try {
        await charonApi.approveChannelResponse(channel, pending.pending_id);
        setPendingResponses((prev) =>
          prev.filter((p) => p.pending_id !== pending.pending_id)
        );
        messageApi.success('Response approved');
        // Refresh conversation
        const convData = await charonApi.getChannelConversation(channel);
        setConversation(convData.messages);
      } catch (err) {
        messageApi.error('Failed to approve response');
      }
    },
    [channel, messageApi]
  );

  const handleReject = useCallback(
    async (pending: PendingResponse) => {
      try {
        await charonApi.rejectChannelResponse(channel, pending.pending_id);
        setPendingResponses((prev) =>
          prev.filter((p) => p.pending_id !== pending.pending_id)
        );
        messageApi.success('Response rejected');
      } catch (err) {
        messageApi.error('Failed to reject response');
      }
    },
    [channel, messageApi]
  );

  const handleEdit = useCallback((pending: PendingResponse) => {
    setEditingResponse(pending);
    setEditedContent(pending.response);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingResponse) return;
    try {
      await charonApi.approveChannelResponse(channel, editingResponse.pending_id, editedContent);
      setPendingResponses((prev) =>
        prev.filter((p) => p.pending_id !== editingResponse.pending_id)
      );
      setEditingResponse(null);
      setEditedContent('');
      messageApi.success('Modified response approved');
      // Refresh conversation
      const convData = await charonApi.getChannelConversation(channel);
      setConversation(convData.messages);
    } catch (err) {
      messageApi.error('Failed to save modified response');
    }
  }, [editingResponse, editedContent, channel, messageApi]);

  const handleClear = useCallback(async () => {
    try {
      await charonApi.clearChannelConversation(channel);
      setConversation([]);
      setPendingResponses([]);
      messageApi.success('Conversation cleared');
    } catch (err) {
      messageApi.error('Failed to clear conversation');
    }
  }, [channel, messageApi]);

  return (
    <>
      {contextHolder}
      {/* Channel Header */}
      <div style={{ marginBottom: 16, padding: '8px 12px', background: '#0f1515', border: '1px solid #4a6b6b' }}>
        <Text strong style={{ color: '#8b7355', fontSize: 13 }}>
          CHARON TERMINAL // {channelLabel} {unreadCount > 0 && `(${unreadCount} unread)`}
        </Text>
      </div>

      {/* Mode Toggle and Dialog */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Text>Mode:</Text>
          <Button.Group>
            <Button
              type={mode === 'DISPLAY' ? 'primary' : 'default'}
              onClick={() => handleModeChange('DISPLAY')}
              disabled={!isActive}
              size="small"
            >
              DISPLAY
            </Button>
            <Button
              type={mode === 'QUERY' ? 'primary' : 'default'}
              onClick={() => handleModeChange('QUERY')}
              disabled={!isActive}
              size="small"
            >
              QUERY
            </Button>
          </Button.Group>
          <Tooltip title="Clear all messages">
            <Button
              icon={<ClearOutlined />}
              onClick={handleClear}
              disabled={!isActive}
              size="small"
            >
              Clear
            </Button>
          </Tooltip>
        </Space>
        {showVisibilityToggle && (
          <Button
            type={charonDialogOpen ? 'primary' : 'default'}
            onClick={onDialogToggle}
            size="small"
            icon={charonDialogOpen ? <CheckOutlined /> : undefined}
          >
            SHOWING
          </Button>
        )}
      </div>

      {/* Send Message */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Send Message
        </Text>
        <TextArea
          placeholder="Type message to display on terminal..."
          value={messageContent}
          onChange={(e) => setMessageContent(e.target.value)}
          disabled={!isActive}
          autoSize={{ minRows: 3, maxRows: 6 }}
          style={{ marginBottom: 8 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSendMessage}
          disabled={!isActive || !messageContent.trim()}
          loading={isSubmitting}
          block
        >
          SEND
        </Button>
      </div>

      <Divider />

      {/* Generate AI Response */}
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Generate AI Response
        </Text>
        <TextArea
          placeholder="Prompt for CHARON AI (e.g., 'Warn about proximity alert')..."
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          disabled={!isActive}
          autoSize={{ minRows: 2, maxRows: 4 }}
          style={{ marginBottom: 8 }}
        />
        <TextArea
          placeholder="System Context Override (optional)"
          value={contextOverride}
          onChange={(e) => setContextOverride(e.target.value)}
          disabled={!isActive}
          autoSize={{ minRows: 2, maxRows: 4 }}
          style={{ marginBottom: 8 }}
        />
        <Button
          icon={<ThunderboltOutlined />}
          onClick={handleGenerateResponse}
          disabled={!isActive || !aiPrompt.trim()}
          loading={isGenerating}
          block
        >
          GENERATE
        </Button>
      </div>

      {/* Pending Responses */}
      {pendingResponses.length > 0 && (
        <>
          <Divider />
          <div style={{ marginBottom: 24 }}>
            <Badge count={pendingResponses.length}>
              <Text strong style={{ marginRight: 8 }}>
                Pending Responses
              </Text>
            </Badge>
            <List
              size="small"
              dataSource={pendingResponses}
              renderItem={(pending) => (
                <List.Item
                  key={pending.pending_id}
                  style={{
                    background: '#0f1515',
                    padding: 12,
                    marginBottom: 8,
                    border: '1px solid #303030',
                  }}
                  actions={[
                    <Button
                      key="approve"
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => handleApprove(pending)}
                    >
                      Approve
                    </Button>,
                    <Button
                      key="edit"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(pending)}
                    >
                      Edit
                    </Button>,
                    <Button
                      key="reject"
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => handleReject(pending)}
                    >
                      Reject
                    </Button>,
                  ]}
                >
                  <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                      {pending.query}
                    </Text>
                    <Text style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{pending.response}</Text>
                  </div>
                </List.Item>
              )}
            />
          </div>
        </>
      )}

      {/* Edit Modal */}
      <Modal
        title="Edit AI Response"
        open={editingResponse !== null}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditingResponse(null);
          setEditedContent('');
        }}
        okText="Approve Modified"
        width={600}
      >
        <TextArea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          autoSize={{ minRows: 4, maxRows: 12 }}
        />
      </Modal>

      {/* Conversation Display */}
      <Divider />
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Conversation ({conversation.length} messages)
        </Text>
        <div
          style={{
            maxHeight: 300,
            overflowY: 'auto',
            background: '#0a0a0a',
            border: '1px solid #303030',
            padding: 8,
          }}
        >
          {conversation.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 11 }}>
              No messages in this channel yet
            </Text>
          ) : (
            conversation.map((msg, index) => (
              <div
                key={msg.message_id || index}
                style={{
                  marginBottom: 12,
                  paddingBottom: 12,
                  borderBottom: index < conversation.length - 1 ? '1px solid #202020' : 'none',
                }}
              >
                <Text
                  type="secondary"
                  style={{ fontSize: 10, display: 'block', marginBottom: 2 }}
                >
                  {msg.role === 'user' ? 'PLAYER' : 'CHARON'} •{' '}
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </Text>
                <Text style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
