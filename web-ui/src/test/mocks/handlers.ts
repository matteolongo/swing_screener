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
        currencies: ['USD', 'EUR'],
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
      account_size: 500.0,
      risk_pct: 0.01,
      max_position_pct: 0.6,
      min_shares: 1,
      k_atr: 2.0,
      min_rr: 2.0,
      rr_target: 2.0,
      commission_pct: 0.0,
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
    social_overlay: {
      enabled: false,
      lookback_hours: 24,
      attention_z_threshold: 3.0,
      min_sample_size: 20,
      negative_sent_threshold: -0.4,
      sentiment_conf_threshold: 0.7,
      hype_percentile_threshold: 95.0,
      providers: ['reddit'],
      sentiment_analyzer: 'keyword',
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
        currencies: ['USD', 'EUR'],
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
      account_size: 500.0,
      risk_pct: 0.01,
      max_position_pct: 0.5,
      min_shares: 1,
      k_atr: 1.8,
      min_rr: 2.0,
      rr_target: 2.0,
      commission_pct: 0.0,
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
    social_overlay: {
      enabled: true,
      lookback_hours: 24,
      attention_z_threshold: 3.0,
      min_sample_size: 20,
      negative_sent_threshold: -0.4,
      sentiment_conf_threshold: 0.7,
      hype_percentile_threshold: 95.0,
      providers: ['reddit', 'yahoo_finance'],
      sentiment_analyzer: 'vader',
    },
  },
]

type StrategyPayload = (typeof mockStrategies)[number]

let activeStrategyId = mockStrategies[0].id
let strategies: StrategyPayload[] = [...mockStrategies]

const asObject = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' ? (value as Record<string, any>) : {}
)

type ValidationWarningLevel = 'danger' | 'warning' | 'info'

const buildStrategyValidation = (payload: Record<string, any>) => {
  const warnings: Array<{ parameter: string; level: ValidationWarningLevel; message: string }> = []
  const signals = asObject(payload.signals)
  const risk = asObject(payload.risk)
  const universe = asObject(payload.universe)
  const filt = asObject(universe.filt)
  const manage = asObject(payload.manage)

  const breakoutLookback = Number(signals.breakout_lookback)
  if (Number.isFinite(breakoutLookback)) {
    if (breakoutLookback < 20) {
      warnings.push({
        parameter: 'breakoutLookback',
        level: 'danger',
        message: 'Breakout Lookback below 20 behaves more like day trading than swing trading.',
      })
    } else if (breakoutLookback < 40) {
      warnings.push({
        parameter: 'breakoutLookback',
        level: 'warning',
        message: 'Lower lookback periods increase signal frequency but may include more false breakouts.',
      })
    }
  }

  const pullbackMa = Number(signals.pullback_ma)
  if (Number.isFinite(pullbackMa)) {
    if (pullbackMa < 10) {
      warnings.push({
        parameter: 'pullbackMa',
        level: 'warning',
        message: 'Very short pullback periods may lead to entries on minor retracements that fail.',
      })
    } else if (pullbackMa > 50) {
      warnings.push({
        parameter: 'pullbackMa',
        level: 'info',
        message: 'Longer pullback periods are more conservative but may miss faster-moving opportunities.',
      })
    }
  }

  const minRr = Number(risk.min_rr)
  if (Number.isFinite(minRr)) {
    if (minRr < 1.5) {
      warnings.push({
        parameter: 'minimumRr',
        level: 'danger',
        message: 'Minimum R/R under 1.5 makes profitability statistically harder. Consider raising to 2 or higher.',
      })
    } else if (minRr < 2.0) {
      warnings.push({
        parameter: 'minimumRr',
        level: 'warning',
        message: 'R/R below 2 requires a higher win rate to be profitable. Most professionals target 2:1 or better.',
      })
    }
  }

  const riskPct = Number(risk.risk_pct) * 100
  if (Number.isFinite(riskPct)) {
    if (riskPct > 3) {
      warnings.push({
        parameter: 'riskPerTrade',
        level: 'danger',
        message: 'Risking more than 3% per trade significantly increases the risk of large drawdowns.',
      })
    } else if (riskPct > 2) {
      warnings.push({
        parameter: 'riskPerTrade',
        level: 'warning',
        message: 'Most professional traders risk 1-2% per trade. Higher risk requires perfect execution.',
      })
    }
  }

  const maxAtrPct = Number(filt.max_atr_pct)
  if (Number.isFinite(maxAtrPct)) {
    if (maxAtrPct > 25) {
      warnings.push({
        parameter: 'maxAtrPct',
        level: 'danger',
        message: 'Max ATR above 25% indicates extremely volatile stocks — beginners often struggle managing risk at this level.',
      })
    } else if (maxAtrPct > 18) {
      warnings.push({
        parameter: 'maxAtrPct',
        level: 'warning',
        message: 'Higher volatility means larger stop distances and more emotional pressure. Ensure your risk management is solid.',
      })
    }
  }

  const maxHoldingDays = Number(manage.max_holding_days)
  if (Number.isFinite(maxHoldingDays)) {
    if (maxHoldingDays < 5) {
      warnings.push({
        parameter: 'maxHoldingDays',
        level: 'warning',
        message: 'Very short holding periods may not give momentum enough time to develop.',
      })
    } else if (maxHoldingDays > 30) {
      warnings.push({
        parameter: 'maxHoldingDays',
        level: 'info',
        message: 'Longer holding periods can tie up capital in stagnant trades. Monitor performance closely.',
      })
    }
  }

  const dangerCount = warnings.filter((warning) => warning.level === 'danger').length
  const warningCount = warnings.filter((warning) => warning.level === 'warning').length
  const infoCount = warnings.filter((warning) => warning.level === 'info').length
  const safetyScore = Math.max(0, Math.min(100, 100 - dangerCount * 15 - warningCount * 8 - infoCount * 3))
  const safetyLevel =
    safetyScore >= 85
      ? 'beginner-safe'
      : safetyScore >= 70
        ? 'requires-discipline'
        : 'expert-only'

  return {
    is_valid: dangerCount === 0,
    warnings,
    safety_score: safetyScore,
    safety_level: safetyLevel,
    total_warnings: warnings.length,
    danger_count: dangerCount,
    warning_count: warningCount,
    info_count: infoCount,
  }
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
  universes: [
    'usd_all',
    'eur_all',
    'usd_mega_stocks',
    'usd_core_etfs',
    'usd_defense_all',
    'usd_healthcare_all',
    'eur_europe_large',
    'eur_amsterdam_all',
    'SP500',
    'NASDAQ100',
    'DOW30',
  ],
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

export const mockPortfolioSummary = {
  total_positions: 1,
  total_value: 97.8,
  total_cost_basis: 95.34,
  total_pnl: 2.46,
  total_pnl_percent: 2.58,
  open_risk: 7.74,
  open_risk_percent: 1.548,
  account_size: 500,
  available_capital: 402.2,
  largest_position_value: 97.8,
  largest_position_ticker: 'VALE',
  best_performer_ticker: 'VALE',
  best_performer_pnl_pct: 2.58,
  worst_performer_ticker: 'VALE',
  worst_performer_pnl_pct: 2.58,
  avg_r_now: 0.3178,
  positions_profitable: 1,
  positions_losing: 0,
  win_rate: 100,
}

export const mockPositionMetrics = {
  ticker: 'VALE',
  pnl: 2.46,
  pnl_percent: 2.58,
  r_now: 0.3178,
  entry_value: 95.34,
  current_value: 97.8,
  per_share_risk: 1.29,
  total_risk: 7.74,
}

const buildPositionMetrics = (position: (typeof mockPositions)[number]) => {
  const referencePrice = position.exit_price ?? position.current_price ?? position.entry_price
  const pnl = (referencePrice - position.entry_price) * position.shares
  const pnlPercent = ((referencePrice - position.entry_price) / position.entry_price) * 100
  const perShareRisk = position.initial_risk ?? (position.entry_price - position.stop_price)
  const totalRisk = perShareRisk * position.shares
  const rNow = totalRisk > 0 ? pnl / totalRisk : 0

  return {
    ticker: position.ticker,
    pnl,
    pnl_percent: pnlPercent,
    r_now: rNow,
    entry_value: position.entry_price * position.shares,
    current_value: referencePrice * position.shares,
    per_share_risk: perShareRisk,
    total_risk: totalRisk,
  }
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
  providers: ['reddit'],
  sentiment_analyzer: 'keyword',
  lookback_hours: 24,
  last_execution_at: '2026-02-09T09:00:00',
  sample_size: 32,
  sentiment_score: 0.18,
  sentiment_confidence: 0.62,
  attention_score: 32,
  attention_z: 1.9,
  hype_score: 2.1,
  source_breakdown: { reddit: 32 },
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

const mockIntelligenceLaunch = {
  job_id: 'intel-job-123',
  status: 'queued',
  total_symbols: 2,
  created_at: '2026-02-15T20:00:00',
  updated_at: '2026-02-15T20:00:00',
}

const mockIntelligenceConfig = {
  enabled: true,
  providers: ['yahoo_finance'],
  universe_scope: 'screener_universe',
  market_context_symbols: ['SPY'],
  llm: {
    enabled: false,
    provider: 'openai',
    model: 'gpt-4o-mini',
    base_url: 'https://api.openai.com/v1',
    api_key: '',
    system_prompt: '',
    user_prompt_template: '',
    enable_cache: true,
    enable_audit: false,
    cache_path: 'data/intelligence_cache.json',
    audit_path: 'data/intelligence_audit.json',
    max_concurrency: 4,
  },
  catalyst: {
    lookback_hours: 72,
    recency_half_life_hours: 24,
    false_catalyst_return_z: -0.5,
    min_price_reaction_atr: 0.5,
    require_price_confirmation: true,
  },
  theme: {
    enabled: false,
    min_cluster_size: 2,
    min_peer_confirmation: 2,
    curated_peer_map_path: 'config/peer_map.json',
  },
  opportunity: {
    technical_weight: 0.6,
    catalyst_weight: 0.4,
    max_daily_opportunities: 10,
    min_opportunity_score: 0.6,
  },
}

const mockIntelligenceProviders = [
  { provider: 'openai', available: true, detail: null },
  { provider: 'ollama', available: false, detail: 'not running' },
]

const defaultIntelligenceSymbolSets = [
  {
    id: 'core-us',
    name: 'Core US',
    symbols: ['AAPL', 'MSFT', 'NVDA'],
    created_at: '2026-02-15T09:00:00',
    updated_at: '2026-02-15T09:00:00',
  },
]

let intelligenceConfig = structuredClone(mockIntelligenceConfig)
let intelligenceSymbolSets = [...defaultIntelligenceSymbolSets]

const mockIntelligenceStatus = {
  job_id: 'intel-job-123',
  status: 'completed',
  total_symbols: 1,
  completed_symbols: 1,
  asof_date: '2026-02-15',
  opportunities_count: 1,
  error: null,
  created_at: '2026-02-15T20:00:00',
  updated_at: '2026-02-15T20:00:03',
}

const mockIntelligenceOpportunities = {
  asof_date: '2026-02-15',
  opportunities: [
    {
      symbol: 'AAPL',
      technical_readiness: 0.82,
      catalyst_strength: 0.71,
      opportunity_score: 0.77,
      state: 'TRENDING',
      explanations: ['Catalyst + follow-through confirmed.'],
    },
    {
      symbol: 'VALE',
      technical_readiness: 0.82,
      catalyst_strength: 0.71,
      opportunity_score: 0.77,
      state: 'TRENDING',
      explanations: ['Catalyst + follow-through confirmed.'],
    },
  ],
}

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

  http.post(`${API_BASE_URL}/api/strategy/validate`, async ({ request }) => {
    const body = asObject(await request.json())
    return HttpResponse.json(buildStrategyValidation(body))
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

  // Intelligence config endpoints
  http.get(`${API_BASE_URL}/api/intelligence/config`, () => {
    return HttpResponse.json(intelligenceConfig)
  }),

  http.put(`${API_BASE_URL}/api/intelligence/config`, async ({ request }) => {
    const body = asObject(await request.json())
    intelligenceConfig = {
      ...intelligenceConfig,
      ...body,
      llm: {
        ...intelligenceConfig.llm,
        ...asObject(body.llm),
      },
      catalyst: {
        ...intelligenceConfig.catalyst,
        ...asObject(body.catalyst),
      },
      theme: {
        ...intelligenceConfig.theme,
        ...asObject(body.theme),
      },
      opportunity: {
        ...intelligenceConfig.opportunity,
        ...asObject(body.opportunity),
      },
    }
    return HttpResponse.json(intelligenceConfig)
  }),

  http.get(`${API_BASE_URL}/api/intelligence/providers`, () => {
    return HttpResponse.json(mockIntelligenceProviders)
  }),

  http.post(`${API_BASE_URL}/api/intelligence/providers/test`, async ({ request }) => {
    const body = asObject(await request.json())
    return HttpResponse.json({
      provider: body.provider || 'openai',
      model: body.model || 'gpt-4o-mini',
      available: true,
      detail: null,
    })
  }),

  // Intelligence symbol set endpoints
  http.get(`${API_BASE_URL}/api/intelligence/symbol-sets`, () => {
    return HttpResponse.json({ items: intelligenceSymbolSets })
  }),

  http.post(`${API_BASE_URL}/api/intelligence/symbol-sets`, async ({ request }) => {
    const body = asObject(await request.json())
    const name = String(body.name || '').trim()
    const symbols = Array.isArray(body.symbols)
      ? body.symbols.map((value: unknown) => String(value).trim().toUpperCase()).filter(Boolean)
      : []
    if (!name || symbols.length === 0) {
      return HttpResponse.json({ detail: 'name and symbols are required' }, { status: 422 })
    }
    const created = {
      id: `set-${Date.now()}`,
      name,
      symbols,
      created_at: '2026-02-15T10:00:00',
      updated_at: '2026-02-15T10:00:00',
    }
    intelligenceSymbolSets = [created, ...intelligenceSymbolSets]
    return HttpResponse.json(created, { status: 201 })
  }),

  http.put(`${API_BASE_URL}/api/intelligence/symbol-sets/:id`, async ({ request, params }) => {
    const id = params.id as string
    const body = asObject(await request.json())
    const index = intelligenceSymbolSets.findIndex((item) => item.id === id)
    if (index === -1) {
      return HttpResponse.json({ detail: 'Symbol set not found' }, { status: 404 })
    }
    const updated = {
      ...intelligenceSymbolSets[index],
      ...body,
      symbols: Array.isArray(body.symbols)
        ? body.symbols.map((value: unknown) => String(value).trim().toUpperCase()).filter(Boolean)
        : intelligenceSymbolSets[index].symbols,
      updated_at: '2026-02-15T10:05:00',
    }
    intelligenceSymbolSets = intelligenceSymbolSets.map((item) => (item.id === id ? updated : item))
    return HttpResponse.json(updated)
  }),

  http.delete(`${API_BASE_URL}/api/intelligence/symbol-sets/:id`, ({ params }) => {
    const id = params.id as string
    intelligenceSymbolSets = intelligenceSymbolSets.filter((item) => item.id !== id)
    return HttpResponse.json({ status: 'deleted', id })
  }),

  // Positions endpoints
  http.get(`${API_BASE_URL}/api/portfolio/positions`, ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    
    let positions = mockPositions
    if (status) {
      positions = mockPositions.filter((p) => p.status === status)
    }
    
    return HttpResponse.json({
      positions: positions.map((position) => ({
        ...position,
        ...buildPositionMetrics(position),
      })),
      asof: '2026-02-08',
    })
  }),

  http.get(`${API_BASE_URL}/api/portfolio/positions/:id/metrics`, ({ params }) => {
    const id = params.id as string
    const position = mockPositions.find((p) => p.position_id === id)
    if (!position) {
      return HttpResponse.json({ detail: 'Position not found' }, { status: 404 })
    }
    return HttpResponse.json({
      ...mockPositionMetrics,
      ...buildPositionMetrics(position),
    })
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

  http.get(`${API_BASE_URL}/api/portfolio/summary`, () => {
    return HttpResponse.json(mockPortfolioSummary)
  }),

  http.post(`${API_BASE_URL}/api/portfolio/orders`, async ({ request }) => {
    const body = asObject(await request.json())
    return HttpResponse.json({ 
      order_id: `TEST-${Date.now()}`,
      ...body,
      status: 'pending'
    }, { status: 201 })
  }),

  http.post(`${API_BASE_URL}/api/portfolio/orders/:orderId/fill`, ({ params }) => {
    return HttpResponse.json({
      status: 'ok',
      order_id: params.orderId,
    })
  }),

  http.delete(`${API_BASE_URL}/api/portfolio/orders/:orderId`, ({ params }) => {
    return HttpResponse.json({
      status: 'ok',
      order_id: params.orderId,
    })
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
  http.get(`${API_BASE_URL}/api/social/providers`, () => {
    return HttpResponse.json({
      providers: ['reddit', 'yahoo_finance'],
      analyzers: ['keyword', 'vader'],
    })
  }),

  http.post(`${API_BASE_URL}/api/social/analyze`, async ({ request }) => {
    const body = asObject(await request.json())
    const symbol = (body?.symbol || 'AAPL').toUpperCase()
    return HttpResponse.json(buildSocialAnalysis(symbol))
  }),

  // Intelligence endpoints
  http.post(`${API_BASE_URL}/api/intelligence/run`, async ({ request }) => {
    const body = asObject(await request.json())
    const symbols = Array.isArray(body.symbols) ? body.symbols : []
    if (symbols.length === 0) {
      return HttpResponse.json({ detail: 'At least one valid symbol is required.' }, { status: 422 })
    }
    return HttpResponse.json({
      ...mockIntelligenceLaunch,
      total_symbols: symbols.length,
    })
  }),

  http.get(`${API_BASE_URL}/api/intelligence/run/:jobId`, ({ params }) => {
    return HttpResponse.json({
      ...mockIntelligenceStatus,
      job_id: params.jobId as string,
    })
  }),

  http.get(`${API_BASE_URL}/api/intelligence/opportunities`, ({ request }) => {
    const url = new URL(request.url)
    const asofDate = url.searchParams.get('asof_date')
    const symbols = url.searchParams
      .getAll('symbols')
      .map((value) => value.trim().toUpperCase())
      .filter((value) => value.length > 0)
    if (asofDate && asofDate !== mockIntelligenceOpportunities.asof_date) {
      return HttpResponse.json({ asof_date: asofDate, opportunities: [] })
    }
    if (symbols.length > 0) {
      const symbolSet = new Set(symbols)
      return HttpResponse.json({
        asof_date: mockIntelligenceOpportunities.asof_date,
        opportunities: mockIntelligenceOpportunities.opportunities.filter((opportunity) =>
          symbolSet.has(opportunity.symbol.toUpperCase())
        ),
      })
    }
    return HttpResponse.json(mockIntelligenceOpportunities)
  }),

]
