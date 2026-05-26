import { describe, it, expect } from 'vitest';
import { transformIntelligence } from './types';
import type { SymbolIntelligenceAPI } from './types';

describe('transformIntelligence', () => {
  it('converts snake_case API shape to camelCase', () => {
    const api: SymbolIntelligenceAPI = {
      symbol: 'APAM',
      generated_at: '2026-05-23T10:00:00Z',
      action: 'BUY_NOW',
      conviction: 'high',
      catalyst_urgency: 'none',
      summary_line: 'Cyclical recovery.',
      narrative: '## Why\n...',
      upcoming_events: [],
      position_signal: null,
      position_outlook: null,
      sources: ['https://example.com'],
    };
    const result = transformIntelligence(api);
    expect(result.symbol).toBe('APAM');
    expect(result.generatedAt).toBe('2026-05-23T10:00:00Z');
    expect(result.summaryLine).toBe('Cyclical recovery.');
    expect(result.sources).toHaveLength(1);
  });
});

describe('transformIntelligence with new fields', () => {
  it('maps catalyst_urgency, upcoming_events, position_signal', () => {
    const api: SymbolIntelligenceAPI = {
      symbol: 'AAPL',
      generated_at: '2026-05-24T10:00:00Z',
      action: 'BUY_NOW',
      conviction: 'high',
      catalyst_urgency: 'high',
      summary_line: 'Strong.',
      narrative: 'Text.',
      upcoming_events: [
        { type: 'earnings', date: '2026-05-28', direction: 'bullish', summary: 'Q2 beat expected.' }
      ],
      position_signal: { action: 'HOLD', reason: 'Thesis intact.' },
      position_outlook: {
        expected_holding_period: '1-2_weeks',
        hold_until: 'Hold above SMA20 while catalyst momentum persists.',
        next_review_trigger: 'Reassess after earnings.',
        thesis_status: 'intact',
        invalidation_signals: ['Close below SMA20'],
        profit_management: 'trail_stop',
        opportunity_cost: 'medium',
        confidence_decay: 'Confidence fades if price stalls for two weeks.',
      },
      sources: [],
    };
    const result = transformIntelligence(api);
    expect(result.catalystUrgency).toBe('high');
    expect(result.upcomingEvents).toHaveLength(1);
    expect(result.upcomingEvents[0].type).toBe('earnings');
    expect(result.positionSignal).toEqual({ action: 'HOLD', reason: 'Thesis intact.' });
    expect(result.positionOutlook).toEqual({
      expectedHoldingPeriod: '1-2_weeks',
      holdUntil: 'Hold above SMA20 while catalyst momentum persists.',
      nextReviewTrigger: 'Reassess after earnings.',
      thesisStatus: 'intact',
      invalidationSignals: ['Close below SMA20'],
      profitManagement: 'trail_stop',
      opportunityCost: 'medium',
      confidenceDecay: 'Confidence fades if price stalls for two weeks.',
    });
  });

  it('defaults upcoming_events to [] and position fields to null', () => {
    const api: SymbolIntelligenceAPI = {
      symbol: 'MSFT',
      generated_at: '2026-05-24T10:00:00Z',
      action: 'WATCH',
      conviction: 'low',
      catalyst_urgency: 'none',
      summary_line: 'Flat.',
      narrative: 'Text.',
      upcoming_events: [],
      position_signal: null,
      position_outlook: null,
      sources: [],
    };
    const result = transformIntelligence(api);
    expect(result.upcomingEvents).toEqual([]);
    expect(result.positionSignal).toBeNull();
    expect(result.positionOutlook).toBeNull();
  });
});
