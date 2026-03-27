import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/utils';
import FundamentalsPage from './Fundamentals';

vi.mock('@/features/fundamentals/hooks', () => ({
  useFundamentalsConfigQuery: vi.fn(),
  useCompareFundamentalsMutation: vi.fn(),
  useFundamentalsWarmupStatus: vi.fn(),
  useStartFundamentalsWarmupMutation: vi.fn(),
  useDegiroPortfolioAuditMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false, data: undefined, isError: false })),
}));

vi.mock('@/features/portfolio/hooks', () => ({
  useDegiroStatusQuery: vi.fn(() => ({
    data: {
      available: false,
      detail: 'DeGiro setup missing.',
    },
    isLoading: false,
    isError: false,
    isSuccess: true,
  })),
}));

import * as fundamentalsHooks from '@/features/fundamentals/hooks';

describe('FundamentalsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forces refresh on warmup and reloads compare cards when the job completes', async () => {
    const warmupMutate = vi.fn();
    const compareMutate = vi.fn();

    vi.mocked(fundamentalsHooks.useFundamentalsConfigQuery).mockReturnValue({
      data: {
        enabled: true,
        providers: ['yfinance'],
        cacheTtlHours: 24,
        staleAfterDays: 120,
        compareLimit: 5,
      },
    } as never);

    vi.mocked(fundamentalsHooks.useCompareFundamentalsMutation).mockReturnValue({
      mutate: compareMutate,
      isPending: false,
      isError: false,
      data: undefined,
      error: null,
    } as never);

    vi.mocked(fundamentalsHooks.useFundamentalsWarmupStatus).mockImplementation(
      ((jobId?: string) =>
        jobId === 'job-1'
          ? ({
              data: {
                jobId: 'job-1',
                status: 'completed',
                source: 'symbols',
                forceRefresh: true,
                totalSymbols: 2,
                completedSymbols: 2,
                coverageCounts: {
                  supported: 2,
                  partial: 0,
                  insufficient: 0,
                  unsupported: 0,
                },
                freshnessCounts: {
                  current: 2,
                  stale: 0,
                  unknown: 0,
                },
                errorCount: 0,
                createdAt: '2026-03-19T10:00:00',
                updatedAt: '2026-03-19T10:00:02',
              },
              isError: false,
            } as never)
          : ({ data: undefined, isError: false } as never)) as never
    );

    vi.mocked(fundamentalsHooks.useStartFundamentalsWarmupMutation).mockImplementation(
      ((onSuccess?: (data: {
        jobId: string;
        status: 'queued' | 'running' | 'completed' | 'error';
        source: 'watchlist' | 'symbols';
        forceRefresh: boolean;
        totalSymbols: number;
        createdAt: string;
        updatedAt: string;
      }) => void) =>
        ({
          mutate: (payload: { source: 'watchlist' | 'symbols'; symbols?: string[]; forceRefresh?: boolean }) => {
            warmupMutate(payload);
            onSuccess?.({
              jobId: 'job-1',
              status: 'queued',
              source: 'symbols',
              forceRefresh: true,
              totalSymbols: 2,
              createdAt: '2026-03-19T10:00:00',
              updatedAt: '2026-03-19T10:00:00',
            });
          },
          isPending: false,
          isError: false,
          error: null,
        } as never)) as never
    );

    const { user } = renderWithProviders(<FundamentalsPage />, { route: '/fundamentals' });

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Warm listed symbols' }));
    });

    expect(warmupMutate).toHaveBeenCalledWith({
      source: 'symbols',
      symbols: ['AAPL', 'MSFT'],
      forceRefresh: true,
    });

    await waitFor(() => {
      expect(compareMutate).toHaveBeenCalledWith({
        symbols: ['AAPL', 'MSFT'],
        forceRefresh: false,
      });
    });
  });

  it('explains DeGiro implications when audit is unavailable', async () => {
    vi.mocked(fundamentalsHooks.useFundamentalsConfigQuery).mockReturnValue({
      data: {
        enabled: true,
        providers: ['yfinance'],
        cacheTtlHours: 24,
        staleAfterDays: 120,
        compareLimit: 5,
      },
    } as never);

    vi.mocked(fundamentalsHooks.useCompareFundamentalsMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      data: undefined,
      error: null,
    } as never);

    vi.mocked(fundamentalsHooks.useFundamentalsWarmupStatus).mockReturnValue({
      data: undefined,
      isError: false,
    } as never);

    vi.mocked(fundamentalsHooks.useStartFundamentalsWarmupMutation).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as never);

    renderWithProviders(<FundamentalsPage />, { route: '/fundamentals' });

    expect(await screen.findByText('DeGiro audit is unavailable on this setup')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run Audit' })).not.toBeInTheDocument();
  });
});
