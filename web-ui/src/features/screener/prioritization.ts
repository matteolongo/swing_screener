import type {
  DecisionAction,
  ScreenerCandidate,
} from '@/features/screener/types';

export type DecisionActionFilter = 'all' | DecisionAction;

export function prioritizeCandidates(candidates: ScreenerCandidate[]): ScreenerCandidate[] {
  return [...candidates]
    .sort((left, right) => {
      const leftRank = left.priorityRank ?? left.rank;
      const rightRank = right.priorityRank ?? right.rank;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      if (left.confidence !== right.confidence) {
        return right.confidence - left.confidence;
      }

      return left.ticker.localeCompare(right.ticker);
    })
    .map((candidate) => ({
      ...candidate,
      priorityRank: candidate.priorityRank ?? candidate.rank,
    }));
}

export function filterCandidates(
  candidates: ScreenerCandidate[],
  {
    recommendedOnly,
    actionFilter,
  }: {
    recommendedOnly: boolean;
    actionFilter: DecisionActionFilter;
  }
): ScreenerCandidate[] {
  return candidates.filter((candidate) => {
    if (recommendedOnly && candidate.recommendation?.workflowStatus !== 'ready') {
      return false;
    }
    if (actionFilter !== 'all' && candidate.decisionSummary?.action !== actionFilter) {
      return false;
    }
    return true;
  });
}

export function filterOutAddOns(candidates: ScreenerCandidate[]): ScreenerCandidate[] {
  const portfolioModes = new Set<string>(['ADD_ON', 'SCALE_BACK']);
  return candidates.filter((c) => !portfolioModes.has(c.sameSymbol?.mode ?? ''));
}
