// Type definitions for configuration and settings

export interface RiskConfig {
  accountSize: number;
  riskPct: number;
  maxPositionPct: number;
  minShares: number;
  kAtr: number;
  minRr: number;
  maxFeeRiskPct: number;
}

export interface IndicatorConfig {
  smaFast: number;
  smaMid: number;
  smaLong: number;
  atrWindow: number;
  lookback6m: number;
  lookback12m: number;
  benchmark: string;
  breakoutLookback: number;
  pullbackMa: number;
  minHistory: number;
}

export interface ManageConfig {
  breakevenAtR: number;
  trailAfterR: number;
  trailSma: number;
  smaBufferPct: number;
  maxHoldingDays: number;
}

export interface AppConfig {
  risk: RiskConfig;
  indicators: IndicatorConfig;
  manage: ManageConfig;
  positionsFile: string;
  ordersFile: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  risk: {
    accountSize: 50000,
    riskPct: 0.01,
    maxPositionPct: 0.60,
    minShares: 1,
    kAtr: 2.0,
    minRr: 2.0,
    maxFeeRiskPct: 0.2,
  },
  indicators: {
    smaFast: 20,
    smaMid: 50,
    smaLong: 200,
    atrWindow: 14,
    lookback6m: 126,
    lookback12m: 252,
    benchmark: 'SPY',
    breakoutLookback: 50,
    pullbackMa: 20,
    minHistory: 260,
  },
  manage: {
    breakevenAtR: 1.0,
    trailAfterR: 2.0,
    trailSma: 20,
    smaBufferPct: 0.005,
    maxHoldingDays: 20,
  },
  positionsFile: 'data/positions.json',
  ordersFile: 'data/orders.json',
};
