import { request, tokenStore } from './apiClient';
import type { LoginPayload, RegisterPayload, Session, User } from '../types';

export const authService = {
  async register(payload: RegisterPayload): Promise<Session> {
    const data = await request<Session>({ method: 'POST', url: '/auth/register', data: payload });
    tokenStore.set(data.token);
    return data;
  },

  async login(payload: LoginPayload): Promise<Session> {
    const data = await request<Session>({ method: 'POST', url: '/auth/login', data: payload });
    tokenStore.set(data.token);
    return data;
  },

  async me(): Promise<User> {
    const data = await request<{ user: User }>({ method: 'GET', url: '/auth/me' });
    return data.user;
  },

  async updateProfile(payload: { fullName?: string; phoneNumber?: string }): Promise<User> {
    const data = await request<{ user: User }>({ method: 'PUT', url: '/users/profile', data: payload });
    return data.user;
  },

  async verifyEmail(token: string): Promise<void> {
    await request({ method: 'POST', url: '/auth/verify-email', data: { token } });
  },

  /** Returns 202 whether or not the account exists, so the UI cannot confirm one. */
  async resendVerification(identifier: string): Promise<void> {
    await request({ method: 'POST', url: '/auth/resend-verification', data: { identifier } });
  },

  async forgotPassword(identifier: string): Promise<void> {
    await request({ method: 'POST', url: '/auth/forgot-password', data: { identifier } });
  },

  async resetPassword(token: string, password: string): Promise<void> {
    await request({ method: 'POST', url: '/auth/reset-password', data: { token, password } });
  },

  logout(): void {
    tokenStore.clear();
  },
};
