import { describe, expect, it } from 'vitest';
import type { Strategy } from '@/features/strategy/types';
import { evaluateStrategy } from '@/utils/strategySafety';

function buildStrategy(maxAtrPct: number): Strategy {
  return {
    id: 'default',
    name: 'Default',
    description: 'Default strategy',
    module: 'momentum',
    universe: {
      trend: {
        smaFast: 20,
        smaMid: 50,
        smaLong: 200,
      },
      vol: {
        atrWindow: 14,
      },
      mom: {
        lookback6m: 126,
        lookback12m: 252,
        benchmark: 'SPY',
      },
      filt: {
        minPrice: 5,
        maxPrice: 500,
        maxAtrPct,
        requireTrendOk: true,
        requireRsPositive: false,
        currencies: ['USD', 'EUR'],
      },
    },
    ranking: {
      wMom6m: 0.45,
      wMom12m: 0.35,
      wRs6m: 0.2,
      topN: 100,
    },
    signals: {
      breakoutLookback: 50,
      pullbackMa: 20,
      minHistory: 260,
    },
    risk: {
      accountSize: 50000,
      riskPct: 0.01,
      maxPositionPct: 0.2,
      minShares: 1,
      kAtr: 2.0,
      minRr: 2.0,
      maxFeeRiskPct: 0.2,
      regimeEnabled: false,
      regimeTrendSma: 200,
      regimeTrendMultiplier: 0.5,
      regimeVolAtrWindow: 14,
      regimeVolAtrPctThreshold: 6.0,
      regimeVolMultiplier: 0.5,
    },
    manage: {
      breakevenAtR: 1.0,
      trailAfterR: 2.0,
      trailSma: 20,
      smaBufferPct: 0.005,
      maxHoldingDays: 20,
      benchmark: 'SPY',
    },
    backtest: {
      entryType: 'auto',
      exitMode: 'trailing_stop',
      takeProfitR: 2.0,
      maxHoldingDays: 20,
      breakevenAtR: 1.0,
      trailAfterR: 2.0,
      trailSma: 20,
      smaBufferPct: 0.005,
      commissionPct: 0,
      minHistory: 260,
    },
    socialOverlay: {
      enabled: false,
      lookbackHours: 24,
      attentionZThreshold: 3.0,
      minSampleSize: 20,
      negativeSentThreshold: -0.4,
      sentimentConfThreshold: 0.7,
      hypePercentileThreshold: 95.0,
      providers: ['reddit'],
      sentimentAnalyzer: 'keyword',
    },
    isDefault: true,
    createdAt: '2026-02-08T00:00:00',
    updatedAt: '2026-02-08T00:00:00',
  };
}

describe('strategySafety ATR % scale', () => {
  it('does not warn for standard max ATR values like 15%', () => {
    const warnings = evaluateStrategy(buildStrategy(15));
    expect(warnings.find((warning) => warning.parameter === 'maxAtrPct')).toBeUndefined();
  });

  it('returns warning for high ATR values like 20%', () => {
    const warnings = evaluateStrategy(buildStrategy(20));
    expect(
      warnings.find((warning) => warning.parameter === 'maxAtrPct' && warning.level === 'warning')
    ).toBeDefined();
  });

  it('returns danger warning for extreme ATR values like 30%', () => {
    const warnings = evaluateStrategy(buildStrategy(30));
    expect(
      warnings.find((warning) => warning.parameter === 'maxAtrPct' && warning.level === 'danger')
    ).toBeDefined();
  });
});

