import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/strategy/api', () => ({
  createStrategy: vi.fn(),
  deleteStrategy: vi.fn(),
  fetchActiveStrategy: vi.fn(),
  fetchStrategies: vi.fn(),
  setActiveStrategy: vi.fn(),
  updateStrategy: vi.fn(),
  validateStrategy: vi.fn(),
}));

import * as strategyApi from '@/features/strategy/api';
import { useSetActiveStrategyMutation, useUpdateStrategyMutation } from '@/features/strategy/hooks';
import type { Strategy } from '@/features/strategy/types';
import { queryKeys } from '@/lib/queryKeys';
import { useScreenerStore } from '@/stores/screenerStore';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const strategy = (id: string) => ({ id, name: id }) as Strategy;

describe('strategy mutation cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useScreenerStore.setState({
      lastResult: { candidates: [] } as never,
      lastRunContext: null,
      todayRun: { request: {}, displayFilters: { recommendedOnly: false, actionFilter: 'all' }, completedAt: '2026-09-10T20:00:00Z', result: { candidates: [] } } as never,
      todayRunInitialized: true,
    });
  });

  it('invalidates every strategy-derived prefix after activating a strategy', async () => {
    const queryClient = createQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(strategyApi.setActiveStrategy).mockResolvedValue(strategy('next'));

    const { result } = renderHook(() => useSetActiveStrategyMutation(), { wrapper: wrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync('next');
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.positions() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.positionMetrics() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.portfolioSummary() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.watchlist() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.watchlistPipeline() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['dailyReview'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['screener'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['backtest'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.openPositionsIntelligence() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['intelligence'] });
    expect(useScreenerStore.getState().lastResult).toBeNull();
    expect(useScreenerStore.getState().todayRun).toBeNull();
  });

  it('uses broad invalidation when the active strategy is updated', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(queryKeys.strategyActive(), strategy('active'));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(strategyApi.updateStrategy).mockResolvedValue(strategy('active'));

    const { result } = renderHook(() => useUpdateStrategyMutation(), { wrapper: wrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync(strategy('active'));
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.positions() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['regime-breakdown'] });
  });

  it('keeps non-active strategy updates on the narrow strategy invalidation path', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(queryKeys.strategyActive(), strategy('active'));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    vi.mocked(strategyApi.updateStrategy).mockResolvedValue(strategy('other'));

    const { result } = renderHook(() => useUpdateStrategyMutation(), { wrapper: wrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync(strategy('other'));
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.strategies() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.strategyActive() });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: queryKeys.positions() });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['dailyReview'] });
  });
});
