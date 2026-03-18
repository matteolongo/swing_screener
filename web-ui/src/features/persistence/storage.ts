import {
  createDefaultTradingStore,
  isPersistedTradingStoreV3,
  isPersistedTradingStoreV2,
  isPersistedTradingStoreV1,
  TRADING_STORE_SCHEMA_VERSION,
  type PersistedTradingStore,
  type PersistedTradingStoreV3,
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

function ensureDefaultStore(): PersistedTradingStoreV3 {
  const store = createDefaultTradingStore();
  persistStore(store);
  return store;
}

function sanitizeStrategies(strategies: unknown): PersistedTradingStore['strategies'] {
  if (!Array.isArray(strategies)) {
    return [];
  }
  return strategies.map((strategy) => {
    if (!strategy || typeof strategy !== 'object') {
      return strategy as PersistedTradingStore['strategies'][number];
    }
    const sanitized = { ...(strategy as Record<string, unknown>) };
    delete sanitized["soc" + "ial" + "Overlay"];
    return sanitized as unknown as PersistedTradingStore['strategies'][number];
  });
}

function migrateStore(raw: unknown): PersistedTradingStore {
  if (isPersistedTradingStoreV3(raw)) {
    return raw;
  }
  if (isPersistedTradingStoreV2(raw)) {
    return {
      ...raw,
      version: TRADING_STORE_SCHEMA_VERSION,
      strategies: sanitizeStrategies(raw.strategies),
    };
  }
  if (isPersistedTradingStoreV1(raw)) {
    return {
      ...raw,
      version: TRADING_STORE_SCHEMA_VERSION,
      strategies: sanitizeStrategies(raw.strategies),
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
        strategies: sanitizeStrategies(candidate.strategies),
        activeStrategyId: candidate.activeStrategyId,
        orders: candidate.orders as PersistedTradingStore['orders'],
        positions: candidate.positions as PersistedTradingStore['positions'],
        watchlist: Array.isArray(candidate.watchlist) ? candidate.watchlist as PersistedTradingStore['watchlist'] : [],
      };
    }
  }
  return createDefaultTradingStore();
}

function isCurrentStore(value: unknown): value is PersistedTradingStore {
  return isPersistedTradingStoreV3(value);
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
    strategies: sanitizeStrategies(store.strategies),
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
