import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    mutationFn: async ({ context }: { context: ScreenerRunContext; sourceId?: string; policy: string }) => {
      const [response] = await Promise.all([
        runScreener(context.request),
        ...[queryKeys.dailyReviewPrefix(), queryKeys.watchlistPipeline(), queryKeys.positions(), queryKeys.orders(), queryKeys.portfolioSummary()]
          .map((queryKey) => queryClient.refetchQueries({ queryKey, type: 'active' })),
      ]);
      return response;
    },
    onSuccess: (result, request) => {
      const store = useScreenerStore.getState();
      const sourceId = store.todayRun?.completedAt ?? store.lastRunContext?.completedAt;
      if (!mounted.current || sourceId !== request.sourceId || JSON.stringify(queryClient.getQueryData(queryKeys.strategyActive())) !== request.policy) return;
      const completedAt = new Date().toISOString();
      store.recordTodayRun(result, { ...request.context, displayFilters: store.todayRun?.displayFilters ?? request.context.displayFilters, completedAt });
      setUpdatedAt(completedAt);
      const workspace = useWorkspaceStore.getState();
      const selection = workspace.selection;
      if (!selection || !['today_run', 'last_run'].includes(selection.source) || selection.runId !== request.sourceId) return;
      const candidate = result.candidates.find((item) => item.ticker.trim().toUpperCase() === selection.ticker);
      if (candidate) workspace.setWorkspaceSelection({ ...selection, source: 'today_run', runId: completedAt, candidate, rowId: `today_run:${completedAt}:${selection.ticker}` });
      else workspace.clearSelectedTicker();
    },
    onSettled: () => { pending.current = false; },
  });

  function refresh() {
    if (pending.current || !initialized || !strategy.data) return;
    pending.current = true;
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

  return { refresh, updatedAt, isRefreshing: mutation.isPending || !initialized || strategy.isLoading, error: mutation.error ?? strategy.error };
}
