import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { runScreener } from './api';
import { useTodayRefresh } from './useTodayRefresh';
import type { ScreenerResponse } from './types';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { queryKeys } from '@/lib/queryKeys';
import { mockStrategies } from '@/test/mocks/handlers';
import { transformStrategy } from '@/features/strategy/types';

vi.mock('./api', async (original) => ({ ...await original<typeof import('./api')>(), runScreener: vi.fn() }));

const response = (entry: number) => ({
  asofDate: '2026-10-07', dataFreshness: 'final_close', benchmarkTicker: 'SPY',
  candidates: [{ ticker: 'STMPA.PA', entry, currency: 'EUR' }],
} as ScreenerResponse);

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(queryKeys.strategyActive(), transformStrategy(mockStrategies[0]));
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { ...renderHook(() => useTodayRefresh(), { wrapper }), client };
}

beforeEach(() => {
  vi.mocked(runScreener).mockReset().mockResolvedValue(response(51));
  useScreenerStore.setState({ lastResult: null, lastRunContext: null, todayRun: null, todayRunInitialized: true });
  useWorkspaceStore.getState().clearSelectedTicker();
});

describe('Today refresh', () => {
  it('runs the latest session on entry with the pinned settings and updates the selected snapshot', async () => {
    useScreenerStore.getState().recordScreenerRun(response(50), {
      request: { preset: 'europe_large_cap_equities', asofDate: '2026-10-06', top: 30, breakoutLookback: 40 },
      displayFilters: { recommendedOnly: false, actionFilter: 'all' }, completedAt: 'old',
    }, true);
    const saved = useScreenerStore.getState().todayRun!;
    useWorkspaceStore.getState().setWorkspaceSelection({ ticker: 'STMPA.PA', source: 'today_run', runId: 'old', candidate: saved.result.candidates[0], rowId: 'old-row' });
    setup();
    await waitFor(() => expect(useScreenerStore.getState().todayRun?.result.candidates[0].entry).toBe(51));
    expect(runScreener).toHaveBeenCalledWith({ preset: 'europe_large_cap_equities', asofDate: undefined, top: 30, breakoutLookback: 40, forceRefresh: true });
    expect(useWorkspaceStore.getState().selection?.candidate?.entry).toBe(51);
    expect(useWorkspaceStore.getState().selection?.runId).toBe(useScreenerStore.getState().todayRun?.completedAt);
    expect(saved.result.candidates[0].entry).toBe(50);
    expect(useScreenerStore.getState().lastResult?.candidates[0].entry).toBe(50);
  });

  it('runs again for each explicit refresh and waits for persistence initialization', async () => {
    useScreenerStore.setState({ todayRunInitialized: false });
    const { result } = setup();
    expect(runScreener).not.toHaveBeenCalled();
    act(() => useScreenerStore.setState({ todayRunInitialized: true }));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    await waitFor(() => expect(runScreener).toHaveBeenCalledTimes(1));
    act(() => result.current.refresh());
    await waitFor(() => expect(runScreener).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    act(() => result.current.refresh());
    await waitFor(() => expect(runScreener).toHaveBeenCalledTimes(3));
  });

  it('keeps the last successful snapshot on failure and supports retry', async () => {
    useScreenerStore.getState().recordScreenerRun(response(50), { request: {}, displayFilters: { recommendedOnly: false, actionFilter: 'all' } }, true);
    const saved = useScreenerStore.getState().todayRun;
    vi.mocked(runScreener).mockRejectedValueOnce(new Error('provider unavailable'));
    const { result } = setup();
    await waitFor(() => expect(result.current.error?.message).toBe('provider unavailable'));
    expect(useScreenerStore.getState().todayRun).toBe(saved);
    act(() => result.current.refresh());
    await waitFor(() => expect(useScreenerStore.getState().todayRun?.result.candidates[0].entry).toBe(51));
  });

  it('discards a response when a different run is pinned while it is pending', async () => {
    let resolve!: (data: ScreenerResponse) => void;
    vi.mocked(runScreener).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { result } = setup();
    await waitFor(() => expect(runScreener).toHaveBeenCalledTimes(1));
    act(() => useScreenerStore.getState().recordScreenerRun(response(70), { request: { tickers: ['STMPA.PA'] }, displayFilters: { recommendedOnly: false, actionFilter: 'all' } }, true));
    await act(async () => resolve(response(51)));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(useScreenerStore.getState().todayRun?.result.candidates[0].entry).toBe(70);
  });

  it('discards the old policy response and reruns after a strategy change during refresh', async () => {
    let resolve!: (data: ScreenerResponse) => void;
    vi.mocked(runScreener).mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const { result, client } = setup();
    await waitFor(() => expect(runScreener).toHaveBeenCalledTimes(1));
    act(() => client.setQueryData(queryKeys.strategyActive(), transformStrategy(mockStrategies[1])));
    await act(async () => resolve(response(45)));
    await waitFor(() => expect(runScreener).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(useScreenerStore.getState().todayRun?.result.candidates[0].entry).toBe(51);
  });
});
