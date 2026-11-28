import { request } from './apiClient';
import type { Checkout, NewOrderPayload, Order, OrderPage, OrderStatus } from '../types';

export const MAX_ORDER_QUANTITY = 100_000;

export interface OrderListFilters {
  scope?: 'buyer' | 'farmer';
  status?: OrderStatus;
  page?: number;
  limit?: number;
}

function params(filters: OrderListFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (filters.scope) out.scope = filters.scope;
  if (filters.status) out.status = filters.status;
  if (filters.page && filters.page > 1) out.page = filters.page;
  if (filters.limit) out.limit = filters.limit;
  return out;
}

export const orderService = {
  async list(filters: OrderListFilters): Promise<OrderPage> {
    return request<OrderPage>({ method: 'GET', url: '/orders', params: params(filters) });
  },

  async get(id: string): Promise<Order> {
    const data = await request<{ order: Order }>({ method: 'GET', url: `/orders/${id}` });
    return data.order;
  },

  async create(payload: NewOrderPayload): Promise<Order> {
    const data = await request<{ order: Order }>({ method: 'POST', url: '/orders', data: payload });
    return data.order;
  },

  async startPayment(id: string): Promise<Checkout> {
    const data = await request<{ checkout: Checkout }>({ method: 'POST', url: `/orders/${id}/pay` });
    return data.checkout;
  },

  /** Asks the API to re check the provider, which is what turns an order into a held payment. */
  async checkPayment(id: string): Promise<{ order: Order; paid: boolean }> {
    return request<{ order: Order; paid: boolean }>({ method: 'POST', url: `/orders/${id}/payment-check` });
  },

  async accept(id: string): Promise<Order> {
    const data = await request<{ order: Order }>({ method: 'POST', url: `/orders/${id}/accept` });
    return data.order;
  },

  async cancel(id: string, reason: string): Promise<Order> {
    const data = await request<{ order: Order }>({ method: 'POST', url: `/orders/${id}/cancel`, data: { reason } });
    return data.order;
  },

  /** Buyer directly confirms receipt of the animals (no driver/code required). */
  async confirm(id: string): Promise<Order> {
    const data = await request<{ order: Order }>({ method: 'POST', url: `/orders/${id}/confirm` });
    return data.order;
  },

  async dispatch(id: string, payload: { etaValue: number; etaUnit: 'hours' | 'days'; note?: string }): Promise<Order> {
    const data = await request<{ order: Order }>({ method: 'POST', url: `/orders/${id}/dispatch`, data: payload });
    return data.order;
  },

  async remindPayout(id: string): Promise<void> {
    await request<{ success: boolean; message: string }>({ method: 'POST', url: `/orders/${id}/remind-payout` });
  },

  /** The test provider only: it marks the in memory checkout as paid and funds the order. */
  async completeMockPayment(reference: string): Promise<{ id: string; orderCode: string; status: string }> {
    const data = await request<{ order: { id: string; orderCode: string; status: string } }>({
      method: 'POST',
      url: '/payments/mock/complete',
      data: { reference },
    });
    return data.order;
  },
};
