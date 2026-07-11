import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { CandleChart, selectDrawnZones, type ChartVolumeZone } from './CandleChart';

const createPriceLine = vi.fn((_options: { price: number }) => ({ applyOptions: vi.fn() }));
const addSeries = vi.fn(() => ({
  setData: vi.fn(),
  createPriceLine,
  applyOptions: vi.fn(),
}));

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries,
    priceScale: () => ({ applyOptions: vi.fn() }),
    remove: vi.fn(),
    applyOptions: vi.fn(),
  })),
  CandlestickSeries: 'Candlestick',
  HistogramSeries: 'Histogram',
  LineSeries: 'Line',
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
  createSeriesMarkers: vi.fn(),
}));

const bars = Array.from({ length: 5 }, (_, i) => ({
  date: `2024-01-0${i + 1}`,
  open: 10,
  high: 11,
  low: 9,
  close: 10,
  volume: 100,
}));

const zones: ChartVolumeZone[] = [
  { kind: 'poc', center: 10, priceLow: 9.5, priceHigh: 10.5, volumeShare: 0.2 },
  { kind: 'hvn', center: 12, priceLow: 11.5, priceHigh: 12.5, volumeShare: 0.15 },
  { kind: 'lvn', center: 8, priceLow: 7.5, priceHigh: 8.5, volumeShare: 0.02 },
];

describe('selectDrawnZones', () => {
  it('keeps POC + top 3 HVN + top 2 LVN by share', () => {
    const many: ChartVolumeZone[] = [
      { kind: 'poc', center: 10, priceLow: 9, priceHigh: 11, volumeShare: 0.2 },
      ...[0.18, 0.16, 0.14, 0.12].map((s, i) => ({
        kind: 'hvn' as const,
        center: 20 + i,
        priceLow: 19 + i,
        priceHigh: 21 + i,
        volumeShare: s,
      })),
      ...[0.05, 0.04, 0.03].map((s, i) => ({
        kind: 'lvn' as const,
        center: 5 - i,
        priceLow: 4 - i,
        priceHigh: 6 - i,
        volumeShare: s,
      })),
    ];
    const kept = selectDrawnZones(many);
    expect(kept.filter((z) => z.kind === 'poc')).toHaveLength(1);
    expect(kept.filter((z) => z.kind === 'hvn')).toHaveLength(3);
    expect(kept.filter((z) => z.kind === 'lvn')).toHaveLength(2);
  });
});

describe('CandleChart volume zones', () => {
  beforeEach(() => {
    createPriceLine.mockClear();
  });

  it('draws POC center + HVN/LVN edge lines when enabled', () => {
    render(<CandleChart ticker="AAPL" bars={bars} patterns={[]} volumeZones={zones} showVolumeZones />);
    const prices = createPriceLine.mock.calls.map((c) => c[0].price);
    expect(prices).toContain(10);
    expect(prices).toContain(11.5);
    expect(prices).toContain(12.5);
    expect(prices).toContain(7.5);
    expect(prices).toContain(8.5);
  });
});
