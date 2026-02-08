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
  R: number;
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
  summary: BacktestSummaryAPI;
  tradesDetail: BacktestTradeAPI[];
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
    R: api.R,
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
    summary: api.summary,
    tradesDetail: api.trades_detail,
    warnings: api.warnings,
  };
}
