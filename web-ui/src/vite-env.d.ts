/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PERSISTENCE_MODE?: string;
  readonly VITE_ENABLE_LOCAL_PERSISTENCE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
