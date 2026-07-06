import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import ScreenerCandidatesTable from '@/components/domain/screener/ScreenerCandidatesTable';
import { renderWithProviders } from '@/test/utils';
import { server } from '@/test/mocks/server';
import type { ScreenerCandidate } from '@/features/screener/types';

function candidate(): ScreenerCandidate {
  return {
    ticker: 'GE',
    currency: 'USD',
    close: 377.52,
    sma20: 360,
    sma50: 350,
    sma200: 300,
    atr: 7.36,
    momentum6m: 0.34,
    momentum12m: 0.5,
    relStrength: 0.12,
    score: 0.82,
    confidence: 78,
    rank: 2,
    rr: 2,
    decisionSummary: {
      symbol: 'GE',
      action: 'WAIT_FOR_BREAKOUT',
      conviction: 'low',
      technicalLabel: 'strong',
      fundamentalsLabel: 'neutral',
      valuationLabel: 'expensive',
      catalystLabel: 'unknown',
      whyNow: 'Wait for cleaner confirmation.',
      whatToDo: 'Watch the breakout level.',
      mainRisk: 'Valuation looks demanding.',
      tradePlan: { entry: 375.06, stop: 367.7, target: 397.16, rr: 3 },
      valuationContext: { method: 'earnings_multiple' },
      drivers: { positives: [], negatives: [], warnings: [], tradeState: [] },
    },
  };
}

describe('ScreenerCandidatesTable', () => {
  it('labels wait-for-breakout rows as breakout setup', () => {
    server.use(http.get('/api/screener/recurrence', () => HttpResponse.json([])));

    renderWithProviders(
      <ScreenerCandidatesTable
        candidates={[candidate()]}
        onCreateOrder={vi.fn()}
        onRecommendationDetails={vi.fn()}
      />
    );

    expect(screen.getByText('Breakout setup')).toBeInTheDocument();
    expect(screen.queryByText(/^Breakout$/)).not.toBeInTheDocument();
  });
});
