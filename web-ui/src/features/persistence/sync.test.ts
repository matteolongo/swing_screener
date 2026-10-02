import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { TRADING_STORE_STORAGE_KEY } from './storage';
import { registerTradingStoreSync } from './sync';

function dispatchTradingStoreStorageEvent(oldValue: unknown, newValue: unknown) {
  window.dispatchEvent(new StorageEvent('storage', {
    key: TRADING_STORE_STORAGE_KEY,
    oldValue: JSON.stringify(oldValue),
    newValue: JSON.stringify(newValue),
  }));
}

describe('registerTradingStoreSync', () => {
  afterEach(() => {
    useWorkspaceStore.getState().clearSelectedTicker();
    useScreenerStore.getState().invalidateActionableRuns();
  });

  it('invalidates review and watchlist pipeline after another tab writes the ledger', async () => {
    const queryClient = new QueryClient();
    const reviewKey = queryKeys.dailyReview(0, 'portfolio');
    const watchlistKey = queryKeys.watchlistPipeline();
    queryClient.setQueryData(reviewKey, { summary: {} });
    queryClient.setQueryData(watchlistKey, []);
    const unregister = registerTradingStoreSync(queryClient);

    dispatchTradingStoreStorageEvent({ activeStrategyId: 'same' }, { activeStrategyId: 'same' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queryClient.getQueryState(reviewKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(watchlistKey)?.isInvalidated).toBe(true);
    unregister();
  });

  it('clears selection and actionable runs when another tab changes activeStrategyId', async () => {
    useWorkspaceStore.getState().setWorkspaceSelection({
      ticker: 'AAPL', source: 'today_run', rowId: 'today:AAPL', candidate: undefined,
    });
    useScreenerStore.setState({
      todayRun: { result: { candidates: [] } as any, request: {}, displayFilters: { recommendedOnly: false, actionFilter: 'all' }, completedAt: 'run-1' },
      todayRunInitialized: true,
      lastResult: { candidates: [] } as any,
    });
    const queryClient = new QueryClient();
    const unregister = registerTradingStoreSync(queryClient);

    dispatchTradingStoreStorageEvent({ activeStrategyId: 'old' }, { activeStrategyId: 'new' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(useWorkspaceStore.getState().selection).toBeNull();
    expect(useScreenerStore.getState().todayRun).toBeNull();
    unregister();
  });
});
