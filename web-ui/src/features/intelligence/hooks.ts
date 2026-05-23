import { useMutation } from '@tanstack/react-query';
import { candidateToPayload, postIntelligenceAnalysis } from '@/features/intelligence/api';
import { transformIntelligence } from '@/features/intelligence/types';
import type { SymbolIntelligence } from '@/features/intelligence/types';
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
