import { describe, it, expect } from 'vitest';
import { pickEdgeInsight } from './edgeInsight';

describe('pickEdgeInsight', () => {
  it('returns developing verdict when fewer than 5 trades', () => {
    const insight = pickEdgeInsight({ totalTrades: 3, avgR: null, profitFactor: null, winRate: null });
    expect(insight.verdict).toBe('developing');
    expect(insight.message).toContain('3 trades');
  });

  it('returns developing verdict for exactly 4 trades regardless of stats', () => {
    const insight = pickEdgeInsight({ totalTrades: 4, avgR: 1.5, profitFactor: 2.0, winRate: 80 });
    expect(insight.verdict).toBe('developing');
  });

  it('returns positive verdict when avgR > 0 and profitFactor >= 1.0', () => {
    const insight = pickEdgeInsight({ totalTrades: 20, avgR: 0.35, profitFactor: 1.8, winRate: 45 });
    expect(insight.verdict).toBe('positive');
    expect(insight.message).toContain('+0.35R');
    expect(insight.message).toContain('1.80');
  });

  it('returns positive verdict when profitFactor is exactly 1.0', () => {
    const insight = pickEdgeInsight({ totalTrades: 10, avgR: 0.05, profitFactor: 1.0, winRate: 50 });
    expect(insight.verdict).toBe('positive');
  });

  it('returns developing verdict when avgR > 0 but profitFactor < 1.0', () => {
    const insight = pickEdgeInsight({ totalTrades: 10, avgR: 0.1, profitFactor: 0.7, winRate: 60 });
    expect(insight.verdict).toBe('developing');
    expect(insight.message).toContain('+0.10R');
    expect(insight.message).toContain('0.70');
  });

  it('returns negative verdict when avgR <= 0 and win rate < 40%', () => {
    const insight = pickEdgeInsight({ totalTrades: 15, avgR: -0.5, profitFactor: 0.4, winRate: 30 });
    expect(insight.verdict).toBe('negative');
    expect(insight.message).toContain('30.0%');
  });

  it('returns negative verdict when avgR is 0', () => {
    const insight = pickEdgeInsight({ totalTrades: 8, avgR: 0, profitFactor: 1.0, winRate: 50 });
    expect(insight.verdict).toBe('negative');
  });

  it('returns negative verdict when avgR < 0 with win rate >= 40%', () => {
    const insight = pickEdgeInsight({ totalTrades: 12, avgR: -0.2, profitFactor: 0.8, winRate: 50 });
    expect(insight.verdict).toBe('negative');
  });

  it('message always contains a non-empty string', () => {
    const cases = [
      { totalTrades: 0, avgR: null, profitFactor: null, winRate: null },
      { totalTrades: 20, avgR: 0.5, profitFactor: 2.0, winRate: 60 },
      { totalTrades: 20, avgR: -0.3, profitFactor: 0.5, winRate: 35 },
    ];
    for (const c of cases) {
      expect(pickEdgeInsight(c).message.length).toBeGreaterThan(0);
    }
  });
});
