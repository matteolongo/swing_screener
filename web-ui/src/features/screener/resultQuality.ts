import type { ScreenerResponse } from './types';

export type MarketStatus = 'final_close' | 'intraday' | 'stale' | 'unknown';

export function summarizeResultQuality(input: {
  requested: number;
  evaluated: number;
  warnings: string[];
  marketStatus: MarketStatus;
}) {
  return {
    coverage: input.requested === 0 || input.evaluated === 0 ? 'empty' as const
      : input.evaluated < input.requested ? 'partial' as const : 'complete' as const,
    marketStatus: input.marketStatus,
    warnings: input.warnings,
  };
}

export function marketDate(value?: string | null): string | null {
  const day = value?.slice(0, 10);
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : null;
}

export function getResultCandleDates(result?: ScreenerResponse | null): string[] {
  if (!result) return [];
  const dates = [...result.candidates.map(candidate => marketDate(candidate.dataAsOf) ?? marketDate(candidate.lastBar)), marketDate(result.benchmarkLastBar)];
  return [...new Set(dates.filter((day): day is string => day !== null))].sort();
}

export function getResultMarketStatus(result?: ScreenerResponse | null): MarketStatus {
  if (!result) return 'unknown';
  const session = marketDate(result.asofDate);
  const dates = getResultCandleDates(result);
  if (result.dataFreshness === 'stale' || getStaleInputs(result).length > 0) return 'stale';
  if (result.dataFreshness === 'intraday' || result.candidates.some(candidate => candidate.dataStatus === 'intraday')) return 'intraday';
  const candidateDatesKnown = result.candidates.every(candidate =>
    (marketDate(candidate.dataAsOf) ?? marketDate(candidate.lastBar))
    && !['unknown', 'missing', 'degraded'].includes(candidate.dataStatus ?? 'unknown'));
  return result.dataFreshness === 'final_close' && session && dates.length > 0 && candidateDatesKnown
    ? 'final_close' : 'unknown';
}

export function getStaleInputs(result: ScreenerResponse) {
  const session = marketDate(result.asofDate);
  const inputs = result.candidates.map(candidate => ({
    ticker: candidate.ticker,
    date: marketDate(candidate.dataAsOf) ?? marketDate(candidate.lastBar),
    stale: candidate.dataStatus === 'stale',
  }));
  inputs.push({ ticker: result.benchmarkTicker ?? '', date: marketDate(result.benchmarkLastBar), stale: false });
  return inputs.filter(input => input.stale || (session && input.date && input.date < session));
}
