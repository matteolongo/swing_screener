import {
  createDefaultTradingStore,
  isPersistedTradingStoreV2,
  isPersistedTradingStoreV1,
  TRADING_STORE_SCHEMA_VERSION,
  type PersistedTradingStore,
  type PersistedTradingStoreV2,
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

function ensureDefaultStore(): PersistedTradingStoreV2 {
  const store = createDefaultTradingStore();
  persistStore(store);
  return store;
}

function migrateStore(raw: unknown): PersistedTradingStore {
  if (isPersistedTradingStoreV2(raw)) {
    return raw;
  }
  if (isPersistedTradingStoreV1(raw)) {
    return {
      ...raw,
      version: TRADING_STORE_SCHEMA_VERSION,
      watchlist: [],
    };
  }
  if (raw && typeof raw === 'object') {
    const candidate = raw as Record<string, unknown>;
    if (
      typeof candidate.updatedAt === 'string' &&
      Array.isArray(candidate.strategies) &&
      typeof candidate.activeStrategyId === 'string' &&
      Array.isArray(candidate.orders) &&
      Array.isArray(candidate.positions)
    ) {
      return {
        version: TRADING_STORE_SCHEMA_VERSION,
        updatedAt: candidate.updatedAt,
        strategies: candidate.strategies as PersistedTradingStore['strategies'],
        activeStrategyId: candidate.activeStrategyId,
        orders: candidate.orders as PersistedTradingStore['orders'],
        positions: candidate.positions as PersistedTradingStore['positions'],
        watchlist: [],
      };
    }
  }
  return createDefaultTradingStore();
}

function isCurrentStore(value: unknown): value is PersistedTradingStore {
  return isPersistedTradingStoreV2(value);
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
    if (!isCurrentStore(parsed)) {
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
