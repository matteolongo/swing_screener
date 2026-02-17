import type { OrderFilterStatus, PositionFilterStatus } from '@/features/portfolio/api';

export const queryKeys = {
  strategies: () => ['strategies'] as const,
  strategyActive: () => ['strategy-active'] as const,
  universes: () => ['universes'] as const,
  dailyReview: (topN: number, universe?: string | null) => ['dailyReview', topN, universe ?? null] as const,
  orders: (status?: OrderFilterStatus) =>
    status == null ? (['orders'] as const) : (['orders', status] as const),
  ordersSnapshot: () => ['orders', 'snapshot'] as const,
  positions: (status?: PositionFilterStatus | 'open') =>
    status == null ? (['positions'] as const) : (['positions', status] as const),
  positionMetrics: (positionId?: string) =>
    positionId == null ? (['position-metrics'] as const) : (['position-metrics', positionId] as const),
  portfolioSummary: () => ['portfolio-summary'] as const,
  positionStopSuggestion: (positionId?: string) =>
    ['positions', positionId, 'stop-suggestion'] as const,
  backtestSimulations: () => ['backtest-simulations'] as const,
  socialWarmupStatus: (jobId?: string) => ['social-warmup', jobId] as const,
  intelligenceRunStatus: (jobId?: string) => ['intelligence-run-status', jobId] as const,
  intelligenceOpportunities: (asofDate?: string, symbolScope?: string) =>
    ['intelligence-opportunities', asofDate, symbolScope] as const,
};
