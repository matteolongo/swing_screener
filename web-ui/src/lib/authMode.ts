export type AuthMode = 'csv' | 'managed';

export const AUTH_MODE: AuthMode =
  import.meta.env.VITE_AUTH_MODE === 'managed' ? 'managed' : 'csv';

export const MANAGED_PROVIDER_LABEL =
  import.meta.env.VITE_AUTH_MANAGED_PROVIDER_LABEL || 'Identity Provider';
