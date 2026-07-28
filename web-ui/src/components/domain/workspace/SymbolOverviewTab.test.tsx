import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { t } from '@/i18n/t';
import { renderWithProviders } from '@/test/utils';
import SymbolOverviewTab, { type SymbolOverviewModel } from './SymbolOverviewTab';

const candidate = {
  ticker: 'AAPL',
  currency: 'USD',
  entry: 200,
  stop: 190,
  recommendation: {
    workflowStatus: 'ready',
    nextStep: { code: 'review_order' },
    risk: { entry: 200, stop: 190, target: 220, rr: 2, riskPct: 0.05 },
  },
  decisionSummary: {
    symbol: 'AAPL',
    action: 'BUY_NOW',
    conviction: 'high',
    technicalLabel: 'strong',
    fundamentalsLabel: 'strong',
    valuationLabel: 'fair',
    catalystLabel: 'active',
    whyNow: 'Momentum and relative strength agree.',
    whatToDo: 'Review the proposed order.',
    mainRisk: 'A close below support invalidates the setup.',
    tradePlan: { entry: 200, stop: 190, target: 220, rr: 2 },
    drivers: {
      positives: ['Strong trend', 'Positive relative strength', 'Healthy growth', 'Extra support'],
      negatives: ['Elevated valuation', 'Earnings nearby', 'Wide stop', 'Extra opposition'],
      warnings: [],
    },
    valuationContext: { method: 'not_available', summary: '' },
  },
  sma20: 195,
  sma50: 185,
  sma200: 170,
  atr: 4,
  momentum6m: 0.2,
  momentum12m: 0.35,
  relStrength: 1.1,
  score: 85,
  confidence: 0.8,
  rank: 1,
  close: 200,
} as any;

function buildModel(overrides: Partial<SymbolOverviewModel> = {}): SymbolOverviewModel {
  return {
    ticker: 'AAPL',
    candidate,
    position: null,
    fundamentals: {
      data: {
        symbol: 'AAPL',
        provider: 'mock',
        updatedAt: '2026-07-27T20:00:00Z',
        trailingPe: 25,
        revenueGrowthYoy: 0.12,
        grossMargin: 0.45,
      } as any,
      isLoading: false,
      isError: false,
      error: null,
    },
    catalyst: {
      data: {
        ticker: 'AAPL',
        state: 'CATALYST_ACTIVE',
        thesis: 'Product launch supports demand.',
        generatedAt: '2026-07-27T19:00:00Z',
      } as any,
      isLoading: false,
      isError: false,
      error: null,
    },
    intelligenceOutdated: false,
    onOpenFundamentals: vi.fn(),
    onOpenIntelligence: vi.fn(),
    ...overrides,
  };
}

describe('SymbolOverviewTab', () => {
  const sourceFailure = (message: string) => ({
    data: null,
    isLoading: false,
    isError: true,
    error: new Error(message),
  });
  const reliabilityCases: Array<{
    name: string;
    overrides: Partial<SymbolOverviewModel>;
    expected: string;
  }> = [
    {
      name: 'no-data',
      overrides: {
        fundamentals: { data: null, isLoading: false, isError: false, error: null },
        catalyst: { data: null, isLoading: false, isError: false, error: null },
      },
      expected: t('workspacePage.overview.notAvailable'),
    },
    {
      name: 'fresh',
      overrides: {},
      expected: t('workspacePage.overview.openFundamentals'),
    },
    { name: 'cached', overrides: {}, expected: 'Product launch supports demand.' },
    { name: 'stale', overrides: { intelligenceOutdated: true }, expected: t('workspacePage.overview.intelligenceOutdated') },
    {
      name: 'refreshing-with-data',
      overrides: {
        fundamentals: { ...buildModel().fundamentals, isLoading: true },
      },
      expected: t('workspacePage.overview.openFundamentals'),
    },
    { name: 'partial', overrides: { fundamentals: sourceFailure('Overview partial') }, expected: t('workspacePage.data.partial') },
    {
      name: 'failed',
      overrides: {
        fundamentals: sourceFailure('Overview fundamentals failed'),
        catalyst: sourceFailure('Overview catalysts failed'),
      },
      expected: t('workspacePage.data.partial'),
    },
    { name: 'timeout', overrides: { fundamentals: sourceFailure('Overview timed out') }, expected: t('workspacePage.data.partial') },
    { name: 'malformed', overrides: { catalyst: sourceFailure('Overview malformed') }, expected: t('workspacePage.data.partial') },
  ];

  it.each(reliabilityCases)('keeps its decision and $name source contract visible', ({ overrides, expected }) => {
    renderWithProviders(<SymbolOverviewTab model={buildModel(overrides)} />);
    expect(
      screen.getAllByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyNow')),
    ).toHaveLength(1);
    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  });

  it('renders one canonical action and groups the trade plan as a table', () => {
    renderWithProviders(<SymbolOverviewTab model={buildModel()} />);

    expect(screen.getAllByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'))).toHaveLength(1);
    const tradePlan = screen.getByRole('table', { name: t('workspacePage.overview.tradePlan') });
    expect(tradePlan).toBeVisible();
    const metricRows = within(tradePlan).getAllByRole('row');
    expect(metricRows).toHaveLength(8);
    for (const row of metricRows) {
      expect(within(row).getAllByRole('rowheader')).toHaveLength(1);
      expect(within(row).getAllByRole('cell')).toHaveLength(1);
    }
    expect(screen.getByRole('link', { name: t('workspacePage.overview.openFundamentals') })).toBeVisible();
    expect(screen.getAllByRole('listitem', { name: t('workspacePage.overview.supportingSignal') })).toHaveLength(3);
    expect(screen.getAllByRole('listitem', { name: t('workspacePage.overview.opposingSignal') })).toHaveLength(3);
  });

  it('shows available content and names a failed dependency', () => {
    renderWithProviders(
      <SymbolOverviewTab
        model={buildModel({
          fundamentals: {
            data: null,
            isLoading: false,
            isError: true,
            error: new Error('Fundamentals unavailable'),
          },
        })}
      />,
    );

    const decision = screen.getByText(t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'));
    const evidence = screen.getByText(t('workspacePage.overview.supports'));
    const partial = screen.getByText(t('workspacePage.data.partial'));
    expect(decision.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(evidence.compareDocumentPosition(partial) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByText(/fundamentals/i).some((element) => element.textContent?.includes('Unavailable'))).toBe(true);
    expect(screen.getByTestId('symbol-candle-chart')).toBeVisible();
  });
});
