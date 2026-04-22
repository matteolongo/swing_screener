import type { OrderFilterStatus, PositionFilterStatus } from '@/features/portfolio/api';

export const queryKeys = {
  config: () => ['config'] as const,
  configDefaults: () => ['config-defaults'] as const,
  strategies: () => ['strategies'] as const,
  strategyActive: () => ['strategy-active'] as const,
  strategyValidation: (payloadHash?: string | null) =>
    payloadHash == null ? (['strategy-validation'] as const) : (['strategy-validation', payloadHash] as const),
  universes: () => ['universes'] as const,
  universeDetail: (id?: string | null) => ['universe-detail', id ?? null] as const,
  dailyReview: (topN: number, universe?: string | null) => ['dailyReview', topN, universe ?? null] as const,
  orders: (status?: OrderFilterStatus) =>
    status == null ? (['orders'] as const) : (['orders', status] as const),
  positions: (status?: PositionFilterStatus | 'open') =>
    status == null ? (['positions'] as const) : (['positions', status] as const),
  positionMetrics: (positionId?: string) =>
    positionId == null ? (['position-metrics'] as const) : (['position-metrics', positionId] as const),
  portfolioSummary: () => ['portfolio-summary'] as const,
  degiroStatus: () => ['degiro-status'] as const,
  positionStopSuggestion: (positionId?: string) =>
    ['positions', positionId, 'stop-suggestion'] as const,
  intelligenceConfig: () => ['intelligence-config'] as const,
  intelligenceProviders: () => ['intelligence-providers'] as const,
  intelligenceSymbolSets: () => ['intelligence-symbol-sets'] as const,
  watchlist: () => ['watchlist'] as const,
  intelligenceRunStatus: (jobId?: string) => ['intelligence-run-status', jobId] as const,
  intelligenceOpportunities: (asofDate?: string, symbolScope?: string) =>
    ['intelligence-opportunities', asofDate, symbolScope] as const,
  intelligenceEvents: (asofDate?: string, symbolScope?: string, eventScope?: string, minMateriality?: number) =>
    ['intelligence-events', asofDate, symbolScope, eventScope, minMateriality ?? null] as const,
  intelligenceUpcomingCatalysts: (asofDate?: string, symbolScope?: string, daysAhead?: number) =>
    ['intelligence-upcoming-catalysts', asofDate, symbolScope, daysAhead ?? 14] as const,
  intelligenceSourcesHealth: () => ['intelligence-sources-health'] as const,
  intelligenceMetrics: (asofDate?: string) => ['intelligence-metrics', asofDate] as const,
  intelligenceEducation: (symbol?: string, asofDate?: string) =>
    ['intelligence-education', symbol, asofDate] as const,
  fundamentalsConfig: () => ['fundamentals-config'] as const,
  fundamentalsSnapshot: (symbol?: string, refresh?: boolean) =>
    ['fundamentals-snapshot', symbol ?? null, refresh ?? false] as const,
  fundamentalsWarmupStatus: (jobId?: string) => ['fundamentals-warmup-status', jobId] as const,
  symbolHistory: (ticker?: string) => ['symbol-history', ticker ?? null] as const,
};
