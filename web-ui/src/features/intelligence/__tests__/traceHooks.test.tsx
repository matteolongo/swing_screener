import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/intelligence/api', () => ({
  getRunTrace: vi.fn(),
  getTickerRuns: vi.fn(),
}));

import * as intelligenceApi from '@/features/intelligence/api';
import { useRunTrace, useTickerRuns } from '@/features/intelligence/hooks';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useRunTrace', () => {
  const mockedGetRunTrace = vi.mocked(intelligenceApi.getRunTrace);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and transforms a trace', async () => {
    mockedGetRunTrace.mockResolvedValue({
      runId: 'r1',
      ticker: 'AAPL',
      startedAt: '2026-07-05T10:00:00+00:00',
      finishedAt: '2026-07-05T10:00:02+00:00',
      status: 'ok',
      error: null,
      steps: [],
    });

    const { result } = renderHook(() => useRunTrace('r1', true), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetRunTrace).toHaveBeenCalledWith('r1');
    expect(result.current.data?.runId).toBe('r1');
  });

  it('does not fetch when disabled or runId missing', () => {
    renderHook(() => useRunTrace(null, true), {
      wrapper: createWrapper(createQueryClient()),
    });
    renderHook(() => useRunTrace('r1', false), {
      wrapper: createWrapper(createQueryClient()),
    });
    expect(mockedGetRunTrace).not.toHaveBeenCalled();
  });
});

describe('useTickerRuns', () => {
  const mockedGetTickerRuns = vi.mocked(intelligenceApi.getTickerRuns);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and transforms the run index', async () => {
    mockedGetTickerRuns.mockResolvedValue([
      {
        runId: 'r1',
        ticker: 'AAPL',
        startedAt: '2026-07-05T10:00:00+00:00',
        finishedAt: null,
        status: 'ok',
        durationMs: 1200,
        stepCount: 9,
      },
    ]);

    const { result } = renderHook(() => useTickerRuns('AAPL', true), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetTickerRuns).toHaveBeenCalledWith('AAPL');
    expect(result.current.data?.[0].stepCount).toBe(9);
  });
});
