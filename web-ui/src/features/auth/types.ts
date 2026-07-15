export type AuthRole = 'viewer' | 'admin';

export interface AuthUser {
  subject: string;
  email: string | null;
  display_name: string | null;
}

export interface AuthSessionResponse {
  authenticated: boolean;
  user?: AuthUser;
  role?: AuthRole;
  csrf_token?: string | null;
  issued_at?: number | null;
  expires_at?: number | null;
}
