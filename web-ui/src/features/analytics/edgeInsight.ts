import { formatNumber } from '@/utils/formatters';

export type EdgeVerdict = 'positive' | 'developing' | 'negative';

export interface EdgeInsight {
  verdict: EdgeVerdict;
  message: string;
}

interface EdgeInsightInput {
  totalTrades: number;
  avgR: number | null;
  profitFactor: number | null;
  winRate: number | null;
}

export function pickEdgeInsight({ totalTrades, avgR, profitFactor, winRate }: EdgeInsightInput): EdgeInsight {
  if (totalTrades < 5) {
    return {
      verdict: 'developing',
      message: `${totalTrades} trades recorded — build more history before drawing conclusions.`,
    };
  }

  if (avgR != null && avgR > 0 && profitFactor != null && profitFactor >= 1.0) {
    return {
      verdict: 'positive',
      message: `Positive edge: average +${formatNumber(avgR, 2)}R per trade with a ${formatNumber(profitFactor, 2)} profit factor. Keep executing the system.`,
    };
  }

  if (avgR != null && avgR > 0) {
    return {
      verdict: 'developing',
      message: `Average R is positive (+${formatNumber(avgR, 2)}R) but profit factor is ${profitFactor != null ? formatNumber(profitFactor, 2) : '—'} — a few large wins may be masking more frequent small losses.`,
    };
  }

  // avgR <= 0 or null
  if (winRate != null && winRate < 40) {
    return {
      verdict: 'negative',
      message: `Win rate is ${formatNumber(winRate, 1)}% and average R is ${avgR != null ? formatNumber(avgR, 2) + 'R' : '—'}. Reduce full −1R losses by skipping low-conviction setups.`,
    };
  }

  return {
    verdict: 'negative',
    message: `Closed trades average ${avgR != null ? formatNumber(avgR, 2) + 'R' : '—'} — exits may be cutting winners too short. Compare captured R vs. peak R on recent trades.`,
  };
}
