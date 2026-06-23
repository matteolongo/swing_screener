// Event-study backtest types and the snake_case (API) -> camelCase (UI) transform.
// The transform is the single boundary between backend and UI naming.

// ---- Request (camelCase in the UI) ----

export interface BacktestConfigOverrides {
  patternStopEnabled?: boolean;
  patternStopAtrBuffer?: number;
  breakevenAtR?: number;
  trailAfterR?: number;
  trailSma?: number;
  maxHoldingDays?: number;
  exitSignalDays?: number;
  kAtr?: number;
  rrTarget?: number;
  breakoutLookback?: number;
  pullbackMa?: number;
  minHistory?: number;
}

export interface EventStudyRequest {
  tickers: string[];
  start?: string;
  end?: string;
  config?: BacktestConfigOverrides;
}

// ---- API shapes (snake_case, from the backend) ----

export interface TradeAPI {
  ticker: string;
  setup: string;
  entry_date: string;
  entry_price: number;
  initial_stop: number;
  initial_risk: number;
  target: number;
  exit_date: string;
  exit_price: number;
  exit_reason: string;
  r_multiple: number;
  bars_held: number;
  mfe_r: number;
  mae_r: number;
  pattern_stop_fired: boolean;
}

export interface SetupMetricsAPI {
  n_trades: number;
  win_rate: number;
  expectancy_r: number;
  total_r: number;
  profit_factor: number | null;
  avg_win_r: number;
  avg_loss_r: number;
  avg_bars_held: number;
  max_drawdown_r: number;
  exit_reason_counts: Record<string, number>;
}

export interface MetricsAPI extends SetupMetricsAPI {
  by_setup: Record<string, SetupMetricsAPI>;
}

export interface EventStudyResponseAPI {
  tickers: string[];
  start: string;
  end: string;
  config_used: Record<string, unknown>;
  trades: TradeAPI[];
  metrics: MetricsAPI;
}

export interface EventStudyLaunchResponseAPI {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
}

export interface EventStudyStatusResponseAPI {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  result?: EventStudyResponseAPI | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
}

// ---- UI model (camelCase) ----

export interface BacktestTrade {
  ticker: string;
  setup: string;
  entryDate: string;
  entryPrice: number;
  initialStop: number;
  initialRisk: number;
  target: number;
  exitDate: string;
  exitPrice: number;
  exitReason: string;
  rMultiple: number;
  barsHeld: number;
  mfeR: number;
  maeR: number;
  patternStopFired: boolean;
}

export interface SetupMetrics {
  nTrades: number;
  winRate: number;
  expectancyR: number;
  totalR: number;
  profitFactor: number | null;
  avgWinR: number;
  avgLossR: number;
  avgBarsHeld: number;
  maxDrawdownR: number;
  exitReasonCounts: Record<string, number>;
}

export interface BacktestMetrics extends SetupMetrics {
  bySetup: Record<string, SetupMetrics>;
}

export interface BacktestResult {
  tickers: string[];
  start: string;
  end: string;
  configUsed: Record<string, unknown>;
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
}

// ---- Transform ----

function transformTrade(t: TradeAPI): BacktestTrade {
  return {
    ticker: t.ticker,
    setup: t.setup,
    entryDate: t.entry_date,
    entryPrice: t.entry_price,
    initialStop: t.initial_stop,
    initialRisk: t.initial_risk,
    target: t.target,
    exitDate: t.exit_date,
    exitPrice: t.exit_price,
    exitReason: t.exit_reason,
    rMultiple: t.r_multiple,
    barsHeld: t.bars_held,
    mfeR: t.mfe_r,
    maeR: t.mae_r,
    patternStopFired: t.pattern_stop_fired,
  };
}

function transformSetupMetrics(m: SetupMetricsAPI): SetupMetrics {
  return {
    nTrades: m.n_trades,
    winRate: m.win_rate,
    expectancyR: m.expectancy_r,
    totalR: m.total_r,
    profitFactor: m.profit_factor,
    avgWinR: m.avg_win_r,
    avgLossR: m.avg_loss_r,
    avgBarsHeld: m.avg_bars_held,
    maxDrawdownR: m.max_drawdown_r,
    exitReasonCounts: m.exit_reason_counts ?? {},
  };
}

export function transformEventStudyResponse(api: EventStudyResponseAPI): BacktestResult {
  const bySetup: Record<string, SetupMetrics> = {};
  for (const [key, value] of Object.entries(api.metrics.by_setup ?? {})) {
    bySetup[key] = transformSetupMetrics(value);
  }

  return {
    tickers: api.tickers,
    start: api.start,
    end: api.end,
    configUsed: api.config_used ?? {},
    trades: (api.trades ?? []).map(transformTrade),
    metrics: {
      ...transformSetupMetrics(api.metrics),
      bySetup,
    },
  };
}
