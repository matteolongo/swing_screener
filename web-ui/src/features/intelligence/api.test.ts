import { describe, it, expect, vi } from 'vitest';
import { candidateToPayload, postIntelligenceAnalysis } from './api';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';

const baseCandidate: SymbolAnalysisCandidate = {
  ticker: 'AAPL',
  close: 150,
  signal: 'BUY',
};

describe('candidateToPayload', () => {
  it('returns null when candidate has no close price', () => {
    expect(candidateToPayload({ ticker: 'AAPL' })).toBeNull();
  });

  it('builds a position-only payload for a held symbol with no candidate', () => {
    const position = {
      entryPrice: 100,
      stopPrice: 95,
      currentPrice: 110,
      rNow: 2,
      daysOpen: 46,
      entryDate: '2026-05-01',
    } as PositionWithMetrics;
    const payload = candidateToPayload(undefined, position);
    expect(payload).not.toBeNull();
    expect(payload!.close).toBe(110);
    expect(payload!.signal).toBe('MANAGE_ONLY');
    expect(payload!.entry_price).toBe(100);
    expect(payload!.entry_date).toBe('2026-05-01');
    expect(payload!.r_now).toBe(2);
    expect(payload!.days_open).toBe(46);
  });

  it('falls back to entry price when the position has no current price', () => {
    const position = { entryPrice: 100, rNow: 0, daysOpen: 1, entryDate: '2026-05-01' } as PositionWithMetrics;
    const payload = candidateToPayload(undefined, position);
    expect(payload!.close).toBe(100);
  });

  it('passes entry_date through when a candidate and position are both present', () => {
    const position = {
      entryPrice: 140,
      rNow: 1.5,
      daysOpen: 12,
      entryDate: '2026-04-10',
    } as PositionWithMetrics;
    const payload = candidateToPayload(baseCandidate, position);
    expect(payload!.entry_date).toBe('2026-04-10');
  });

  it('maps candidate fields to API payload', () => {
    const payload = candidateToPayload({
      ...baseCandidate,
      sma20: 145,
      sma50: 138,
      momentum6m: 12.5,
      sector: 'Technology',
      currency: 'USD',
      entry: 152,
      stop: 143,
    });
    expect(payload).not.toBeNull();
    expect(payload!.close).toBe(150);
    expect(payload!.signal).toBe('BUY');
    expect(payload!.sma_20).toBe(145);
    expect(payload!.sma_50).toBe(138);
    expect(payload!.momentum_6m).toBe(12.5);
    expect(payload!.sector).toBe('Technology');
    expect(payload!.entry).toBe(152);
    expect(payload!.stop).toBe(143);
  });

  it('omits position fields when no position provided', () => {
    const payload = candidateToPayload(baseCandidate);
    expect(payload!.entry_price).toBeUndefined();
    expect(payload!.r_now).toBeUndefined();
    expect(payload!.days_open).toBeUndefined();
  });

  it('maps candle patterns to recent_patterns strings', () => {
    const payload = candidateToPayload({
      ...baseCandidate,
      patterns: [
        { barIndex: 9, date: '2024-01-10', name: 'hammer', direction: 'bullish', keyLevel: 9, context: 'at_pullback' },
        { barIndex: 9, date: '2024-01-10', name: 'inside_bar', direction: 'bullish', keyLevel: 9, context: 'none' },
      ],
    });
    expect(payload!.recent_patterns).toEqual(['hammer@at_pullback', 'inside_bar@none']);
  });

  it('sets recent_patterns to null when no patterns', () => {
    const payload = candidateToPayload(baseCandidate);
    expect(payload!.recent_patterns).toBeNull();
  });

  it('omits position fields when null position provided', () => {
    const payload = candidateToPayload(baseCandidate, null);
    expect(payload!.entry_price).toBeUndefined();
    expect(payload!.r_now).toBeUndefined();
    expect(payload!.days_open).toBeUndefined();
  });

  it('includes position context when open position provided', () => {
    const position = {
      entryPrice: 140,
      rNow: 1.5,
      daysOpen: 12,
    } as PositionWithMetrics;
    const payload = candidateToPayload(baseCandidate, position);
    expect(payload!.entry_price).toBe(140);
    expect(payload!.r_now).toBe(1.5);
    expect(payload!.days_open).toBe(12);
  });

  it('position context does not overwrite stop/entry when position has no stopPrice', () => {
    const position = {
      entryPrice: 140,
      rNow: 1.5,
      daysOpen: 12,
    } as PositionWithMetrics;
    const payload = candidateToPayload({ ...baseCandidate, entry: 152, stop: 143 }, position);
    expect(payload!.stop).toBe(143);
    expect(payload!.entry_price).toBe(140);
  });

  it('overrides stop and entry with position values when position has stopPrice', () => {
    const position = {
      entryPrice: 47.72,
      stopPrice: 50.50,
      rNow: 1.17,
      daysOpen: 20,
    } as PositionWithMetrics;
    const payload = candidateToPayload({ ...baseCandidate, entry: 45.0, stop: 49.00 }, position);
    expect(payload!.stop).toBe(50.50);
    expect(payload!.entry).toBe(47.72);
    expect(payload!.entry_price).toBe(47.72);
  });

  it('maps rr, atr, rel_strength and sector rotation fields from candidate fields', () => {
    const payload = candidateToPayload({
      ...baseCandidate,
      rr: 2.5,
      atr: 3.2,
      relStrength: 15.4,
      sectorRs: 3.1,
      sectorRotationContext: { fast_rs: 0.04, slow_rs: 0.02, in_rotation: true },
      dist52wHighPct: -0.03,
      near52wHigh: true,
    });
    expect(payload!.rr).toBe(2.5);
    expect(payload!.atr).toBe(3.2);
    expect(payload!.rel_strength).toBe(15.4);
    expect(payload!.sector_rs).toBe(3.1);
    expect(payload!.sector_rotation_context).toEqual({ fast_rs: 0.04, slow_rs: 0.02, in_rotation: true });
    expect(payload!.dist_52w_high_pct).toBe(-0.03);
    expect(payload!.near_52w_high).toBe(true);
  });

  it('maps decision_action, decision_conviction, valuation_label, technical_label, fundamentals_label from decisionSummary', () => {
    const payload = candidateToPayload({
      ...baseCandidate,
      decisionSummary: {
        symbol: 'AAPL',
        action: 'BUY_NOW',
        conviction: 'high',
        technicalLabel: 'strong',
        fundamentalsLabel: 'neutral',
        valuationLabel: 'fair',
        catalystLabel: 'active',
        whyNow: 'Breakout.',
        whatToDo: 'Buy.',
        mainRisk: 'Risk.',
        tradePlan: { entry: 152, stop: 143, target: 170, rr: 2.5 },
        valuationContext: { method: 'earnings_multiple' },
        drivers: { positives: [], negatives: [], warnings: [] },
      },
    });
    expect(payload!.decision_action).toBe('BUY_NOW');
    expect(payload!.decision_conviction).toBe('high');
    expect(payload!.valuation_label).toBe('fair');
    expect(payload!.technical_label).toBe('strong');
    expect(payload!.fundamentals_label).toBe('neutral');
  });

  it('maps target and fair_value_* from decisionSummary.tradePlan and valuationContext', () => {
    const payload = candidateToPayload({
      ...baseCandidate,
      decisionSummary: {
        symbol: 'AAPL',
        action: 'BUY_NOW',
        conviction: 'high',
        technicalLabel: 'strong',
        fundamentalsLabel: 'neutral',
        valuationLabel: 'fair',
        catalystLabel: 'active',
        whyNow: 'Breakout.',
        whatToDo: 'Buy.',
        mainRisk: 'Risk.',
        tradePlan: { entry: 152, stop: 143, target: 170, rr: 2.5 },
        valuationContext: {
          method: 'earnings_multiple',
          fairValueLow: 140,
          fairValueBase: 160,
          fairValueHigh: 180,
        },
        drivers: { positives: [], negatives: [], warnings: [] },
      },
    });
    expect(payload!.target).toBe(170);
    expect(payload!.fair_value_low).toBe(140);
    expect(payload!.fair_value_base).toBe(160);
    expect(payload!.fair_value_high).toBe(180);
  });

  it('all new fields are null when candidate has no decisionSummary', () => {
    const payload = candidateToPayload(baseCandidate);
    expect(payload!.rr).toBeNull();
    expect(payload!.atr).toBeNull();
    expect(payload!.rel_strength).toBeNull();
    expect(payload!.target).toBeNull();
    expect(payload!.fair_value_low).toBeNull();
    expect(payload!.fair_value_base).toBeNull();
    expect(payload!.fair_value_high).toBeNull();
    expect(payload!.valuation_label).toBeNull();
    expect(payload!.decision_action).toBeNull();
    expect(payload!.decision_conviction).toBeNull();
    expect(payload!.technical_label).toBeNull();
    expect(payload!.fundamentals_label).toBeNull();
  });
});

describe('postIntelligenceAnalysis', () => {
  const okFetch = () =>
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: 'AAPL' }),
      text: async () => JSON.stringify({ symbol: 'AAPL' }),
    });

  it('omits force from the URL by default', async () => {
    const mockFetch = okFetch();
    vi.stubGlobal('fetch', mockFetch);

    await postIntelligenceAnalysis('AAPL', { close: 150, signal: 'BUY' });

    expect(mockFetch.mock.calls[0][0]).toContain('/api/intelligence/AAPL');
    expect(mockFetch.mock.calls[0][0]).not.toContain('force=true');
    vi.unstubAllGlobals();
  });

  it('appends force=true when forced', async () => {
    const mockFetch = okFetch();
    vi.stubGlobal('fetch', mockFetch);

    await postIntelligenceAnalysis('AAPL', { close: 150, signal: 'BUY' }, true);

    expect(mockFetch.mock.calls[0][0]).toContain('/api/intelligence/AAPL?force=true');
    vi.unstubAllGlobals();
  });
});
