import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export async function invalidateStrategyQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.strategies() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.strategyActive() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.strategyValidation() }),
  ]);
}

export async function invalidateOrderQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.orders() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.positionMetrics() }),
  ]);
}

export async function invalidatePositionQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.positions() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.positionMetrics() }),
  ]);
}
