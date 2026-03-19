import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/fundamentals/api', () => ({
  fetchFundamentalsConfig: vi.fn(),
  fetchFundamentalSnapshot: vi.fn(),
  compareFundamentals: vi.fn(),
  startFundamentalsWarmup: vi.fn(),
  fetchFundamentalsWarmupStatus: vi.fn(),
}));

import * as fundamentalsApi from '@/features/fundamentals/api';
import { useFundamentalsWarmupStatus, useStartFundamentalsWarmupMutation } from '@/features/fundamentals/hooks';
import { queryKeys } from '@/lib/queryKeys';

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

describe('fundamentals hooks', () => {
  const mockedStartFundamentalsWarmup = vi.mocked(fundamentalsApi.startFundamentalsWarmup);
  const mockedFetchFundamentalsWarmupStatus = vi.mocked(fundamentalsApi.fetchFundamentalsWarmupStatus);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('launches warmup and calls onSuccess', async () => {
    const queryClient = createQueryClient();
    const onSuccess = vi.fn();
    const launchResponse = {
      jobId: 'warmup-1',
      status: 'queued' as const,
      source: 'watchlist' as const,
      forceRefresh: false,
      totalSymbols: 4,
      createdAt: '2026-03-19T10:00:00',
      updatedAt: '2026-03-19T10:00:00',
    };
    mockedStartFundamentalsWarmup.mockResolvedValue(launchResponse);

    const { result } = renderHook(() => useStartFundamentalsWarmupMutation(onSuccess), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ source: 'watchlist', forceRefresh: false });
    });

    expect(mockedStartFundamentalsWarmup).toHaveBeenCalledWith({
      source: 'watchlist',
      forceRefresh: false,
    });
    expect(onSuccess).toHaveBeenCalled();
    expect(onSuccess.mock.calls[0]?.[0]).toEqual(launchResponse);
  });

  it('does not fetch warmup status when job id is missing', async () => {
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useFundamentalsWarmupStatus(undefined), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockedFetchFundamentalsWarmupStatus).not.toHaveBeenCalled();
  });

  it('polls warmup status while the job is active', async () => {
    const queryClient = createQueryClient();
    mockedFetchFundamentalsWarmupStatus.mockResolvedValue({
      jobId: 'warmup-2',
      status: 'running',
      source: 'symbols',
      forceRefresh: false,
      totalSymbols: 3,
      completedSymbols: 1,
      coverageCounts: {
        supported: 1,
        partial: 0,
        insufficient: 0,
        unsupported: 0,
      },
      freshnessCounts: {
        current: 1,
        stale: 0,
        unknown: 0,
      },
      errorCount: 0,
      createdAt: '2026-03-19T10:00:00',
      updatedAt: '2026-03-19T10:00:02',
    });

    const { result } = renderHook(() => useFundamentalsWarmupStatus('warmup-2'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockedFetchFundamentalsWarmupStatus).toHaveBeenCalledWith('warmup-2');

    const query = queryClient.getQueryCache().find({
      queryKey: queryKeys.fundamentalsWarmupStatus('warmup-2'),
    }) as any;
    const refetchInterval = query?.options?.refetchInterval as ((queryArg: any) => number | false) | undefined;
    expect(refetchInterval?.(query)).toBe(2000);
  });

  it('stops polling when warmup is completed', async () => {
    const queryClient = createQueryClient();
    mockedFetchFundamentalsWarmupStatus.mockResolvedValue({
      jobId: 'warmup-3',
      status: 'completed',
      source: 'watchlist',
      forceRefresh: false,
      totalSymbols: 3,
      completedSymbols: 3,
      coverageCounts: {
        supported: 2,
        partial: 1,
        insufficient: 0,
        unsupported: 0,
      },
      freshnessCounts: {
        current: 2,
        stale: 1,
        unknown: 0,
      },
      errorCount: 0,
      createdAt: '2026-03-19T10:00:00',
      updatedAt: '2026-03-19T10:00:06',
    });

    const { result } = renderHook(() => useFundamentalsWarmupStatus('warmup-3'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const query = queryClient.getQueryCache().find({
      queryKey: queryKeys.fundamentalsWarmupStatus('warmup-3'),
    }) as any;
    const refetchInterval = query?.options?.refetchInterval as ((queryArg: any) => number | false) | undefined;
    expect(refetchInterval?.(query)).toBe(false);
  });
});
