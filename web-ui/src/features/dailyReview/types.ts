/**
 * Daily Review types and transformations
 */

import { Recommendation, RecommendationAPI, transformRecommendation } from '@/types/recommendation';
import {
  type DecisionSummary,
  type DecisionSummaryAPI,
  type SameSymbolCandidateContext,
} from '@/features/screener/types';

// API response types (snake_case from backend)
export interface DailyReviewCandidateAPI {
  ticker: string;
  rank?: number | null;
  priority_rank?: number | null;
  confidence?: number | null;
  signal: string;
  close: number;
  entry: number;
  stop: number;
  shares: number;
  r_reward: number;
  name: string | null;
  sector: string | null;
  suggested_order_type?: string | null;
  suggested_order_price?: number | null;
  execution_note?: string | null;
  recommendation?: RecommendationAPI | null;
  decision_summary?: DecisionSummaryAPI | null;
  same_symbol?: {
    mode: SameSymbolCandidateContext['mode'];
    position_id?: string | null;
    current_position_entry?: number | null;
    current_position_stop?: number | null;
    fresh_setup_stop?: number | null;
    execution_stop?: number | null;
    pending_entry_exists?: boolean;
    add_on_count?: number;
    max_add_ons?: number;
    reason?: string;
  } | null;
}

export interface DailyReviewPositionHoldAPI {
  position_id: string;
  ticker: string;
  entry_price: number;
  stop_price: number;
  current_price: number;
  r_now: number;
  reason: string;
}

export interface DailyReviewPositionUpdateAPI {
  position_id: string;
  ticker: string;
  entry_price: number;
  stop_current: number;
  stop_suggested: number;
  current_price: number;
  r_now: number;
  reason: string;
}

export interface DailyReviewPositionCloseAPI {
  position_id: string;
  ticker: string;
  entry_price: number;
  stop_price: number;
  current_price: number;
  r_now: number;
  reason: string;
}

export interface DailyReviewSummaryAPI {
  total_positions: number;
  no_action: number;
  update_stop: number;
  close_positions: number;
  new_candidates: number;
  add_on_candidates: number;
  review_date: string;
}

export interface DailyReviewAPI {
  new_candidates: DailyReviewCandidateAPI[];
  positions_add_on_candidates: DailyReviewCandidateAPI[];
  positions_hold: DailyReviewPositionHoldAPI[];
  positions_update_stop: DailyReviewPositionUpdateAPI[];
  positions_close: DailyReviewPositionCloseAPI[];
  summary: DailyReviewSummaryAPI;
}

// Frontend types (camelCase)
export interface DailyReviewCandidate {
  ticker: string;
  rank?: number;
  priorityRank?: number;
  confidence?: number;
  signal: string;
  close: number;
  entry: number;
  stop: number;
  shares: number;
  rReward: number;
  name: string | null;
  sector: string | null;
  suggestedOrderType?: string;
  suggestedOrderPrice?: number;
  executionNote?: string;
  recommendation?: Recommendation;
  decisionSummary?: DecisionSummary;
  sameSymbol?: SameSymbolCandidateContext;
}

export interface DailyReviewPositionHold {
  positionId: string;
  ticker: string;
  entryPrice: number;
  stopPrice: number;
  currentPrice: number;
  rNow: number;
  reason: string;
}

export interface DailyReviewPositionUpdate {
  positionId: string;
  ticker: string;
  entryPrice: number;
  stopCurrent: number;
  stopSuggested: number;
  currentPrice: number;
  rNow: number;
  reason: string;
}

export interface DailyReviewPositionClose {
  positionId: string;
  ticker: string;
  entryPrice: number;
  stopPrice: number;
  currentPrice: number;
  rNow: number;
  reason: string;
}

export interface DailyReviewSummary {
  totalPositions: number;
  noAction: number;
  updateStop: number;
  closePositions: number;
  newCandidates: number;
  addOnCandidates: number;
  reviewDate: string;
}

export interface DailyReview {
  newCandidates: DailyReviewCandidate[];
  positionsAddOnCandidates: DailyReviewCandidate[];
  positionsHold: DailyReviewPositionHold[];
  positionsUpdateStop: DailyReviewPositionUpdate[];
  positionsClose: DailyReviewPositionClose[];
  summary: DailyReviewSummary;
}

// Transform functions
export function transformCandidate(api: DailyReviewCandidateAPI): DailyReviewCandidate {
  return {
    ticker: api.ticker,
    rank: api.rank ?? undefined,
    priorityRank: api.priority_rank ?? undefined,
    confidence: api.confidence ?? undefined,
    signal: api.signal,
    close: api.close,
    entry: api.entry,
    stop: api.stop,
    shares: api.shares,
    rReward: api.r_reward,
    name: api.name,
    sector: api.sector,
    suggestedOrderType: api.suggested_order_type ?? undefined,
    suggestedOrderPrice: api.suggested_order_price ?? undefined,
    executionNote: api.execution_note ?? undefined,
    recommendation: api.recommendation ? transformRecommendation(api.recommendation) : undefined,
    decisionSummary: api.decision_summary
      ? {
          symbol: api.decision_summary.symbol,
          action: api.decision_summary.action,
          conviction: api.decision_summary.conviction,
          technicalLabel: api.decision_summary.technical_label,
          fundamentalsLabel: api.decision_summary.fundamentals_label,
          valuationLabel: api.decision_summary.valuation_label,
          catalystLabel: api.decision_summary.catalyst_label,
          whyNow: api.decision_summary.why_now,
          whatToDo: api.decision_summary.what_to_do,
          mainRisk: api.decision_summary.main_risk,
          tradePlan: {
            entry: api.decision_summary.trade_plan?.entry ?? undefined,
            stop: api.decision_summary.trade_plan?.stop ?? undefined,
            target: api.decision_summary.trade_plan?.target ?? undefined,
            rr: api.decision_summary.trade_plan?.rr ?? undefined,
          },
          valuationContext: {
            method: api.decision_summary.valuation_context?.method ?? 'not_available',
            summary: api.decision_summary.valuation_context?.summary ?? undefined,
            trailingPe: api.decision_summary.valuation_context?.trailing_pe ?? undefined,
            priceToSales: api.decision_summary.valuation_context?.price_to_sales ?? undefined,
            bookValuePerShare: api.decision_summary.valuation_context?.book_value_per_share ?? undefined,
            priceToBook: api.decision_summary.valuation_context?.price_to_book ?? undefined,
            bookToPrice: api.decision_summary.valuation_context?.book_to_price ?? undefined,
            fairValueLow: api.decision_summary.valuation_context?.fair_value_low ?? undefined,
            fairValueBase: api.decision_summary.valuation_context?.fair_value_base ?? undefined,
            fairValueHigh: api.decision_summary.valuation_context?.fair_value_high ?? undefined,
            premiumDiscountPct: api.decision_summary.valuation_context?.premium_discount_pct ?? undefined,
          },
          drivers: {
            positives: api.decision_summary.drivers?.positives ?? [],
            negatives: api.decision_summary.drivers?.negatives ?? [],
            warnings: api.decision_summary.drivers?.warnings ?? [],
          },
        }
      : undefined,
    sameSymbol: api.same_symbol
      ? {
          mode: api.same_symbol.mode,
          positionId: api.same_symbol.position_id ?? undefined,
          currentPositionEntry: api.same_symbol.current_position_entry ?? undefined,
          currentPositionStop: api.same_symbol.current_position_stop ?? undefined,
          freshSetupStop: api.same_symbol.fresh_setup_stop ?? undefined,
          executionStop: api.same_symbol.execution_stop ?? undefined,
          pendingEntryExists: api.same_symbol.pending_entry_exists ?? false,
          addOnCount: api.same_symbol.add_on_count ?? 0,
          maxAddOns: api.same_symbol.max_add_ons ?? undefined,
          reason: api.same_symbol.reason ?? '',
        }
      : undefined,
  };
}

export function transformPositionHold(api: DailyReviewPositionHoldAPI): DailyReviewPositionHold {
  return {
    positionId: api.position_id,
    ticker: api.ticker,
    entryPrice: api.entry_price,
    stopPrice: api.stop_price,
    currentPrice: api.current_price,
    rNow: api.r_now,
    reason: api.reason,
  };
}

export function transformPositionUpdate(api: DailyReviewPositionUpdateAPI): DailyReviewPositionUpdate {
  return {
    positionId: api.position_id,
    ticker: api.ticker,
    entryPrice: api.entry_price,
    stopCurrent: api.stop_current,
    stopSuggested: api.stop_suggested,
    currentPrice: api.current_price,
    rNow: api.r_now,
    reason: api.reason,
  };
}

export function transformPositionClose(api: DailyReviewPositionCloseAPI): DailyReviewPositionClose {
  return {
    positionId: api.position_id,
    ticker: api.ticker,
    entryPrice: api.entry_price,
    stopPrice: api.stop_price,
    currentPrice: api.current_price,
    rNow: api.r_now,
    reason: api.reason,
  };
}

export function transformSummary(api: DailyReviewSummaryAPI): DailyReviewSummary {
  return {
    totalPositions: api.total_positions,
    noAction: api.no_action,
    updateStop: api.update_stop,
    closePositions: api.close_positions,
    newCandidates: api.new_candidates,
    addOnCandidates: api.add_on_candidates,
    reviewDate: api.review_date,
  };
}

export function transformDailyReview(api: DailyReviewAPI): DailyReview {
  return {
    newCandidates: api.new_candidates.map(transformCandidate),
    positionsAddOnCandidates: (api.positions_add_on_candidates ?? []).map(transformCandidate),
    positionsHold: api.positions_hold.map(transformPositionHold),
    positionsUpdateStop: api.positions_update_stop.map(transformPositionUpdate),
    positionsClose: api.positions_close.map(transformPositionClose),
    summary: transformSummary(api.summary),
  };
}
