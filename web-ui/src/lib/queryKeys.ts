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
  degiroStatus: () => ['degiro-status'] as const,
  degiroOrderHistory: () => ['degiro-order-history'] as const,
  positionMetrics: (positionId?: string) =>
    positionId == null ? (['position-metrics'] as const) : (['position-metrics', positionId] as const),
  portfolioSummary: () => ['portfolio-summary'] as const,
  positionStopSuggestion: (positionId?: string) =>
    ['positions', positionId, 'stop-suggestion'] as const,
  positionStopPreview: (positionId: string) =>
    ['positions', positionId, 'stop-preview'] as const,
  watchlist: () => ['watchlist'] as const,
  watchlistPipeline: () => ['watchlist-pipeline'] as const,
  fundamentalsSnapshot: (symbol?: string, refresh?: boolean) =>
    ['fundamentals-snapshot', symbol ?? null, refresh ?? false] as const,
  calendarEvents: (daysAhead?: number) =>
    ['calendar-events', daysAhead ?? 30] as const,
  openPositionsIntelligence: () => ['openPositionsIntelligence'] as const,
};
