import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  compareFundamentals,
  fetchDegiroCapabilityAudit,
  fetchDegiroPortfolioAudit,
  fetchFundamentalSnapshot,
  fetchFundamentalsConfig,
  fetchFundamentalsWarmupStatus,
  startFundamentalsWarmup,
} from '@/features/fundamentals/api';
import type {
  DegiroAuditRun,
  FundamentalSnapshot,
  FundamentalsCompareRequest,
  FundamentalsCompareResponse,
  FundamentalsConfig,
  FundamentalsWarmupLaunchResponse,
  FundamentalsWarmupRequest,
  FundamentalsWarmupStatus,
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

export function useStartFundamentalsWarmupMutation(
  onSuccess?: (data: FundamentalsWarmupLaunchResponse) => void
) {
  return useMutation<FundamentalsWarmupLaunchResponse, Error, FundamentalsWarmupRequest>({
    mutationFn: (request) => startFundamentalsWarmup(request),
    onSuccess,
  });
}

export function useFundamentalsWarmupStatus(jobId?: string) {
  return useQuery<FundamentalsWarmupStatus>({
    queryKey: queryKeys.fundamentalsWarmupStatus(jobId),
    queryFn: () => fetchFundamentalsWarmupStatus(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'error') {
        return false;
      }
      return 2000;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useDegiroCapabilityAuditMutation(onSuccess?: (data: DegiroAuditRun) => void) {
  return useMutation<DegiroAuditRun, Error, string[]>({
    mutationFn: fetchDegiroCapabilityAudit,
    onSuccess,
  });
}

export function useDegiroPortfolioAuditMutation(onSuccess?: (data: DegiroAuditRun) => void) {
  return useMutation<DegiroAuditRun, Error, void>({
    mutationFn: fetchDegiroPortfolioAudit,
    onSuccess,
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
