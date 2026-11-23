import { request } from './apiClient';
import type { AdminCounts, Complaint, Dispute, FarmerProfile, Order, PlatformInfo, Settlement, User } from '../types';

export interface KycQueueEntry {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  isEmailVerified: boolean;
  profile: (FarmerProfile & { documentPublicId?: string }) | null;
}

export interface ComplaintWithContact extends Complaint {
  reporterName: string;
  reporterEmail: string;
  reporterPhone?: string;
}

export type SettingsPatch = Omit<PlatformInfo, 'maintenanceNote'> & { maintenanceNote?: string };

export const adminService = {
  async counts(): Promise<AdminCounts> {
    const data = await request<{ counts: AdminCounts }>({ method: 'GET', url: '/admin/counts' });
    return data.counts;
  },

  async complaints(status?: string): Promise<ComplaintWithContact[]> {
    const data = await request<{ complaints: ComplaintWithContact[] }>({
      method: 'GET',
      url: '/admin/complaints',
      params: status ? { status } : {},
    });
    return data.complaints;
  },

  async reviewComplaint(id: string, status: string, response: string): Promise<Complaint> {
    const data = await request<{ complaint: Complaint }>({
      method: 'PATCH',
      url: `/admin/complaints/${id}`,
      data: { status, response },
    });
    return data.complaint;
  },

  async kycQueue(status: string): Promise<KycQueueEntry[]> {
    const data = await request<{ farmers: KycQueueEntry[] }>({ method: 'GET', url: '/admin/kyc', params: { status } });
    return data.farmers;
  },

  async reviewKyc(userId: string, decision: 'approved' | 'rejected', note: string): Promise<User> {
    const data = await request<{ farmer: User }>({ method: 'POST', url: `/admin/kyc/${userId}`, data: { decision, note } });
    return data.farmer;
  },

  async orders(status?: string): Promise<Order[]> {
    const data = await request<{ orders: Order[] }>({ method: 'GET', url: '/admin/orders', params: status ? { status } : {} });
    return data.orders;
  },

  async settlements(status?: string): Promise<Settlement[]> {
    const data = await request<{ settlements: Settlement[] }>({ method: 'GET', url: '/admin/settlements', params: status ? { status } : {} });
    return data.settlements;
  },

  async releaseSettlement(id: string, reference: string): Promise<Settlement> {
    const data = await request<{ settlement: Settlement }>({
      method: 'POST',
      url: `/admin/settlements/${id}/release`,
      data: { reference },
    });
    return data.settlement;
  },

  async disputes(status?: string): Promise<Dispute[]> {
    const data = await request<{ disputes: Dispute[] }>({ method: 'GET', url: '/admin/disputes', params: status ? { status } : {} });
    return data.disputes;
  },

  async ruleDispute(id: string, outcome: 'refund' | 'release', note: string): Promise<Dispute> {
    const data = await request<{ dispute: Dispute }>({ method: 'POST', url: `/admin/disputes/${id}/rule`, data: { outcome, note } });
    return data.dispute;
  },

  async moderateListing(id: string, action: 'restore' | 'remove', reason?: string): Promise<void> {
    await request<{ listing: unknown }>({ method: 'POST', url: `/admin/listings/${id}/moderate`, data: { action, reason } });
  },

  async deleteListing(id: string): Promise<void> {
    await request<{ success: boolean }>({ method: 'DELETE', url: `/admin/listings/${id}` });
  },

  async users(params: { role?: string; q?: string }): Promise<User[]> {
    const data = await request<{ users: User[] }>({ method: 'GET', url: '/admin/users', params });
    return data.users;
  },

  async settings(): Promise<PlatformInfo> {
    const data = await request<{ settings: PlatformInfo }>({ method: 'GET', url: '/admin/settings' });
    return data.settings;
  },

  async saveSettings(patch: SettingsPatch): Promise<PlatformInfo> {
    const data = await request<{ settings: PlatformInfo }>({ method: 'PUT', url: '/admin/settings', data: patch });
    return data.settings;
  },
};
