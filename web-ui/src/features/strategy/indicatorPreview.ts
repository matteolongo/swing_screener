export interface IndicatorPreviewInput {
  breakoutLookback: number;
  pullbackMa: number;
  smaFast: number;
  smaMid: number;
  smaLong: number;
}

export interface IndicatorPreviewPoint {
  index: number;
  close: number;
  smaFast: number | null;
  smaMid: number | null;
  smaLong: number | null;
  pullbackMa: number | null;
  breakoutHigh: number | null;
}

export interface IndicatorPreviewViewModel {
  isValid: boolean;
  errorMessage?: string;
  points: IndicatorPreviewPoint[];
  latestClose: number;
  latestBreakoutHigh: number;
  latestPullbackMa: number;
}

interface SampleBar {
  close: number;
  high: number;
}

const SAMPLE_BAR_COUNT = 220;

function toPositiveInt(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded <= 0) return null;
  return rounded;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rollingAverage(values: number[], window: number, endIndex: number): number | null {
  if (window <= 0 || endIndex < window - 1) {
    return null;
  }
  const start = endIndex - window + 1;
  return average(values.slice(start, endIndex + 1));
}

function rollingMax(values: number[], window: number, endIndex: number): number | null {
  if (window <= 0 || endIndex < window - 1) {
    return null;
  }
  const start = endIndex - window + 1;
  return Math.max(...values.slice(start, endIndex + 1));
}

export function buildDeterministicSampleBars(length = SAMPLE_BAR_COUNT): SampleBar[] {
  return Array.from({ length }, (_, index) => {
    const trend = 95 + index * 0.17;
    const wave = Math.sin(index / 8) * 2.2 + Math.cos(index / 21) * 1.3;
    const deterministicNoise = (((index * 41) % 11) - 5) * 0.08;
    const close = trend + wave + deterministicNoise;
    const high = close + 0.65 + Math.abs(Math.sin(index / 5.5)) * 0.55;

    return {
      close,
      high,
    };
  });
}

export function buildIndicatorPreviewViewModel(input: IndicatorPreviewInput): IndicatorPreviewViewModel {
  const breakoutLookback = toPositiveInt(input.breakoutLookback);
  const pullbackMa = toPositiveInt(input.pullbackMa);
  const smaFast = toPositiveInt(input.smaFast);
  const smaMid = toPositiveInt(input.smaMid);
  const smaLong = toPositiveInt(input.smaLong);

  const windows = [breakoutLookback, pullbackMa, smaFast, smaMid, smaLong];
  if (windows.some((windowValue) => windowValue == null)) {
    return {
      isValid: false,
      errorMessage: 'All indicator windows must be positive integers.',
      points: [],
      latestClose: 0,
      latestBreakoutHigh: 0,
      latestPullbackMa: 0,
    };
  }

  const maxWindow = Math.max(...windows as number[]);
  if (maxWindow >= SAMPLE_BAR_COUNT) {
    return {
      isValid: false,
      errorMessage: `Window values must be below ${SAMPLE_BAR_COUNT}.`,
      points: [],
      latestClose: 0,
      latestBreakoutHigh: 0,
      latestPullbackMa: 0,
    };
  }

  const bars = buildDeterministicSampleBars();
  const closeSeries = bars.map((bar) => bar.close);
  const highSeries = bars.map((bar) => bar.high);

  const points: IndicatorPreviewPoint[] = closeSeries.map((close, index) => ({
    index,
    close,
    smaFast: rollingAverage(closeSeries, smaFast as number, index),
    smaMid: rollingAverage(closeSeries, smaMid as number, index),
    smaLong: rollingAverage(closeSeries, smaLong as number, index),
    pullbackMa: rollingAverage(closeSeries, pullbackMa as number, index),
    breakoutHigh: rollingMax(highSeries, breakoutLookback as number, index),
  }));

  const lastPoint = points[points.length - 1];
  return {
    isValid: true,
    points,
    latestClose: lastPoint?.close ?? 0,
    latestBreakoutHigh: lastPoint?.breakoutHigh ?? 0,
    latestPullbackMa: lastPoint?.pullbackMa ?? 0,
  };
}
