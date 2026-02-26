import type { QueryClient } from '@tanstack/react-query';
import { TRADING_STORE_STORAGE_KEY } from '@/features/persistence/storage';
import { queryKeys } from '@/lib/queryKeys';

export function registerTradingStoreSync(queryClient: QueryClient): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== TRADING_STORE_STORAGE_KEY) {
      return;
    }

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.strategies() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.strategyActive() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.strategyValidation() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.orders() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.positions() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioSummary() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.positionMetrics() }),
    ]);
  };

  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener('storage', handleStorage);
  };
}
