import type { DecisionAction, DecisionConviction } from '@/features/screener/types';
import type { IntelligenceRequestPayload } from '@/features/intelligence/api';

export type { DecisionAction, DecisionConviction };

export type CatalystUrgency = 'high' | 'medium' | 'low' | 'none';
export type IntelligenceEventDirection = 'bullish' | 'bearish' | 'neutral';
export type IntelligenceEventType = 'earnings' | 'macro' | 'dividend' | 'product_launch' | 'regulatory' | 'other';
export type CatalystType =
  | 'analyst_upgrade'
  | 'analyst_downgrade'
  | 'insider_buying'
  | 'insider_selling'
  | 'earnings_beat'
  | 'earnings_miss'
  | 'guidance_up'
  | 'guidance_down'
  | 'buyback'
  | 'dividend_change'
  | 'product_launch'
  | 'fda_approval'
  | 'acquisition'
  | 'ceo_change'
  | 'litigation'
  | 'offering'
  | 'sector_news'
  | 'macro'
  | 'other';
export type PositionSignalAction = 'HOLD' | 'TRIM' | 'EXIT';
export type ExpectedHoldingPeriod = 'days' | '1-2_weeks' | '2-6_weeks' | 'unknown';
export type ThesisStatus = 'intact' | 'weakening' | 'broken' | 'unclear';
export type ProfitManagement = 'hold_full' | 'consider_trim' | 'trail_stop' | 'protect_breakeven' | 'exit';
export type OpportunityCost = 'low' | 'medium' | 'high';
export type BalanceLabel = 'strongly_bullish' | 'bullish' | 'mixed' | 'bearish' | 'strongly_bearish';
export type SignalCategory = 'technical' | 'fundamental' | 'catalyst' | 'news' | 'positioning';

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

export type PredictionOutcomeStatus = 'confirmed' | 'contradicted' | 'unresolved';

export interface PredictionOutcome {
  status: PredictionOutcomeStatus;
  evidence: string;
}

export interface HistoryPrediction extends PredictionBullet {
  outcome?: PredictionOutcome | null;
}

export interface NewsItem {
  headline: string;
  url: string | null;
  date: string | null;
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

export interface IntelligenceEvent {
  type: IntelligenceEventType;
  date: string | null;
  direction: IntelligenceEventDirection;
  summary: string;
}

export interface ClassifiedCatalystAPI {
  type: CatalystType;
  direction: IntelligenceEventDirection;
  summary: string;
  source_url: string | null;
  date: string | null;
}

export interface ClassifiedCatalyst {
  type: CatalystType;
  direction: IntelligenceEventDirection;
  summary: string;
  sourceUrl: string | null;
  date: string | null;
}

export interface WeightedSignal {
  key: string;
  label: string;
  category: SignalCategory;
  direction: IntelligenceEventDirection;
  weight: number;
  contribution: number;
  source: string;
  event_date?: string | null;
  eventDate?: string | null;
  explanation?: string | null;
}

export interface EvidenceLedgerAPI {
  contributions: WeightedSignal[];
  bull_weight: number;
  bear_weight: number;
  net: number;
  balance_label: BalanceLabel;
}

export interface EvidenceLedger {
  contributions: WeightedSignal[];
  bullWeight: number;
  bearWeight: number;
  net: number;
  balanceLabel: BalanceLabel;
}

export interface PositionSignal {
  action: PositionSignalAction;
  reason: string;
  trimPct: number | null;
  trimPrice: number | null;
}

export interface PositionSignalAPI {
  action: PositionSignalAction;
  reason: string;
  trim_pct?: number | null;
  trim_price?: number | null;
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
  run_id?: string | null;
  action: DecisionAction;
  conviction: DecisionConviction;
  catalyst_urgency: CatalystUrgency;
  summary_line: string;
  narrative: string;
  upcoming_events: IntelligenceEvent[];
  position_signal: PositionSignalAPI | null;
  position_outlook?: PositionOutlookAPI | null;
  position_move_explanation?: PositionMoveExplanation | null;
  sources: string[];
  inputs_used?: Record<string, Record<string, unknown>>;
  price_hook?: string | null;
  key_numbers?: KeyNumber[];
  risk_factors?: string[];
  prediction_bullets?: PredictionBullet[];
  news?: NewsItem[];
  past_trades_context?: string | null;
  pre_open_outlook?: PreOpenOutlookAPI | null;
  thesis_delta?: ThesisDeltaAPI | null;
  evidence_ledger?: EvidenceLedgerAPI | null;
  classified_catalysts?: ClassifiedCatalystAPI[];
  data_status?: 'current' | 'stale' | 'intraday' | 'unknown';
  degraded_reasons?: string[];
  claim_grounding?: {
    status: 'grounded' | 'partial' | 'unsupported';
    grounded_claims: number;
    unsupported_claims: string[];
    grounded_urls: string[];
  } | null;
}

export interface SymbolIntelligence {
  symbol: string;
  generatedAt: string;
  runId?: string | null;
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
  news?: NewsItem[];
  pastTradesContext?: string | null;
  preOpenOutlook?: PreOpenOutlook | null;
  thesisDelta?: ThesisDelta | null;
  evidenceLedger: EvidenceLedger | null;
  classifiedCatalysts: ClassifiedCatalyst[];
  dataStatus?: 'current' | 'stale' | 'intraday' | 'unknown';
  degradedReasons?: string[];
  claimGrounding?: SymbolIntelligenceAPI['claim_grounding'];
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

export function transformEvidenceLedger(api: EvidenceLedgerAPI | null | undefined): EvidenceLedger | null {
  if (!api) return null;
  return {
    contributions: (api.contributions ?? []).map((signal) => ({
      ...signal,
      eventDate: signal.event_date ?? signal.eventDate ?? null,
    })),
    bullWeight: api.bull_weight,
    bearWeight: api.bear_weight,
    net: api.net,
    balanceLabel: api.balance_label,
  };
}

function transformPositionSignal(api: PositionSignalAPI | null | undefined): PositionSignal | null {
  if (!api) return null;
  return {
    action: api.action,
    reason: api.reason,
    trimPct: api.trim_pct ?? null,
    trimPrice: api.trim_price ?? null,
  };
}

function transformClassifiedCatalyst(api: ClassifiedCatalystAPI): ClassifiedCatalyst {
  return {
    type: api.type,
    direction: api.direction,
    summary: api.summary,
    sourceUrl: api.source_url ?? null,
    date: api.date ?? null,
  };
}

export function transformIntelligence(api: SymbolIntelligenceAPI): SymbolIntelligence {
  return {
    symbol: api.symbol,
    generatedAt: api.generated_at,
    runId: api.run_id ?? null,
    action: api.action,
    conviction: api.conviction,
    catalystUrgency: api.catalyst_urgency,
    summaryLine: api.summary_line,
    narrative: api.narrative,
    upcomingEvents: api.upcoming_events ?? [],
    positionSignal: transformPositionSignal(api.position_signal),
    positionOutlook: transformPositionOutlook(api.position_outlook),
    positionMoveExplanation: api.position_move_explanation ?? null,
    sources: api.sources ?? [],
    inputsUsed: api.inputs_used ?? {},
    priceHook: api.price_hook ?? null,
    keyNumbers: api.key_numbers ?? [],
    riskFactors: api.risk_factors ?? [],
    predictionBullets: api.prediction_bullets ?? [],
    news: api.news ?? [],
    pastTradesContext: api.past_trades_context ?? null,
    preOpenOutlook: transformPreOpenOutlook(api.pre_open_outlook),
    thesisDelta: transformThesisDelta(api.thesis_delta),
    evidenceLedger: transformEvidenceLedger(api.evidence_ledger),
    classifiedCatalysts: (api.classified_catalysts ?? []).map(transformClassifiedCatalyst),
    dataStatus: api.data_status ?? 'unknown',
    degradedReasons: api.degraded_reasons ?? [],
    claimGrounding: api.claim_grounding ?? null,
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
  predictions?: HistoryPrediction[];
  pre_open_outlook?: PreOpenOutlookAPI | null;
}

export interface HistoryEntry {
  generatedAt: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  summaryLine: string;
  watchFor: string[];
  predictions: HistoryPrediction[];
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
    predictions: api.predictions ?? [],
    preOpenOutlook: transformPreOpenOutlook(api.pre_open_outlook),
  };
}

export interface IntelligenceChatEvidenceAPI {
  label: string;
  source?: string | null;
  url?: string | null;
  date?: string | null;
  summary?: string | null;
}

export interface IntelligenceChatEvidence {
  label: string;
  source: string | null;
  url: string | null;
  date: string | null;
  summary: string | null;
}

export interface IntelligenceChatMessageAPI {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  refresh_sources?: boolean;
  evidence_used?: IntelligenceChatEvidenceAPI[];
}

export interface IntelligenceChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  refreshSources: boolean;
  evidenceUsed: IntelligenceChatEvidence[];
}

export interface IntelligenceChatResponseAPI {
  ticker: string;
  chat_date: string;
  analysis_generated_at: string;
  messages: IntelligenceChatMessageAPI[];
  refreshed_at?: string | null;
}

export interface IntelligenceChatResponse {
  ticker: string;
  chatDate: string;
  analysisGeneratedAt: string;
  messages: IntelligenceChatMessage[];
  refreshedAt: string | null;
}

export function transformIntelligenceChat(api: IntelligenceChatResponseAPI): IntelligenceChatResponse {
  return {
    ticker: api.ticker,
    chatDate: api.chat_date,
    analysisGeneratedAt: api.analysis_generated_at,
    refreshedAt: api.refreshed_at ?? null,
    messages: (api.messages ?? []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
      refreshSources: message.refresh_sources ?? false,
      evidenceUsed: (message.evidence_used ?? []).map((evidence) => ({
        label: evidence.label,
        source: evidence.source ?? null,
        url: evidence.url ?? null,
        date: evidence.date ?? null,
        summary: evidence.summary ?? null,
      })),
    })),
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
