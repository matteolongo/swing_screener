import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDefaultTradingStore,
  listWatchlistLocal,
  readTradingStore,
  resetTradingStore,
  TRADING_STORE_SCHEMA_VERSION,
  TRADING_STORE_STORAGE_KEY,
  unwatchSymbolLocal,
  watchSymbolLocal,
} from '@/features/persistence';

describe('watchlist local persistence service', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PERSISTENCE_MODE', 'local');
    vi.stubEnv('VITE_ENABLE_LOCAL_PERSISTENCE', 'true');
    resetTradingStore();
  });

  it('migrates legacy v1 store to v2 with empty watchlist', () => {
    const now = new Date('2026-03-06T08:00:00Z');
    const current = createDefaultTradingStore(now);
    const legacyStore = {
      version: 1,
      updatedAt: current.updatedAt,
      strategies: current.strategies,
      activeStrategyId: current.activeStrategyId,
      orders: current.orders,
      positions: current.positions,
    };
    window.localStorage.setItem(TRADING_STORE_STORAGE_KEY, JSON.stringify(legacyStore));

    const migrated = readTradingStore();
    expect(migrated.version).toBe(TRADING_STORE_SCHEMA_VERSION);
    expect(migrated.watchlist).toEqual([]);
  });

  it('stores and removes watchlist items', () => {
    const watched = watchSymbolLocal({
      ticker: 'aapl',
      watchPrice: 182.45,
      currency: 'usd',
      source: 'screener',
    });

    expect(watched.ticker).toBe('AAPL');
    expect(watched.watchPrice).toBe(182.45);
    expect(watched.currency).toBe('USD');
    expect(watched.source).toBe('screener');
    expect(listWatchlistLocal()).toHaveLength(1);

    // Idempotent create: second watch returns existing item.
    const watchedAgain = watchSymbolLocal({
      ticker: 'AAPL',
      watchPrice: 190,
      currency: 'USD',
      source: 'daily_review_candidates',
    });
    expect(watchedAgain.watchedAt).toBe(watched.watchedAt);
    expect(listWatchlistLocal()).toHaveLength(1);

    expect(unwatchSymbolLocal('AAPL')).toBe(true);
    expect(listWatchlistLocal()).toHaveLength(0);
    expect(unwatchSymbolLocal('AAPL')).toBe(false);
  });
});

