/**
 * CHARON Terminal Types
 * Types for the interactive CHARON AI terminal system.
 */

export type CharonMode = 'DISPLAY' | 'QUERY';

export interface CharonMessage {
  message_id: string;
  role: 'user' | 'charon';
  content: string;
  timestamp: string;
  pending_approval?: boolean;
}

export interface CharonConversation {
  mode: CharonMode;
  charon_location_path: string;
  /** The actual location path CHARON is using (derived from encounter or explicit setting) */
  active_location_path: string;
  messages: CharonMessage[];
  updated_at: string;
}

export interface PendingResponse {
  pending_id: string;
  query_id: string;
  query: string;
  response: string;
  timestamp: string;
}

export interface CharonState {
  mode: CharonMode;
  messages: CharonMessage[];
  pendingResponses: PendingResponse[];
  isLoading: boolean;
  error: string | null;
}
