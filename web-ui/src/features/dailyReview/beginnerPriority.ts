// web-ui/src/features/dailyReview/beginnerPriority.ts

import type { DailyReview, DailyReviewPositionClose, DailyReviewPositionUpdate, PendingOrderReview } from '@/features/dailyReview/types';
import type { BeginnerDecision } from '@/features/screener/beginnerDecision';
import type { WatchItem } from '@/features/watchlist/types';
import { t } from '@/i18n/t';

export type TodayPriorityKind =
  | 'close_position'
  | 'update_stop'
  | 'pending_orders'
  | 'watchlist_near_trigger'
  | 'best_candidate'
  | 'run_screener'
  | 'no_action';

export interface TodayPriority {
  kind: TodayPriorityKind;
  ticker?: string;
  headline: string;
  reason: string;
  risk?: string;
  actionLabel: string;
  closeItem?: DailyReviewPositionClose;
  updateItem?: DailyReviewPositionUpdate;
  watchItem?: WatchItem;
  decision?: BeginnerDecision;
  pendingOrderCount?: number;
}

export function pickTodayPriority(
  review: DailyReview | null | undefined,
  pendingEntryOrderCount: number,
  bestDecision: BeginnerDecision | undefined,
  pendingOrdersReview?: PendingOrderReview[],
): TodayPriority {
  // 1. Positions to close
  if (review && review.positionsClose.length > 0) {
    const item = review.positionsClose[0];
    return {
      kind: 'close_position',
      ticker: item.ticker,
      headline: `${item.ticker} needs to be closed`,
      reason: item.reason,
      risk: 'Holding past the exit signal increases loss risk.',
      actionLabel: t('todayPage.todayPriorityCard.action.close_position'),
      closeItem: item,
    };
  }

  // 2. Positions needing stop update
  if (review && review.positionsUpdateStop.length > 0) {
    const item = review.positionsUpdateStop[0];
    return {
      kind: 'update_stop',
      ticker: item.ticker,
      headline: `${item.ticker} needs a stop update`,
      reason: item.reason,
      risk: 'The current stop may be too loose.',
      actionLabel: 'Update stop',
      updateItem: item,
    };
  }

  // 3. Pending entry orders
  if (pendingEntryOrderCount > 0) {
    const n = pendingEntryOrderCount;
    const s = n === 1 ? '' : 's';
    const hasStale = (pendingOrdersReview ?? []).some((o) => o.category === 'stale');
    const reason = hasStale
      ? t('todayPage.todayPriorityCard.kinds.pending_orders_stale')
      : 'Review whether conditions still match the original trade plan.';
    return {
      kind: 'pending_orders',
      headline: `${n} pending order${s} need review`,
      reason,
      actionLabel: 'Go to Orders',
      pendingOrderCount: n,
    };
  }

  // 4. Watchlist near trigger
  if (review && review.watchlistNearTrigger.length > 0) {
    const item = review.watchlistNearTrigger[0];
    return {
      kind: 'watchlist_near_trigger',
      ticker: item.ticker,
      headline: `${item.ticker} is near trigger`,
      reason: 'Check whether the price action confirms your entry plan.',
      actionLabel: 'Review',
      watchItem: item,
    };
  }

  // 5. Best actionable candidate
  if (
    bestDecision !== undefined &&
    bestDecision.orderReadiness !== 'avoid' &&
    bestDecision.orderReadiness !== 'manage_existing'
  ) {
    return {
      kind: 'best_candidate',
      ticker: bestDecision.ticker,
      headline: bestDecision.headline,
      reason: bestDecision.plainReason,
      risk: bestDecision.mainRisk,
      actionLabel: bestDecision.nextStepLabel,
      decision: bestDecision,
    };
  }

  // 6. No review data — prompt to run screener
  if (review === null || review === undefined) {
    return {
      kind: 'run_screener',
      headline: t('todayPage.todayPriorityCard.headline.run_screener'),
      reason: 'No screener results yet for today.',
      actionLabel: t('todayPage.todayPriorityCard.action.run_screener'),
    };
  }

  // 7. Fallback — nothing urgent
  return {
    kind: 'no_action',
    headline: 'Nothing urgent today',
    reason: 'All positions are being managed. Check back after market close.',
    actionLabel: 'View positions',
  };
}
