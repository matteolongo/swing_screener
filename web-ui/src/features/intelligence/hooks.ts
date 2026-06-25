import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  candidateToPayload,
  getIntelligenceHistory,
  getIntelligenceLatest,
  postIntelligenceAnalysis,
  postIntelligenceSweep,
} from '@/features/intelligence/api';
import { transformIntelligence } from '@/features/intelligence/types';
import type { HistoryEntry, SymbolIntelligence, SweepResponseAPI, SweepSymbolPayload } from '@/features/intelligence/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';

export function useIntelligenceAnalysisMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    SymbolIntelligence,
    Error,
    { ticker: string; candidate: SymbolAnalysisCandidate | null | undefined; position?: PositionWithMetrics | null; force?: boolean }
  >({
    mutationFn: async ({ ticker, candidate, position, force }) => {
      const payload = candidateToPayload(candidate, position);
      if (!payload) throw new Error('No technical context available for this symbol');
      const api = await postIntelligenceAnalysis(ticker, payload, force);
      return transformIntelligence(api);
    },
    onSuccess: (_data, { ticker }) => {
      // A fresh analysis is appended to history server-side; refresh the timeline.
      queryClient.invalidateQueries({ queryKey: ['intelligence', 'history', ticker] });
      queryClient.invalidateQueries({ queryKey: ['intelligence', 'latest', ticker] });
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

export function useIntelligenceHistoryQuery(ticker: string, enabled: boolean) {
  return useQuery<HistoryEntry[], Error>({
    queryKey: ['intelligence', 'history', ticker],
    queryFn: () => getIntelligenceHistory(ticker),
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
