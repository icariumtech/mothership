export interface Message {
  id: number;
  sender: string;
  content: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  created_at: string;
}

export interface MessageResponse {
  messages: Message[];
  count: number;
}
