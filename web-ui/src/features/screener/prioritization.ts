import type {
  DecisionAction,
  DecisionConviction,
  ScreenerCandidate,
} from '@/features/screener/types';

export type DecisionActionFilter = 'all' | DecisionAction;

const ACTION_PRIORITY: Record<DecisionAction, number> = {
  BUY_NOW: 6,
  BUY_ON_PULLBACK: 5,
  WAIT_FOR_BREAKOUT: 4,
  WATCH: 3,
  TACTICAL_ONLY: 2,
  MANAGE_ONLY: 1,
  AVOID: 0,
};

const CONVICTION_PRIORITY: Record<DecisionConviction, number> = {
  high: 2,
  medium: 1,
  low: 0,
};

function actionPriority(candidate: ScreenerCandidate): number {
  const action = candidate.decisionSummary?.action;
  return action ? ACTION_PRIORITY[action] : -1;
}

function convictionPriority(candidate: ScreenerCandidate): number {
  const conviction = candidate.decisionSummary?.conviction;
  return conviction ? CONVICTION_PRIORITY[conviction] : -1;
}

export function prioritizeCandidates(candidates: ScreenerCandidate[]): ScreenerCandidate[] {
  return [...candidates]
    .sort((left, right) => {
      const actionDelta = actionPriority(right) - actionPriority(left);
      if (actionDelta !== 0) {
        return actionDelta;
      }

      const convictionDelta = convictionPriority(right) - convictionPriority(left);
      if (convictionDelta !== 0) {
        return convictionDelta;
      }

      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      if (left.confidence !== right.confidence) {
        return right.confidence - left.confidence;
      }

      return left.ticker.localeCompare(right.ticker);
    })
    .map((candidate, index) => ({
      ...candidate,
      priorityRank: index + 1,
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
    if (recommendedOnly && candidate.recommendation?.verdict !== 'RECOMMENDED') {
      return false;
    }
    if (actionFilter !== 'all' && candidate.decisionSummary?.action !== actionFilter) {
      return false;
    }
    return true;
  });
}
