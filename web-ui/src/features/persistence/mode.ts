export type PersistenceMode = 'local' | 'api';

function parseBooleanEnv(value: unknown): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function getPersistenceMode(): PersistenceMode {
  const configured = String(import.meta.env.VITE_PERSISTENCE_MODE || '').trim().toLowerCase();
  const localOptIn = parseBooleanEnv(import.meta.env.VITE_ENABLE_LOCAL_PERSISTENCE);

  // Default to API-backed persistence unless local mode is explicitly and safely enabled.
  if (configured === 'local' && localOptIn) {
    return 'local';
  }
  return 'api';
}

export function isLocalPersistenceMode(): boolean {
  return getPersistenceMode() === 'local';
}
