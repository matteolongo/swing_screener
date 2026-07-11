import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  candidateToPayload,
  getIntelligenceChat,
  getIntelligenceHistory,
  getIntelligenceLatest,
  getRunTrace,
  getTickerRuns,
  postPositionReview,
  postStrategicReview,
  postIntelligenceAnalysis,
  postIntelligenceSweep,
  sendIntelligenceChatMessage,
  type IntelligenceChatMessagePayload,
  type PositionReviewPayload,
  type StrategicReviewPayload,
} from '@/features/intelligence/api';
import { transformIntelligence } from '@/features/intelligence/types';
import type { HistoryEntry, IntelligenceChatResponse, SymbolIntelligence, SweepResponseAPI, SweepSymbolPayload } from '@/features/intelligence/types';
import type { PositionReview } from '@/features/intelligence/positionReviewTypes';
import type { StrategicReview } from '@/features/intelligence/strategicReviewTypes';
import type { RunTrace, RunIndexEntry } from '@/features/intelligence/traceTypes';
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
      queryClient.invalidateQueries({ queryKey: ['intelligence', 'chat', ticker] });
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

export function useIntelligenceChatQuery(
  ticker: string,
  enabled: boolean,
  analysisGeneratedAt: string | null | undefined,
) {
  return useQuery<IntelligenceChatResponse, Error>({
    queryKey: ['intelligence', 'chat', ticker, analysisGeneratedAt ?? null],
    queryFn: () => getIntelligenceChat(ticker),
    enabled,
    retry: false,
    staleTime: 30 * 1000,
  });
}

export function useSendIntelligenceChatMutation(ticker: string) {
  const queryClient = useQueryClient();
  return useMutation<IntelligenceChatResponse, Error, IntelligenceChatMessagePayload>({
    mutationFn: (payload) => sendIntelligenceChatMessage(ticker, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence', 'chat', ticker] });
    },
  });
}

export function usePositionReviewMutation() {
  return useMutation<PositionReview, Error, PositionReviewPayload>({
    mutationFn: postPositionReview,
  });
}

export function useStrategicReviewMutation() {
  return useMutation<StrategicReview, Error, StrategicReviewPayload>({
    mutationFn: postStrategicReview,
  });
}

export function useIntelligenceSweepMutation() {
  return useMutation<SweepResponseAPI, Error, SweepSymbolPayload[]>({
    mutationFn: postIntelligenceSweep,
  });
}

export function useRunTrace(runId: string | null | undefined, enabled: boolean) {
  return useQuery<RunTrace, Error>({
    queryKey: ['intelligence', 'runTrace', runId],
    queryFn: () => getRunTrace(runId as string),
    enabled: enabled && !!runId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTickerRuns(ticker: string, enabled: boolean) {
  return useQuery<RunIndexEntry[], Error>({
    queryKey: ['intelligence', 'runs', ticker],
    queryFn: () => getTickerRuns(ticker),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
