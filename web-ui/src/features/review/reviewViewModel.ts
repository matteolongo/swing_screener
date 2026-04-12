import type {
  DailyReviewPositionClose,
  DailyReviewPositionHold,
  DailyReviewPositionUpdate,
} from '@/features/dailyReview/types';
import type { Position } from '@/features/portfolio/types';
import type { PositionCaseStudy } from '@/features/practice/types';

type DailyReviewPositionEntry =
  | DailyReviewPositionHold
  | DailyReviewPositionUpdate
  | DailyReviewPositionClose
  | undefined;

function computeCurrentRNow(position: Position): number | undefined {
  if (!position.initialRisk || position.initialRisk <= 0 || position.currentPrice == null) {
    return undefined;
  }
  return (position.currentPrice - position.entryPrice) / position.initialRisk;
}

export function buildPositionCaseStudy(
  position: Position,
  dailyReviewEntry?: DailyReviewPositionEntry,
): PositionCaseStudy {
  const currentRNow = dailyReviewEntry?.rNow ?? computeCurrentRNow(position);
  const invalidationCheck = position.stopPrice
    ? `If ${position.ticker} closes below ${position.stopPrice.toFixed(2)}, the original risk plan is broken.`
    : undefined;
  const nextMilestone = currentRNow == null
    ? 'Define the next price level that would confirm the thesis is still improving.'
    : currentRNow >= 1
      ? 'Protect open profit and decide what would justify holding for a bigger move.'
      : currentRNow >= 0
        ? 'Ask what evidence would move this position from “acceptable” to “high conviction.”'
        : 'Decide whether the thesis is intact or whether the loss is signaling a broken setup.';

  return {
    position,
    currentRNow,
    setupType: position.thesis?.split('.')[0] || undefined,
    keyQuestion:
      currentRNow != null && currentRNow < 0
        ? 'Is the original thesis still valid, or are you just hoping the trade recovers?'
        : 'What evidence tells you this position still deserves capital today?',
    invalidationCheck,
    nextMilestone,
  };
}
