// Screener types

import { Recommendation, RecommendationAPI, transformRecommendation } from '@/types/recommendation';

export type SameSymbolMode = 'NEW_ENTRY' | 'ADD_ON' | 'MANAGE_ONLY';

export interface SameSymbolCandidateContext {
  mode: SameSymbolMode;
  positionId?: string;
  currentPositionEntry?: number;
  currentPositionStop?: number;
  freshSetupStop?: number;
  executionStop?: number;
  pendingEntryExists: boolean;
  addOnCount: number;
  maxAddOns?: number;
  reason: string;
}

export interface PriceHistoryPoint {
  date: string;
  close: number;
}

export type DecisionAction =
  | 'BUY_NOW'
  | 'BUY_ON_PULLBACK'
  | 'WAIT_FOR_BREAKOUT'
  | 'WATCH'
  | 'TACTICAL_ONLY'
  | 'AVOID'
  | 'MANAGE_ONLY';

export type DecisionConviction = 'high' | 'medium' | 'low';
export type DecisionSignalLabel = 'strong' | 'neutral' | 'weak';
export type DecisionValuationLabel = 'cheap' | 'fair' | 'expensive' | 'unknown';
export type DecisionCatalystLabel = 'active' | 'neutral' | 'weak';
export type FairValueMethod = 'earnings_multiple' | 'sales_multiple' | 'book_multiple' | 'not_available';

export interface DecisionTradePlan {
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
}

export interface DecisionValuationContext {
  method: FairValueMethod;
  summary?: string;
  trailingPe?: number;
  priceToSales?: number;
  bookValuePerShare?: number;
  priceToBook?: number;
  bookToPrice?: number;
  fairValueLow?: number;
  fairValueBase?: number;
  fairValueHigh?: number;
  premiumDiscountPct?: number;
}

export interface DecisionDrivers {
  positives: string[];
  negatives: string[];
  warnings: string[];
}

export interface ExplanationContract {
  summaryLine: string;
  whyItQualified: string[];
  whyNow: string[];
  mainRisks: string[];
  whatInvalidatesIt: string[];
  nextBestAction: string;
  confidenceNotes: string[];
}

export interface DecisionSummary {
  symbol: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  technicalLabel: DecisionSignalLabel;
  fundamentalsLabel: DecisionSignalLabel;
  valuationLabel: DecisionValuationLabel;
  catalystLabel: DecisionCatalystLabel;
  whyNow: string;
  whatToDo: string;
  mainRisk: string;
  tradePlan: DecisionTradePlan;
  valuationContext: DecisionValuationContext;
  drivers: DecisionDrivers;
  explanation?: ExplanationContract;
}

export interface ScreenerCandidate {
  ticker: string;
  currency: 'USD' | 'EUR';
  name?: string;
  sector?: string;
  lastBar?: string;
  close: number;
  sma20: number;
  sma50: number;
  sma200: number;
  atr: number;
  momentum6m: number;
  momentum12m: number;
  relStrength: number;
  score: number;
  confidence: number;
  rank: number;
  priorityRank?: number;
  fundamentalsCoverageStatus?: string;
  fundamentalsFreshnessStatus?: string;
  fundamentalsSummary?: string;
  signal?: string;
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
  shares?: number;
  positionSizeUsd?: number;
  riskUsd?: number;
  riskPct?: number;
  recommendation?: Recommendation;
  priceHistory?: PriceHistoryPoint[];
  suggestedOrderType?: string;
  suggestedOrderPrice?: number;
  executionNote?: string;
  sameSymbol?: SameSymbolCandidateContext;
  decisionSummary?: DecisionSummary;
}

export interface DecisionTradePlanAPI {
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
}

export interface DecisionValuationContextAPI {
  method: FairValueMethod;
  summary?: string | null;
  trailing_pe?: number | null;
  price_to_sales?: number | null;
  book_value_per_share?: number | null;
  price_to_book?: number | null;
  book_to_price?: number | null;
  fair_value_low?: number | null;
  fair_value_base?: number | null;
  fair_value_high?: number | null;
  premium_discount_pct?: number | null;
}

export interface DecisionDriversAPI {
  positives?: string[];
  negatives?: string[];
  warnings?: string[];
}

export interface ExplanationContractAPI {
  summary_line: string;
  why_it_qualified: string[];
  why_now: string[];
  main_risks: string[];
  what_invalidates_it: string[];
  next_best_action: string;
  confidence_notes: string[];
}

export interface DecisionSummaryAPI {
  symbol: string;
  action: DecisionAction;
  conviction: DecisionConviction;
  technical_label: DecisionSignalLabel;
  fundamentals_label: DecisionSignalLabel;
  valuation_label: DecisionValuationLabel;
  catalyst_label: DecisionCatalystLabel;
  why_now: string;
  what_to_do: string;
  main_risk: string;
  trade_plan: DecisionTradePlanAPI;
  valuation_context: DecisionValuationContextAPI;
  drivers: DecisionDriversAPI;
  explanation?: ExplanationContractAPI | null;
}

// API response format (snake_case)
export interface ScreenerCandidateAPI {
  ticker: string;
  currency?: string;
  name?: string;
  sector?: string;
  last_bar?: string;
  close: number;
  sma_20: number;
  sma_50: number;
  sma_200: number;
  atr: number;
  momentum_6m: number;
  momentum_12m: number;
  rel_strength: number;
  score: number;
  confidence: number;
  rank: number;
  priority_rank?: number;
  fundamentals_coverage_status?: string;
  fundamentals_freshness_status?: string;
  fundamentals_summary?: string;
  signal?: string;
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
  shares?: number;
  position_size_usd?: number;
  risk_usd?: number;
  risk_pct?: number;
  recommendation?: RecommendationAPI;
  price_history?: PriceHistoryPoint[];
  suggested_order_type?: string;
  suggested_order_price?: number;
  execution_note?: string;
  same_symbol?: {
    mode: SameSymbolMode;
    position_id?: string | null;
    current_position_entry?: number | null;
    current_position_stop?: number | null;
    fresh_setup_stop?: number | null;
    execution_stop?: number | null;
    pending_entry_exists?: boolean;
    add_on_count?: number;
    max_add_ons?: number;
    reason?: string;
  };
  decision_summary?: DecisionSummaryAPI;
}

export interface ScreenerRequest {
  universe?: string;
  tickers?: string[];
  top?: number;
  asofDate?: string;
  minPrice?: number;
  maxPrice?: number;
  currencies?: string[];
  breakoutLookback?: number;
  pullbackMa?: number;
  minHistory?: number;
}

export interface ScreenerResponse {
  candidates: ScreenerCandidate[];
  asofDate: string;
  totalScreened: number;
  dataFreshness: 'final_close' | 'intraday';
  warnings?: string[];
  sameSymbolSuppressedCount?: number;
  sameSymbolAddOnCount?: number;
}

// API response format (snake_case)
export interface ScreenerResponseAPI {
  candidates: ScreenerCandidateAPI[];
  asof_date: string;
  total_screened: number;
  data_freshness?: 'final_close' | 'intraday';
  warnings?: string[];
  same_symbol_suppressed_count?: number;
  same_symbol_add_on_count?: number;
}

export interface ScreenerRunLaunchResponseAPI {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
}

export interface ScreenerRunStatusResponseAPI {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  result?: ScreenerResponseAPI;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderPreview {
  ticker: string;
  entryPrice: number;
  stopPrice: number;
  atr: number;
  shares: number;
  positionSizeUsd: number;
  riskUsd: number;
  riskPct: number;
}

export interface UniversesResponse {
  universes: string[];
}

function transformDecisionSummary(apiSummary: DecisionSummaryAPI): DecisionSummary {
  return {
    symbol: apiSummary.symbol,
    action: apiSummary.action,
    conviction: apiSummary.conviction,
    technicalLabel: apiSummary.technical_label,
    fundamentalsLabel: apiSummary.fundamentals_label,
    valuationLabel: apiSummary.valuation_label,
    catalystLabel: apiSummary.catalyst_label,
    whyNow: apiSummary.why_now,
    whatToDo: apiSummary.what_to_do,
    mainRisk: apiSummary.main_risk,
    tradePlan: {
      entry: apiSummary.trade_plan?.entry ?? undefined,
      stop: apiSummary.trade_plan?.stop ?? undefined,
      target: apiSummary.trade_plan?.target ?? undefined,
      rr: apiSummary.trade_plan?.rr ?? undefined,
    },
    valuationContext: {
      method: apiSummary.valuation_context?.method ?? 'not_available',
      summary: apiSummary.valuation_context?.summary ?? undefined,
      trailingPe: apiSummary.valuation_context?.trailing_pe ?? undefined,
      priceToSales: apiSummary.valuation_context?.price_to_sales ?? undefined,
      bookValuePerShare: apiSummary.valuation_context?.book_value_per_share ?? undefined,
      priceToBook: apiSummary.valuation_context?.price_to_book ?? undefined,
      bookToPrice: apiSummary.valuation_context?.book_to_price ?? undefined,
      fairValueLow: apiSummary.valuation_context?.fair_value_low ?? undefined,
      fairValueBase: apiSummary.valuation_context?.fair_value_base ?? undefined,
      fairValueHigh: apiSummary.valuation_context?.fair_value_high ?? undefined,
      premiumDiscountPct: apiSummary.valuation_context?.premium_discount_pct ?? undefined,
    },
    drivers: {
      positives: apiSummary.drivers?.positives ?? [],
      negatives: apiSummary.drivers?.negatives ?? [],
      warnings: apiSummary.drivers?.warnings ?? [],
    },
    explanation: apiSummary.explanation
      ? {
          summaryLine: apiSummary.explanation.summary_line,
          whyItQualified: apiSummary.explanation.why_it_qualified,
          whyNow: apiSummary.explanation.why_now,
          mainRisks: apiSummary.explanation.main_risks,
          whatInvalidatesIt: apiSummary.explanation.what_invalidates_it,
          nextBestAction: apiSummary.explanation.next_best_action,
          confidenceNotes: apiSummary.explanation.confidence_notes,
        }
      : undefined,
  };
}

// Transform API response to UI format
export function transformScreenerResponse(apiResponse: ScreenerResponseAPI): ScreenerResponse {
  return {
    candidates: apiResponse.candidates.map(c => ({
      ticker: c.ticker,
      currency: c.currency === 'EUR' ? 'EUR' : 'USD',
      name: c.name,
      sector: c.sector,
      lastBar: c.last_bar,
      close: c.close,
      sma20: c.sma_20,
      sma50: c.sma_50,
      sma200: c.sma_200,
      atr: c.atr,
      momentum6m: c.momentum_6m,
      momentum12m: c.momentum_12m,
      relStrength: c.rel_strength,
      score: c.score,
      confidence: c.confidence,
      rank: c.rank,
      priorityRank: c.priority_rank ?? undefined,
      fundamentalsCoverageStatus: c.fundamentals_coverage_status,
      fundamentalsFreshnessStatus: c.fundamentals_freshness_status,
      fundamentalsSummary: c.fundamentals_summary,
      signal: c.signal,
      entry: c.entry,
      stop: c.stop,
      target: c.target,
      rr: c.rr,
      shares: c.shares,
      positionSizeUsd: c.position_size_usd,
      riskUsd: c.risk_usd,
      riskPct: c.risk_pct,
      recommendation: c.recommendation ? transformRecommendation(c.recommendation) : undefined,
      priceHistory: c.price_history ?? [],
      suggestedOrderType: c.suggested_order_type,
      suggestedOrderPrice: c.suggested_order_price,
      executionNote: c.execution_note,
      sameSymbol: c.same_symbol
        ? {
            mode: c.same_symbol.mode,
            positionId: c.same_symbol.position_id ?? undefined,
            currentPositionEntry: c.same_symbol.current_position_entry ?? undefined,
            currentPositionStop: c.same_symbol.current_position_stop ?? undefined,
            freshSetupStop: c.same_symbol.fresh_setup_stop ?? undefined,
            executionStop: c.same_symbol.execution_stop ?? undefined,
            pendingEntryExists: c.same_symbol.pending_entry_exists ?? false,
            addOnCount: c.same_symbol.add_on_count ?? 0,
            maxAddOns: c.same_symbol.max_add_ons ?? undefined,
            reason: c.same_symbol.reason ?? '',
          }
        : undefined,
      decisionSummary: c.decision_summary ? transformDecisionSummary(c.decision_summary) : undefined,
    })),
    asofDate: apiResponse.asof_date,
    totalScreened: apiResponse.total_screened,
    dataFreshness: apiResponse.data_freshness ?? 'final_close',
    warnings: apiResponse.warnings ?? [],
    sameSymbolSuppressedCount: apiResponse.same_symbol_suppressed_count ?? 0,
    sameSymbolAddOnCount: apiResponse.same_symbol_add_on_count ?? 0,
  };
}
