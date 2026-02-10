/**
 * CHARON Terminal API Service
 * Handles all API calls for the CHARON interactive terminal.
 */
import { api } from './api';
import type { CharonConversation, CharonMode, PendingResponse } from '@/types/charon';

// Public endpoints (for shared terminal)

async function getConversation(): Promise<CharonConversation> {
  const response = await api.get<CharonConversation>('/charon/conversation/');
  return response.data;
}

async function submitQuery(query: string): Promise<{
  success: boolean;
  query_id: string;
  pending_id: string;
}> {
  const response = await api.post('/charon/submit-query/', { query });
  return response.data;
}

// GM endpoints

async function switchMode(mode: CharonMode): Promise<void> {
  await api.post('/gm/charon/mode/', { mode });
}

async function setLocation(locationPath: string): Promise<void> {
  await api.post('/gm/charon/location/', { location_path: locationPath });
}

async function sendMessage(content: string): Promise<{ message_id: string }> {
  const response = await api.post<{ success: boolean; message_id: string }>(
    '/gm/charon/send/',
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
  }>('/gm/charon/generate/', { prompt });
  return response.data;
}

async function getPending(): Promise<{ pending: PendingResponse[] }> {
  const response = await api.get<{ pending: PendingResponse[] }>('/gm/charon/pending/');
  return response.data;
}

async function approveResponse(
  pendingId: string,
  modifiedContent?: string
): Promise<void> {
  await api.post('/gm/charon/approve/', {
    pending_id: pendingId,
    modified_content: modifiedContent,
  });
}

async function rejectResponse(pendingId: string): Promise<void> {
  await api.post('/gm/charon/reject/', { pending_id: pendingId });
}

async function clearConversation(): Promise<void> {
  await api.post('/gm/charon/clear/', {});
}

async function switchToCharon(): Promise<void> {
  await api.post('/gm/switch-view/', { view_type: 'CHARON_TERMINAL' });
}

async function toggleDialog(open?: boolean): Promise<{ charon_dialog_open: boolean }> {
  const response = await api.post<{ success: boolean; charon_dialog_open: boolean }>(
    '/gm/charon/toggle-dialog/',
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
  const response = await api.get('/gm/charon/channels/');
  return response.data;
}

async function getChannelConversation(channel: string): Promise<{
  channel: string;
  mode: CharonMode;
  messages: any[];
}> {
  const response = await api.get(`/charon/${channel}/conversation/`);
  return response.data;
}

async function submitChannelQuery(channel: string, query: string): Promise<{
  success: boolean;
  query_id: string;
  pending_id: string;
}> {
  const response = await api.post(`/charon/${channel}/submit/`, { query });
  return response.data;
}

async function sendChannelMessage(channel: string, content: string): Promise<{
  success: boolean;
  message_id: string;
  channel: string;
}> {
  const response = await api.post(`/gm/charon/${channel}/send/`, { content });
  return response.data;
}

async function markChannelRead(channel: string): Promise<void> {
  await api.post(`/gm/charon/${channel}/mark-read/`, {});
}

async function getChannelPending(channel: string): Promise<{
  channel: string;
  pending: PendingResponse[];
  count: number;
}> {
  const response = await api.get(`/gm/charon/${channel}/pending/`);
  return response.data;
}

async function approveChannelResponse(
  channel: string,
  pendingId: string,
  modifiedContent?: string
): Promise<void> {
  await api.post(`/gm/charon/${channel}/approve/`, {
    pending_id: pendingId,
    modified_content: modifiedContent,
  });
}

async function rejectChannelResponse(channel: string, pendingId: string): Promise<void> {
  await api.post(`/gm/charon/${channel}/reject/`, { pending_id: pendingId });
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
  const response = await api.post(`/gm/charon/${channel}/generate/`, {
    prompt,
    context_override: contextOverride || '',
  });
  return response.data;
}

async function clearChannelConversation(channel: string): Promise<void> {
  await api.post(`/gm/charon/${channel}/clear/`, {});
}

export const charonApi = {
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
  switchToCharon,
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
