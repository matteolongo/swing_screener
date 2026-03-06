import type { Order } from '@/features/portfolio/types';
import type { Position } from '@/features/portfolio/types';
import type { Strategy } from '@/features/strategy/types';

export const TRADING_STORE_SCHEMA_VERSION = 2 as const;
const LEGACY_TRADING_STORE_SCHEMA_VERSION = 1 as const;

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
  version: typeof TRADING_STORE_SCHEMA_VERSION;
  updatedAt: string;
  strategies: Strategy[];
  activeStrategyId: string;
  orders: Order[];
  positions: Position[];
  watchlist: PersistedWatchItem[];
}

export type PersistedTradingStore = PersistedTradingStoreV2;

export const DEFAULT_STRATEGY_ID = 'default';

export function createDefaultStrategy(now: Date = new Date()): Strategy {
  const timestamp = now.toISOString();
  return {
    id: DEFAULT_STRATEGY_ID,
    name: 'Default',
    description: 'Default strategy seeded from current system settings.',
    module: 'momentum',
    universe: {
      trend: { smaFast: 20, smaMid: 50, smaLong: 200 },
      vol: { atrWindow: 14 },
      mom: { lookback6m: 126, lookback12m: 252, benchmark: 'SPY' },
      filt: {
        minPrice: 5.0,
        maxPrice: 500.0,
        maxAtrPct: 15.0,
        requireTrendOk: true,
        requireRsPositive: false,
        currencies: ['USD', 'EUR'],
      },
    },
    ranking: {
      wMom6m: 0.45,
      wMom12m: 0.35,
      wRs6m: 0.2,
      topN: 100,
    },
    signals: {
      breakoutLookback: 50,
      pullbackMa: 20,
      minHistory: 260,
    },
    risk: {
      accountSize: 50000,
      riskPct: 0.01,
      maxPositionPct: 0.6,
      minShares: 1,
      kAtr: 2.0,
      minRr: 2.0,
      rrTarget: 2.0,
      commissionPct: 0.0,
      maxFeeRiskPct: 0.2,
      regimeEnabled: false,
      regimeTrendSma: 200,
      regimeTrendMultiplier: 0.5,
      regimeVolAtrWindow: 14,
      regimeVolAtrPctThreshold: 6.0,
      regimeVolMultiplier: 0.5,
    },
    manage: {
      breakevenAtR: 1.0,
      trailAfterR: 2.0,
      trailSma: 20,
      smaBufferPct: 0.005,
      maxHoldingDays: 20,
      benchmark: 'SPY',
    },
    socialOverlay: {
      enabled: false,
      lookbackHours: 24,
      attentionZThreshold: 3.0,
      minSampleSize: 20,
      negativeSentThreshold: -0.4,
      sentimentConfThreshold: 0.7,
      hypePercentileThreshold: 95.0,
      providers: ['reddit'],
      sentimentAnalyzer: 'keyword',
    },
    marketIntelligence: {
      enabled: false,
      providers: ['yahoo_finance'],
      universeScope: 'screener_universe',
      marketContextSymbols: ['SPY', 'QQQ', 'XLK', 'SMH', 'XBI'],
      llm: {
        enabled: false,
        provider: 'ollama',
        model: 'mistral:7b-instruct',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
        enableCache: true,
        enableAudit: true,
        cachePath: 'data/intelligence/llm_cache.json',
        auditPath: 'data/intelligence/llm_audit',
        maxConcurrency: 4,
      },
      catalyst: {
        lookbackHours: 72,
        recencyHalfLifeHours: 36,
        falseCatalystReturnZ: 1.5,
        minPriceReactionAtr: 0.8,
        requirePriceConfirmation: true,
      },
      theme: {
        enabled: true,
        minClusterSize: 3,
        minPeerConfirmation: 2,
        curatedPeerMapPath: 'data/intelligence/peer_map.yaml',
      },
      opportunity: {
        technicalWeight: 0.55,
        catalystWeight: 0.45,
        maxDailyOpportunities: 8,
        minOpportunityScore: 0.55,
      },
    },
    isDefault: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createDefaultTradingStore(now: Date = new Date()): PersistedTradingStoreV2 {
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

function isPersistedWatchItem(value: unknown): value is PersistedWatchItem {
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
