/**
 * JANUS Terminal Types
 * Types for the interactive JANUS AI terminal system.
 */

export type JanusMode = 'DISPLAY' | 'QUERY';

export type JanusChannel = 'story' | 'bridge' | `encounter-${string}`;

export interface JanusMessage {
  message_id: string;
  role: 'user' | 'janus';
  content: string;
  timestamp: string;
  pending_approval?: boolean;
}

export interface JanusConversation {
  mode: JanusMode;
  janus_location_path: string;
  /** The actual location path JANUS is using (derived from encounter or explicit setting) */
  active_location_path: string;
  messages: JanusMessage[];
  updated_at: string;
}

export interface PendingResponse {
  pending_id: string;
  query_id: string;
  query: string;
  response: string;
  timestamp: string;
}

export interface JanusState {
  mode: JanusMode;
  messages: JanusMessage[];
  pendingResponses: PendingResponse[];
  isLoading: boolean;
  error: string | null;
}
