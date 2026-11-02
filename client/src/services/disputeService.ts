import { request } from './apiClient';
import type { Dispute, DisputeReason } from '../types';

export interface NewDisputePayload {
  orderId: string;
  reason: DisputeReason;
  description: string;
}

export const disputeService = {
  async mine(): Promise<Dispute[]> {
    const data = await request<{ disputes: Dispute[] }>({ method: 'GET', url: '/disputes' });
    return data.disputes;
  },

  async get(id: string): Promise<Dispute> {
    const data = await request<{ dispute: Dispute }>({ method: 'GET', url: `/disputes/${id}` });
    return data.dispute;
  },

  async create(payload: NewDisputePayload, files: File[]): Promise<Dispute> {
    const form = new FormData();
    form.append('orderId', payload.orderId);
    form.append('reason', payload.reason);
    form.append('description', payload.description);
    files.forEach((file) => form.append('images', file));

    const data = await request<{ dispute: Dispute }>({ method: 'POST', url: '/disputes', data: form });
    return data.dispute;
  },

  async addEvidence(id: string, files: File[]): Promise<Dispute> {
    const form = new FormData();
    files.forEach((file) => form.append('images', file));

    const data = await request<{ dispute: Dispute }>({ method: 'POST', url: `/disputes/${id}/evidence`, data: form });
    return data.dispute;
  },

  async removeEvidence(id: string, publicId: string): Promise<Dispute> {
    const data = await request<{ dispute: Dispute }>({
      method: 'DELETE',
      url: `/disputes/${id}/evidence`,
      data: { publicId },
    });
    return data.dispute;
  },
};
