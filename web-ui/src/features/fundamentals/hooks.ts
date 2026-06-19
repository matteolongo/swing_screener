import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchFundamentalSnapshot,
} from '@/features/fundamentals/api';
import type {
  FundamentalSnapshot,
} from '@/features/fundamentals/types';
import { queryKeys } from '@/lib/queryKeys';

export function useFundamentalSnapshotQuery(symbol?: string, refresh: boolean = false) {
  const normalizedSymbol = symbol?.trim().toUpperCase();
  return useQuery<FundamentalSnapshot>({
    queryKey: queryKeys.fundamentalsSnapshot(normalizedSymbol, refresh),
    queryFn: () => fetchFundamentalSnapshot(normalizedSymbol as string, refresh),
    enabled: Boolean(normalizedSymbol),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useRefreshFundamentalSnapshotMutation() {
  const queryClient = useQueryClient();
  return useMutation<FundamentalSnapshot, Error, string>({
    mutationFn: (symbol) => fetchFundamentalSnapshot(symbol, true),
    onSuccess: async (snapshot) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.fundamentalsSnapshot(snapshot.symbol) });
    },
  });
}
