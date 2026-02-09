// Backtest types for quick backtesting feature

export interface BacktestSummary {
  trades: number;
  expectancyR: number;
  winrate: number;
  profitFactorR: number;
  maxDrawdownR: number;
  avgR: number;
  bestTradeR: number | null;
  worstTradeR: number | null;
}

export interface BacktestTrade {
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  r: number;  // lowercase to match modal usage
  exitReason: string;
}

export interface QuickBacktestRequest {
  ticker: string;
  monthsBack?: number;
  entryType?: 'breakout' | 'pullback';
  kAtr?: number;
  maxHoldingDays?: number;
}

export interface QuickBacktestResponse {
  ticker: string;
  start: string;
  end: string;
  bars: number;
  trades: number;
  summary: BacktestSummary;  // Use transformed camelCase version
  tradesDetail: BacktestTrade[];  // Use transformed camelCase version
  warnings: string[];
}

// API response formats (snake_case)
export interface BacktestSummaryAPI {
  trades: number;
  expectancy_R: number;
  winrate: number;
  profit_factor_R: number;
  max_drawdown_R: number;
  avg_R: number;
  best_trade_R: number | null;
  worst_trade_R: number | null;
}

export interface BacktestTradeAPI {
  entry_date: string;
  entry_price: number;
  exit_date: string;
  exit_price: number;
  R: number;
  exit_reason: string;
}

export interface QuickBacktestResponseAPI {
  ticker: string;
  start: string;
  end: string;
  bars: number;
  trades: number;
  summary: BacktestSummaryAPI;
  trades_detail: BacktestTradeAPI[];
  warnings: string[];
}

// Transform functions
export function transformBacktestSummary(api: BacktestSummaryAPI): BacktestSummary {
  return {
    trades: api.trades,
    expectancyR: api.expectancy_R,
    winrate: api.winrate,
    profitFactorR: api.profit_factor_R,
    maxDrawdownR: api.max_drawdown_R,
    avgR: api.avg_R,
    bestTradeR: api.best_trade_R,
    worstTradeR: api.worst_trade_R,
  };
}

export function transformBacktestTrade(api: BacktestTradeAPI): BacktestTrade {
  return {
    entryDate: api.entry_date,
    entryPrice: api.entry_price,
    exitDate: api.exit_date,
    exitPrice: api.exit_price,
    r: api.R,  // API uses capital R, we use lowercase
    exitReason: api.exit_reason,
  };
}

export function transformQuickBacktestResponse(api: QuickBacktestResponseAPI): QuickBacktestResponse {
  return {
    ticker: api.ticker,
    start: api.start,
    end: api.end,
    bars: api.bars,
    trades: api.trades,
    summary: transformBacktestSummary(api.summary),  // Transform summary!
    tradesDetail: api.trades_detail.map(transformBacktestTrade),  // Transform each trade!
    warnings: api.warnings,
  };
}

// ===== Full Backtest Types =====

export type FullEntryType = 'auto' | 'breakout' | 'pullback';

export interface FullBacktestParams {
  tickers: string[];
  start: string;
  end: string;
  investedBudget?: number | null;
  entryType: FullEntryType;
  breakoutLookback: number;
  pullbackMa: number;
  minHistory: number;
  atrWindow: number;
  kAtr: number;
  breakevenAtR: number;
  trailAfterR: number;
  trailSma: number;
  smaBufferPct: number;
  maxHoldingDays: number;
  commissionPct: number;
}

export interface FullBacktestSummary {
  trades: number;
  expectancyR: number | null;
  winrate: number | null;
  profitFactorR: number | null;
  maxDrawdownR: number | null;
  avgR: number | null;
  bestTradeR: number | null;
  worstTradeR: number | null;
}

export interface FullBacktestSummaryByTicker extends FullBacktestSummary {
  ticker: string;
}

export interface FullBacktestTrade {
  ticker: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  r: number;
  exitReason: string;
  holdingDays: number | null;
  stopPrice: number | null;
}

export interface BacktestCurvePoint {
  date: string;
  r: number;
  cumR: number;
  ticker?: string | null;
}

export interface FullBacktestResponse {
  tickers: string[];
  start: string;
  end: string;
  entryType: FullEntryType;
  summary: FullBacktestSummary;
  summaryByTicker: FullBacktestSummaryByTicker[];
  trades: FullBacktestTrade[];
  curveTotal: BacktestCurvePoint[];
  curveByTicker: BacktestCurvePoint[];
  warnings: string[];
  simulationId: string;
  simulationName: string;
  createdAt: string;
}

export interface FullBacktestResponseAPI {
  tickers: string[];
  start: string;
  end: string;
  entry_type: FullEntryType;
  summary: {
    trades: number;
    expectancy_R: number | null;
    winrate: number | null;
    profit_factor_R: number | null;
    max_drawdown_R: number | null;
    avg_R: number | null;
    best_trade_R: number | null;
    worst_trade_R: number | null;
  };
  summary_by_ticker: Array<{
    ticker: string;
    trades: number;
    expectancy_R: number | null;
    winrate: number | null;
    profit_factor_R: number | null;
    max_drawdown_R: number | null;
    avg_R: number | null;
    best_trade_R: number | null;
    worst_trade_R: number | null;
  }>;
  trades: Array<{
    ticker: string;
    entry_date: string;
    entry_price: number;
    exit_date: string;
    exit_price: number;
    R: number;
    exit_reason: string;
    holding_days: number | null;
    stop_price: number | null;
  }>;
  curve_total: Array<{
    date: string;
    R: number;
    cum_R: number;
    ticker?: string | null;
  }>;
  curve_by_ticker: Array<{
    date: string;
    R: number;
    cum_R: number;
    ticker?: string | null;
  }>;
  warnings: string[];
  simulation_id: string;
  simulation_name: string;
  created_at: string;
}

export interface BacktestSimulationMeta {
  id: string;
  name: string;
  createdAt: string;
  tickers: string[];
  start: string;
  end: string;
  entryType: FullEntryType;
  trades: number | null;
}

export interface BacktestSimulation {
  id: string;
  name: string;
  createdAt: string;
  params: FullBacktestParams;
  result: FullBacktestResponse;
}

export interface BacktestSimulationMetaAPI {
  id: string;
  name: string;
  created_at: string;
  tickers: string[];
  start: string;
  end: string;
  entry_type: FullEntryType;
  trades: number | null;
}

export interface BacktestSimulationAPI {
  id: string;
  name: string;
  created_at: string;
  params: {
    tickers: string[];
    start: string;
    end: string;
    invested_budget?: number | null;
    entry_type: FullEntryType;
    breakout_lookback: number;
    pullback_ma: number;
    min_history: number;
    atr_window: number;
    k_atr: number;
    breakeven_at_r: number;
    trail_after_r: number;
    trail_sma: number;
    sma_buffer_pct: number;
    max_holding_days: number;
    commission_pct: number;
  };
  result: FullBacktestResponseAPI;
}

export function transformFullBacktestResponse(api: FullBacktestResponseAPI): FullBacktestResponse {
  return {
    tickers: api.tickers,
    start: api.start,
    end: api.end,
    entryType: api.entry_type,
    summary: {
      trades: api.summary.trades,
      expectancyR: api.summary.expectancy_R,
      winrate: api.summary.winrate,
      profitFactorR: api.summary.profit_factor_R,
      maxDrawdownR: api.summary.max_drawdown_R,
      avgR: api.summary.avg_R,
      bestTradeR: api.summary.best_trade_R,
      worstTradeR: api.summary.worst_trade_R,
    },
    summaryByTicker: api.summary_by_ticker.map((s) => ({
      ticker: s.ticker,
      trades: s.trades,
      expectancyR: s.expectancy_R,
      winrate: s.winrate,
      profitFactorR: s.profit_factor_R,
      maxDrawdownR: s.max_drawdown_R,
      avgR: s.avg_R,
      bestTradeR: s.best_trade_R,
      worstTradeR: s.worst_trade_R,
    })),
    trades: api.trades.map((t) => ({
      ticker: t.ticker,
      entryDate: t.entry_date,
      entryPrice: t.entry_price,
      exitDate: t.exit_date,
      exitPrice: t.exit_price,
      r: t.R,
      exitReason: t.exit_reason,
      holdingDays: t.holding_days,
      stopPrice: t.stop_price,
    })),
    curveTotal: api.curve_total.map((p) => ({
      date: p.date,
      r: p.R,
      cumR: p.cum_R,
      ticker: p.ticker ?? null,
    })),
    curveByTicker: api.curve_by_ticker.map((p) => ({
      date: p.date,
      r: p.R,
      cumR: p.cum_R,
      ticker: p.ticker ?? null,
    })),
    warnings: api.warnings,
    simulationId: api.simulation_id,
    simulationName: api.simulation_name,
    createdAt: api.created_at,
  };
}

export function transformBacktestParamsFromAPI(api: BacktestSimulationAPI['params']): FullBacktestParams {
  return {
    tickers: api.tickers,
    start: api.start,
    end: api.end,
    investedBudget: api.invested_budget ?? null,
    entryType: api.entry_type,
    breakoutLookback: api.breakout_lookback,
    pullbackMa: api.pullback_ma,
    minHistory: api.min_history,
    atrWindow: api.atr_window,
    kAtr: api.k_atr,
    breakevenAtR: api.breakeven_at_r,
    trailAfterR: api.trail_after_r,
    trailSma: api.trail_sma,
    smaBufferPct: api.sma_buffer_pct,
    maxHoldingDays: api.max_holding_days,
    commissionPct: api.commission_pct,
  };
}

export function transformBacktestSimulationMeta(api: BacktestSimulationMetaAPI): BacktestSimulationMeta {
  return {
    id: api.id,
    name: api.name,
    createdAt: api.created_at,
    tickers: api.tickers,
    start: api.start,
    end: api.end,
    entryType: api.entry_type,
    trades: api.trades ?? null,
  };
}

export function transformBacktestSimulation(api: BacktestSimulationAPI): BacktestSimulation {
  const params = transformBacktestParamsFromAPI(api.params);
  return {
    id: api.id,
    name: api.name,
    createdAt: api.created_at,
    params,
    result: transformFullBacktestResponse(api.result),
  };
}
