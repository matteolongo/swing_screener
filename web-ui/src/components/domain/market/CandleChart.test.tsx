import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { CandleChart, rebaseBenchmark, computeSMA, patternLabel } from './CandleChart';
import type { CandlePattern, PriceHistoryPoint } from '@/features/screener/types';
import { t } from '@/i18n/t';

vi.mock('lightweight-charts');

const bars: PriceHistoryPoint[] = [
  { date: '2024-01-01', open: 9.5, high: 10.2, low: 9.4, close: 10.0, volume: 1000 },
  { date: '2024-01-02', open: 10.0, high: 10.6, low: 9.9, close: 9.8, volume: 1200 },
];

describe('CandleChart', () => {
  it('renders chart container when bars are usable', () => {
    renderWithProviders(<CandleChart ticker="AAA" bars={bars} patterns={[]} />);
    expect(document.querySelector('[data-testid="candle-chart-container"]')).toBeInTheDocument();
  });

  it('renders a fallback when no usable OHLC bars', () => {
    const closeOnly: PriceHistoryPoint[] = [{ date: '2024-01-01', close: 10 }];
    renderWithProviders(<CandleChart ticker="AAA" bars={closeOnly} patterns={[]} />);
    expect(document.querySelector('[data-testid="candle-chart-container"]')).not.toBeInTheDocument();
    expect(screen.getByText('AAA')).toBeInTheDocument();
  });

  it('shows benchmark legend with label and outperformance when provided', () => {
    const benchmarkBars: PriceHistoryPoint[] = [
      { date: '2024-01-01', close: 500 },
      { date: '2024-01-02', close: 505 },
    ];
    renderWithProviders(
      <CandleChart
        ticker="AAA"
        bars={bars}
        patterns={[]}
        benchmarkBars={benchmarkBars}
        benchmarkLabel="SPY"
        outperformancePct={-2.5}
      />,
    );
    expect(screen.getByText('SPY')).toBeInTheDocument();
    expect(screen.getByText('-2.5%')).toBeInTheDocument();
  });

  it('hides benchmark legend when no benchmark label', () => {
    renderWithProviders(<CandleChart ticker="AAA" bars={bars} patterns={[]} />);
    expect(screen.queryByText('SPY')).not.toBeInTheDocument();
  });
});

describe('patternLabel', () => {
  const base: CandlePattern = {
    barIndex: 9,
    date: '2024-02-02',
    name: 'shooting_star',
    direction: 'bearish',
    keyLevel: 12,
    context: 'at_breakout',
  };

  it('appends the volume-confirmed badge when volumeConfirmed is true', () => {
    const label = patternLabel({ ...base, volumeConfirmed: true });
    expect(label).toContain(t('chart.volumeConfirmed'));
    expect(label).toContain(t('chart.pattern.shooting_star'));
  });

  it('omits the badge when volume is not confirmed', () => {
    expect(patternLabel({ ...base, volumeConfirmed: false })).not.toContain(t('chart.volumeConfirmed'));
    expect(patternLabel({ ...base })).not.toContain(t('chart.volumeConfirmed'));
  });
});

describe('computeSMA', () => {
  const closes = [10, 11, 12, 13, 14];

  it('returns nulls for first period-1 bars', () => {
    const result = computeSMA(closes, 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
  });

  it('computes correct average at period boundary', () => {
    const result = computeSMA(closes, 3);
    expect(result[2]).toBeCloseTo((10 + 11 + 12) / 3);
    expect(result[4]).toBeCloseTo((12 + 13 + 14) / 3);
  });

  it('returns all nulls when fewer bars than period', () => {
    const result = computeSMA([10, 11], 5);
    expect(result).toEqual([null, null]);
  });
});

describe('rebaseBenchmark', () => {
  const usable = [
    { date: '2024-01-01', open: 9.5, high: 10.2, low: 9.4, close: 10.0, volume: 1000 },
    { date: '2024-01-02', open: 10.0, high: 10.6, low: 9.9, close: 9.8, volume: 1200 },
  ];

  it('rebases benchmark to symbol start price', () => {
    const benchBars = [
      { date: '2024-01-01', close: 500 },
      { date: '2024-01-02', close: 505 },
    ];
    const result = rebaseBenchmark(usable, benchBars);
    expect(result[0]).toBeCloseTo(10.0);
    expect(result[1]).toBeCloseTo(10.0 * (505 / 500));
  });

  it('returns nulls when no shared dates', () => {
    const benchBars = [{ date: '2024-02-01', close: 500 }];
    const result = rebaseBenchmark(usable, benchBars);
    expect(result).toEqual([null, null]);
  });

  it('returns nulls when benchmark base is zero', () => {
    const benchBars = [
      { date: '2024-01-01', close: 0 },
      { date: '2024-01-02', close: 505 },
    ];
    const result = rebaseBenchmark(usable, benchBars);
    expect(result).toEqual([null, null]);
  });
});
