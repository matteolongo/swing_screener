import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
import type {
  SymbolIntelligenceAPI,
  SweepSymbolPayload,
  SweepResponseAPI,
  AnalysisHistoryResponseAPI,
  HistoryEntry,
  IntelligenceChatResponseAPI,
  EvidenceRefreshResponseAPI,
} from '@/features/intelligence/types';
import {
  transformEvidenceRefresh,
  transformHistoryEntry,
  transformIntelligenceChat,
} from '@/features/intelligence/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import type { PositionReviewAPI } from '@/features/intelligence/positionReviewTypes';
import { transformPositionReview } from '@/features/intelligence/positionReviewTypes';
import type { StrategicReviewAPI } from '@/features/intelligence/strategicReviewTypes';
import { transformStrategicReview } from '@/features/intelligence/strategicReviewTypes';
import type { RunTraceAPI, RunIndexEntryAPI, RunTrace, RunIndexEntry } from '@/features/intelligence/traceTypes';
import { transformRunTrace, transformRunIndexEntry } from '@/features/intelligence/traceTypes';

export interface IntelligenceRequestPayload {
  close: number;
  signal: string;
  entry?: number | null;
  stop?: number | null;
  sma_20?: number | null;
  sma_50?: number | null;
  sma_200?: number | null;
  momentum_6m?: number | null;
  momentum_12m?: number | null;
  sector?: string | null;
  currency?: string;
  entry_price?: number;
  entry_date?: string | null;
  r_now?: number;
  days_open?: number;
  rr?: number | null;
  target?: number | null;
  rel_strength?: number | null;
  sector_rs?: number | null;
  sector_rotation_context?: Record<string, unknown> | null;
  dist_52w_high_pct?: number | null;
  near_52w_high?: boolean | null;
  atr?: number | null;
  fair_value_low?: number | null;
  fair_value_base?: number | null;
  fair_value_high?: number | null;
  valuation_label?: string | null;
  decision_action?: string | null;
  decision_conviction?: string | null;
  decision_entry_condition?: string | null;
  decision_trigger_price?: number | null;
  decision_trigger_note?: string | null;
  technical_label?: string | null;
  fundamentals_label?: string | null;
  days_to_earnings?: number | null;
  next_earnings_date?: string | null;
  days_to_dividend?: number | null;
  next_dividend_date?: string | null;
  next_dividend_amount?: number | null;
  recent_patterns?: string[] | null;
  price_source?: string | null;
  price_asof?: string | null;
  price_status?: 'current' | 'stale' | 'intraday' | 'unknown';
  fundamentals_asof?: string | null;
  fundamentals_status?: 'current' | 'stale' | 'intraday' | 'unknown';
}

export function candidateToPayload(
  candidate: SymbolAnalysisCandidate | null | undefined,
  position?: PositionWithMetrics | null,
): IntelligenceRequestPayload | null {
  // A held position with no screener candidate (close it from the live position price)
  // must still be analyzable — fall back to a position-only payload.
  const positionPrice = position?.currentPrice ?? position?.entryPrice ?? null;
  if (!candidate?.close && positionPrice == null) return null;

  let payload: IntelligenceRequestPayload;
  if (candidate?.close) {
    payload = {
      close: candidate.close,
      signal: candidate.signal ?? 'unknown',
      entry: candidate.suggestedOrderPrice ?? candidate.entry ?? null,
      stop: candidate.stop ?? null,
      sma_20: candidate.sma20 ?? null,
      sma_50: candidate.sma50 ?? null,
      sma_200: candidate.sma200 ?? null,
      momentum_6m: candidate.momentum6m ?? null,
      momentum_12m: candidate.momentum12m ?? null,
      sector: candidate.sector ?? null,
      currency: candidate.currency ?? 'USD',
      price_source: 'screener_market_data',
      price_asof: candidate.lastBar ?? null,
      price_status: candidate.dataStatus ?? 'unknown',
      fundamentals_asof: candidate.fundamentalsAsOf ?? null,
      fundamentals_status: (
        candidate.fundamentalsFreshnessStatus === 'current' || candidate.fundamentalsFreshnessStatus === 'stale'
          ? candidate.fundamentalsFreshnessStatus
          : 'unknown'
      ),
    };
    payload.rr = candidate.rr ?? null;
    payload.rel_strength = candidate.relStrength ?? null;
    payload.sector_rs = candidate.sectorRs ?? null;
    payload.sector_rotation_context = candidate.sectorRotationContext ?? null;
    payload.dist_52w_high_pct = candidate.dist52wHighPct ?? null;
    payload.near_52w_high = candidate.near52wHigh ?? null;
    payload.atr = candidate.atr ?? null;
    payload.target = candidate.decisionSummary?.tradePlan?.target ?? null;
    payload.fair_value_low = candidate.decisionSummary?.valuationContext?.fairValueLow ?? null;
    payload.fair_value_base = candidate.decisionSummary?.valuationContext?.fairValueBase ?? null;
    payload.fair_value_high = candidate.decisionSummary?.valuationContext?.fairValueHigh ?? null;
    payload.valuation_label = candidate.decisionSummary?.valuationLabel ?? null;
    payload.decision_action = candidate.decisionSummary?.action ?? null;
    payload.decision_conviction = candidate.decisionSummary?.conviction ?? null;
    payload.decision_entry_condition = candidate.decisionSummary?.tradePlan?.entryCondition ?? null;
    payload.decision_trigger_price = candidate.decisionSummary?.tradePlan?.triggerPrice ?? null;
    payload.decision_trigger_note = candidate.decisionSummary?.tradePlan?.triggerNote ?? null;
    payload.technical_label = candidate.decisionSummary?.technicalLabel ?? null;
    payload.fundamentals_label = candidate.decisionSummary?.fundamentalsLabel ?? null;
    payload.days_to_earnings = candidate.daysToEarnings ?? null;
    payload.recent_patterns = candidate.patterns?.length
      ? candidate.patterns.map((p) => `${p.name}@${p.context}`)
      : null;
  } else {
    payload = {
      close: positionPrice as number,
      signal: 'MANAGE_ONLY',
      currency: 'USD',
    };
  }
  if (position != null) {
    payload.entry_price = position.entryPrice;
    payload.entry = position.entryPrice;
    if (position.stopPrice != null) {
      payload.stop = position.stopPrice;
    }
    payload.r_now = position.rNow;
    payload.days_open = position.daysOpen;
    payload.entry_date = position.entryDate ?? null;
  }
  return payload;
}

export async function postIntelligenceAnalysis(
  ticker: string,
  payload: IntelligenceRequestPayload,
  force = false
): Promise<SymbolIntelligenceAPI> {
  const endpoint = force
    ? `${API_ENDPOINTS.intelligenceAnalyze(ticker)}?force=true`
    : API_ENDPOINTS.intelligenceAnalyze(ticker);
  return fetchJson<SymbolIntelligenceAPI>(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    errorMessage: `Failed to analyze ${ticker}`,
  });
}

export async function getIntelligenceLatest(ticker: string): Promise<SymbolIntelligenceAPI> {
  return fetchJson<SymbolIntelligenceAPI>(API_ENDPOINTS.intelligenceLatest(ticker), {
    errorMessage: `No cached analysis for ${ticker}`,
  });
}

export async function refreshIntelligenceEvidence(ticker: string) {
  const response = await fetchJson<EvidenceRefreshResponseAPI>(
    API_ENDPOINTS.intelligenceEvidenceRefresh(ticker),
    {
      method: 'POST',
      errorMessage: `Failed to refresh intelligence evidence for ${ticker}`,
    },
  );
  return transformEvidenceRefresh(response);
}

export async function getIntelligenceHistory(ticker: string): Promise<HistoryEntry[]> {
  const res = await fetchJson<AnalysisHistoryResponseAPI>(API_ENDPOINTS.intelligenceHistory(ticker), {
    errorMessage: `Failed to load analysis history for ${ticker}`,
  });
  return (res.entries ?? []).map(transformHistoryEntry);
}

export async function getIntelligenceChat(ticker: string) {
  const res = await fetchJson<IntelligenceChatResponseAPI>(API_ENDPOINTS.intelligenceChat(ticker), {
    errorMessage: `Failed to load intelligence chat for ${ticker}`,
  });
  return transformIntelligenceChat(res);
}

export interface IntelligenceChatMessagePayload {
  message: string;
  refreshSources: boolean;
  analysisGeneratedAt?: string | null;
  candidate?: Record<string, unknown> | null;
  position?: Record<string, unknown> | null;
}

export async function sendIntelligenceChatMessage(
  ticker: string,
  payload: IntelligenceChatMessagePayload,
) {
  const body: Record<string, unknown> = {
    message: payload.message,
    refresh_sources: payload.refreshSources,
  };
  if (payload.analysisGeneratedAt != null) body.analysis_generated_at = payload.analysisGeneratedAt;
  if (payload.candidate != null) body.candidate = payload.candidate;
  if (payload.position != null) body.position = payload.position;

  const res = await fetchJson<IntelligenceChatResponseAPI>(API_ENDPOINTS.intelligenceChat(ticker), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    errorMessage: `Failed to send intelligence chat message for ${ticker}`,
  });
  return transformIntelligenceChat(res);
}

export interface PositionReviewPayload {
  ticker: string;
  positionId?: string | null;
  refreshSources: boolean;
}

export async function postPositionReview(payload: PositionReviewPayload) {
  const endpoint = payload.positionId
    ? API_ENDPOINTS.intelligencePositionReview(payload.positionId)
    : API_ENDPOINTS.intelligenceSymbolReview(payload.ticker);
  const res = await fetchJson<PositionReviewAPI>(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_sources: payload.refreshSources }),
    errorMessage: `Failed to review ${payload.ticker}`,
  });
  return transformPositionReview(res);
}

export interface StrategicReviewPayload {
  ticker: string;
  topic?: string | null;
  refreshSources: boolean;
  riskMode: 'normal' | 'defensive' | 'aggressive';
  horizonDays: number;
}

export async function postStrategicReview(payload: StrategicReviewPayload) {
  const res = await fetchJson<StrategicReviewAPI>(API_ENDPOINTS.intelligenceStrategicReview, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker: payload.ticker,
      topic: payload.topic ?? null,
      refresh_sources: payload.refreshSources,
      risk_mode: payload.riskMode,
      horizon_days: payload.horizonDays,
    }),
    errorMessage: `Failed to build strategic overlay for ${payload.ticker}`,
  });
  return transformStrategicReview(res);
}

export async function postIntelligenceSweep(symbols: SweepSymbolPayload[]): Promise<SweepResponseAPI> {
  return fetchJson<SweepResponseAPI>(API_ENDPOINTS.intelligenceSweep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
    errorMessage: 'Intelligence sweep failed',
  });
}

export async function getRunTrace(runId: string): Promise<RunTrace> {
  const res = await fetchJson<RunTraceAPI>(API_ENDPOINTS.intelligenceRunTrace(runId), {
    errorMessage: `Failed to load run trace ${runId}`,
  });
  return transformRunTrace(res);
}

export async function getTickerRuns(ticker: string): Promise<RunIndexEntry[]> {
  const res = await fetchJson<{ entries: RunIndexEntryAPI[] }>(API_ENDPOINTS.intelligenceRuns(ticker), {
    errorMessage: `Failed to load runs for ${ticker}`,
  });
  return (res.entries ?? []).map(transformRunIndexEntry);
}
