import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import type { SymbolIntelligenceAPI, SweepSymbolPayload, SweepResponseAPI } from '@/features/intelligence/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';

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
  r_now?: number;
  days_open?: number;
  rr?: number | null;
  target?: number | null;
  rel_strength?: number | null;
  atr?: number | null;
  fair_value_low?: number | null;
  fair_value_base?: number | null;
  fair_value_high?: number | null;
  valuation_label?: string | null;
  decision_action?: string | null;
  decision_conviction?: string | null;
  technical_label?: string | null;
  fundamentals_label?: string | null;
  catalyst_summary?: string | null;
}

export function candidateToPayload(
  candidate: SymbolAnalysisCandidate | null | undefined,
  position?: PositionWithMetrics | null,
): IntelligenceRequestPayload | null {
  if (!candidate?.close) return null;
  const payload: IntelligenceRequestPayload = {
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
  };
  payload.rr = candidate.rr ?? null;
  payload.rel_strength = candidate.relStrength ?? null;
  payload.atr = candidate.atr ?? null;
  payload.target = candidate.decisionSummary?.tradePlan?.target ?? null;
  payload.fair_value_low = candidate.decisionSummary?.valuationContext?.fairValueLow ?? null;
  payload.fair_value_base = candidate.decisionSummary?.valuationContext?.fairValueBase ?? null;
  payload.fair_value_high = candidate.decisionSummary?.valuationContext?.fairValueHigh ?? null;
  payload.valuation_label = candidate.decisionSummary?.valuationLabel ?? null;
  payload.decision_action = candidate.decisionSummary?.action ?? null;
  payload.decision_conviction = candidate.decisionSummary?.conviction ?? null;
  payload.technical_label = candidate.decisionSummary?.technicalLabel ?? null;
  payload.fundamentals_label = candidate.decisionSummary?.fundamentalsLabel ?? null;
  payload.catalyst_summary = candidate.decisionSummary?.catalystSummary ?? null;
  if (position != null) {
    payload.entry_price = position.entryPrice;
    payload.r_now = position.rNow;
    payload.days_open = position.daysOpen;
  }
  return payload;
}

export async function postIntelligenceAnalysis(
  ticker: string,
  payload: IntelligenceRequestPayload
): Promise<SymbolIntelligenceAPI> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceAnalyze(ticker)), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to analyze ${ticker}`);
  }
  return response.json() as Promise<SymbolIntelligenceAPI>;
}

export async function getIntelligenceLatest(ticker: string): Promise<SymbolIntelligenceAPI> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceLatest(ticker)));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || `No cached analysis for ${ticker}`);
  }
  return response.json() as Promise<SymbolIntelligenceAPI>;
}

export async function postIntelligenceSweep(symbols: SweepSymbolPayload[]): Promise<SweepResponseAPI> {
  const response = await fetch(apiUrl(API_ENDPOINTS.intelligenceSweep), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || 'Intelligence sweep failed');
  }
  return response.json() as Promise<SweepResponseAPI>;
}
