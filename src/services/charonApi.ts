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

export const charonApi = {
  // Public
  getConversation,
  submitQuery,
  // GM
  switchMode,
  setLocation,
  sendMessage,
  generateResponse,
  getPending,
  approveResponse,
  rejectResponse,
  clearConversation,
  switchToCharon,
};
