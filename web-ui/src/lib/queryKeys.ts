import type { OrderFilterStatus, PositionFilterStatus } from '@/features/portfolio/api';

export const queryKeys = {
  strategies: () => ['strategies'] as const,
  strategyActive: () => ['strategy-active'] as const,
  strategyValidation: (payloadHash?: string | null) =>
    payloadHash == null ? (['strategy-validation'] as const) : (['strategy-validation', payloadHash] as const),
  dailyReview: (strategyId: string | null, topN: number, universe?: string | null) =>
    ['dailyReview', strategyId, topN, universe ?? null] as const,
  orders: (status?: OrderFilterStatus) =>
    status == null ? (['orders'] as const) : (['orders', status] as const),
  positions: (status?: PositionFilterStatus | 'open') =>
    status == null ? (['positions'] as const) : (['positions', status] as const),
  positionMetrics: (positionId?: string) =>
    positionId == null ? (['position-metrics'] as const) : (['position-metrics', positionId] as const),
  portfolioSummary: () => ['portfolio-summary'] as const,
  positionStopSuggestion: (positionId?: string) =>
    ['positions', positionId, 'stop-suggestion'] as const,
};
