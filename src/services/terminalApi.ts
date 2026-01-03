/**
 * Terminal API Service
 * Handles API calls for comm terminal data and messages.
 */
import { api } from './api';

export interface TerminalMessage {
  message_id: string;
  subject: string;
  from: string;
  to: string;
  content: string;
  timestamp: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  read: boolean;
  folder: 'inbox' | 'sent';
  contact: string;
  conversation_id: string;
  in_reply_to: string;
}

export interface TerminalData {
  slug: string;
  owner: string;
  terminal_id: string;
  access_level: 'PUBLIC' | 'RESTRICTED' | 'CLASSIFIED';
  description: string;
  location_name: string;
  inbox: TerminalMessage[];
  sent: TerminalMessage[];
}

/**
 * Get terminal data including messages
 */
async function getTerminalData(locationSlug: string, terminalSlug: string): Promise<TerminalData> {
  const response = await api.get<TerminalData>(`/terminal/${locationSlug}/${terminalSlug}/`);
  return response.data;
}

/**
 * Show terminal overlay (GM only)
 */
async function showTerminal(locationSlug: string, terminalSlug: string): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean; overlay_terminal_slug: string }>(
    '/gm/show-terminal/',
    { location_slug: locationSlug, terminal_slug: terminalSlug }
  );
  return response.data;
}

/**
 * Hide terminal overlay (public - can be called by players)
 */
async function hideTerminal(): Promise<{ success: boolean }> {
  const response = await api.post<{ success: boolean }>(
    '/terminal/hide/',
    {}
  );
  return response.data;
}

export const terminalApi = {
  getTerminalData,
  showTerminal,
  hideTerminal,
};
