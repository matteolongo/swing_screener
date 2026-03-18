import type { Order } from '@/features/portfolio/types';
import type { Position } from '@/features/portfolio/types';
import defaultStrategyFixtureApi from '@/features/persistence/defaultStrategyFixture.json';
import { transformStrategy, type Strategy, type StrategyAPI } from '@/features/strategy/types';

export const TRADING_STORE_SCHEMA_VERSION = 3 as const;
const LEGACY_TRADING_STORE_SCHEMA_VERSION = 1 as const;
const LEGACY_TRADING_STORE_WITH_WATCHLIST_SCHEMA_VERSION = 2 as const;

export interface PersistedWatchItem {
  ticker: string;
  watchedAt: string;
  watchPrice: number | null;
  currency: string | null;
  source: string;
}

export interface PersistedTradingStoreV1 {
  version: typeof LEGACY_TRADING_STORE_SCHEMA_VERSION;
  updatedAt: string;
  strategies: Strategy[];
  activeStrategyId: string;
  orders: Order[];
  positions: Position[];
}

export interface PersistedTradingStoreV2 {
  version: typeof LEGACY_TRADING_STORE_WITH_WATCHLIST_SCHEMA_VERSION;
  updatedAt: string;
  strategies: Strategy[];
  activeStrategyId: string;
  orders: Order[];
  positions: Position[];
  watchlist: PersistedWatchItem[];
}

export interface PersistedTradingStoreV3 {
  version: typeof TRADING_STORE_SCHEMA_VERSION;
  updatedAt: string;
  strategies: Strategy[];
  activeStrategyId: string;
  orders: Order[];
  positions: Position[];
  watchlist: PersistedWatchItem[];
}

export type PersistedTradingStore = PersistedTradingStoreV3;

export const DEFAULT_STRATEGY_ID = 'default';
const DEFAULT_STRATEGY_FIXTURE = transformStrategy(defaultStrategyFixtureApi as StrategyAPI);

function cloneDefaultStrategyFixture(): Strategy {
  return JSON.parse(JSON.stringify(DEFAULT_STRATEGY_FIXTURE)) as Strategy;
}

export function createDefaultStrategy(now: Date = new Date()): Strategy {
  const timestamp = now.toISOString();
  return {
    ...cloneDefaultStrategyFixture(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createDefaultTradingStore(now: Date = new Date()): PersistedTradingStoreV3 {
  return {
    version: TRADING_STORE_SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    strategies: [createDefaultStrategy(now)],
    activeStrategyId: DEFAULT_STRATEGY_ID,
    orders: [],
    positions: [],
    watchlist: [],
  };
}

export function isPersistedTradingStoreV1(value: unknown): value is PersistedTradingStoreV1 {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === LEGACY_TRADING_STORE_SCHEMA_VERSION &&
    typeof candidate.updatedAt === 'string' &&
    Array.isArray(candidate.strategies) &&
    typeof candidate.activeStrategyId === 'string' &&
    Array.isArray(candidate.orders) &&
    Array.isArray(candidate.positions)
  );
}

export function isPersistedWatchItem(value: unknown): value is PersistedWatchItem {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.ticker === 'string' &&
    typeof candidate.watchedAt === 'string' &&
    (candidate.watchPrice == null || typeof candidate.watchPrice === 'number') &&
    (candidate.currency == null || typeof candidate.currency === 'string') &&
    typeof candidate.source === 'string'
  );
}

export function isPersistedTradingStoreV2(value: unknown): value is PersistedTradingStoreV2 {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === LEGACY_TRADING_STORE_WITH_WATCHLIST_SCHEMA_VERSION &&
    typeof candidate.updatedAt === 'string' &&
    Array.isArray(candidate.strategies) &&
    typeof candidate.activeStrategyId === 'string' &&
    Array.isArray(candidate.orders) &&
    Array.isArray(candidate.positions) &&
    Array.isArray(candidate.watchlist) &&
    candidate.watchlist.every(isPersistedWatchItem)
  );
}

export function isPersistedTradingStoreV3(value: unknown): value is PersistedTradingStoreV3 {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.version === TRADING_STORE_SCHEMA_VERSION &&
    typeof candidate.updatedAt === 'string' &&
    Array.isArray(candidate.strategies) &&
    typeof candidate.activeStrategyId === 'string' &&
    Array.isArray(candidate.orders) &&
    Array.isArray(candidate.positions) &&
    Array.isArray(candidate.watchlist) &&
    candidate.watchlist.every(isPersistedWatchItem)
  );
}
