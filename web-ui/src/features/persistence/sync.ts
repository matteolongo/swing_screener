import type { QueryClient } from '@tanstack/react-query';
import { TRADING_STORE_STORAGE_KEY } from '@/features/persistence/storage';
import { queryKeys } from '@/lib/queryKeys';
import { invalidateStrategyDependentQueries, invalidateDailyReviewQueries } from '@/lib/queryInvalidation';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

function readActiveStrategyId(value: string | null): string | null | undefined {
  if (value == null) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const id = (parsed as { activeStrategyId?: unknown }).activeStrategyId;
    return typeof id === 'string' ? id : null;
  } catch {
    return undefined;
  }
}

export function registerTradingStoreSync(queryClient: QueryClient): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== TRADING_STORE_STORAGE_KEY) {
      return;
    }

    const previousStrategyId = readActiveStrategyId(event.oldValue);
    const nextStrategyId = readActiveStrategyId(event.newValue);
    const strategyChanged = previousStrategyId !== undefined
      && nextStrategyId !== undefined
      && previousStrategyId !== nextStrategyId;

    if (strategyChanged) {
      useScreenerStore.getState().invalidateActionableRuns();
      useWorkspaceStore.getState().clearSelectedTicker();
      void invalidateStrategyDependentQueries(queryClient);
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
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlist() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.watchlistPipeline() }),
      invalidateDailyReviewQueries(queryClient),
    ]);
  };

  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener('storage', handleStorage);
  };
}
