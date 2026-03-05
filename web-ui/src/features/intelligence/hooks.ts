import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchIntelligenceEducation,
  generateIntelligenceEducation,
  explainIntelligenceSymbol,
  createIntelligenceSymbolSet,
  deleteIntelligenceSymbolSet,
  fetchIntelligenceConfig,
  fetchIntelligenceOpportunities,
  fetchIntelligenceProviders,
  fetchIntelligenceRunStatus,
  fetchIntelligenceSymbolSets,
  runIntelligence,
  testIntelligenceProvider,
  updateIntelligenceConfig,
  updateIntelligenceSymbolSet,
} from '@/features/intelligence/api';
import {
  IntelligenceEducationGenerateRequest,
  IntelligenceEducationGenerateResponse,
  IntelligenceExplainSymbolRequest,
  IntelligenceExplainSymbolResponse,
  IntelligenceConfig,
  IntelligenceOpportunitiesResponse,
  IntelligenceProviderInfo,
  IntelligenceProviderTestRequest,
  IntelligenceProviderTestResponse,
  IntelligenceRunLaunchResponse,
  IntelligenceRunRequest,
  IntelligenceRunStatus,
  IntelligenceSymbolSet,
  IntelligenceSymbolSetUpsertRequest,
} from '@/features/intelligence/types';
import { queryKeys } from '@/lib/queryKeys';

export function useIntelligenceConfigQuery() {
  return useQuery<IntelligenceConfig>({
    queryKey: queryKeys.intelligenceConfig(),
    queryFn: fetchIntelligenceConfig,
  });
}

export function useUpdateIntelligenceConfigMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: IntelligenceConfig) => updateIntelligenceConfig(config),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.intelligenceConfig() });
    },
  });
}

export function useIntelligenceProvidersQuery() {
  return useQuery<IntelligenceProviderInfo[]>({
    queryKey: queryKeys.intelligenceProviders(),
    queryFn: fetchIntelligenceProviders,
    refetchOnWindowFocus: false,
  });
}

export function useTestIntelligenceProviderMutation() {
  return useMutation<IntelligenceProviderTestResponse, Error, IntelligenceProviderTestRequest>({
    mutationFn: (request) => testIntelligenceProvider(request),
  });
}

export function useIntelligenceSymbolSetsQuery() {
  return useQuery({
    queryKey: queryKeys.intelligenceSymbolSets(),
    queryFn: fetchIntelligenceSymbolSets,
  });
}

export function useCreateIntelligenceSymbolSetMutation() {
  const queryClient = useQueryClient();
  return useMutation<IntelligenceSymbolSet, Error, IntelligenceSymbolSetUpsertRequest>({
    mutationFn: (request) => createIntelligenceSymbolSet(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.intelligenceSymbolSets() });
    },
  });
}

export function useUpdateIntelligenceSymbolSetMutation() {
  const queryClient = useQueryClient();
  return useMutation<IntelligenceSymbolSet, Error, { id: string; payload: IntelligenceSymbolSetUpsertRequest }>({
    mutationFn: ({ id, payload }) => updateIntelligenceSymbolSet(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.intelligenceSymbolSets() });
    },
  });
}

export function useDeleteIntelligenceSymbolSetMutation() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteIntelligenceSymbolSet(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.intelligenceSymbolSets() });
    },
  });
}

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

export function useExplainIntelligenceSymbolMutation() {
  return useMutation<IntelligenceExplainSymbolResponse, Error, IntelligenceExplainSymbolRequest>({
    mutationFn: (request) => explainIntelligenceSymbol(request),
  });
}

export function useIntelligenceEducationQuery(symbol?: string, asofDate?: string, enabled: boolean = true) {
  const normalizedSymbol = symbol?.trim().toUpperCase();
  return useQuery<IntelligenceEducationGenerateResponse>({
    queryKey: queryKeys.intelligenceEducation(normalizedSymbol, asofDate),
    queryFn: () => fetchIntelligenceEducation(normalizedSymbol as string, asofDate),
    enabled: Boolean(normalizedSymbol) && enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useGenerateIntelligenceEducationMutation() {
  const queryClient = useQueryClient();
  return useMutation<IntelligenceEducationGenerateResponse, Error, IntelligenceEducationGenerateRequest>({
    mutationFn: (request) => generateIntelligenceEducation(request),
    onSuccess: async (response, request) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.intelligenceEducation(request.symbol.trim().toUpperCase(), response.asofDate),
      });
    },
  });
}
