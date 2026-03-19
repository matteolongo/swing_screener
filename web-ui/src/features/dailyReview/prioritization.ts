import type { DailyReviewCandidate } from '@/features/dailyReview/types';
import type { DecisionActionFilter } from '@/features/screener/prioritization';

export function filterDailyReviewCandidates(
  candidates: DailyReviewCandidate[],
  {
    recommendedOnly,
    actionFilter,
  }: {
    recommendedOnly: boolean;
    actionFilter: DecisionActionFilter;
  }
): DailyReviewCandidate[] {
  return candidates.filter((candidate) => {
    if (recommendedOnly && candidate.recommendation?.verdict !== 'RECOMMENDED') {
      return false;
    }
    if (actionFilter !== 'all' && candidate.decisionSummary?.action !== actionFilter) {
      return false;
    }
    return true;
  });
}
