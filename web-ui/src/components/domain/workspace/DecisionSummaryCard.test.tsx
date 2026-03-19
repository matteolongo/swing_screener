import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import DecisionSummaryCard from '@/components/domain/workspace/DecisionSummaryCard';
import type { DecisionSummary } from '@/features/screener/types';

function buildSummary(overrides: Partial<DecisionSummary> = {}): DecisionSummary {
  return {
    symbol: 'AAPL',
    action: 'BUY_NOW',
    conviction: 'high',
    technicalLabel: 'strong',
    fundamentalsLabel: 'strong',
    valuationLabel: 'fair',
    catalystLabel: 'active',
    whyNow: 'Setup timing is ready and business quality supports conviction.',
    whatToDo: 'Use the current trade plan and keep sizing disciplined.',
    mainRisk: 'Valuation is acceptable, but risk still needs active management.',
    tradePlan: {
      entry: 180,
      stop: 171,
      target: 198,
      rr: 2.0,
    },
    valuationContext: {
      method: 'fundamental_pillar',
    },
    drivers: {
      positives: ['Technical setup is ready.'],
      negatives: [],
      warnings: ['No cached catalyst snapshot is available yet.'],
    },
    ...overrides,
  };
}

describe('DecisionSummaryCard', () => {
  it('renders the decision summary card with trade plan and warnings', () => {
    render(<DecisionSummaryCard summary={buildSummary()} currency="USD" />);

    expect(screen.getByText('AAPL Decision Summary')).toBeInTheDocument();
    expect(screen.getByText('Buy Now')).toBeInTheDocument();
    expect(screen.getByText('Conviction: High')).toBeInTheDocument();
    expect(screen.getByText('Coverage Warnings')).toBeInTheDocument();
    expect(screen.getByText('$180.00')).toBeInTheDocument();
    expect(screen.getByText('No cached catalyst snapshot is available yet.')).toBeInTheDocument();
  });

  it('hides the trade plan grid when trade values are missing', () => {
    render(
      <DecisionSummaryCard
        summary={buildSummary({
          tradePlan: {},
          drivers: { positives: [], negatives: [], warnings: [] },
        })}
        currency="USD"
      />
    );

    expect(screen.queryByText('Entry')).not.toBeInTheDocument();
    expect(screen.queryByText('Coverage Warnings')).not.toBeInTheDocument();
  });
});
