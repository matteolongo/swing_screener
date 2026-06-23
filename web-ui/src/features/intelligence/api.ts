import { API_ENDPOINTS } from '@/lib/api';
import { fetchJson } from '@/lib/fetchJson';
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
  technical_label?: string | null;
  fundamentals_label?: string | null;
  catalyst_summary?: string | null;
  days_to_earnings?: number | null;
  next_earnings_date?: string | null;
  recent_patterns?: string[] | null;
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
    payload.technical_label = candidate.decisionSummary?.technicalLabel ?? null;
    payload.fundamentals_label = candidate.decisionSummary?.fundamentalsLabel ?? null;
    payload.catalyst_summary = candidate.decisionSummary?.catalystSummary ?? null;
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

    // Anchor target/rr to actual position values so the AI sees consistent data.
    // position.targetPrice takes priority; fall back to candidate's market target for context.
    const posEntry = position.entryPrice;
    const posStop = position.stopPrice ?? null;
    const resolvedTarget = position.targetPrice ?? payload.target ?? null;
    payload.target = resolvedTarget;
    payload.rr =
      resolvedTarget != null && posStop != null && posEntry > posStop
        ? (resolvedTarget - posEntry) / (posEntry - posStop)
        : null;
  }
  return payload;
}

export async function postIntelligenceAnalysis(
  ticker: string,
  payload: IntelligenceRequestPayload
): Promise<SymbolIntelligenceAPI> {
  return fetchJson<SymbolIntelligenceAPI>(API_ENDPOINTS.intelligenceAnalyze(ticker), {
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

export async function postIntelligenceSweep(symbols: SweepSymbolPayload[]): Promise<SweepResponseAPI> {
  return fetchJson<SweepResponseAPI>(API_ENDPOINTS.intelligenceSweep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols }),
    errorMessage: 'Intelligence sweep failed',
  });
}
