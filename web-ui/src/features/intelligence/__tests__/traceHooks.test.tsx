import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/intelligence/api', () => ({
  getIntelligenceLatest: vi.fn(),
  getRunTrace: vi.fn(),
  getTickerRuns: vi.fn(),
}));

import * as intelligenceApi from '@/features/intelligence/api';
import {
  IntelligenceIdentityError,
  findRunByAttemptId,
  resolveRunId,
  useIntelligenceLatestQuery,
  useRunTrace,
  useTickerRuns,
} from '@/features/intelligence/hooks';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useIntelligenceLatestQuery', () => {
  const mockedGetIntelligenceLatest = vi.mocked(intelligenceApi.getIntelligenceLatest);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a response tagged for a different symbol', async () => {
    mockedGetIntelligenceLatest.mockResolvedValue({
      symbol: 'MSFT',
      generated_at: '2026-07-29T08:00:00Z',
      action: 'WATCH',
      conviction: 'medium',
      catalyst_urgency: 'none',
      summary_line: 'Wrong symbol.',
      narrative: 'Wrong symbol payload.',
      upcoming_events: [],
      position_signal: null,
      sources: ['openai'],
    });

    const { result } = renderHook(() => useIntelligenceLatestQuery(' aapl ', true), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(IntelligenceIdentityError);
    expect(result.current.data).toBeUndefined();
  });
});

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

describe('findRunByAttemptId', () => {
  it('selects the exact concurrent same-symbol attempt without a clock heuristic', () => {
    const runs = [
      {
        runId: 'old-success',
        ticker: 'AAPL',
        startedAt: '2026-07-28T08:59:00Z',
        finishedAt: '2026-07-28T08:59:02Z',
        status: 'ok',
        durationMs: 2000,
        stepCount: 9,
        clientAttemptId: null,
        attemptForce: null,
      },
      {
        runId: 'wrong-symbol',
        ticker: 'MSFT',
        startedAt: '2026-07-28T09:01:00Z',
        finishedAt: '2026-07-28T09:01:01Z',
        status: 'error',
        durationMs: 1000,
        stepCount: 2,
        clientAttemptId: 'attempt-msft',
        attemptForce: false,
      },
      {
        runId: 'current-failure',
        ticker: 'aapl',
        startedAt: '2026-07-28T09:00:01Z',
        finishedAt: '2026-07-28T09:00:02Z',
        status: 'error',
        durationMs: 1000,
        stepCount: 4,
        clientAttemptId: 'attempt-aapl-2',
        attemptForce: true,
      },
      {
        runId: 'concurrent-other-aapl',
        ticker: 'AAPL',
        startedAt: '2026-07-28T09:00:01Z',
        finishedAt: null,
        status: 'running',
        durationMs: null,
        stepCount: 1,
        clientAttemptId: 'attempt-aapl-1',
        attemptForce: false,
      },
    ];

    expect(
      findRunByAttemptId(runs, ' AAPL ', 'attempt-aapl-2')?.runId,
    ).toBe('current-failure');
  });
});

describe('resolveRunId', () => {
  it('prefers the newest persisted failed run after remount over an older cached success', () => {
    expect(resolveRunId([
      {
        runId: 'new-failure',
        ticker: 'AAPL',
        startedAt: '2026-07-28T09:00:00Z',
        finishedAt: '2026-07-28T09:00:01Z',
        status: 'error',
        durationMs: 1000,
        stepCount: 2,
        clientAttemptId: 'attempt-new',
        attemptForce: true,
      },
    ], null, 'old-cached-success')).toBe('new-failure');
  });

  it('shows a client preflight failure without an older cached trace', () => {
    expect(resolveRunId([
      {
        runId: 'old-success',
        ticker: 'AAPL',
        startedAt: '2026-07-27T09:00:00Z',
        finishedAt: '2026-07-27T09:00:01Z',
        status: 'ok',
        durationMs: 1000,
        stepCount: 9,
        clientAttemptId: 'old-attempt',
        attemptForce: false,
      },
    ], null, 'old-success', true)).toBeNull();
  });

  it('shows an untraced server 503 without an older cached trace', () => {
    expect(resolveRunId([
      {
        runId: 'old-success',
        ticker: 'AAPL',
        startedAt: '2026-07-27T09:00:00Z',
        finishedAt: '2026-07-27T09:00:01Z',
        status: 'ok',
        durationMs: 1000,
        stepCount: 9,
      },
    ], null, 'old-success', true)).toBeNull();
  });

  it('prefers a modern attempted run after remount over a newer legacy run', () => {
    expect(resolveRunId([
      {
        runId: 'newer-legacy',
        ticker: 'AAPL',
        startedAt: '2026-07-28T10:00:00Z',
        finishedAt: null,
        status: 'error',
        durationMs: 100,
        stepCount: 1,
      },
      {
        runId: 'modern-attempt',
        ticker: 'AAPL',
        startedAt: '2026-07-28T09:00:00Z',
        finishedAt: null,
        status: 'error',
        durationMs: 100,
        stepCount: 1,
        clientAttemptId: 'attempt-modern',
        attemptForce: true,
      },
    ], null, 'cached-success')).toBe('modern-attempt');
  });
});
