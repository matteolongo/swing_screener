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

export interface RiskConfigAPI {
  account_size: number;
  risk_pct: number;
  max_position_pct: number;
  min_shares: number;
  k_atr: number;
  min_rr: number;
  max_fee_risk_pct: number;
}

export interface IndicatorConfigAPI {
  sma_fast: number;
  sma_mid: number;
  sma_long: number;
  atr_window: number;
  lookback_6m: number;
  lookback_12m: number;
  benchmark: string;
  breakout_lookback: number;
  pullback_ma: number;
  min_history: number;
}

export interface ManageConfigAPI {
  breakeven_at_r: number;
  trail_after_r: number;
  trail_sma: number;
  sma_buffer_pct: number;
  max_holding_days: number;
}

export interface AppConfigAPI {
  risk: RiskConfigAPI;
  indicators: IndicatorConfigAPI;
  manage: ManageConfigAPI;
  positions_file: string;
  orders_file: string;
}

export function transformAppConfig(api: AppConfigAPI): AppConfig {
  return {
    risk: {
      accountSize: api.risk.account_size,
      riskPct: api.risk.risk_pct,
      maxPositionPct: api.risk.max_position_pct,
      minShares: api.risk.min_shares,
      kAtr: api.risk.k_atr,
      minRr: api.risk.min_rr,
      maxFeeRiskPct: api.risk.max_fee_risk_pct,
    },
    indicators: {
      smaFast: api.indicators.sma_fast,
      smaMid: api.indicators.sma_mid,
      smaLong: api.indicators.sma_long,
      atrWindow: api.indicators.atr_window,
      lookback6m: api.indicators.lookback_6m,
      lookback12m: api.indicators.lookback_12m,
      benchmark: api.indicators.benchmark,
      breakoutLookback: api.indicators.breakout_lookback,
      pullbackMa: api.indicators.pullback_ma,
      minHistory: api.indicators.min_history,
    },
    manage: {
      breakevenAtR: api.manage.breakeven_at_r,
      trailAfterR: api.manage.trail_after_r,
      trailSma: api.manage.trail_sma,
      smaBufferPct: api.manage.sma_buffer_pct,
      maxHoldingDays: api.manage.max_holding_days,
    },
    positionsFile: api.positions_file,
    ordersFile: api.orders_file,
  };
}

export function toAppConfigAPI(config: AppConfig): AppConfigAPI {
  return {
    risk: {
      account_size: config.risk.accountSize,
      risk_pct: config.risk.riskPct,
      max_position_pct: config.risk.maxPositionPct,
      min_shares: config.risk.minShares,
      k_atr: config.risk.kAtr,
      min_rr: config.risk.minRr,
      max_fee_risk_pct: config.risk.maxFeeRiskPct,
    },
    indicators: {
      sma_fast: config.indicators.smaFast,
      sma_mid: config.indicators.smaMid,
      sma_long: config.indicators.smaLong,
      atr_window: config.indicators.atrWindow,
      lookback_6m: config.indicators.lookback6m,
      lookback_12m: config.indicators.lookback12m,
      benchmark: config.indicators.benchmark,
      breakout_lookback: config.indicators.breakoutLookback,
      pullback_ma: config.indicators.pullbackMa,
      min_history: config.indicators.minHistory,
    },
    manage: {
      breakeven_at_r: config.manage.breakevenAtR,
      trail_after_r: config.manage.trailAfterR,
      trail_sma: config.manage.trailSma,
      sma_buffer_pct: config.manage.smaBufferPct,
      max_holding_days: config.manage.maxHoldingDays,
    },
    positions_file: config.positionsFile,
    orders_file: config.ordersFile,
  };
}
