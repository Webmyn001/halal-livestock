import { request } from './apiClient';
import type { FarmerProfile, IdType } from '../types';

export interface KycPayload {
  farmName: string;
  businessName?: string;
  address: string;
  town: string;
  state: string;
  idType: IdType;
  idNumber: string;
  cacNumber?: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
}

function toForm(payload: KycPayload): FormData {
  const form = new FormData();
  form.append('farmName', payload.farmName);
  form.append('address', payload.address);
  form.append('town', payload.town);
  form.append('state', payload.state);
  form.append('idType', payload.idType);
  form.append('idNumber', payload.idNumber);
  form.append('bankName', payload.bankName);
  form.append('accountName', payload.accountName);
  form.append('accountNumber', payload.accountNumber);
  if (payload.businessName) form.append('businessName', payload.businessName);
  if (payload.cacNumber) form.append('cacNumber', payload.cacNumber);
  return form;
}

export const kycService = {
  async submit(payload: KycPayload, document?: File | null): Promise<{ farmerProfile: FarmerProfile }> {
    const form = toForm(payload);
    if (document) form.append('document', document);

    return request<{ farmerProfile: FarmerProfile }>({ method: 'POST', url: '/kyc', data: form });
  },

  async withdrawDocument(): Promise<{ farmerProfile: FarmerProfile }> {
    return request<{ farmerProfile: FarmerProfile }>({ method: 'DELETE', url: '/kyc/document' });
  },
};
