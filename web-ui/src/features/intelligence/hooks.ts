import { useMutation, useQuery } from '@tanstack/react-query';
import {
  candidateToPayload,
  getIntelligenceLatest,
  postIntelligenceAnalysis,
  postIntelligenceSweep,
} from '@/features/intelligence/api';
import { transformIntelligence } from '@/features/intelligence/types';
import type { SymbolIntelligence, SweepResponseAPI, SweepSymbolPayload } from '@/features/intelligence/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';

export function useIntelligenceAnalysisMutation() {
  return useMutation<
    SymbolIntelligence,
    Error,
    { ticker: string; candidate: SymbolAnalysisCandidate | null | undefined }
  >({
    mutationFn: async ({ ticker, candidate }) => {
      const payload = candidateToPayload(candidate);
      if (!payload) throw new Error('No technical context available for this symbol');
      const api = await postIntelligenceAnalysis(ticker, payload);
      return transformIntelligence(api);
    },
  });
}

export function useIntelligenceLatestQuery(ticker: string, enabled: boolean) {
  return useQuery<SymbolIntelligence, Error>({
    queryKey: ['intelligence', 'latest', ticker],
    queryFn: async () => {
      const api = await getIntelligenceLatest(ticker);
      return transformIntelligence(api);
    },
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIntelligenceSweepMutation() {
  return useMutation<SweepResponseAPI, Error, SweepSymbolPayload[]>({
    mutationFn: postIntelligenceSweep,
  });
}
