export type PersistenceMode = 'local' | 'api';

export function getPersistenceMode(): PersistenceMode {
  const configured = String(import.meta.env.VITE_PERSISTENCE_MODE || '').trim().toLowerCase();
  if (configured === 'api') {
    return 'api';
  }
  return 'local';
}

export function isLocalPersistenceMode(): boolean {
  return getPersistenceMode() === 'local';
}
