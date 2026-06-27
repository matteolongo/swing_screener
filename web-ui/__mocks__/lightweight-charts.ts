import { vi } from 'vitest';

const mockSeries = {
  setData: vi.fn(),
  applyOptions: vi.fn(),
};

const mockPriceScale = {
  applyOptions: vi.fn(),
};

const mockTimeScale = {
  fitContent: vi.fn(),
  setVisibleRange: vi.fn(),
};

const mockChart = {
  addSeries: vi.fn(() => mockSeries),
  priceScale: vi.fn(() => mockPriceScale),
  timeScale: vi.fn(() => mockTimeScale),
  applyOptions: vi.fn(),
  remove: vi.fn(),
  resize: vi.fn(),
};

export const createChart = vi.fn(() => mockChart);
export const createSeriesMarkers = vi.fn(() => ({ setMarkers: vi.fn() }));
export const CandlestickSeries = 'CandlestickSeries';
export const HistogramSeries = 'HistogramSeries';
export const LineSeries = 'LineSeries';
export const LineStyle = { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 };
