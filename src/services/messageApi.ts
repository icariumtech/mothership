import { api } from './api';
import { MessageResponse } from '@/types/message';

export async function getMessages(sinceId?: number): Promise<MessageResponse> {
  const params = sinceId ? { since: sinceId } : {};
  const response = await api.get<MessageResponse>('/messages/', { params });
  return response.data;
}

export const messageApi = {
  getMessages,
};
