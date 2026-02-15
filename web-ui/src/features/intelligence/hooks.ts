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
      await queryClient.invalidateQueries({ queryKey: queryKeys.intelligenceOpportunities() });
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

export function useIntelligenceOpportunities(asofDate?: string, enabled: boolean = true) {
  return useQuery<IntelligenceOpportunitiesResponse>({
    queryKey: queryKeys.intelligenceOpportunities(asofDate),
    queryFn: () => fetchIntelligenceOpportunities(asofDate),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

