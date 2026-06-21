import type { Position } from '@/types/position';

export interface EquityPoint {
  date: string;
  cumulativeR: number;
  r: number;
}

export function finalR(p: Position): number | null {
  if (!p.initialRisk || p.initialRisk <= 0 || p.exitPrice == null) return null;
  return (p.exitPrice - p.entryPrice) / p.initialRisk;
}

export function maxR(p: Position): number | null {
  if (!p.initialRisk || p.initialRisk <= 0 || p.maxFavorablePrice == null) return null;
  return (p.maxFavorablePrice - p.entryPrice) / p.initialRisk;
}

export function holdingDays(p: Position): number | null {
  if (!p.exitDate || !p.entryDate) return null;
  const diff = new Date(p.exitDate).getTime() - new Date(p.entryDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function maxStreak(flags: boolean[]): number {
  let max = 0;
  let cur = 0;
  for (const f of flags) {
    if (f) { cur++; max = Math.max(max, cur); }
    else cur = 0;
  }
  return max;
}

export interface AnalyticsStats {
  winRate: number | null;
  avgR: number | null;
  profitFactor: number | null;
  avgHoldDays: number | null;
  maxWinStreak: number;
  maxLossStreak: number;
  equityCurve: EquityPoint[];
  rValues: number[];
  sorted: Position[];
  winCount: number;
  lossCount: number;
  beCount: number;
  totalTrades: number;
}

export function computeAnalyticsStats(data: Position[] | undefined): AnalyticsStats {
  const positions = (data ?? []).filter((p) => p.exitDate);
  const sorted = [...positions].sort((a, b) => (a.exitDate ?? '') < (b.exitDate ?? '') ? -1 : 1);

  const rValues = sorted.map(finalR).filter((r): r is number => r !== null);
  const hDays = sorted.map(holdingDays).filter((d): d is number => d !== null);

  const winCount = rValues.filter((r) => r > 0).length;
  const lossCount = rValues.filter((r) => r < 0).length;
  const beCount = rValues.filter((r) => r === 0).length;

  const winRate = (winCount + lossCount) > 0 ? (winCount / (winCount + lossCount)) * 100 : null;
  const avgRVal = mean(rValues);
  const positiveSum = rValues.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const negativeSum = rValues.filter((r) => r < 0).reduce((a, b) => a + b, 0);
  const profitFactor = negativeSum !== 0 ? positiveSum / Math.abs(negativeSum) : null;
  const avgHold = mean(hDays);

  // streaks
  const sortedRFlags = sorted.map((p) => (finalR(p) ?? 0) > 0);
  const wStreak = maxStreak(sortedRFlags);
  const lStreak = maxStreak(sortedRFlags.map((f) => !f));

  // equity curve
  let cumR = 0;
  const equityCurve: EquityPoint[] = sorted
    .filter((p) => finalR(p) !== null)
    .map((p) => {
      const r = finalR(p)!;
      cumR += r;
      return { date: p.exitDate!.slice(5), cumulativeR: cumR, r };
    });

  return {
    winRate,
    avgR: avgRVal,
    profitFactor,
    avgHoldDays: avgHold,
    maxWinStreak: wStreak,
    maxLossStreak: lStreak,
    equityCurve,
    rValues,
    sorted,
    winCount,
    lossCount,
    beCount,
    totalTrades: rValues.length,
  };
}
