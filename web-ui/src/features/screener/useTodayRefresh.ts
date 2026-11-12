import { useQuery, useQueryClient } from '@tanstack/react-query';
import { refetchTodayPortfolio } from '@/features/dailyReview/api';
import { runScreener } from './api';
import type { ScreenerResponse } from './types';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { queryKeys } from '@/lib/queryKeys';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

function refreshSelection(result: ScreenerResponse, sourceId: string | undefined, completedAt: string) {
  const workspace = useWorkspaceStore.getState();
  const selection = workspace.selection;
  if (!selection) return;
  const fromPortfolio = selection.source === 'today_position' || selection.source === 'today_watchlist';
  const fromScan = selection.source === 'today_run' || selection.source === 'last_run';
  if (!fromPortfolio && (!fromScan || selection.runId !== sourceId)) return;

  const candidate = result.candidates.find((item) => item.ticker.trim().toUpperCase() === selection.ticker);
  if (fromPortfolio) {
    workspace.setWorkspaceSelection({ ...selection, candidate, runId: candidate ? completedAt : undefined });
  } else if (candidate) {
    workspace.setWorkspaceSelection({
      ...selection,
      source: 'today_run',
      runId: completedAt,
      candidate,
      rowId: selection.rowId.startsWith(`${selection.source}:`) ? `today_run:${completedAt}:${selection.ticker}` : selection.rowId,
    });
  } else {
    workspace.clearSelectedTicker();
  }
}

export function useTodayRefresh() {
  const queryClient = useQueryClient();
  const strategy = useActiveStrategyQuery();
  const initialized = useScreenerStore((state) => state.todayRunInitialized);
  const completedAt = useScreenerStore((state) => state.todayRun?.completedAt);
  const policy = strategy.data ? JSON.stringify(strategy.data) : null;
  const scan = useQuery({
    queryKey: queryKeys.todayScan(policy),
    enabled: initialized && policy !== null,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const store = useScreenerStore.getState();
      const context = store.todayRun ?? store.lastRunContext;
      const sourceId = context?.completedAt;
      const request = { ...context?.request, asofDate: undefined, forceRefresh: true };
      void refetchTodayPortfolio(queryClient);
      // The query owns completion so navigation does not restart or discard a run.
      const result = await runScreener(request);
      const current = useScreenerStore.getState();
      const currentSource = current.todayRun ?? current.lastRunContext;
      if (currentSource?.completedAt !== sourceId ||
        JSON.stringify(queryClient.getQueryData(queryKeys.strategyActive())) !== policy) {
        return { completedAt: null };
      }

      const completedAt = new Date().toISOString();
      current.recordTodayRun(result, {
        request,
        displayFilters: current.todayRun?.displayFilters ?? context?.displayFilters ??
          { recommendedOnly: false, actionFilter: 'all' },
        completedAt,
      });
      refreshSelection(result, sourceId, completedAt);
      return { completedAt };
    },
  });

  function refresh() {
    if (scan.isFetching || !initialized) return;
    if (!strategy.data) {
      void strategy.refetch();
      return;
    }
    void scan.refetch();
  }

  return {
    refresh,
    updatedAt: completedAt ?? scan.data?.completedAt ?? null,
    isRefreshing: scan.isFetching || !initialized || (!strategy.data && strategy.isFetching),
    error: scan.error ?? strategy.error,
  };
}
