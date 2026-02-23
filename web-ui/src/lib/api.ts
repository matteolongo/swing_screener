// API client configuration and base URL

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const API_ENDPOINTS = {
  // Strategy
  strategy: '/api/strategy',
  strategyActive: '/api/strategy/active',
  strategyValidate: '/api/strategy/validate',
  strategyById: (id: string) => `/api/strategy/${id}`,
  
  // Screener
  screenerRun: '/api/screener/run',
  screenerUniverses: '/api/screener/universes',
  screenerPreview: '/api/screener/preview-order',
  
  // Portfolio - Positions
  positions: '/api/portfolio/positions',
  positionMetrics: (id: string) => `/api/portfolio/positions/${id}/metrics`,
  positionStop: (id: string) => `/api/portfolio/positions/${id}/stop`,
  positionStopSuggestion: (id: string) => `/api/portfolio/positions/${id}/stop-suggestion`,
  positionClose: (id: string) => `/api/portfolio/positions/${id}/close`,
  portfolioSummary: '/api/portfolio/summary',
  
  // Portfolio - Orders
  orders: '/api/portfolio/orders',
  order: (id: string) => `/api/portfolio/orders/${id}`,
  orderFill: (id: string) => `/api/portfolio/orders/${id}/fill`,

  // Backtest
  backtestRun: '/api/backtest/run',
  backtestSimulations: '/api/backtest/simulations',
  backtestSimulation: (id: string) => `/api/backtest/simulations/${id}`,

  // Social
  socialAnalyze: '/api/social/analyze',
  socialWarmupStatus: (jobId: string) => `/api/social/warmup/${jobId}`,

  // Intelligence
  intelligenceRun: '/api/intelligence/run',
  intelligenceRunStatus: (jobId: string) => `/api/intelligence/run/${jobId}`,
  intelligenceOpportunities: '/api/intelligence/opportunities',

  // Daily Review
  dailyReview: '/api/daily-review',
} as const;

// Helper to build full URL
export const apiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};
