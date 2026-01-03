import { useState, useEffect, useCallback } from 'react';
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
  EnvironmentOutlined,
} from '@ant-design/icons';
import { charonApi } from '@/services/charonApi';
import type { CharonMode, PendingResponse, CharonMessage } from '@/types/charon';

const { TextArea } = Input;
const { Text } = Typography;

interface CharonPanelProps {
  currentViewType: string;
  charonDialogOpen?: boolean;
  onDialogToggle?: () => void;
}

export function CharonPanel({ currentViewType, charonDialogOpen = false, onDialogToggle }: CharonPanelProps) {
  const [mode, setMode] = useState<CharonMode>('DISPLAY');
  const [locationPath, setLocationPath] = useState('');  // Explicit override
  const [activeLocationPath, setActiveLocationPath] = useState('');  // What CHARON is actually using
  const [locationInput, setLocationInput] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [pendingResponses, setPendingResponses] = useState<PendingResponse[]>([]);
  const [conversation, setConversation] = useState<CharonMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingResponse, setEditingResponse] = useState<PendingResponse | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [messageApi, contextHolder] = message.useMessage();

  // CHARON panel is active when either the terminal view is displayed OR the dialog is open
  const isActive = currentViewType === 'CHARON_TERMINAL' || charonDialogOpen;

  // Poll for updates when CHARON terminal is active
  useEffect(() => {
    if (!isActive) return;

    const fetchData = async () => {
      try {
        const [convData, pendingData] = await Promise.all([
          charonApi.getConversation(),
          charonApi.getPending(),
        ]);
        setMode(convData.mode);
        setConversation(convData.messages);
        setPendingResponses(pendingData.pending);
        // Sync location paths from server
        setActiveLocationPath(convData.active_location_path || '');
        if (convData.charon_location_path !== locationPath) {
          setLocationPath(convData.charon_location_path);
          setLocationInput(convData.charon_location_path);
        }
      } catch (err) {
        console.error('Error fetching CHARON data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [isActive, locationPath]);

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

  const handleSetLocation = useCallback(async () => {
    if (locationInput === locationPath) return;
    try {
      await charonApi.setLocation(locationInput);
      setLocationPath(locationInput);
      messageApi.success(locationInput ? `CHARON: ${locationInput}` : 'CHARON location cleared');
    } catch (err) {
      messageApi.error('Failed to set location');
    }
  }, [locationInput, locationPath, messageApi]);

  const handleSendMessage = useCallback(async () => {
    if (!messageContent.trim()) return;
    setIsSubmitting(true);
    try {
      await charonApi.sendMessage(messageContent);
      setMessageContent('');
      messageApi.success('Message sent to terminal');
      // Refresh conversation
      const convData = await charonApi.getConversation();
      setConversation(convData.messages);
    } catch (err) {
      messageApi.error('Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  }, [messageContent, messageApi]);

  const handleGenerateResponse = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      await charonApi.generateResponse(aiPrompt);
      setAiPrompt('');
      messageApi.success('AI response generated - review in pending');
      // Refresh pending responses
      const pendingData = await charonApi.getPending();
      setPendingResponses(pendingData.pending);
    } catch (err) {
      messageApi.error('Failed to generate AI response');
    } finally {
      setIsGenerating(false);
    }
  }, [aiPrompt, messageApi]);

  const handleApprove = useCallback(
    async (pending: PendingResponse) => {
      try {
        await charonApi.approveResponse(pending.pending_id);
        setPendingResponses((prev) =>
          prev.filter((p) => p.pending_id !== pending.pending_id)
        );
        messageApi.success('Response approved');
        // Refresh conversation
        const convData = await charonApi.getConversation();
        setConversation(convData.messages);
      } catch (err) {
        messageApi.error('Failed to approve response');
      }
    },
    [messageApi]
  );

  const handleReject = useCallback(
    async (pending: PendingResponse) => {
      try {
        await charonApi.rejectResponse(pending.pending_id);
        setPendingResponses((prev) =>
          prev.filter((p) => p.pending_id !== pending.pending_id)
        );
        messageApi.success('Response rejected');
      } catch (err) {
        messageApi.error('Failed to reject response');
      }
    },
    [messageApi]
  );

  const handleEdit = useCallback((pending: PendingResponse) => {
    setEditingResponse(pending);
    setEditedContent(pending.response);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingResponse) return;
    try {
      await charonApi.approveResponse(editingResponse.pending_id, editedContent);
      setPendingResponses((prev) =>
        prev.filter((p) => p.pending_id !== editingResponse.pending_id)
      );
      setEditingResponse(null);
      setEditedContent('');
      messageApi.success('Modified response approved');
      // Refresh conversation
      const convData = await charonApi.getConversation();
      setConversation(convData.messages);
    } catch (err) {
      messageApi.error('Failed to save modified response');
    }
  }, [editingResponse, editedContent, messageApi]);

  const handleClear = useCallback(async () => {
    try {
      await charonApi.clearConversation();
      setConversation([]);
      setPendingResponses([]);
      messageApi.success('Conversation cleared');
    } catch (err) {
      messageApi.error('Failed to clear conversation');
    }
  }, [messageApi]);

  return (
    <>
      {contextHolder}
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
        <Button
          type={charonDialogOpen ? 'primary' : 'default'}
          onClick={onDialogToggle}
          size="small"
          icon={charonDialogOpen ? <CheckOutlined /> : undefined}
        >
          SHOWING
        </Button>
      </div>

        {/* Location Context */}
        <div style={{ marginBottom: 16 }}>
          <Text style={{ display: 'block', marginBottom: 4 }}>
            <EnvironmentOutlined /> CHARON Context:
          </Text>
          {/* Show active location (derived from encounter or explicit) */}
          {activeLocationPath ? (
            <div style={{
              background: '#0f1515',
              border: '1px solid #4a6b6b',
              padding: '6px 10px',
              marginBottom: 8,
              fontSize: 11,
            }}>
              <Text style={{ color: '#5a7a7a' }}>
                {activeLocationPath}
              </Text>
              {activeLocationPath !== locationPath && !locationPath && (
                <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>
                  (from current encounter)
                </Text>
              )}
              {locationPath && (
                <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2 }}>
                  (explicit override)
                </Text>
              )}
            </div>
          ) : (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
              No location context (use encounter view or set below)
            </Text>
          )}
          {/* Override location input */}
          <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>
            Override location:
          </Text>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="e.g., anchor-system/veil-station"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              disabled={!isActive}
              size="small"
              onPressEnter={handleSetLocation}
            />
            <Button
              type="primary"
              onClick={handleSetLocation}
              disabled={!isActive || locationInput === locationPath}
              size="small"
            >
              SET
            </Button>
          </Space.Compact>
        </div>

        {/* GM Message Input */}
        <Divider style={{ margin: '12px 0 8px 0' }}>
          Send Message
        </Divider>
        <TextArea
          rows={3}
          placeholder="Type message to display on terminal..."
          value={messageContent}
          onChange={(e) => setMessageContent(e.target.value)}
          disabled={!isActive}
          style={{ marginBottom: 8 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSendMessage}
          loading={isSubmitting}
          disabled={!isActive || !messageContent.trim()}
        >
          SEND
        </Button>

        {/* AI Response Generation */}
        <Divider style={{ margin: '16px 0 8px 0' }}>
          Generate AI Response
        </Divider>
        <TextArea
          rows={2}
          placeholder="Prompt for CHARON AI (e.g., 'Warn about proximity alert')..."
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          disabled={!isActive}
          style={{ marginBottom: 8 }}
        />
        <Button
          icon={<ThunderboltOutlined />}
          onClick={handleGenerateResponse}
          loading={isGenerating}
          disabled={!isActive || !aiPrompt.trim()}
          style={{ background: '#4a6b6b', borderColor: '#5a7a7a' }}
        >
          {isGenerating ? 'GENERATING...' : 'GENERATE'}
        </Button>

        {/* Pending Responses */}
        {pendingResponses.length > 0 && (
          <>
            <Divider style={{ margin: '16px 0 8px 0' }}>
              <Badge count={pendingResponses.length} offset={[10, 0]}>
                <span style={{ paddingRight: 16 }}>Pending Approval</span>
              </Badge>
            </Divider>
            <List
              size="small"
              dataSource={pendingResponses}
              renderItem={(pending) => (
                <List.Item
                  style={{
                    background: '#1a1a1a',
                    marginBottom: 8,
                    padding: '8px 12px',
                    borderRadius: 4,
                  }}
                  actions={[
                    <Tooltip title="Approve" key="approve">
                      <Button
                        type="primary"
                        icon={<CheckOutlined />}
                        size="small"
                        onClick={() => handleApprove(pending)}
                      />
                    </Tooltip>,
                    <Tooltip title="Edit & Approve" key="edit">
                      <Button
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => handleEdit(pending)}
                      />
                    </Tooltip>,
                    <Tooltip title="Reject" key="reject">
                      <Button
                        danger
                        icon={<CloseOutlined />}
                        size="small"
                        onClick={() => handleReject(pending)}
                      />
                    </Tooltip>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Query: {pending.query}
                      </Text>
                    }
                    description={
                      <Text style={{ fontSize: 12 }}>{pending.response}</Text>
                    }
                  />
                </List.Item>
              )}
            />
          </>
        )}

        {/* Recent Conversation */}
        {conversation.length > 0 && (
          <>
            <Divider style={{ margin: '16px 0 8px 0' }}>
              Recent Messages ({conversation.length})
            </Divider>
            <List
              size="small"
              dataSource={conversation.slice(-5)}
              style={{ maxHeight: 200, overflow: 'auto' }}
              renderItem={(msg) => (
                <List.Item style={{ padding: '4px 0' }}>
                  <Text
                    style={{
                      fontSize: 11,
                      color: msg.role === 'charon' ? '#5a7a7a' : '#8b7355',
                    }}
                  >
                    <strong>[{msg.role.toUpperCase()}]</strong> {msg.content}
                  </Text>
                </List.Item>
              )}
            />
          </>
        )}

      {/* Edit Modal */}
      <Modal
        title="Edit Response"
        open={!!editingResponse}
        onOk={handleSaveEdit}
        onCancel={() => setEditingResponse(null)}
        okText="Approve with Changes"
      >
        {editingResponse && (
          <>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Original query: {editingResponse.query}
            </Text>
            <TextArea
              rows={6}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
            />
          </>
        )}
      </Modal>
    </>
  );
}
