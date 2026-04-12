import { describe, expect, it } from 'vitest';
import { buildPositionCaseStudy } from './reviewViewModel';
import type { Position } from '@/features/portfolio/types';

const position: Position = {
  ticker: 'MSFT',
  status: 'open',
  entryDate: '2026-04-01',
  entryPrice: 100,
  stopPrice: 95,
  shares: 10,
  positionId: 'pos-1',
  initialRisk: 5,
  currentPrice: 108,
  thesis: 'Breakout through multi-week base.',
};

describe('reviewViewModel', () => {
  it('builds a position case study from position metrics', () => {
    const result = buildPositionCaseStudy(position);

    expect(result.currentRNow).toBeCloseTo(1.6);
    expect(result.keyQuestion).toContain('deserves capital');
    expect(result.invalidationCheck).toContain('95.00');
  });

  it('uses daily review entry data when present', () => {
    const result = buildPositionCaseStudy(position, {
      positionId: 'pos-1',
      ticker: 'MSFT',
      entryPrice: 100,
      stopPrice: 95,
      currentPrice: 108,
      rNow: 0.5,
      reason: 'Trail the stop',
    });

    expect(result.currentRNow).toBe(0.5);
  });

  it('handles missing risk data', () => {
    const result = buildPositionCaseStudy({
      ...position,
      initialRisk: 0,
      currentPrice: undefined,
      thesis: undefined,
    });

    expect(result.currentRNow).toBeUndefined();
    expect(result.setupType).toBeUndefined();
  });
});
