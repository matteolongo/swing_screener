// API client configuration and base URL

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const API_ENDPOINTS = {
  // Config
  config: '/api/config',
  configDefaults: '/api/config/defaults',

  // Strategy
  strategy: '/api/strategy',
  strategyActive: '/api/strategy/active',
  strategyValidate: '/api/strategy/validate',
  strategyById: (id: string) => `/api/strategy/${id}`,
  
  // Screener
  screenerRun: '/api/screener/run',
  screenerRunStatus: (jobId: string) => `/api/screener/run/${jobId}`,

  // Backtest
  backtestEventStudy: '/api/backtest/event-study',
  backtestEventStudyStatus: (jobId: string) => `/api/backtest/event-study/${jobId}`,

  // Universe management
  universes: '/api/universes',
  universeDiscover: '/api/universes/discover',
  universeAutoRefresh: '/api/universes/auto-refresh',
  universeById: (id: string) => `/api/universes/${encodeURIComponent(id)}`,
  universeRefresh: (id: string) => `/api/universes/${encodeURIComponent(id)}/refresh`,
  universeBenchmark: (id: string) => `/api/universes/${encodeURIComponent(id)}/benchmark`,
  
  // Portfolio - Positions
  positions: '/api/portfolio/positions',
  positionMetrics: (id: string) => `/api/portfolio/positions/${id}/metrics`,
  positionStop: (id: string) => `/api/portfolio/positions/${id}/stop`,
  positionStopSuggestion: (id: string) => `/api/portfolio/positions/${id}/stop-suggestion`,
  positionStopPreview: (id: string) => `/api/portfolio/positions/${id}/stop-preview`,
  positionStopSuggestionCompute: '/api/portfolio/stop-suggestion/compute',
  positionClose: (id: string) => `/api/portfolio/positions/${id}/close`,
  positionPartialClose: (id: string) => `/api/portfolio/positions/${id}/partial-close`,
  positionTrailMethod: (id: string) => `/api/portfolio/positions/${id}/trail-method`,
  portfolioSummary: '/api/portfolio/summary',
  earningsProximity: (ticker: string) => `/api/portfolio/earnings-proximity/${encodeURIComponent(ticker)}`,
  regimeBreakdown: '/api/portfolio/analytics/regime-breakdown',
  openPositionsIntelligence: '/api/portfolio/positions/open/intelligence',
  analyzePosition: (positionId: string) => `/api/intelligence/position/${encodeURIComponent(positionId)}`,
  degiroStatus: '/api/portfolio/degiro/status',
  
  // Portfolio - Orders
  orders: '/api/portfolio/orders',
  order: (id: string) => `/api/portfolio/orders/${id}`,
  orderFill: (id: string) => `/api/portfolio/orders/${id}/fill`,
  degiroOrderHistory: '/api/portfolio/degiro/order-history',
  orderFillFromDegiro: (id: string) => `/api/portfolio/orders/${id}/fill-from-degiro`,
  localOrders: '/api/portfolio/orders/local',
  degiroOrderSyncApply: '/api/portfolio/sync/degiro/apply',

  // Watchlist
  watchlist: '/api/watchlist',
  watchlistItem: (ticker: string) => `/api/watchlist/${encodeURIComponent(ticker)}`,

  // Intelligence
  intelligenceAnalyze: (ticker: string) => `/api/intelligence/${encodeURIComponent(ticker)}`,
  intelligenceLatest: (ticker: string) => `/api/intelligence/${encodeURIComponent(ticker)}/latest`,
  intelligenceHistory: (ticker: string) => `/api/intelligence/${encodeURIComponent(ticker)}/history`,
  intelligenceSweep: '/api/intelligence/sweep',

  // Catalysts
  catalystsManual: '/api/catalysts/manual',
  catalystsDailyScan: '/api/catalysts/daily-scan',
  catalystsLatest: '/api/catalysts/latest',
  catalystsSymbol: (ticker: string) => `/api/catalysts/symbol/${encodeURIComponent(ticker)}`,

  // Fundamentals
  fundamentalsSnapshot: (symbol: string) => `/api/fundamentals/snapshot/${encodeURIComponent(symbol)}`,

  // Daily Review
  dailyReview: '/api/daily-review',
  dailyReviewCompute: '/api/daily-review/compute',

  // Calendar
  calendarEvents: '/api/calendar/events',

  // Market data
  marketDataCandles: (ticker: string) => `/api/market-data/${encodeURIComponent(ticker)}/candles`,

  // Data sources
  datasources: '/api/datasources',
  datasourceProbe: (id: string) => `/api/datasources/${encodeURIComponent(id)}/probe`,
  datasourcesProbeAll: '/api/datasources/probe',
  datasourcesEvents: '/api/datasources/events',

  // Cache
  cacheStatus: '/api/cache/status',
  cacheClear: (id: string) => `/api/cache/clear/${encodeURIComponent(id)}`,
} as const;

// Helper to build full URL
export const apiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};
