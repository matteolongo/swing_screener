import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export async function invalidateStrategyQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.strategies() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.strategyActive() }),
  ]);
}

export async function invalidateOrderQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
}

export async function invalidatePositionQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.positions() });
}
