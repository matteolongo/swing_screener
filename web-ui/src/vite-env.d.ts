/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_AUTH_MODE?: 'csv' | 'managed';
  readonly VITE_AUTH_MANAGED_PROVIDER_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
