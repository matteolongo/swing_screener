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
  universes: ['mega', 'SP500', 'NASDAQ100', 'DOW30'],
}

export const mockScreenerResults = {
  candidates: [
    {
      ticker: 'AAPL',
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

// MSW request handlers
export const handlers = [
  // Config endpoints
  http.get(`${API_BASE_URL}/api/config`, () => {
    return HttpResponse.json(mockConfig)
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
    const body = await request.json()
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

  http.post(`${API_BASE_URL}/api/screener/run`, async ({ request }) => {
    return HttpResponse.json(mockScreenerResults)
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
