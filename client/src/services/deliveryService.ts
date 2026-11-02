import { request } from './apiClient';
import type { Order } from '../types';

export interface Driver {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string;
}

export const deliveryService = {
  async mine(): Promise<Order[]> {
    const data = await request<{ deliveries: Order[] }>({ method: 'GET', url: '/deliveries/mine' });
    return data.deliveries;
  },

  async drivers(): Promise<Driver[]> {
    const data = await request<{ drivers: Driver[] }>({ method: 'GET', url: '/deliveries/drivers' });
    return data.drivers;
  },

  async dispatch(orderId: string, driverId: string): Promise<Order> {
    const data = await request<{ order: Order }>({
      method: 'POST',
      url: `/deliveries/${orderId}/dispatch`,
      data: { driverId },
    });
    return data.order;
  },

  async submitCode(orderId: string, code: string): Promise<Order> {
    const data = await request<{ order: Order }>({ method: 'POST', url: `/deliveries/${orderId}/handover`, data: { code } });
    return data.order;
  },
};
