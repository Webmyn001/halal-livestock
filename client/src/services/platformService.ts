import { request } from './apiClient';
import type { PlatformInfo } from '../types';

export const platformService = {
  async info(): Promise<PlatformInfo> {
    const data = await request<{ settings: PlatformInfo }>({ method: 'GET', url: '/platform' });
    return data.settings;
  },
};
