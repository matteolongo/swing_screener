import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { CandleChart } from './CandleChart';
import type { PriceHistoryPoint, CandlePattern } from '@/features/screener/types';

const bars: PriceHistoryPoint[] = [
  { date: '2024-01-01', open: 9.5, high: 10.2, low: 9.4, close: 10.0, volume: 1000 },
  { date: '2024-01-02', open: 10.0, high: 10.6, low: 9.9, close: 9.8, volume: 1200 },
];

describe('CandleChart', () => {
  it('renders one candle body per usable bar', () => {
    renderWithProviders(<CandleChart ticker="AAA" bars={bars} patterns={[]} />);
    expect(document.querySelectorAll('[data-testid="candle-body"]').length).toBe(2);
  });

  it('colors up vs down candles by close vs open', () => {
    renderWithProviders(<CandleChart ticker="AAA" bars={bars} patterns={[]} />);
    const bodies = document.querySelectorAll('[data-testid="candle-body"]');
    expect(bodies[0].getAttribute('data-direction')).toBe('up'); // close > open
    expect(bodies[1].getAttribute('data-direction')).toBe('down'); // close < open
  });

  it('renders volume bars', () => {
    renderWithProviders(<CandleChart ticker="AAA" bars={bars} patterns={[]} />);
    expect(document.querySelectorAll('[data-testid="volume-bar"]').length).toBe(2);
  });

  it('renders a pattern marker when patterns are present', () => {
    const patterns: CandlePattern[] = [
      {
        barIndex: 1,
        date: '2024-01-02',
        name: 'hammer',
        direction: 'bullish',
        keyLevel: 9.4,
        context: 'at_pullback',
      },
    ];
    renderWithProviders(<CandleChart ticker="AAA" bars={bars} patterns={patterns} />);
    expect(document.querySelectorAll('[data-testid="pattern-marker"]').length).toBe(1);
  });

  it('renders a rebased benchmark line when benchmark bars are provided', () => {
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
    expect(document.querySelectorAll('[data-testid="benchmark-line"]').length).toBe(1);
  });

  it('omits the benchmark line when no benchmark label', () => {
    renderWithProviders(<CandleChart ticker="AAA" bars={bars} patterns={[]} />);
    expect(document.querySelectorAll('[data-testid="benchmark-line"]').length).toBe(0);
  });

  it('renders a fallback when no usable OHLC bars', () => {
    const closeOnly: PriceHistoryPoint[] = [{ date: '2024-01-01', close: 10 }];
    renderWithProviders(<CandleChart ticker="AAA" bars={closeOnly} patterns={[]} />);
    expect(document.querySelectorAll('[data-testid="candle-body"]').length).toBe(0);
  });
});
