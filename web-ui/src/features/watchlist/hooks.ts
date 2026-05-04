import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchWatchlist, fetchWatchlistPipeline, unwatchSymbol, watchSymbol } from '@/features/watchlist/api';
import type { WatchSymbolRequest } from '@/features/watchlist/types';
import { queryKeys } from '@/lib/queryKeys';

export function useWatchlistPipeline() {
  return useQuery({
    queryKey: queryKeys.watchlistPipeline(),
    queryFn: fetchWatchlistPipeline,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}

export function useWatchlist() {
  return useQuery({
    queryKey: queryKeys.watchlist(),
    queryFn: fetchWatchlist,
    refetchOnWindowFocus: false,
  });
}

export function useWatchSymbolMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: WatchSymbolRequest) => watchSymbol(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist() });
    },
  });
}

export function useUnwatchSymbolMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticker: string) => unwatchSymbol(ticker),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist() });
    },
  });
}

