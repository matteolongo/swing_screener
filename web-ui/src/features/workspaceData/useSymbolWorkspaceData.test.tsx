import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { intelligenceResult, tickerCandlesResult, positionsResult, ordersResult } = vi.hoisted(() => ({
  intelligenceResult: {
    current: {
      data: undefined as { symbol: string; generatedAt: string } | undefined,
    },
  },
  tickerCandlesResult: {
    current: {
      data: undefined as
        | { ticker: string; priceHistory: Array<{ date: string; close: number }>; patterns: [] }
        | undefined,
      dataUpdatedAt: 0,
    },
  },
  positionsResult: { current: {} as Record<string, unknown> },
  ordersResult: { current: {} as Record<string, unknown> },
}));

vi.mock('@/features/fundamentals/api', () => ({
  fetchFundamentalSnapshot: vi.fn(),
}));
vi.mock('@/features/screener/hooks', () => ({
  useTickerCandles: () => ({
    data: tickerCandlesResult.current.data,
    dataUpdatedAt: tickerCandlesResult.current.dataUpdatedAt,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('@/features/intelligence/hooks', () => ({
  useIntelligenceLatestQuery: () => ({
    data: intelligenceResult.current.data,
    dataUpdatedAt: 0,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
  }),
}));
vi.mock('@/features/portfolio/hooks', () => ({
  useOpenPositions: () => ({
    data: [],
    dataUpdatedAt: 100,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isStale: false,
    isFetchedAfterMount: true,
    ...positionsResult.current,
  }),
  useOrders: () => ({
    data: [],
    dataUpdatedAt: 200,
    error: null,
    isError: false,
    isFetching: false,
    isLoading: false,
    isStale: false,
    isFetchedAfterMount: true,
    ...ordersResult.current,
  }),
}));

import * as fundamentalsApi from '@/features/fundamentals/api';
import { queryKeys } from '@/lib/queryKeys';
import { useSymbolWorkspaceData } from './useSymbolWorkspaceData';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function snapshot(symbol: string) {
  return {
    symbol,
    asofDate: '2026-07-27',
    provider: 'test',
    updatedAt: '2026-07-27T18:00:00Z',
    instrumentType: 'equity',
    supported: true,
    coverageStatus: 'supported' as const,
    freshnessStatus: 'current' as const,
    pillars: {},
    historicalSeries: {},
    metricContext: {},
    dataQualityStatus: 'high' as const,
    dataQualityFlags: [],
    redFlags: [],
    highlights: [],
    metricSources: {},
  };
}

describe('useSymbolWorkspaceData', () => {
  const fetchSnapshot = vi.mocked(fundamentalsApi.fetchFundamentalSnapshot);

  beforeEach(() => {
    vi.clearAllMocks();
    intelligenceResult.current.data = undefined;
    tickerCandlesResult.current.data = undefined;
    tickerCandlesResult.current.dataUpdatedAt = 0;
    positionsResult.current = {};
    ordersResult.current = {};
  });

  it('derives position and order health from both canonical query observers', () => {
    fetchSnapshot.mockResolvedValue(snapshot('AAPL'));
    positionsResult.current = {
      data: [{ ticker: 'AAPL' }],
      dataUpdatedAt: 500,
      isFetching: true,
    };
    ordersResult.current = {
      data: [],
      dataUpdatedAt: 400,
      isFetchedAfterMount: false,
    };
    const queryClient = createQueryClient();
    const { result, rerender } = renderHook(
      () => useSymbolWorkspaceData({
        ticker: 'AAPL',
        selectionVersion: 1,
        candidate: null,
        position: null,
      }),
      { wrapper: wrapper(queryClient) },
    );

    expect(result.current.sourceStates.find(({ id }) => id === 'positionOrders')).toMatchObject({
      phase: 'loading',
      provider: 'local portfolio',
      fetchedAt: new Date(500).toISOString(),
    });

    positionsResult.current = { data: [], isFetching: false, isStale: true };
    ordersResult.current = { data: [], isStale: false };
    rerender();
    expect(result.current.sourceStates.find(({ id }) => id === 'positionOrders')?.phase).toBe('stale');
  });

  it('does not expose an AAPL completion in an MSFT workspace session', async () => {
    let finishAapl!: (value: ReturnType<typeof snapshot>) => void;
    fetchSnapshot.mockImplementation(
      (symbol) =>
        symbol === 'AAPL'
          ? new Promise((resolve) => {
              finishAapl = resolve;
            })
          : Promise.resolve(snapshot('MSFT')),
    );
    const queryClient = createQueryClient();
    const { result, rerender } = renderHook(
      ({ ticker, selectionVersion }) =>
        useSymbolWorkspaceData({ ticker, selectionVersion, candidate: null, position: null }),
      {
        initialProps: { ticker: 'AAPL', selectionVersion: 1 },
        wrapper: wrapper(queryClient),
      },
    );

    rerender({ ticker: 'MSFT', selectionVersion: 2 });
    await waitFor(() => expect(result.current.fundamentals.data?.symbol).toBe('MSFT'));
    await act(async () => finishAapl(snapshot('AAPL')));

    expect(result.current.ticker).toBe('MSFT');
    expect(result.current.fundamentals.data?.symbol).not.toBe('AAPL');
  });

  it('refreshes non-intelligence sources without invalidating intelligence', async () => {
    fetchSnapshot.mockResolvedValue(snapshot('AAPL'));
    const queryClient = createQueryClient();
    await queryClient.prefetchQuery({
      queryKey: queryKeys.intelligence.latest('AAPL'),
      queryFn: async () => ({ generatedAt: '2026-07-27T17:00:00Z' }),
    });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () =>
        useSymbolWorkspaceData({
          ticker: 'AAPL',
          selectionVersion: 1,
          candidate: null,
          position: null,
        }),
      { wrapper: wrapper(queryClient) },
    );

    await act(async () => result.current.refreshAllNonIntelligence());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.positions() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.orders() });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: queryKeys.intelligence.latest('AAPL'),
    });
  });

  it('keeps fundamentals and intelligence timestamps unchanged after a screener rerun', async () => {
    fetchSnapshot.mockResolvedValue(snapshot('AAPL'));
    intelligenceResult.current.data = {
      symbol: 'AAPL',
      generatedAt: '2026-07-27T17:00:00Z',
    };
    const queryClient = createQueryClient();
    const { result, rerender } = renderHook(
      ({ lastBar }) =>
        useSymbolWorkspaceData({
          ticker: 'AAPL',
          selectionVersion: 1,
          candidate: { ticker: 'AAPL', lastBar } as never,
          position: null,
        }),
      {
        initialProps: { lastBar: '2026-07-26' },
        wrapper: wrapper(queryClient),
      },
    );
    await waitFor(() => expect(result.current.fundamentals.data).toBeDefined());
    const fundamentalsTime = result.current.sourceStates.find(
      ({ id }) => id === 'fundamentals',
    )?.fetchedAt;
    const intelligenceTime = result.current.sourceStates.find(
      ({ id }) => id === 'intelligence',
    )?.dataAsOf;

    rerender({ lastBar: '2026-07-27' });

    expect(result.current.sourceStates.find(({ id }) => id === 'screener')?.dataAsOf).toBe(
      '2026-07-27',
    );
    expect(result.current.sourceStates.find(({ id }) => id === 'fundamentals')?.fetchedAt).toBe(
      fundamentalsTime,
    );
    expect(result.current.sourceStates.find(({ id }) => id === 'intelligence')?.dataAsOf).toBe(
      intelligenceTime,
    );
  });

  it('does not expose candle data tagged for another ticker', () => {
    tickerCandlesResult.current.data = {
      ticker: 'AAPL',
      priceHistory: [{ date: '2026-07-27', close: 210 }],
      patterns: [],
    };
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useSymbolWorkspaceData({
          ticker: 'MSFT',
          selectionVersion: 2,
          candidate: null,
          position: null,
        }),
      { wrapper: wrapper(queryClient) },
    );

    expect(result.current.prices.data).toBeUndefined();
    expect(result.current.sourceStates.find(({ id }) => id === 'prices')?.phase).toBe('idle');
  });

  it('does not use a mismatched candle timestamp to invalidate intelligence', () => {
    intelligenceResult.current.data = {
      symbol: 'MSFT',
      generatedAt: '2026-07-27T19:00:00Z',
    };
    tickerCandlesResult.current.data = {
      ticker: 'AAPL',
      priceHistory: [{ date: '2026-07-27', close: 210 }],
      patterns: [],
    };
    tickerCandlesResult.current.dataUpdatedAt = Date.parse('2026-07-27T20:00:00Z');
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useSymbolWorkspaceData({
          ticker: 'MSFT',
          selectionVersion: 2,
          candidate: null,
          position: null,
        }),
      { wrapper: wrapper(queryClient) },
    );

    expect(result.current.intelligenceOutdated).toBe(false);
  });
});
