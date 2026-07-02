/**
 * buildInboxItems — flattens the bucketed DailyReview into a single
 * prioritized inbox. Pure data adapter: no React, no i18n.
 */

import type {
  DailyReview,
  DailyReviewCandidate,
  PendingOrderReview,
} from './types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import type { OpenPositionIntelligenceSummary } from '@/features/intelligence/types';

export type InboxItemKind =
  | 'close'
  | 'updateStop'
  | 'exitSignal'
  | 'staleOrder'
  | 'addOn'
  | 'newCandidate'
  | 'watch'
  | 'weeklyReview';

export interface InboxItem {
  id: string; // `${kind}:${ticker|orderId|'weekly'}`
  kind: InboxItemKind;
  ticker: string | null; // null only for weeklyReview
  rNow?: number;
  reason: string; // one-liner
  detail?: string; // expandable "why" extra text
  position?: PositionWithMetrics;
  stopSuggested?: number;
  stopCurrent?: number;
  exhaustionLabel?: 'fine' | 'watch' | 'exit';
  candidate?: DailyReviewCandidate;
  orderId?: string;
  orderCategory?: 'stale' | 'no_data';
  daysPending?: number;
  distanceToTriggerPct?: number;
  positionSignal?: 'HOLD' | 'TRIM' | 'EXIT';
}

export interface BuildInboxInput {
  review: DailyReview | undefined;
  positionById: Map<string, PositionWithMetrics>;
  intelligenceByTicker: Map<string, OpenPositionIntelligenceSummary>;
  weeklyReviewDue: boolean;
}

function narrowExhaustionLabel(label: string | null | undefined): 'fine' | 'watch' | 'exit' | undefined {
  return label === 'fine' || label === 'watch' || label === 'exit' ? label : undefined;
}

function positionSignalFor(
  ticker: string,
  intelligenceByTicker: Map<string, OpenPositionIntelligenceSummary>,
): 'HOLD' | 'TRIM' | 'EXIT' | undefined {
  return intelligenceByTicker.get(ticker)?.intelligence?.positionSignal?.action;
}

function candidateReason(candidate: DailyReviewCandidate): string {
  return candidate.decisionSummary?.whyNow || candidate.recommendation?.reasonsShort?.[0] || candidate.signal;
}

function staleOrderReason(order: PendingOrderReview): string {
  return order.note || order.category;
}

export function buildInboxItems(input: BuildInboxInput): InboxItem[] {
  const { review, positionById, intelligenceByTicker, weeklyReviewDue } = input;
  const items: InboxItem[] = [];

  for (const close of review?.positionsClose ?? []) {
    items.push({
      id: `close:${close.ticker}`,
      kind: 'close',
      ticker: close.ticker,
      rNow: close.rNow,
      reason: close.reason,
      position: positionById.get(close.positionId),
      positionSignal: positionSignalFor(close.ticker, intelligenceByTicker),
    });
  }

  for (const update of review?.positionsUpdateStop ?? []) {
    items.push({
      id: `updateStop:${update.ticker}`,
      kind: 'updateStop',
      ticker: update.ticker,
      rNow: update.rNow,
      reason: update.reason,
      position: positionById.get(update.positionId),
      stopSuggested: update.stopSuggested,
      stopCurrent: update.stopCurrent,
      exhaustionLabel: narrowExhaustionLabel(update.exhaustionLabel),
    });
  }

  for (const exit of review?.positionsExitSignal ?? []) {
    items.push({
      id: `exitSignal:${exit.ticker}`,
      kind: 'exitSignal',
      ticker: exit.ticker,
      rNow: exit.rNow,
      reason: exit.reason,
      position: positionById.get(exit.positionId),
      positionSignal: positionSignalFor(exit.ticker, intelligenceByTicker),
    });
  }

  for (const order of review?.pendingOrdersReview ?? []) {
    if (order.category === 'still_valid') continue;
    items.push({
      id: `staleOrder:${order.orderId}`,
      kind: 'staleOrder',
      ticker: order.ticker,
      reason: staleOrderReason(order),
      orderId: order.orderId,
      orderCategory: order.category,
      daysPending: order.daysPending,
    });
  }

  for (const addOn of review?.positionsAddOnCandidates ?? []) {
    items.push({
      id: `addOn:${addOn.ticker}`,
      kind: 'addOn',
      ticker: addOn.ticker,
      reason: candidateReason(addOn),
      candidate: addOn,
    });
  }

  for (const candidate of review?.newCandidates ?? []) {
    items.push({
      id: `newCandidate:${candidate.ticker}`,
      kind: 'newCandidate',
      ticker: candidate.ticker,
      reason: candidateReason(candidate),
      candidate,
    });
  }

  for (const watch of review?.watchlistNearTrigger ?? []) {
    items.push({
      id: `watch:${watch.ticker}`,
      kind: 'watch',
      ticker: watch.ticker,
      reason: watch.signal || '',
      distanceToTriggerPct: watch.distanceToTriggerPct,
    });
  }

  if (weeklyReviewDue) {
    items.push({
      id: 'weeklyReview:weekly',
      kind: 'weeklyReview',
      ticker: null,
      reason: '',
    });
  }

  return items;
}
