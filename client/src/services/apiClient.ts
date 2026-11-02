import axios, { type AxiosRequestConfig } from 'axios';
import type { FieldError } from '../types';

const TOKEN_KEY = 'hl.auth.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiRequestError extends Error {
  readonly status?: number;
  readonly code: string;
  readonly fieldErrors: FieldError[];

  constructor(message: string, code: string, status?: number, fieldErrors: FieldError[] = []) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** Per-field messages for the inline errors a form shows under its inputs. */
  errorFor(field: string): string | undefined {
    return this.fieldErrors.find((entry) => entry.field === field)?.message;
  }
}

/**
 * Same origin by default so the dev proxy and a reverse proxy in production both work. Set
 * VITE_API_BASE_URL when the API is deployed on its own host.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '') || '/api/v1';

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Calls the API and unwraps the server's { success, data } envelope. */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await api.request<{ success: boolean; data: T }>(config);
    return response.data.data;
  } catch (err) {
    throw normalizeError(err);
  }
}

function normalizeError(err: unknown): ApiRequestError {
  if (err instanceof ApiRequestError) return err;

  if (axios.isAxiosError(err)) {
    const body = err.response?.data as { error?: { code?: string; message?: string; details?: FieldError[] } } | undefined;
    return new ApiRequestError(
      body?.error?.message ?? 'Cannot reach the API. Check that the server is running.',
      body?.error?.code ?? 'NETWORK_ERROR',
      err.response?.status,
      body?.error?.details ?? []
    );
  }

  return new ApiRequestError(err instanceof Error ? err.message : 'Unexpected error', 'UNKNOWN_ERROR');
}
