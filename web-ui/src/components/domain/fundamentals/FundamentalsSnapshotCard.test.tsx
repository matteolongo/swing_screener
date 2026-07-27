import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import FundamentalsSnapshotCard from '@/components/domain/fundamentals/FundamentalsSnapshotCard';
import type { FundamentalSnapshot } from '@/features/fundamentals/types';
import { t } from '@/i18n/t';

const snapshot: FundamentalSnapshot = {
  symbol: 'SBMO.AS',
  asofDate: '2026-03-19',
  provider: 'yfinance',
  updatedAt: '2026-03-19T10:00:00',
  instrumentType: 'equity',
  supported: true,
  coverageStatus: 'supported',
  freshnessStatus: 'unknown',
  companyName: 'SBM Offshore N.V.',
  sector: 'Energy',
  currency: 'EUR',
  revenueGrowthYoy: 0.195,
  earningsGrowthYoy: 17.196,
  operatingMargin: 0.341,
  freeCashFlowMargin: 0.761,
  debtToEquity: 141.24,
  trailingPe: 7.46,
  sharesOutstanding: 650_000_000,
  totalEquity: 6_500_000_000,
  bookValuePerShare: 10,
  priceToBook: 1.7,
  bookToPrice: 0.588,
  pillars: {
    growth: { score: 1, status: 'strong', summary: 'Revenue and earnings growth profile.' },
  },
  historicalSeries: {
    revenue: {
      label: 'Revenue',
      unit: 'currency',
      frequency: 'annual',
      direction: 'not_comparable',
      source: 'yfinance.financials',
      points: [
        { periodEnd: '2023-12-31', value: 4_962_000_000 },
        { periodEnd: '2024-12-31', value: 4_784_000_000 },
      ],
    },
    operating_margin: {
      label: 'Operating margin',
      unit: 'percent',
      frequency: 'annual',
      direction: 'unknown',
      source: 'yfinance.financials',
      points: [{ periodEnd: '2024-12-31', value: 0.19 }],
    },
  },
  metricContext: {
    revenue_growth_yoy: {
      source: 'yfinance.info.revenueGrowth',
      cadence: 'snapshot',
      derived: false,
      derivedFrom: [],
      periodEnd: '2025-12-31',
    },
    operating_margin: {
      source: 'yfinance.financials',
      cadence: 'annual',
      derived: true,
      derivedFrom: ['yfinance.financials', 'yfinance.financials'],
      periodEnd: '2024-12-31',
    },
  },
  dataQualityStatus: 'low',
  dataQualityFlags: [
    'Revenue YoY mixes snapshot metric data with annual history.',
    'Operating margin history is too sparse for a reliable trend signal.',
  ],
  redFlags: ['Operating margin is deteriorating.'],
  highlights: [
    'Revenue trend is improving.',
    'Profitability profile looks healthy.',
  ],
  metricSources: {
    revenue_growth_yoy: 'yfinance.info.revenueGrowth',
  },
};

describe('FundamentalsSnapshotCard', () => {
  it('renders trust metadata and filters contradictory trend narratives', () => {
    render(<FundamentalsSnapshotCard snapshot={snapshot} />);

    expect(
      screen.getByText(
        t('workspacePage.fundamentals.card.qualityBadge', {
          status: t('workspacePage.fundamentals.card.statuses.low'),
        }),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t('workspacePage.fundamentals.card.statuses.notComparable')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t('workspacePage.fundamentals.card.metrics.priceToBook')),
    ).toBeInTheDocument();
    expect(screen.getByText(/1[,.]7/)).toBeInTheDocument();
    expect(screen.getByText(/58[,.]8%/)).toBeInTheDocument();
    expect(screen.getByText(/6[,.]?5\s*B|6[,.]?500\s*M/i)).toBeInTheDocument();
    expect(screen.getByText(/650\s*M/i)).toBeInTheDocument();
    expect(screen.getByText('FY')).toBeInTheDocument();
    expect(screen.getByText('rep')).toBeInTheDocument();
    expect(screen.getByText(/yfinance · 2024-12-31/i)).toBeInTheDocument();
    expect(screen.getByText(/yfinance · 2025-12-31/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(t('workspacePage.fundamentals.card.dataQuality')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Revenue YoY mixes snapshot metric data with annual history\./i).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Revenue trend is improving.')).not.toBeInTheDocument();
    expect(screen.queryByText('Operating margin is deteriorating.')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Profitability profile looks healthy\./i).length).toBeGreaterThan(0);
  });

  it('renders the data quality flags before the pillar scores', () => {
    render(<FundamentalsSnapshotCard snapshot={snapshot} />);

    const flag = screen.getByText(
      /Operating margin history is too sparse for a reliable trend signal\./
    );
    const pillars = screen.getByText(t('workspacePage.fundamentals.card.pillarScores'));
    expect(
      flag.compareDocumentPosition(pillars) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('renders the decision-first hierarchy from localized copy', () => {
    render(<FundamentalsSnapshotCard snapshot={snapshot} />);

    expect(
      screen.getByText(t('workspacePage.fundamentals.card.overallRead')),
    ).toBeVisible();
    expect(
      screen.getByText(t('workspacePage.fundamentals.card.readMixed')),
    ).toBeVisible();
    expect(
      screen.getByText(t('workspacePage.fundamentals.card.keySupports')),
    ).toBeVisible();
    expect(
      screen.getByText(t('workspacePage.fundamentals.card.mainConcerns')),
    ).toBeVisible();
    expect(
      screen.getAllByText(t('workspacePage.fundamentals.card.dataQuality')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        t('workspacePage.fundamentals.card.qualityStatus', {
          status: t('workspacePage.fundamentals.card.statuses.low'),
        }),
      ),
    ).toBeVisible();
    expect(
      screen.getByText(t('workspacePage.fundamentals.card.recentHistory')),
    ).toBeVisible();
    expect(
      screen.getAllByText(t('workspacePage.fundamentals.card.date')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(t('workspacePage.fundamentals.card.value')).length,
    ).toBeGreaterThan(0);
  });
});
