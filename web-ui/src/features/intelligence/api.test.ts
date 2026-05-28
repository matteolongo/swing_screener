import { describe, it, expect } from 'vitest';
import { candidateToPayload } from './api';
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

  it('position context does not overwrite candidate technical fields', () => {
    const position = {
      entryPrice: 140,
      rNow: 1.5,
      daysOpen: 12,
    } as PositionWithMetrics;
    const payload = candidateToPayload({ ...baseCandidate, entry: 152, stop: 143 }, position);
    expect(payload!.entry).toBe(152);
    expect(payload!.stop).toBe(143);
    expect(payload!.entry_price).toBe(140);
  });

  it('maps rr, atr, rel_strength from candidate fields', () => {
    const payload = candidateToPayload({
      ...baseCandidate,
      rr: 2.5,
      atr: 3.2,
      relStrength: 15.4,
    });
    expect(payload!.rr).toBe(2.5);
    expect(payload!.atr).toBe(3.2);
    expect(payload!.rel_strength).toBe(15.4);
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
        catalystSummary: null,
        catalystSources: [],
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
        catalystSummary: null,
        catalystSources: [],
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
