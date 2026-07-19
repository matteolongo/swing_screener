import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import IntelligenceDecisionBrief from './IntelligenceDecisionBrief';

describe('IntelligenceDecisionBrief', () => {
  it('keeps a wait-for-breakout decision distinct from a pullback entry', () => {
    render(
      <IntelligenceDecisionBrief
        candidate={{
          ticker: 'BMO',
          currency: 'USD',
          fundamentalsFreshnessStatus: 'stale',
          decisionSummary: {
            symbol: 'BMO',
            action: 'WAIT_FOR_BREAKOUT',
            conviction: 'medium',
            technicalLabel: 'neutral',
            fundamentalsLabel: 'strong',
            valuationLabel: 'expensive',
            catalystLabel: 'active',
            whyNow: 'Catalyst support is active.',
            whatToDo: 'Wait for confirmation before entry.',
            mainRisk: 'Valuation is stretched.',
            tradePlan: {
              entry: 178.18,
              stop: 175.84,
              target: 185.2,
              rr: 3,
              entryCondition: 'wait_for_confirmation',
              triggerNote: 'Wait for a confirmed breakout. No precise trigger price is available in this screen yet.',
            },
            valuationContext: { method: 'not_available' },
            drivers: { positives: ['Technical structure is constructive.'], negatives: [], warnings: ['Fundamentals stale: latest quarter 2025-10-31.'], staleFundamentals: true },
            explanation: {
              summaryLine: 'Constructive setup, but confirmation is required.',
              whyItQualified: ['Technical structure is constructive.'],
              whyNow: ['Catalyst support is active.'],
              mainRisks: ['Valuation is stretched.'],
              whatInvalidatesIt: ['A close below $175.84 invalidates the plan.'],
              nextBestAction: 'Wait for confirmation before entry.',
              confidenceNotes: ['Fundamentals stale: latest quarter 2025-10-31.'],
            },
          },
        }}
      />,
    );

    expect(screen.getByText(/Wait for a confirmed breakout/)).toBeInTheDocument();
    expect(screen.queryByText(/Wait for a pullback to/)).not.toBeInTheDocument();
    expect(screen.getByText(/Fundamentals stale/)).toBeInTheDocument();
  });
});
