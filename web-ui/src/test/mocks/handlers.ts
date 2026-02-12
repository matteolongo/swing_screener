import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '@/lib/api'

// Mock data fixtures
export const mockConfig = {
  risk: {
    accountSize: 50000,
    riskPerTrade: 0.01,
    maxPositions: 10,
    minShares: 1,
  },
  market_data: {
    start: '2024-01-01',
    end: '2026-02-08',
    auto_adjust: true,
    progress: false,
  },
}

export const mockStrategies = [
  {
    id: 'default',
    name: 'Default',
    description: 'Default strategy seeded from current system settings.',
    module: 'momentum',
    is_default: true,
    created_at: '2026-02-08T00:00:00',
    updated_at: '2026-02-08T00:00:00',
    universe: {
      trend: { sma_fast: 20, sma_mid: 50, sma_long: 200 },
      vol: { atr_window: 14 },
      mom: { lookback_6m: 126, lookback_12m: 252, benchmark: 'SPY' },
      filt: {
        min_price: 5.0,
        max_price: 500.0,
        max_atr_pct: 15.0,
        require_trend_ok: true,
        require_rs_positive: false,
      },
    },
    ranking: {
      w_mom_6m: 0.45,
      w_mom_12m: 0.35,
      w_rs_6m: 0.2,
      top_n: 100,
    },
    signals: { breakout_lookback: 50, pullback_ma: 20, min_history: 260 },
    risk: {
      account_size: 50000.0,
      risk_pct: 0.01,
      max_position_pct: 0.6,
      min_shares: 1,
      k_atr: 2.0,
      min_rr: 2.0,
      max_fee_risk_pct: 0.2,
      regime_enabled: false,
      regime_trend_sma: 200,
      regime_trend_multiplier: 0.5,
      regime_vol_atr_window: 14,
      regime_vol_atr_pct_threshold: 6.0,
      regime_vol_multiplier: 0.5,
    },
    manage: {
      breakeven_at_r: 1.0,
      trail_after_r: 2.0,
      trail_sma: 20,
      sma_buffer_pct: 0.005,
      max_holding_days: 20,
      benchmark: 'SPY',
    },
    backtest: {
      entry_type: 'auto',
      exit_mode: 'trailing_stop',
      take_profit_r: 2.0,
      max_holding_days: 20,
      breakeven_at_r: 1.0,
      trail_after_r: 2.0,
      trail_sma: 20,
      sma_buffer_pct: 0.005,
      commission_pct: 0.0,
      min_history: 260,
    },
    social_overlay: {
      enabled: false,
      lookback_hours: 24,
      attention_z_threshold: 3.0,
      min_sample_size: 20,
      negative_sent_threshold: -0.4,
      sentiment_conf_threshold: 0.7,
      hype_percentile_threshold: 95.0,
    },
  },
  {
    id: 'momentum',
    name: 'Momentum',
    description: 'Faster trend + tighter filters.',
    module: 'momentum',
    is_default: false,
    created_at: '2026-02-08T08:30:00',
    updated_at: '2026-02-08T08:30:00',
    universe: {
      trend: { sma_fast: 15, sma_mid: 40, sma_long: 200 },
      vol: { atr_window: 10 },
      mom: { lookback_6m: 84, lookback_12m: 252, benchmark: 'SPY' },
      filt: {
        min_price: 10.0,
        max_price: 300.0,
        max_atr_pct: 12.0,
        require_trend_ok: true,
        require_rs_positive: true,
      },
    },
    ranking: {
      w_mom_6m: 0.5,
      w_mom_12m: 0.3,
      w_rs_6m: 0.2,
      top_n: 75,
    },
    signals: { breakout_lookback: 40, pullback_ma: 15, min_history: 200 },
    risk: {
      account_size: 50000.0,
      risk_pct: 0.01,
      max_position_pct: 0.5,
      min_shares: 1,
      k_atr: 1.8,
      min_rr: 2.0,
      max_fee_risk_pct: 0.2,
      regime_enabled: false,
      regime_trend_sma: 200,
      regime_trend_multiplier: 0.5,
      regime_vol_atr_window: 14,
      regime_vol_atr_pct_threshold: 6.0,
      regime_vol_multiplier: 0.5,
    },
    manage: {
      breakeven_at_r: 1.0,
      trail_after_r: 1.5,
      trail_sma: 15,
      sma_buffer_pct: 0.004,
      max_holding_days: 15,
      benchmark: 'SPY',
    },
    backtest: {
      entry_type: 'breakout',
      exit_mode: 'trailing_stop',
      take_profit_r: 2.0,
      max_holding_days: 15,
      breakeven_at_r: 1.0,
      trail_after_r: 1.5,
      trail_sma: 15,
      sma_buffer_pct: 0.004,
      commission_pct: 0.0,
      min_history: 200,
    },
    social_overlay: {
      enabled: true,
      lookback_hours: 24,
      attention_z_threshold: 3.0,
      min_sample_size: 20,
      negative_sent_threshold: -0.4,
      sentiment_conf_threshold: 0.7,
      hype_percentile_threshold: 95.0,
    },
  },
]

type StrategyPayload = (typeof mockStrategies)[number]

let activeStrategyId = mockStrategies[0].id
let strategies: StrategyPayload[] = [...mockStrategies]

const asObject = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' ? (value as Record<string, any>) : {}
)

export const mockPositions = [
  {
    ticker: 'VALE',
    status: 'open',
    entry_date: '2026-01-16',
    entry_price: 15.89,
    stop_price: 15.0,
    shares: 6,
    position_id: 'POS-VALE-20260116-01',
    source_order_id: 'ORD-VALE-20260116-ENTRY',
    initial_risk: 1.29,
    max_favorable_price: 17.03,
    exit_date: null,
    exit_price: null,
    current_price: 16.30,
    notes: '',
    exit_order_ids: null,
  },
  {
    ticker: 'INTC',
    status: 'closed',
    entry_date: '2026-01-15',
    entry_price: 48.15,
    stop_price: 47.17,
    shares: 1,
    position_id: 'POS-INTC-20260115-01',
    source_order_id: 'ORD-INTC-20260115-ENTRY',
    initial_risk: 0.98,
    max_favorable_price: null,
    exit_date: '2026-01-23',
    exit_price: 47.29,
    current_price: null,
    notes: 'stopped',
    exit_order_ids: ['ORD-INTC-20260115-STOP'],
  },
]

export const mockOrders = [
  {
    order_id: 'VALE-20260116-STOP',
    ticker: 'VALE',
    status: 'pending',
    order_kind: 'stop',
    order_type: 'SELL_STOP',
    limit_price: null,
    quantity: 6,
    stop_price: 14.9,
    order_date: '2026-01-16',
    filled_date: '',
    entry_price: null,
    position_id: 'POS-VALE-20260116-01',
    parent_order_id: 'ORD-VALE-20260116-ENTRY',
    tif: 'GTC',
    notes: 'trailing stop',
  },
]

export const mockUniverses = {
  universes: ['mega_all', 'mega_stocks', 'core_etfs', 'amsterdam_all', 'SP500', 'NASDAQ100', 'DOW30'],
}

export const mockScreenerResults = {
  candidates: [
    {
      ticker: 'AAPL',
      currency: 'USD',
      rank: 1,
      score: 0.95,
      close: 175.50,
      last_bar: '2026-02-07T16:00:00',
      sma_20: 170.00,
      sma_50: 165.00,
      sma_200: 160.00,
      atr: 3.25,
      momentum_6m: 25.0,
      momentum_12m: 45.0,
      rel_strength: 85.2,
      confidence: 72.5,
      overlay_status: 'OK',
      overlay_reasons: [],
      overlay_risk_multiplier: 1.0,
      overlay_max_pos_multiplier: 1.0,
      overlay_attention_z: 0.5,
      overlay_sentiment_score: 0.1,
      overlay_sentiment_confidence: 0.4,
      overlay_hype_score: 2.0,
      overlay_sample_size: 30,
    },
  ],
  asof_date: '2026-02-08',
  total_screened: 500,
  warnings: [],
}

export const mockOrderSnapshots = {
  orders: [
    {
      order_id: 'ORD-VALE-20260116-ENTRY',
      ticker: 'VALE',
      status: 'pending',
      order_type: 'SELL_STOP',
      quantity: 6,
      limit_price: null,
      stop_price: 14.9,
      order_kind: 'stop',
      last_price: 16.3,
      last_bar: '2026-02-07T16:00:00',
      pct_to_limit: null,
      pct_to_stop: -8.59,
    },
  ],
  asof: '2026-02-08',
}

export const mockBacktestRun = {
  tickers: ['AAPL', 'MSFT'],
  start: '2024-02-01',
  end: '2026-02-08',
  entry_type: 'auto',
  summary: {
    trades: 4,
    expectancy_R: 0.75,
    winrate: 0.5,
    profit_factor_R: 1.8,
    max_drawdown_R: -1.2,
    avg_R: 0.6,
    avg_win_R: 1.4,
    avg_loss_R: -0.8,
    trade_frequency_per_year: 8.0,
    rr_distribution: {
      '<-1R': 0,
      '-1 to 0R': 1,
      '0 to 1R': 1,
      '1 to 2R': 1,
      '2 to 3R': 1,
      '>=3R': 0,
    },
    best_trade_R: 2.4,
    worst_trade_R: -1.3,
  },
  summary_by_ticker: [
    {
      ticker: 'AAPL',
      trades: 2,
      expectancy_R: 0.9,
      winrate: 0.5,
      profit_factor_R: 2.0,
      max_drawdown_R: null,
      avg_R: 0.7,
      avg_win_R: 1.6,
      avg_loss_R: -0.9,
      trade_frequency_per_year: 4.0,
      rr_distribution: {
        '<-1R': 0,
        '-1 to 0R': 1,
        '0 to 1R': 0,
        '1 to 2R': 1,
        '2 to 3R': 0,
        '>=3R': 0,
      },
      best_trade_R: 2.4,
      worst_trade_R: -1.0,
    },
  ],
  trades: [
    {
      ticker: 'AAPL',
      entry_date: '2025-01-10',
      entry_price: 150.0,
      exit_date: '2025-01-20',
      exit_price: 165.0,
      R: 2.4,
      exit_reason: 'trailing_stop',
      holding_days: 8,
      stop_price: 145.0,
    },
  ],
  curve_total: [
    { date: '2025-01-20', R: 2.4, cum_R: 2.4, ticker: null },
  ],
  curve_by_ticker: [
    { date: '2025-01-20', R: 2.4, cum_R: 2.4, ticker: 'AAPL' },
  ],
  warnings: [],
  costs: {
    commission_pct: 0.0,
    slippage_bps: 5.0,
    fx_pct: 0.0,
    gross_R_total: 2.9,
    net_R_total: 2.4,
    fee_impact_pct: 0.17,
    avg_cost_R: 0.1,
    total_cost_R: 0.5,
  },
  education: {
    overview: 'Results are net of basic execution costs and designed for learning, not prediction.',
    drivers: ['Expectancy: 0.75R', 'Win rate: 50%', 'Avg win/loss: 1.40R / -0.80R'],
    caveats: ['Assumes entries at next bar open and ignores intraday liquidity constraints.'],
  },
  simulation_id: '20260208_223000_abcd12',
  simulation_name: '2026-02-08 22:30 • AAPL, MSFT • auto • 2024-02-01→2026-02-08',
  created_at: '2026-02-08T22:30:00',
}

export const mockBacktestSimulationList = [
  {
    id: '20260208_223000_abcd12',
    name: '2026-02-08 22:30 • AAPL, MSFT • auto • 2024-02-01→2026-02-08',
    created_at: '2026-02-08T22:30:00',
    tickers: ['AAPL', 'MSFT'],
    start: '2024-02-01',
    end: '2026-02-08',
    entry_type: 'auto',
    trades: 4,
  },
]

export const mockBacktestSimulation = {
  id: '20260208_223000_abcd12',
  name: '2026-02-08 22:30 • AAPL, MSFT • auto • 2024-02-01→2026-02-08',
  created_at: '2026-02-08T22:30:00',
  params: {
    tickers: ['AAPL', 'MSFT'],
    start: '2024-02-01',
    end: '2026-02-08',
    entry_type: 'auto',
    breakout_lookback: 50,
    pullback_ma: 20,
    min_history: 260,
    atr_window: 14,
    k_atr: 2.0,
    breakeven_at_r: 1.0,
    trail_after_r: 2.0,
    trail_sma: 20,
    sma_buffer_pct: 0.005,
    max_holding_days: 20,
    commission_pct: 0.0,
  },
  result: mockBacktestRun,
}

const resolveActiveStrategy = () => {
  const found = strategies.find((s) => s.id === activeStrategyId)
  if (!found) {
    activeStrategyId = strategies[0]?.id || 'default'
    return strategies[0]
  }
  return found
}

const buildSocialAnalysis = (symbol: string) => ({
  status: 'ok',
  symbol,
  provider: 'reddit',
  lookback_hours: 24,
  last_execution_at: '2026-02-09T09:00:00',
  sample_size: 32,
  sentiment_score: 0.18,
  sentiment_confidence: 0.62,
  attention_score: 32,
  attention_z: 1.9,
  hype_score: 2.1,
  reasons: [],
  raw_events: [
    {
      source: 'reddit',
      symbol,
      timestamp: '2026-02-09T08:45:00',
      text: `${symbol} looking strong today`,
      author_id_hash: 'hash123',
      upvotes: 12,
      url: 'https://www.reddit.com/r/stocks/comments/abc123',
      metadata: { subreddit: 'stocks', id: 'abc123' },
    },
  ],
})

// MSW request handlers
export const handlers = [
  // Config endpoints
  http.get(`${API_BASE_URL}/api/config`, () => {
    return HttpResponse.json(mockConfig)
  }),

  // Strategy endpoints
  http.get(`${API_BASE_URL}/api/strategy`, () => {
    return HttpResponse.json(strategies)
  }),

  http.post(`${API_BASE_URL}/api/strategy`, async ({ request }) => {
    const body = asObject(await request.json()) as Partial<StrategyPayload>
    if (body.id === 'default') {
      return HttpResponse.json({ detail: 'Cannot create strategy with reserved id.' }, { status: 400 })
    }
    if (body.id && strategies.some((s) => s.id === body.id)) {
      return HttpResponse.json({ detail: 'Strategy already exists' }, { status: 409 })
    }
    const bodyId = typeof body.id === 'string' ? body.id : `strategy-${Date.now()}`
    const bodyName = typeof body.name === 'string' ? body.name : 'New Strategy'
    const bodyDescription = typeof body.description === 'string' ? body.description : mockStrategies[0].description
    const bodyModule = typeof body.module === 'string' ? body.module : mockStrategies[0].module
    const created: StrategyPayload = {
      ...mockStrategies[0],
      ...body,
      id: bodyId,
      name: bodyName,
      description: bodyDescription,
      module: bodyModule,
      is_default: false,
      created_at: '2026-02-08T23:10:00',
      updated_at: '2026-02-08T23:10:00',
    }
    strategies = [...strategies, created]
    return HttpResponse.json(created, { status: 201 })
  }),

  http.delete(`${API_BASE_URL}/api/strategy/:id`, ({ params }) => {
    const id = params.id as string
    if (id === 'default') {
      return HttpResponse.json({ detail: 'Default strategy cannot be deleted' }, { status: 400 })
    }
    const exists = strategies.find((s) => s.id === id)
    if (!exists) {
      return HttpResponse.json({ detail: 'Strategy not found' }, { status: 404 })
    }
    strategies = strategies.filter((s) => s.id !== id)
    if (activeStrategyId === id) {
      activeStrategyId = strategies[0]?.id || 'default'
    }
    return HttpResponse.json({ status: 'deleted', id })
  }),

  http.get(`${API_BASE_URL}/api/strategy/active`, () => {
    return HttpResponse.json(resolveActiveStrategy())
  }),

  http.post(`${API_BASE_URL}/api/strategy/active`, async ({ request }) => {
    const body = asObject(await request.json())
    const target = strategies.find((s) => s.id === body.strategy_id)
    if (!target) {
      return HttpResponse.json({ detail: 'Strategy not found' }, { status: 404 })
    }
    activeStrategyId = target.id
    return HttpResponse.json(target)
  }),

  http.put(`${API_BASE_URL}/api/strategy/:id`, async ({ request, params }) => {
    const body = asObject(await request.json()) as Partial<StrategyPayload>
    const id = params.id as string
    const idx = strategies.findIndex((s) => s.id === id)
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Strategy not found' }, { status: 404 })
    }
    const updated: StrategyPayload = {
      ...strategies[idx],
      ...body,
      id,
      updated_at: '2026-02-08T22:45:00',
    }
    strategies = strategies.map((s) => (s.id === id ? updated : s))
    return HttpResponse.json(updated)
  }),

  // Positions endpoints
  http.get(`${API_BASE_URL}/api/portfolio/positions`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    
    let positions = mockPositions
    if (status) {
      positions = mockPositions.filter((p) => p.status === status)
    }
    
    return HttpResponse.json({ positions, asof: '2026-02-08' })
  }),

  http.get(`${API_BASE_URL}/api/portfolio/positions/:id/stop-suggestion`, ({ params }) => {
    const id = params.id as string
    const position = mockPositions.find((p) => p.position_id === id) ?? mockPositions[0]
    return HttpResponse.json({
      ticker: position?.ticker ?? 'VALE',
      status: 'open',
      last: position?.current_price ?? 16.3,
      entry: position?.entry_price ?? 15.89,
      stop_old: position?.stop_price ?? 15.0,
      stop_suggested: (position?.stop_price ?? 15.0) + 0.2,
      shares: position?.shares ?? 1,
      r_now: 0.6,
      action: 'MOVE_STOP_UP',
      reason: 'Trail: R=2.00 >= 2.0 and SMA20 trail',
    })
  }),

  // Orders endpoints
  http.get(`${API_BASE_URL}/api/portfolio/orders`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    
    let orders = mockOrders
    if (status) {
      orders = mockOrders.filter((o) => o.status === status)
    }
    
    return HttpResponse.json({ orders, asof: '2026-02-08' })
  }),

  http.post(`${API_BASE_URL}/api/portfolio/orders`, async ({ request }) => {
    const body = asObject(await request.json())
    return HttpResponse.json({ 
      order_id: `TEST-${Date.now()}`,
      ...body,
      status: 'pending'
    }, { status: 201 })
  }),

  http.get(`${API_BASE_URL}/api/portfolio/orders/snapshot`, () => {
    return HttpResponse.json(mockOrderSnapshots)
  }),

  // Screener endpoints
  http.get(`${API_BASE_URL}/api/screener/universes`, () => {
    return HttpResponse.json(mockUniverses)
  }),

  http.post(`${API_BASE_URL}/api/screener/run`, () => {
    return HttpResponse.json(mockScreenerResults)
  }),

  // Social endpoints
  http.post(`${API_BASE_URL}/api/social/analyze`, async ({ request }) => {
    const body = asObject(await request.json())
    const symbol = (body?.symbol || 'AAPL').toUpperCase()
    return HttpResponse.json(buildSocialAnalysis(symbol))
  }),

  // Backtest endpoints
  http.get(`${API_BASE_URL}/api/backtest/simulations`, () => {
    return HttpResponse.json(mockBacktestSimulationList)
  }),

  http.get(`${API_BASE_URL}/api/backtest/simulations/:id`, () => {
    return HttpResponse.json(mockBacktestSimulation)
  }),

  http.delete(`${API_BASE_URL}/api/backtest/simulations/:id`, () => {
    return HttpResponse.json({ status: 'deleted' })
  }),

  http.post(`${API_BASE_URL}/api/backtest/run`, async () => {
    return HttpResponse.json(mockBacktestRun)
  }),
]
