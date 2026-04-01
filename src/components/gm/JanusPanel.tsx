import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Input,
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
import { janusApi } from '@/services/janusApi';
import type { JanusMode, PendingResponse, JanusMessage } from '@/types/janus';

const { TextArea } = Input;
const { Text } = Typography;

interface JanusPanelProps {
  channel: string;
  currentViewType: string;
  janusDialogOpen?: boolean;
  onDialogToggle?: () => void;
}

export function JanusPanel({ channel, currentViewType, janusDialogOpen = false, onDialogToggle }: JanusPanelProps) {
  const [mode, setMode] = useState<JanusMode>('DISPLAY');
  const [messageContent, setMessageContent] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [contextOverride, setContextOverride] = useState('');
  const [pendingResponses, setPendingResponses] = useState<PendingResponse[]>([]);
  const [conversation, setConversation] = useState<JanusMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingResponse, setEditingResponse] = useState<PendingResponse | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [messageApi, contextHolder] = message.useMessage();

  // JANUS panel is active when the terminal view is displayed, the dialog is open,
  // or we're in a view that has a JANUS channel (bridge, encounter)
  const isActive = currentViewType === 'JANUS_TERMINAL' || currentViewType === 'BRIDGE' || currentViewType === 'ENCOUNTER' || currentViewType === 'STANDBY' || janusDialogOpen;

  // Show visibility toggle unless JANUS_TERMINAL is active (already always showing there)
  const showVisibilityToggle = useMemo(() => {
    if (currentViewType === 'JANUS_TERMINAL') return false;
    return true;
  }, [currentViewType]);

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

  // Poll for updates when JANUS terminal is active
  useEffect(() => {
    if (!isActive) return;

    const fetchData = async () => {
      try {
        const [convData, pendingData] = await Promise.all([
          janusApi.getChannelConversation(channel),
          janusApi.getChannelPending(channel),
        ]);
        setMode(convData.mode);
        setConversation(convData.messages);
        setPendingResponses(pendingData.pending);
      } catch (err) {
        console.error('Error fetching JANUS data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [isActive, channel]);

  const handleModeChange = useCallback(
    async (newMode: JanusMode) => {
      if (newMode === mode) return;
      try {
        await janusApi.switchMode(newMode);
        setMode(newMode);
        messageApi.success(`JANUS mode: ${newMode}`);
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
      await janusApi.sendChannelMessage(channel, messageContent);
      setMessageContent('');
      messageApi.success('Message sent to terminal');
      // Refresh conversation
      const convData = await janusApi.getChannelConversation(channel);
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
      await janusApi.generateChannelResponse(channel, aiPrompt, contextOverride);
      setAiPrompt('');
      messageApi.success('AI response generated - review in pending');
      // Refresh pending responses
      const pendingData = await janusApi.getChannelPending(channel);
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
        await janusApi.approveChannelResponse(channel, pending.pending_id);
        setPendingResponses((prev) =>
          prev.filter((p) => p.pending_id !== pending.pending_id)
        );
        messageApi.success('Response approved');
        // Refresh conversation
        const convData = await janusApi.getChannelConversation(channel);
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
        await janusApi.rejectChannelResponse(channel, pending.pending_id);
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
      await janusApi.approveChannelResponse(channel, editingResponse.pending_id, editedContent);
      setPendingResponses((prev) =>
        prev.filter((p) => p.pending_id !== editingResponse.pending_id)
      );
      setEditingResponse(null);
      setEditedContent('');
      messageApi.success('Modified response approved');
      // Refresh conversation
      const convData = await janusApi.getChannelConversation(channel);
      setConversation(convData.messages);
    } catch (err) {
      messageApi.error('Failed to save modified response');
    }
  }, [editingResponse, editedContent, channel, messageApi]);

  const handleClear = useCallback(async () => {
    try {
      await janusApi.clearChannelConversation(channel);
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
      {/* Mode Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
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
      </div>

      {/* Clear + Visibility row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
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
        {showVisibilityToggle && (
          <Button
            type={janusDialogOpen ? 'primary' : 'default'}
            onClick={onDialogToggle}
            size="small"
            icon={janusDialogOpen ? <CheckOutlined /> : undefined}
          >
            SHOWING
          </Button>
        )}
        {unreadCount > 0 && (
          <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
            {unreadCount} pending
          </Text>
        )}
      </div>

      {/* Send Message */}
      <div>
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

      <Divider style={{ marginTop: 12, marginBottom: 6 }} />

      {/* Generate AI Response */}
      <div>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Generate AI Response
        </Text>
        <TextArea
          placeholder="Prompt for JANUS AI (e.g., 'Warn about proximity alert')..."
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
          <Divider style={{ marginTop: 12, marginBottom: 6 }} />
          <div>
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
      <Divider style={{ marginTop: 12, marginBottom: 6 }} />
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
                  {msg.role === 'user' ? 'PLAYER' : 'JANUS'} •{' '}
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
