import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { runScreener } from '@/features/screener/api';
import type { ScreenerRequest, ScreenerResponse } from '@/features/screener/types';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';

interface AnalysisRequest {
  ticker: string;
  session: string;
  input: SymbolAnalysisCandidate | null;
  force: boolean;
  settings?: ScreenerRequest;
}

// Recomputed data belongs to this review; persisted runs remain immutable.
export function useCandidateAnalysis(
  ticker: string,
  input: SymbolAnalysisCandidate | null,
  selectionVersion = 0,
  benchmarkTicker: string | null = null,
  runRequest?: ScreenerRequest,
) {
  const normalized = ticker.trim().toUpperCase();
  const session = `${normalized}:${selectionVersion}`;
  const live = useRef({ session, input });
  live.current = { session, input };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [result, setResult] = useState<{
    request: AnalysisRequest;
    response: ScreenerResponse;
  } | null>(null);

  function matches(request: AnalysisRequest | undefined) {
    if (!request || request.session !== live.current.session || request.input !== live.current.input) return false;
    const workspace = useWorkspaceStore.getState();
    return selectionVersion === 0 || (
      workspace.selectedTicker === normalized && workspace.selectionVersion === selectionVersion
    );
  }

  const mutation = useMutation({
    mutationFn: async (request: AnalysisRequest) => {
      const response = await runScreener({
        ...request.settings,
        tickers: [request.ticker],
        top: 1,
        asofDate: undefined,
        includeHeld: true,
        forceRefresh: request.force,
      });
      if (!response.candidates.some((candidate) => candidate.ticker.trim().toUpperCase() === request.ticker)) {
        throw new Error(t('workspacePage.panels.analysis.computeAnalysis.noCandidate', { ticker: request.ticker }));
      }
      return response;
    },
    onSuccess: (response, request) => {
      if (mounted.current && matches(request)) setResult({ request, response });
    },
  });
  const displayed = result && matches(result.request) ? result.response : null;
  const request = (force: boolean) => mutation.mutate({ ticker: normalized, session, input, force, settings: runRequest });

  return {
    candidate: displayed?.candidates.find((candidate) => candidate.ticker.trim().toUpperCase() === normalized) ?? input,
    benchmarkTicker: displayed ? displayed.benchmarkTicker ?? null : benchmarkTicker,
    refreshedResult: displayed,
    isPending: matches(mutation.variables) && mutation.isPending,
    error: matches(mutation.variables) ? mutation.error : null,
    refresh: () => request(true),
    compute: () => request(false),
  };
}
