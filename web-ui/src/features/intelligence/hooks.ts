import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  candidateToPayload,
  getIntelligenceChat,
  getIntelligenceHistory,
  getIntelligenceLatest,
  getLatestEvidenceSummary,
  getRunTrace,
  getTickerRuns,
  postPositionReview,
  postStrategicReview,
  postIntelligenceAnalysis,
  refreshIntelligenceEvidence,
  postIntelligenceSweep,
  sendIntelligenceChatMessage,
  type IntelligenceChatMessagePayload,
  type PositionReviewPayload,
  type StrategicReviewPayload,
} from '@/features/intelligence/api';
import { transformIntelligence } from '@/features/intelligence/types';
import type {
  EvidenceRefreshResponse,
  EvidenceCacheSummary,
  HistoryEntry,
  IntelligenceChatResponse,
  SymbolIntelligence,
  SweepResponseAPI,
  SweepSymbolPayload,
} from '@/features/intelligence/types';
import type { PositionReview } from '@/features/intelligence/positionReviewTypes';
import type { StrategicReview } from '@/features/intelligence/strategicReviewTypes';
import type { RunTrace, RunIndexEntry } from '@/features/intelligence/traceTypes';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { queryKeys } from '@/lib/queryKeys';

export function findRunByAttemptId(
  runs: RunIndexEntry[],
  ticker: string,
  clientAttemptId: string,
): RunIndexEntry | null {
  const normalizedTicker = ticker.trim().toUpperCase();
  return runs.find(
    (run) =>
      run.ticker.trim().toUpperCase() === normalizedTicker
      && run.clientAttemptId === clientAttemptId,
  ) ?? null;
}

export function resolveRunId(
  runs: RunIndexEntry[] | undefined,
  attemptedRunId: string | null,
  cachedRunId: string | null | undefined,
  hasFailedAttempt = false,
): string | null {
  if (hasFailedAttempt) return attemptedRunId;
  if (attemptedRunId) return attemptedRunId;
  const modernRun = runs?.find((run) => run.clientAttemptId);
  if (modernRun) return modernRun.runId;
  if (cachedRunId) return cachedRunId;
  return runs?.[0]?.runId ?? null;
}

export function useIntelligenceAnalysisMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    SymbolIntelligence,
    Error,
    { ticker: string; candidate: SymbolAnalysisCandidate | null | undefined; position?: PositionWithMetrics | null; force?: boolean; attemptId?: string }
  >({
    mutationFn: async ({ ticker, candidate, position, force, attemptId }) => {
      const payload = candidateToPayload(candidate, position);
      if (!payload) throw new Error('No technical context available for this symbol');
      const api = await postIntelligenceAnalysis(ticker, payload, force, attemptId);
      return transformIntelligence(api);
    },
    onSuccess: (_data, { ticker }) => {
      // A fresh analysis is appended to history server-side; refresh the timeline.
      queryClient.invalidateQueries({ queryKey: queryKeys.intelligence.history(ticker) });
      queryClient.invalidateQueries({ queryKey: queryKeys.intelligence.latest(ticker) });
      queryClient.invalidateQueries({ queryKey: queryKeys.intelligence.chat(ticker) });
    },
  });
}

export function useEvidenceRefreshMutation() {
  const queryClient = useQueryClient();
  return useMutation<EvidenceRefreshResponse, Error, string>({
    mutationFn: refreshIntelligenceEvidence,
    onSuccess: (response, ticker) => {
      queryClient.setQueryData(
        queryKeys.intelligence.evidence(ticker),
        response,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.intelligence.evidenceLatest(ticker) });
    },
  });
}

export class IntelligenceIdentityError extends Error {
  constructor() {
    super('Intelligence identity mismatch');
    this.name = 'IntelligenceIdentityError';
  }
}

export function useIntelligenceLatestQuery(ticker: string, enabled: boolean) {
  return useQuery<SymbolIntelligence, Error>({
    queryKey: queryKeys.intelligence.latest(ticker),
    queryFn: async () => {
      const api = await getIntelligenceLatest(ticker);
      const intelligence = transformIntelligence(api);
      if (intelligence.symbol.trim().toUpperCase() !== ticker.trim().toUpperCase()) {
        throw new IntelligenceIdentityError();
      }
      return intelligence;
    },
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLatestEvidenceSummaryQuery(ticker: string, enabled: boolean) {
  return useQuery<EvidenceCacheSummary, Error>({
    queryKey: queryKeys.intelligence.evidenceLatest(ticker),
    queryFn: () => getLatestEvidenceSummary(ticker),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIntelligenceHistoryQuery(ticker: string, enabled: boolean) {
  return useQuery<HistoryEntry[], Error>({
    queryKey: queryKeys.intelligence.history(ticker),
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
    queryKey: queryKeys.intelligence.chat(ticker, analysisGeneratedAt ?? null),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.intelligence.chat(ticker) });
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
    queryKey: queryKeys.intelligence.runTrace(runId),
    queryFn: () => getRunTrace(runId as string),
    enabled: enabled && !!runId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTickerRuns(ticker: string, enabled: boolean) {
  return useQuery<RunIndexEntry[], Error>({
    queryKey: queryKeys.intelligence.runs(ticker),
    queryFn: () => getTickerRuns(ticker),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
