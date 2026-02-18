import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchIntelligenceOpportunities,
  fetchIntelligenceRunStatus,
  runIntelligence,
} from '@/features/intelligence/api';
import {
  IntelligenceOpportunitiesResponse,
  IntelligenceRunLaunchResponse,
  IntelligenceRunRequest,
  IntelligenceRunStatus,
} from '@/features/intelligence/types';
import { queryKeys } from '@/lib/queryKeys';

export function useRunIntelligenceMutation(
  onSuccess?: (data: IntelligenceRunLaunchResponse) => void
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: IntelligenceRunRequest) => runIntelligence(request),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'intelligence-opportunities',
      });
      onSuccess?.(data);
    },
  });
}

export function useIntelligenceRunStatus(jobId?: string) {
  return useQuery<IntelligenceRunStatus>({
    queryKey: queryKeys.intelligenceRunStatus(jobId),
    queryFn: () => fetchIntelligenceRunStatus(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'error') {
        return false;
      }
      return 2500;
    },
    retry: false,
  });
}

export function useIntelligenceOpportunitiesScoped(
  asofDate?: string,
  symbols?: string[],
  enabled: boolean = true
) {
  const normalizedSymbols = (symbols ?? [])
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => symbol.length > 0);
  const symbolScope = normalizedSymbols.join(',');
  return useQuery<IntelligenceOpportunitiesResponse>({
    queryKey: queryKeys.intelligenceOpportunities(asofDate, symbolScope || undefined),
    queryFn: () => fetchIntelligenceOpportunities(asofDate, normalizedSymbols),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
