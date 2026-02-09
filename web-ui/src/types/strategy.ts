export type StrategyEntryType = 'auto' | 'breakout' | 'pullback';
export type StrategyExitMode = 'take_profit' | 'trailing_stop';

export interface StrategyTrend {
  smaFast: number;
  smaMid: number;
  smaLong: number;
}

export interface StrategyVol {
  atrWindow: number;
}

export interface StrategyMom {
  lookback6m: number;
  lookback12m: number;
  benchmark: string;
}

export interface StrategyFilt {
  minPrice: number;
  maxPrice: number;
  maxAtrPct: number;
  requireTrendOk: boolean;
  requireRsPositive: boolean;
}

export interface StrategyUniverse {
  trend: StrategyTrend;
  vol: StrategyVol;
  mom: StrategyMom;
  filt: StrategyFilt;
}

export interface StrategyRanking {
  wMom6m: number;
  wMom12m: number;
  wRs6m: number;
  topN: number;
}

export interface StrategySignals {
  breakoutLookback: number;
  pullbackMa: number;
  minHistory: number;
}

export interface StrategyRisk {
  accountSize: number;
  riskPct: number;
  maxPositionPct: number;
  minShares: number;
  kAtr: number;
}

export interface StrategyManage {
  breakevenAtR: number;
  trailAfterR: number;
  trailSma: number;
  smaBufferPct: number;
  maxHoldingDays: number;
  benchmark: string;
}

export interface StrategyBacktest {
  entryType: StrategyEntryType;
  exitMode: StrategyExitMode;
  takeProfitR: number;
  maxHoldingDays: number;
  breakevenAtR: number;
  trailAfterR: number;
  trailSma: number;
  smaBufferPct: number;
  commissionPct: number;
  minHistory: number;
}

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  universe: StrategyUniverse;
  ranking: StrategyRanking;
  signals: StrategySignals;
  risk: StrategyRisk;
  manage: StrategyManage;
  backtest: StrategyBacktest;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyTrendAPI {
  sma_fast: number;
  sma_mid: number;
  sma_long: number;
}

export interface StrategyVolAPI {
  atr_window: number;
}

export interface StrategyMomAPI {
  lookback_6m: number;
  lookback_12m: number;
  benchmark: string;
}

export interface StrategyFiltAPI {
  min_price: number;
  max_price: number;
  max_atr_pct: number;
  require_trend_ok: boolean;
  require_rs_positive: boolean;
}

export interface StrategyUniverseAPI {
  trend: StrategyTrendAPI;
  vol: StrategyVolAPI;
  mom: StrategyMomAPI;
  filt: StrategyFiltAPI;
}

export interface StrategyRankingAPI {
  w_mom_6m: number;
  w_mom_12m: number;
  w_rs_6m: number;
  top_n: number;
}

export interface StrategySignalsAPI {
  breakout_lookback: number;
  pullback_ma: number;
  min_history: number;
}

export interface StrategyRiskAPI {
  account_size: number;
  risk_pct: number;
  max_position_pct: number;
  min_shares: number;
  k_atr: number;
}

export interface StrategyManageAPI {
  breakeven_at_r: number;
  trail_after_r: number;
  trail_sma: number;
  sma_buffer_pct: number;
  max_holding_days: number;
  benchmark: string;
}

export interface StrategyBacktestAPI {
  entry_type: StrategyEntryType;
  exit_mode: StrategyExitMode;
  take_profit_r: number;
  max_holding_days: number;
  breakeven_at_r: number;
  trail_after_r: number;
  trail_sma: number;
  sma_buffer_pct: number;
  commission_pct: number;
  min_history: number;
}

export interface StrategyAPI {
  id: string;
  name: string;
  description?: string | null;
  universe: StrategyUniverseAPI;
  ranking: StrategyRankingAPI;
  signals: StrategySignalsAPI;
  risk: StrategyRiskAPI;
  manage: StrategyManageAPI;
  backtest: StrategyBacktestAPI;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface StrategyUpdateRequestAPI {
  name: string;
  description?: string | null;
  universe: StrategyUniverseAPI;
  ranking: StrategyRankingAPI;
  signals: StrategySignalsAPI;
  risk: StrategyRiskAPI;
  manage: StrategyManageAPI;
  backtest: StrategyBacktestAPI;
}

export interface StrategyCreateRequestAPI extends StrategyUpdateRequestAPI {
  id: string;
}

export interface ActiveStrategyRequestAPI {
  strategy_id: string;
}

export function transformStrategy(api: StrategyAPI): Strategy {
  return {
    id: api.id,
    name: api.name,
    description: api.description ?? undefined,
    universe: {
      trend: {
        smaFast: api.universe.trend.sma_fast,
        smaMid: api.universe.trend.sma_mid,
        smaLong: api.universe.trend.sma_long,
      },
      vol: {
        atrWindow: api.universe.vol.atr_window,
      },
      mom: {
        lookback6m: api.universe.mom.lookback_6m,
        lookback12m: api.universe.mom.lookback_12m,
        benchmark: api.universe.mom.benchmark,
      },
      filt: {
        minPrice: api.universe.filt.min_price,
        maxPrice: api.universe.filt.max_price,
        maxAtrPct: api.universe.filt.max_atr_pct,
        requireTrendOk: api.universe.filt.require_trend_ok,
        requireRsPositive: api.universe.filt.require_rs_positive,
      },
    },
    ranking: {
      wMom6m: api.ranking.w_mom_6m,
      wMom12m: api.ranking.w_mom_12m,
      wRs6m: api.ranking.w_rs_6m,
      topN: api.ranking.top_n,
    },
    signals: {
      breakoutLookback: api.signals.breakout_lookback,
      pullbackMa: api.signals.pullback_ma,
      minHistory: api.signals.min_history,
    },
    risk: {
      accountSize: api.risk.account_size,
      riskPct: api.risk.risk_pct,
      maxPositionPct: api.risk.max_position_pct,
      minShares: api.risk.min_shares,
      kAtr: api.risk.k_atr,
    },
    manage: {
      breakevenAtR: api.manage.breakeven_at_r,
      trailAfterR: api.manage.trail_after_r,
      trailSma: api.manage.trail_sma,
      smaBufferPct: api.manage.sma_buffer_pct,
      maxHoldingDays: api.manage.max_holding_days,
      benchmark: api.manage.benchmark,
    },
    backtest: {
      entryType: api.backtest.entry_type,
      exitMode: api.backtest.exit_mode,
      takeProfitR: api.backtest.take_profit_r,
      maxHoldingDays: api.backtest.max_holding_days,
      breakevenAtR: api.backtest.breakeven_at_r,
      trailAfterR: api.backtest.trail_after_r,
      trailSma: api.backtest.trail_sma,
      smaBufferPct: api.backtest.sma_buffer_pct,
      commissionPct: api.backtest.commission_pct,
      minHistory: api.backtest.min_history,
    },
    isDefault: api.is_default,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export function toStrategyUpdateRequest(strategy: Strategy): StrategyUpdateRequestAPI {
  return {
    name: strategy.name,
    description: strategy.description ?? undefined,
    universe: {
      trend: {
        sma_fast: strategy.universe.trend.smaFast,
        sma_mid: strategy.universe.trend.smaMid,
        sma_long: strategy.universe.trend.smaLong,
      },
      vol: {
        atr_window: strategy.universe.vol.atrWindow,
      },
      mom: {
        lookback_6m: strategy.universe.mom.lookback6m,
        lookback_12m: strategy.universe.mom.lookback12m,
        benchmark: strategy.universe.mom.benchmark,
      },
      filt: {
        min_price: strategy.universe.filt.minPrice,
        max_price: strategy.universe.filt.maxPrice,
        max_atr_pct: strategy.universe.filt.maxAtrPct,
        require_trend_ok: strategy.universe.filt.requireTrendOk,
        require_rs_positive: strategy.universe.filt.requireRsPositive,
      },
    },
    ranking: {
      w_mom_6m: strategy.ranking.wMom6m,
      w_mom_12m: strategy.ranking.wMom12m,
      w_rs_6m: strategy.ranking.wRs6m,
      top_n: strategy.ranking.topN,
    },
    signals: {
      breakout_lookback: strategy.signals.breakoutLookback,
      pullback_ma: strategy.signals.pullbackMa,
      min_history: strategy.signals.minHistory,
    },
    risk: {
      account_size: strategy.risk.accountSize,
      risk_pct: strategy.risk.riskPct,
      max_position_pct: strategy.risk.maxPositionPct,
      min_shares: strategy.risk.minShares,
      k_atr: strategy.risk.kAtr,
    },
    manage: {
      breakeven_at_r: strategy.manage.breakevenAtR,
      trail_after_r: strategy.manage.trailAfterR,
      trail_sma: strategy.manage.trailSma,
      sma_buffer_pct: strategy.manage.smaBufferPct,
      max_holding_days: strategy.manage.maxHoldingDays,
      benchmark: strategy.manage.benchmark,
    },
    backtest: {
      entry_type: strategy.backtest.entryType,
      exit_mode: strategy.backtest.exitMode,
      take_profit_r: strategy.backtest.takeProfitR,
      max_holding_days: strategy.backtest.maxHoldingDays,
      breakeven_at_r: strategy.backtest.breakevenAtR,
      trail_after_r: strategy.backtest.trailAfterR,
      trail_sma: strategy.backtest.trailSma,
      sma_buffer_pct: strategy.backtest.smaBufferPct,
      commission_pct: strategy.backtest.commissionPct,
      min_history: strategy.backtest.minHistory,
    },
  };
}

export function toStrategyCreateRequest(
  strategy: Strategy,
  payload: { id: string; name: string; description?: string }
): StrategyCreateRequestAPI {
  const base = {
    ...strategy,
    name: payload.name,
    description: payload.description ?? strategy.description,
  };
  return {
    id: payload.id,
    ...toStrategyUpdateRequest(base),
  };
}
