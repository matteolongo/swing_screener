import {
  createDefaultTradingStore,
  isPersistedTradingStoreV1,
  TRADING_STORE_SCHEMA_VERSION,
  type PersistedTradingStore,
  type PersistedTradingStoreV1,
} from '@/features/persistence/schema';

export const TRADING_STORE_STORAGE_KEY = 'swing-screener.trading-store.v1';

function hasBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function cloneStore<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function persistStore(store: PersistedTradingStore): void {
  if (!hasBrowserStorage()) return;
  window.localStorage.setItem(TRADING_STORE_STORAGE_KEY, JSON.stringify(store));
}

function ensureDefaultStore(): PersistedTradingStoreV1 {
  const store = createDefaultTradingStore();
  persistStore(store);
  return store;
}

function migrateStore(raw: unknown): PersistedTradingStore {
  if (isPersistedTradingStoreV1(raw)) {
    return raw;
  }
  return createDefaultTradingStore();
}

export function readTradingStore(): PersistedTradingStore {
  if (!hasBrowserStorage()) {
    return createDefaultTradingStore();
  }

  const rawValue = window.localStorage.getItem(TRADING_STORE_STORAGE_KEY);
  if (!rawValue) {
    return ensureDefaultStore();
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    const migrated = migrateStore(parsed);
    if (migrated.version !== TRADING_STORE_SCHEMA_VERSION) {
      const fallback = createDefaultTradingStore();
      persistStore(fallback);
      return fallback;
    }
    if (!isPersistedTradingStoreV1(parsed)) {
      persistStore(migrated);
    }
    return cloneStore(migrated);
  } catch (error) {
    console.warn('Invalid trading store in localStorage. Resetting.', error);
    return ensureDefaultStore();
  }
}

export function writeTradingStore(store: PersistedTradingStore): PersistedTradingStore {
  const next: PersistedTradingStore = {
    ...cloneStore(store),
    version: TRADING_STORE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  persistStore(next);
  return cloneStore(next);
}

export function mutateTradingStore(
  mutator: (draft: PersistedTradingStore) => void,
): PersistedTradingStore {
  const current = readTradingStore();
  const draft = cloneStore(current);
  mutator(draft);
  return writeTradingStore(draft);
}

export function resetTradingStore(): PersistedTradingStore {
  return writeTradingStore(createDefaultTradingStore());
}
