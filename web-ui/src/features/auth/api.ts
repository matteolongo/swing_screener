import { API_ENDPOINTS, apiFetch, apiUrl } from '@/lib/api';
import { AuthUser } from '@/lib/auth';

interface LoginResponseApi {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
  user: {
    email: string;
    tenant_id: string;
    role: string;
    active: boolean;
  };
}

export interface LoginResult {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await fetch(apiUrl(API_ENDPOINTS.authLogin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Login failed');
  }

  const payload: LoginResponseApi = await response.json();
  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type,
    expiresInSeconds: payload.expires_in_seconds,
    user: {
      email: payload.user.email,
      tenantId: payload.user.tenant_id,
      role: payload.user.role,
      active: payload.user.active,
    },
  };
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await apiFetch(API_ENDPOINTS.authMe, { skipAuthRedirect: true });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load current user');
  }
  const payload: LoginResponseApi["user"] = await response.json();
  return {
    email: payload.email,
    tenantId: payload.tenant_id,
    role: payload.role,
    active: payload.active,
  };
}

