import { API_ENDPOINTS, apiUrl } from '@/lib/api';
import type { SymbolIntelligenceAPI, SweepSymbolPayload, SweepResponseAPI } from '@/features/intelligence/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';

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
}

export function candidateToPayload(candidate: SymbolAnalysisCandidate | null | undefined): IntelligenceRequestPayload | null {
  if (!candidate?.close) return null;
  return {
    close: candidate.close,
    signal: candidate.signal ?? 'unknown',
    entry: candidate.entry ?? null,
    stop: candidate.stop ?? null,
    sma_20: candidate.sma20 ?? null,
    sma_50: candidate.sma50 ?? null,
    sma_200: candidate.sma200 ?? null,
    momentum_6m: candidate.momentum6m ?? null,
    momentum_12m: candidate.momentum12m ?? null,
    sector: candidate.sector ?? null,
    currency: candidate.currency ?? 'USD',
  };
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
