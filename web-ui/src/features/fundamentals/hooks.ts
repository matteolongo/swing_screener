import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  compareFundamentals,
  fetchFundamentalSnapshot,
  fetchFundamentalsConfig,
} from '@/features/fundamentals/api';
import type {
  FundamentalSnapshot,
  FundamentalsCompareRequest,
  FundamentalsCompareResponse,
  FundamentalsConfig,
} from '@/features/fundamentals/types';
import { queryKeys } from '@/lib/queryKeys';

export function useFundamentalsConfigQuery() {
  return useQuery<FundamentalsConfig>({
    queryKey: queryKeys.fundamentalsConfig(),
    queryFn: fetchFundamentalsConfig,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

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

export function useCompareFundamentalsMutation() {
  return useMutation<FundamentalsCompareResponse, Error, FundamentalsCompareRequest>({
    mutationFn: (request) => compareFundamentals(request),
  });
}

export function useRefreshFundamentalSnapshotMutation() {
  const queryClient = useQueryClient();
  return useMutation<FundamentalSnapshot, Error, string>({
    mutationFn: (symbol) => fetchFundamentalSnapshot(symbol, true),
    onSuccess: async (snapshot) => {
      await queryClient.invalidateQueries({ queryKey: ['fundamentals-snapshot', snapshot.symbol] });
    },
  });
}
