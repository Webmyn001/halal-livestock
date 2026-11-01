import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '../services/authService';
import { tokenStore } from '../services/apiClient';
import type { LoginPayload, RegisterPayload, User } from '../types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  updateProfile: (payload: { fullName?: string; phoneNumber?: string }) => Promise<User>;
  refresh: () => Promise<User | null>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // Restore the session from a stored token on first paint.
  useEffect(() => {
    if (!tokenStore.get()) {
      setStatus('unauthenticated');
      return;
    }

    let active = true;
    authService
      .me()
      .then((restored) => {
        if (!active) return;
        setUser(restored);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        tokenStore.clear();
        setStatus('unauthenticated');
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const session = await authService.login(payload);
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const session = await authService.register(payload);
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  const updateProfile = useCallback(async (payload: { fullName?: string; phoneNumber?: string }) => {
    const updated = await authService.updateProfile(payload);
    setUser(updated);
    return updated;
  }, []);

  // Verification changes happen server side, so the session is re-read rather than patched locally.
  const refresh = useCallback(async () => {
    if (!tokenStore.get()) return null;
    try {
      const current = await authService.me();
      setUser(current);
      setStatus('authenticated');
      return current;
    } catch {
      tokenStore.clear();
      setUser(null);
      setStatus('unauthenticated');
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, updateProfile, refresh, logout }),
    [status, user, login, register, updateProfile, refresh, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
