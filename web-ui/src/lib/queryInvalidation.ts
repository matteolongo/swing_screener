import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useScreenerStore } from '@/stores/screenerStore';

export async function invalidateStrategyQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.strategies() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.strategyActive() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.strategyValidation() }),
  ]);
}

/**
 * Invalidate every view whose response is calculated with the active strategy.
 *
 * Query keys intentionally do not include strategy identity: callers see a
 * single current-decision view. Therefore an active-strategy transition must
 * clear all of these prefixes together, including the persisted screener result
 * that otherwise has no React Query key to invalidate.
 */
export async function invalidateStrategyDependentQueries(queryClient: QueryClient): Promise<void> {
  useScreenerStore.getState().clearLastResult();
  await Promise.all([
    invalidateStrategyQueries(queryClient),
    queryClient.invalidateQueries({ queryKey: queryKeys.positions() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.positionMetrics() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.openPositionsIntelligence() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.watchlist() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.watchlistPipeline() }),
    queryClient.invalidateQueries({ queryKey: ['dailyReview'] }),
    queryClient.invalidateQueries({ queryKey: ['earnings-proximity'] }),
    queryClient.invalidateQueries({ queryKey: ['regime-breakdown'] }),
    queryClient.invalidateQueries({ queryKey: ['screener'] }),
    queryClient.invalidateQueries({ queryKey: ['backtest'] }),
    queryClient.invalidateQueries({ queryKey: ['intelligence'] }),
  ]);
}

export async function invalidateOrderQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.orders() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.positionMetrics() }),
  ]);
}

export async function invalidateDailyReviewQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ['dailyReview'] });
}

export async function invalidatePositionQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.positions() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.positionMetrics() }),
  ]);
}
