import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import { apiFetch, setCsrfToken, subscribeAuthExpired } from '@/lib/apiFetch';
import type { AuthRole, AuthSessionResponse, AuthUser } from './types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  role: AuthRole | null;
  login(): void;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AuthRole | null>(null);

  const becomeAnonymous = useCallback(() => {
    setCsrfToken(null);
    setUser(null);
    setRole(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    let active = true;
    apiFetch(API_ENDPOINTS.authSession)
      .then(async (response) => {
        if (!response.ok) throw new Error('Session bootstrap failed');
        return response.json() as Promise<AuthSessionResponse>;
      })
      .then((session) => {
        if (!active) return;
        if (!session.authenticated || !session.user || !session.role) {
          becomeAnonymous();
          return;
        }
        setCsrfToken(session.csrf_token ?? null);
        setUser(session.user);
        setRole(session.role);
        setStatus('authenticated');
      })
      .catch(() => { if (active) becomeAnonymous(); });
    const unsubscribe = subscribeAuthExpired(() => { if (active) becomeAnonymous(); });
    return () => { active = false; unsubscribe(); };
  }, [becomeAnonymous]);

  const login = useCallback(() => {
    window.location.assign(apiUrl(API_ENDPOINTS.authLogin));
  }, []);

  const logout = useCallback(async () => {
    await apiFetch(API_ENDPOINTS.authLogout, { method: 'POST' });
    becomeAnonymous();
  }, [becomeAnonymous]);

  const value = useMemo(
    () => ({ status, user, role, login, logout }),
    [status, user, role, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
