import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/watchlist/api', () => ({
  fetchWatchlist: vi.fn(),
  watchSymbol: vi.fn(),
  unwatchSymbol: vi.fn(),
}));

import * as watchlistApi from '@/features/watchlist/api';
import { queryKeys } from '@/lib/queryKeys';
import { useUnwatchSymbolMutation, useWatchSymbolMutation, useWatchlist } from '@/features/watchlist/hooks';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('watchlist hooks', () => {
  const mockedFetchWatchlist = vi.mocked(watchlistApi.fetchWatchlist);
  const mockedWatchSymbol = vi.mocked(watchlistApi.watchSymbol);
  const mockedUnwatchSymbol = vi.mocked(watchlistApi.unwatchSymbol);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches watchlist items', async () => {
    const queryClient = createQueryClient();
    mockedFetchWatchlist.mockResolvedValue([
      {
        ticker: 'AAPL',
        watchedAt: '2026-03-05T10:00:00Z',
        watchPrice: 180,
        currency: 'USD',
        source: 'screener',
      },
    ]);

    const { result } = renderHook(() => useWatchlist(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedFetchWatchlist).toHaveBeenCalledTimes(1);
    expect(result.current.data?.[0].ticker).toBe('AAPL');
  });

  it('watches symbol and invalidates watchlist query', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockedWatchSymbol.mockResolvedValue({
      ticker: 'AAPL',
      watchedAt: '2026-03-05T10:00:00Z',
      watchPrice: 180,
      currency: 'USD',
      source: 'screener',
    });

    const { result } = renderHook(() => useWatchSymbolMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        ticker: 'AAPL',
        watchPrice: 180,
        currency: 'USD',
        source: 'screener',
      });
    });

    expect(mockedWatchSymbol).toHaveBeenCalledWith({
      ticker: 'AAPL',
      watchPrice: 180,
      currency: 'USD',
      source: 'screener',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.watchlist() });
  });

  it('unwatches symbol and invalidates watchlist query', async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    mockedUnwatchSymbol.mockResolvedValue(undefined);

    const { result } = renderHook(() => useUnwatchSymbolMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('AAPL');
    });

    expect(mockedUnwatchSymbol).toHaveBeenCalledWith('AAPL');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.watchlist() });
  });
});

