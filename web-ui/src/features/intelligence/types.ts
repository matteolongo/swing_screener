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

export type PriceMoveDirection = 'up' | 'down' | 'flat';

export interface PriceMoveDriver {
  label: string;
  detail: string;
}

export interface PositionMoveExplanation {
  direction: PriceMoveDirection;
  summary: string;
  drivers: PriceMoveDriver[];
}

export type GapDirection = 'gap_up' | 'gap_down' | 'flat';
export type GapMagnitude = 'minor' | 'moderate' | 'large';
export type PreOpenConfidence = 'high' | 'medium' | 'low';
export type ThesisDeltaStatus = 'new' | 'confirmed' | 'weakening' | 'invalidated';

export interface PreOpenDriver {
  summary: string;
  sourceUrl: string | null;
}

export interface PreOpenDriverAPI {
  summary: string;
  source_url: string | null;
}

export interface PreOpenOutlookAPI {
  gap_direction: GapDirection;
  magnitude: GapMagnitude;
  primary_driver: PreOpenDriverAPI;
  action_at_open: string;
  stop_gap_plan: string;
  confidence: PreOpenConfidence;
}

export interface PreOpenOutlook {
  gapDirection: GapDirection;
  magnitude: GapMagnitude;
  primaryDriver: PreOpenDriver;
  actionAtOpen: string;
  stopGapPlan: string;
  confidence: PreOpenConfidence;
}

export interface ThesisDeltaAPI {
  status: ThesisDeltaStatus;
  summary: string;
  what_played_out: string[];
}

export interface ThesisDelta {
  status: ThesisDeltaStatus;
  summary: string;
  whatPlayedOut: string[];
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
  position_move_explanation?: PositionMoveExplanation | null;
  sources: string[];
  inputs_used?: Record<string, Record<string, unknown>>;
  price_hook?: string | null;
  key_numbers?: KeyNumber[];
  risk_factors?: string[];
  prediction_bullets?: PredictionBullet[];
  past_trades_context?: string | null;
  pre_open_outlook?: PreOpenOutlookAPI | null;
  thesis_delta?: ThesisDeltaAPI | null;
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
  positionMoveExplanation?: PositionMoveExplanation | null;
  sources: string[];
  inputsUsed?: Record<string, Record<string, unknown>>;
  priceHook?: string | null;
  keyNumbers?: KeyNumber[];
  riskFactors?: string[];
  predictionBullets?: PredictionBullet[];
  pastTradesContext?: string | null;
  preOpenOutlook?: PreOpenOutlook | null;
  thesisDelta?: ThesisDelta | null;
}

function transformPreOpenOutlook(api: PreOpenOutlookAPI | null | undefined): PreOpenOutlook | null {
  if (!api) return null;
  return {
    gapDirection: api.gap_direction,
    magnitude: api.magnitude,
    primaryDriver: {
      summary: api.primary_driver.summary,
      sourceUrl: api.primary_driver.source_url ?? null,
    },
    actionAtOpen: api.action_at_open,
    stopGapPlan: api.stop_gap_plan,
    confidence: api.confidence,
  };
}

function transformThesisDelta(api: ThesisDeltaAPI | null | undefined): ThesisDelta | null {
  if (!api) return null;
  return {
    status: api.status,
    summary: api.summary,
    whatPlayedOut: api.what_played_out ?? [],
  };
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
    positionMoveExplanation: api.position_move_explanation ?? null,
    sources: api.sources ?? [],
    inputsUsed: api.inputs_used ?? {},
    priceHook: api.price_hook ?? null,
    keyNumbers: api.key_numbers ?? [],
    riskFactors: api.risk_factors ?? [],
    predictionBullets: api.prediction_bullets ?? [],
    pastTradesContext: api.past_trades_context ?? null,
    preOpenOutlook: transformPreOpenOutlook(api.pre_open_outlook),
    thesisDelta: transformThesisDelta(api.thesis_delta),
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

export interface HistoryEntryAPI {
  generated_at: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  summary_line: string;
  watch_for: string[];
  pre_open_outlook?: PreOpenOutlookAPI | null;
}

export interface HistoryEntry {
  generatedAt: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  summaryLine: string;
  watchFor: string[];
  preOpenOutlook: PreOpenOutlook | null;
}

export interface AnalysisHistoryResponseAPI {
  entries: HistoryEntryAPI[];
}

export function transformHistoryEntry(api: HistoryEntryAPI): HistoryEntry {
  return {
    generatedAt: api.generated_at,
    action: api.action,
    conviction: api.conviction,
    summaryLine: api.summary_line,
    watchFor: api.watch_for ?? [],
    preOpenOutlook: transformPreOpenOutlook(api.pre_open_outlook),
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
