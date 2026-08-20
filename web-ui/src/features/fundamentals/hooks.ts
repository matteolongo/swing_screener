import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchFundamentalSnapshot,
} from '@/features/fundamentals/api';
import type {
  FundamentalSnapshot,
} from '@/features/fundamentals/types';
import { queryKeys } from '@/lib/queryKeys';

export function useFundamentalSnapshotQuery(symbol?: string) {
  const normalizedSymbol = symbol?.trim().toUpperCase();
  return useQuery<FundamentalSnapshot>({
    queryKey: queryKeys.fundamentalsSnapshot(normalizedSymbol),
    queryFn: () => fetchFundamentalSnapshot(normalizedSymbol as string, false),
    enabled: Boolean(normalizedSymbol),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useRefreshFundamentalSnapshotMutation() {
  const queryClient = useQueryClient();
  return useMutation<FundamentalSnapshot, Error, string>({
    mutationFn: (symbol) => fetchFundamentalSnapshot(symbol, true),
    onSuccess: (snapshot) => {
      queryClient.setQueryData(
        queryKeys.fundamentalsSnapshot(snapshot.symbol.trim().toUpperCase()),
        snapshot,
      );
    },
  });
}
