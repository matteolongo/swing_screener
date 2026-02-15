import { describe, expect, it } from 'vitest';
import { buildOpportunityEducation } from './presentation';
import { IntelligenceOpportunity } from './types';

function makeOpportunity(overrides: Partial<IntelligenceOpportunity> = {}): IntelligenceOpportunity {
  return {
    symbol: 'AAPL',
    technicalReadiness: 0.82,
    catalystStrength: 0.71,
    opportunityScore: 0.77,
    state: 'TRENDING',
    explanations: ['Catalyst + follow-through confirmed.'],
    ...overrides,
  };
}

describe('intelligence presentation', () => {
  it('builds educational copy from explanation tokens when provided', () => {
    const education = buildOpportunityEducation(
      makeOpportunity({
        explanations: [
          'technical=0.50',
          'catalyst=0.63',
          'blend=0.56',
          'Peer confirmation: 4 semis moved together.',
        ],
      })
    );

    expect(education.opportunityLabel).toBe('Opportunity 56.0%');
    expect(education.technicalLine).toBe('Technical readiness 50.0% (Low): trend structure quality.');
    expect(education.catalystLine).toBe('Catalyst strength 63.0% (Medium): freshness and reaction quality.');
    expect(education.blendLine).toBe('Combined opportunity 56.0% (Medium): blended technical + catalyst edge.');
    expect(education.evidence).toEqual(['Peer confirmation: 4 semis moved together.']);
  });

  it('falls back to opportunity fields and default evidence when no explanations are available', () => {
    const education = buildOpportunityEducation(makeOpportunity({ explanations: [] }));

    expect(education.stateLabel).toBe('Trending');
    expect(education.stateSummary).toBe(
      'Strong continuation state with confirmed momentum and catalyst support.'
    );
    expect(education.technicalLine).toBe('Technical readiness 82.0% (High): trend structure quality.');
    expect(education.catalystLine).toBe('Catalyst strength 71.0% (Medium): freshness and reaction quality.');
    expect(education.blendLine).toBe('Combined opportunity 77.0% (High): blended technical + catalyst edge.');
    expect(education.evidence).toEqual(['No additional plain-language evidence was captured for this symbol.']);
  });

  it('clamps token values and maps unknown states to quiet defaults', () => {
    const education = buildOpportunityEducation(
      makeOpportunity({
        state: 'UNMAPPED',
        explanations: ['technical=2', 'catalyst=-1', 'blend=0.8'],
      })
    );

    expect(education.stateLabel).toBe('Quiet');
    expect(education.nextStep).toBe(
      'Keep on watchlist only if structure improves or a new catalyst appears.'
    );
    expect(education.riskNote).toBe(
      'High score does not remove risk. Define invalidation and size before entry.'
    );
    expect(education.technicalLine).toBe('Technical readiness 100.0% (High): trend structure quality.');
    expect(education.catalystLine).toBe('Catalyst strength 0.0% (Low): freshness and reaction quality.');
    expect(education.blendLine).toBe('Combined opportunity 80.0% (High): blended technical + catalyst edge.');
  });
});
