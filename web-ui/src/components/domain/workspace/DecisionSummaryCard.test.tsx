import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import DecisionSummaryCard from '@/components/domain/workspace/DecisionSummaryCard';
import { t } from '@/i18n/t';
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
      method: 'earnings_multiple',
      summary:
        'Valuation looks fair on current fundamentals. Fair value range is 171.22 to 215.12 using earnings multiple, and the current price is 6.8% below the base fair value. Trailing PE is 24.6x, price-to-sales is 5.1x, book value per share is 18.40, and price-to-book is 5.4x.',
      trailingPe: 24.6,
      priceToSales: 5.1,
      bookValuePerShare: 18.4,
      priceToBook: 5.4,
      bookToPrice: 0.1852,
      fairValueLow: 171.22,
      fairValueBase: 193.17,
      fairValueHigh: 215.12,
      premiumDiscountPct: -6.8,
    },
    drivers: {
      positives: ['Technical setup is ready.'],
      negatives: [],
      warnings: ['Fundamentals stale: latest quarter 2024-12-31.'],
      tradeState: [],
    },
    ...overrides,
  };
}

describe('DecisionSummaryCard', () => {
  it('renders the decision summary card with trade plan and warnings', () => {
    render(<DecisionSummaryCard summary={buildSummary()} currency="USD" onRefreshFundamentals={() => undefined} />);

    expect(screen.getByText(/AAPL Decision Summary/)).toBeInTheDocument();
    expect(screen.getByText(/Buy Now/)).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Coverage Warnings')).toBeInTheDocument();
    expect(screen.getByText('Fundamentals stale: latest quarter 2024-12-31.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: t('workspacePage.panels.analysis.decisionSummary.refreshFundamentalsAction'),
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Valuation Context')).toBeInTheDocument();
    expect(screen.getByText('Method: Earnings multiple')).toBeInTheDocument();
    expect(screen.getByText('24.6x')).toBeInTheDocument();
    expect(screen.getByText('$18.40')).toBeInTheDocument();
    expect(screen.getByText('$193.17')).toBeInTheDocument();
    expect(screen.getByText('-6.8%')).toBeInTheDocument();
  });

  it('shows canonical workflow guidance separately from an analytical action', () => {
    render(
      <DecisionSummaryCard
        summary={buildSummary({ action: 'WAIT_FOR_BREAKOUT', whatToDo: 'Wait for a breakout.' })}
        recommendation={{
          workflowStatus: 'ready',
          nextStep: { code: 'review_order' },
        }}
      />,
    );

    expect(screen.getByText('Ready for order review')).toBeInTheDocument();
    expect(screen.getByText('Review the proposed order')).toBeInTheDocument();
    expect(screen.getByText(/Decision Summary.*Wait for Breakout/)).toBeInTheDocument();
  });

  it('renders unknown catalyst as a neutral data state', () => {
    render(
      <DecisionSummaryCard
        summary={buildSummary({
          catalystLabel: 'unknown',
          drivers: { positives: [], negatives: [], warnings: [], tradeState: [] },
        })}
        currency="USD"
      />
    );

    expect(
      screen.getByText(
        `${t('workspacePage.panels.analysis.decisionSummary.labels.catalyst')}: ${t(
          'workspacePage.panels.analysis.decisionSummary.catalyst.unknown'
        )}`
      )
    ).toBeInTheDocument();
  });

  it('renders trade state outside coverage warnings', () => {
    render(
      <DecisionSummaryCard
        summary={buildSummary({
          action: 'MANAGE_ONLY',
          drivers: {
            positives: [],
            negatives: [],
            warnings: [],
            tradeState: ['This symbol is already in an active manage-only state.'],
          },
        })}
        currency="USD"
      />
    );

    expect(screen.queryByText('Coverage Warnings')).not.toBeInTheDocument();
    expect(
      screen.getByText(t('workspacePage.panels.analysis.decisionSummary.tradeStateTitle'))
    ).toBeInTheDocument();
    expect(screen.getByText('This symbol is already in an active manage-only state.')).toBeInTheDocument();
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

  it('renders book-based valuation metrics when book multiple is used', () => {
    render(
      <DecisionSummaryCard
        summary={buildSummary({
          tradePlan: {},
          valuationContext: {
            method: 'book_multiple',
            summary:
              'Valuation looks fair on current fundamentals. Fair value range is 62.30 to 76.30 using book multiple, and the current price is 27.8% below the base fair value. book value per share is 20.00, price-to-book is 2.5x, and book-to-price is 40.0%.',
            trailingPe: undefined,
            priceToSales: undefined,
            bookValuePerShare: 20,
            priceToBook: 2.5,
            bookToPrice: 0.4,
            fairValueLow: 62.3,
            fairValueBase: 69.3,
            fairValueHigh: 76.3,
            premiumDiscountPct: -27.8,
          },
          drivers: { positives: [], negatives: [], warnings: [] },
        })}
        currency="USD"
      />
    );

    expect(screen.getByText('Method: Book multiple')).toBeInTheDocument();
    expect(screen.getByText('Book Value / Share')).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();
  });
});

describe('DecisionSummaryCard — no trade plan metric grid', () => {
  it('does not render the Entry / Stop grid cells even when trade values exist', () => {
    render(<DecisionSummaryCard summary={buildSummary()} currency="USD" />);
    expect(screen.queryByText('Entry')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Stop$/)).not.toBeInTheDocument();
    expect(screen.queryByText('$180.00')).not.toBeInTheDocument();
  });
});
describe('DecisionSummaryCard — warning position', () => {
  it('renders coverage warnings before the explanation grid', () => {
    const summary = buildSummary({
      explanation: {
        summaryLine: 'Medium conviction setup.',
        whyItQualified: ['Setup quality is ready.'],
        whyNow: ['Valuation pressure argues against chasing.'],
        mainRisks: ['Valuation demanding.'],
        whatInvalidatesIt: ['Price below 274.03.'],
        nextBestAction: 'Wait for a pullback toward the stop.',
        confidenceNotes: ['Fundamentals stale: latest quarter 2024-12-31.'],
      },
    });
    render(<DecisionSummaryCard summary={summary} currency="USD" />);

    const warning = screen.getByText('Fundamentals stale: latest quarter 2024-12-31.');
    const whyItQualified = screen.getByText('Why It Qualified');
    expect(
      warning.compareDocumentPosition(whyItQualified) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
