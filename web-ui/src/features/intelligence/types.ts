import type { DecisionAction, DecisionConviction } from '@/features/screener/types';
import type { IntelligenceRequestPayload } from '@/features/intelligence/api';

export type { DecisionAction, DecisionConviction };

export type CatalystUrgency = 'high' | 'medium' | 'low' | 'none';
export type IntelligenceEventDirection = 'bullish' | 'bearish' | 'neutral';
export type IntelligenceEventType = 'earnings' | 'macro' | 'dividend' | 'product_launch' | 'regulatory' | 'other';
export type PositionSignalAction = 'HOLD' | 'TRIM' | 'EXIT';
export type ExpectedHoldingPeriod = 'days' | '1-2_weeks' | '2-6_weeks' | 'unknown';
export type ThesisStatus = 'intact' | 'weakening' | 'broken' | 'unclear';
export type ProfitManagement = 'hold_full' | 'consider_trim' | 'trail_stop' | 'protect_breakeven' | 'exit';
export type OpportunityCost = 'low' | 'medium' | 'high';

export interface KeyNumber {
  label: string;
  value: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface PredictionBullet {
  direction: 'bullish' | 'bearish' | 'neutral';
  reason: string;
  reference: string;
}

export interface IntelligenceEvent {
  type: IntelligenceEventType;
  date: string | null;
  direction: IntelligenceEventDirection;
  summary: string;
}

export interface PositionSignal {
  action: PositionSignalAction;
  reason: string;
}

export interface PositionOutlookAPI {
  expected_holding_period: ExpectedHoldingPeriod;
  hold_until: string;
  next_review_trigger: string;
  thesis_status: ThesisStatus;
  invalidation_signals: string[];
  profit_management: ProfitManagement;
  opportunity_cost: OpportunityCost;
  confidence_decay: string;
}

export interface PositionOutlook {
  expectedHoldingPeriod: ExpectedHoldingPeriod;
  holdUntil: string;
  nextReviewTrigger: string;
  thesisStatus: ThesisStatus;
  invalidationSignals: string[];
  profitManagement: ProfitManagement;
  opportunityCost: OpportunityCost;
  confidenceDecay: string;
}

export interface SymbolIntelligenceAPI {
  symbol: string;
  generated_at: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  catalyst_urgency: CatalystUrgency;
  summary_line: string;
  narrative: string;
  upcoming_events: IntelligenceEvent[];
  position_signal: PositionSignal | null;
  position_outlook?: PositionOutlookAPI | null;
  sources: string[];
  inputs_used?: Record<string, Record<string, unknown>>;
  price_hook?: string | null;
  key_numbers?: KeyNumber[];
  risk_factors?: string[];
  prediction_bullets?: PredictionBullet[];
  past_trades_context?: string | null;
}

export interface SymbolIntelligence {
  symbol: string;
  generatedAt: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  catalystUrgency: CatalystUrgency;
  summaryLine: string;
  narrative: string;
  upcomingEvents: IntelligenceEvent[];
  positionSignal: PositionSignal | null;
  positionOutlook?: PositionOutlook | null;
  sources: string[];
  inputsUsed?: Record<string, Record<string, unknown>>;
  priceHook?: string | null;
  keyNumbers?: KeyNumber[];
  riskFactors?: string[];
  predictionBullets?: PredictionBullet[];
  pastTradesContext?: string | null;
}

function transformPositionOutlook(api: PositionOutlookAPI | null | undefined): PositionOutlook | null {
  if (!api) return null;
  return {
    expectedHoldingPeriod: api.expected_holding_period,
    holdUntil: api.hold_until,
    nextReviewTrigger: api.next_review_trigger,
    thesisStatus: api.thesis_status,
    invalidationSignals: api.invalidation_signals ?? [],
    profitManagement: api.profit_management,
    opportunityCost: api.opportunity_cost,
    confidenceDecay: api.confidence_decay,
  };
}

export function transformIntelligence(api: SymbolIntelligenceAPI): SymbolIntelligence {
  return {
    symbol: api.symbol,
    generatedAt: api.generated_at,
    action: api.action,
    conviction: api.conviction,
    catalystUrgency: api.catalyst_urgency,
    summaryLine: api.summary_line,
    narrative: api.narrative,
    upcomingEvents: api.upcoming_events ?? [],
    positionSignal: api.position_signal ?? null,
    positionOutlook: transformPositionOutlook(api.position_outlook),
    sources: api.sources ?? [],
    inputsUsed: api.inputs_used ?? {},
    priceHook: api.price_hook ?? null,
    keyNumbers: api.key_numbers ?? [],
    riskFactors: api.risk_factors ?? [],
    predictionBullets: api.prediction_bullets ?? [],
    pastTradesContext: api.past_trades_context ?? null,
  };
}

export type { IntelligenceRequestPayload };

export interface OpenPositionIntelligenceSummaryAPI {
  position_id: string;
  ticker: string;
  entry_price: number;
  stop_price: number;
  current_price: number | null;
  r_now: number;
  days_open: number;
  stop_action: string;
  stop_suggested: number;
  stop_reason: string;
  intelligence: SymbolIntelligenceAPI | null;
}

export interface OpenPositionIntelligenceSummary {
  positionId: string;
  ticker: string;
  entryPrice: number;
  stopPrice: number;
  currentPrice: number | null;
  rNow: number;
  daysOpen: number;
  stopAction: string;
  stopSuggested: number;
  stopReason: string;
  intelligence: SymbolIntelligence | null;
}

export function transformOpenPositionIntelligence(
  api: OpenPositionIntelligenceSummaryAPI,
): OpenPositionIntelligenceSummary {
  return {
    positionId: api.position_id,
    ticker: api.ticker,
    entryPrice: api.entry_price,
    stopPrice: api.stop_price,
    currentPrice: api.current_price,
    rNow: api.r_now,
    daysOpen: api.days_open,
    stopAction: api.stop_action,
    stopSuggested: api.stop_suggested,
    stopReason: api.stop_reason,
    intelligence: api.intelligence ? transformIntelligence(api.intelligence) : null,
  };
}

export interface SweepSymbolPayload {
  ticker: string;
  request: IntelligenceRequestPayload;
}

export interface SweepResponseAPI {
  analyzed: string[];
  failed: Array<{ ticker: string; error: string }>;
}
