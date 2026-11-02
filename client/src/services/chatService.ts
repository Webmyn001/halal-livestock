import { request } from './apiClient';
import type { ChatMessage, ChatThread, ThreadSummary } from '../types';

export interface ThreadWithMessages {
  thread: ThreadSummary;
  order: { id: string; orderCode: string; status: string } | null;
  messages: ChatMessage[];
}

export const chatService = {
  async threads(): Promise<ThreadSummary[]> {
    const data = await request<{ threads: ThreadSummary[] }>({ method: 'GET', url: '/conversations' });
    return data.threads;
  },

  async read(id: string): Promise<ThreadWithMessages> {
    return request<ThreadWithMessages>({ method: 'GET', url: `/conversations/${id}` });
  },

  async send(id: string, body: string): Promise<ChatMessage> {
    const data = await request<{ message: ChatMessage }>({
      method: 'POST',
      url: `/conversations/${id}/messages`,
      data: { body },
    });
    return data.message;
  },

  /** The thread lives on the order page, so the id is looked up from there. */
  async forOrder(orderId: string): Promise<{ conversation: ChatThread; messages: ChatMessage[] }> {
    return request<{ conversation: ChatThread; messages: ChatMessage[] }>({
      method:
        'GET',
      url: `/orders/${orderId}/thread`,
    });
  },
};
