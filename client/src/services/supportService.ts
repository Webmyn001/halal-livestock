import { request } from './apiClient';
import type { Complaint, ComplaintPayload } from '../types';

export const supportService = {
  async submit(payload: ComplaintPayload): Promise<Complaint> {
    const data = await request<{ complaint: Complaint }>({ method: 'POST', url: '/support/complaints', data: payload });
    return data.complaint;
  },

  async listMine(): Promise<Complaint[]> {
    const data = await request<{ complaints: Complaint[] }>({ method: 'GET', url: '/support/complaints' });
    return data.complaints;
  },
};
