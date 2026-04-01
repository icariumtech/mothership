/**
 * JANUS Terminal API Service
 * Handles all API calls for the JANUS interactive terminal.
 */
import { api } from './api';
import type { JanusConversation, JanusMode, PendingResponse } from '@/types/janus';

// Public endpoints (for shared terminal)

async function getConversation(): Promise<JanusConversation> {
  const response = await api.get<JanusConversation>('/janus/conversation/');
  return response.data;
}

async function submitQuery(query: string): Promise<{
  success: boolean;
  query_id: string;
  pending_id: string;
}> {
  const response = await api.post('/janus/submit-query/', { query });
  return response.data;
}

// GM endpoints

async function switchMode(mode: JanusMode): Promise<void> {
  await api.post('/gm/janus/mode/', { mode });
}

async function setLocation(locationPath: string): Promise<void> {
  await api.post('/gm/janus/location/', { location_path: locationPath });
}

async function sendMessage(content: string): Promise<{ message_id: string }> {
  const response = await api.post<{ success: boolean; message_id: string }>(
    '/gm/janus/send/',
    { content }
  );
  return response.data;
}

async function generateResponse(prompt: string): Promise<{
  success: boolean;
  pending_id: string;
  query_id: string;
}> {
  const response = await api.post<{
    success: boolean;
    pending_id: string;
    query_id: string;
  }>('/gm/janus/generate/', { prompt });
  return response.data;
}

async function getPending(): Promise<{ pending: PendingResponse[] }> {
  const response = await api.get<{ pending: PendingResponse[] }>('/gm/janus/pending/');
  return response.data;
}

async function approveResponse(
  pendingId: string,
  modifiedContent?: string
): Promise<void> {
  await api.post('/gm/janus/approve/', {
    pending_id: pendingId,
    modified_content: modifiedContent,
  });
}

async function rejectResponse(pendingId: string): Promise<void> {
  await api.post('/gm/janus/reject/', { pending_id: pendingId });
}

async function clearConversation(): Promise<void> {
  await api.post('/gm/janus/clear/', {});
}

async function switchToJanus(): Promise<void> {
  await api.post('/gm/switch-view/', { view_type: 'JANUS_TERMINAL' });
}

async function toggleDialog(open?: boolean): Promise<{ janus_dialog_open: boolean }> {
  const response = await api.post<{ success: boolean; janus_dialog_open: boolean }>(
    '/gm/janus/toggle-dialog/',
    open !== undefined ? { open } : {}
  );
  return response.data;
}

// Channel-aware endpoints (multi-channel support)

async function getChannels(): Promise<{
  channels: Array<{
    channel: string;
    message_count: number;
    unread_count: number;
    last_message: any | null;
  }>;
}> {
  const response = await api.get('/gm/janus/channels/');
  return response.data;
}

async function getChannelConversation(channel: string): Promise<{
  channel: string;
  mode: JanusMode;
  messages: any[];
}> {
  const response = await api.get(`/janus/${channel}/conversation/`);
  return response.data;
}

async function submitChannelQuery(channel: string, query: string): Promise<{
  success: boolean;
  query_id: string;
  pending_id: string;
}> {
  const response = await api.post(`/janus/${channel}/submit/`, { query });
  return response.data;
}

async function sendChannelMessage(channel: string, content: string): Promise<{
  success: boolean;
  message_id: string;
  channel: string;
}> {
  const response = await api.post(`/gm/janus/${channel}/send/`, { content });
  return response.data;
}

async function markChannelRead(channel: string): Promise<void> {
  await api.post(`/gm/janus/${channel}/mark-read/`, {});
}

async function getChannelPending(channel: string): Promise<{
  channel: string;
  pending: PendingResponse[];
  count: number;
}> {
  const response = await api.get(`/gm/janus/${channel}/pending/`);
  return response.data;
}

async function approveChannelResponse(
  channel: string,
  pendingId: string,
  modifiedContent?: string
): Promise<void> {
  await api.post(`/gm/janus/${channel}/approve/`, {
    pending_id: pendingId,
    modified_content: modifiedContent,
  });
}

async function rejectChannelResponse(channel: string, pendingId: string): Promise<void> {
  await api.post(`/gm/janus/${channel}/reject/`, { pending_id: pendingId });
}

async function generateChannelResponse(
  channel: string,
  prompt: string,
  contextOverride?: string
): Promise<{
  success: boolean;
  pending_id: string;
  response: string;
  channel: string;
}> {
  const response = await api.post(`/gm/janus/${channel}/generate/`, {
    prompt,
    context_override: contextOverride || '',
  });
  return response.data;
}

async function clearChannelConversation(channel: string): Promise<void> {
  await api.post(`/gm/janus/${channel}/clear/`, {});
}

export const janusApi = {
  // Public (legacy - default channel)
  getConversation,
  submitQuery,
  // GM (legacy - default channel)
  switchMode,
  setLocation,
  sendMessage,
  generateResponse,
  getPending,
  approveResponse,
  rejectResponse,
  clearConversation,
  switchToJanus,
  toggleDialog,
  // Channel-aware (new multi-channel API)
  getChannels,
  getChannelConversation,
  submitChannelQuery,
  sendChannelMessage,
  markChannelRead,
  getChannelPending,
  approveChannelResponse,
  rejectChannelResponse,
  generateChannelResponse,
  clearChannelConversation,
};
