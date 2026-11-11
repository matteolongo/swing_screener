import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { refetchTodayPortfolio } from '@/features/dailyReview/api';
import { runScreener } from './api';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { queryKeys } from '@/lib/queryKeys';
import { useScreenerStore, type ScreenerRunContext } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function useTodayRefresh() {
  const queryClient = useQueryClient();
  const strategy = useActiveStrategyQuery();
  const initialized = useScreenerStore((state) => state.todayRunInitialized);
  const startedForPolicy = useRef<string | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const mutation = useMutation({
    mutationFn: ({ context }: { context: ScreenerRunContext; sourceId?: string; policy: string }) =>
      runScreener(context.request),
    onSuccess: (result, request) => {
      const store = useScreenerStore.getState();
      const sourceId = store.todayRun ? store.todayRun.completedAt : store.lastRunContext?.completedAt;
      if (!mounted.current || sourceId !== request.sourceId || JSON.stringify(queryClient.getQueryData(queryKeys.strategyActive())) !== request.policy) return;
      const completedAt = new Date().toISOString();
      store.recordTodayRun(result, { ...request.context, displayFilters: store.todayRun?.displayFilters ?? request.context.displayFilters, completedAt });
      setUpdatedAt(completedAt);
      const workspace = useWorkspaceStore.getState();
      const selection = workspace.selection;
      if (!selection) return;
      const fromPortfolio = selection.source === 'today_position' || selection.source === 'today_watchlist';
      const fromScan = selection.source === 'today_run' || selection.source === 'last_run';
      if (!fromPortfolio && (!fromScan || selection.runId !== request.sourceId)) return;

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
    },
    onSettled: () => { pending.current = false; },
  });

  function refresh() {
    if (pending.current || !initialized) return;
    if (!strategy.data) {
      void strategy.refetch();
      return;
    }
    pending.current = true;
    void refetchTodayPortfolio(queryClient);
    const store = useScreenerStore.getState();
    const context = store.todayRun ?? store.lastRunContext;
    mutation.mutate({
      context: {
        request: { ...context?.request, asofDate: undefined, forceRefresh: true },
        displayFilters: context?.displayFilters ?? { recommendedOnly: false, actionFilter: 'all' },
        completedAt: context?.completedAt ?? '',
      },
      sourceId: context?.completedAt,
      policy: JSON.stringify(strategy.data),
    });
  }

  const policy = strategy.data ? JSON.stringify(strategy.data) : null;
  useEffect(() => {
    if (initialized && policy && !mutation.isPending && startedForPolicy.current !== policy) {
      startedForPolicy.current = policy;
      refresh();
    }
  }, [initialized, policy, mutation.isPending]);

  return {
    refresh,
    updatedAt,
    isRefreshing: mutation.isPending || !initialized || (!strategy.data && strategy.isFetching),
    error: mutation.error ?? strategy.error,
  };
}
