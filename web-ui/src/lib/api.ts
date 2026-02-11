// API client configuration and base URL

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const API_ENDPOINTS = {
  // Config
  config: '/api/config',
  configReset: '/api/config/reset',
  configDefaults: '/api/config/defaults',

  // Strategy
  strategy: '/api/strategy',
  strategyActive: '/api/strategy/active',
  strategyById: (id: string) => `/api/strategy/${id}`,
  
  // Screener
  screenerRun: '/api/screener/run',
  screenerUniverses: '/api/screener/universes',
  screenerPreview: '/api/screener/preview-order',
  
  // Portfolio - Positions
  positions: '/api/portfolio/positions',
  position: (id: string) => `/api/portfolio/positions/${id}`,
  positionStop: (id: string) => `/api/portfolio/positions/${id}/stop`,
  positionStopSuggestion: (id: string) => `/api/portfolio/positions/${id}/stop-suggestion`,
  positionClose: (id: string) => `/api/portfolio/positions/${id}/close`,
  
  // Portfolio - Orders
  orders: '/api/portfolio/orders',
  ordersSnapshot: '/api/portfolio/orders/snapshot',
  order: (id: string) => `/api/portfolio/orders/${id}`,
  orderFill: (id: string) => `/api/portfolio/orders/${id}/fill`,

  // Backtest
  backtestRun: '/api/backtest/run',
  backtestSimulations: '/api/backtest/simulations',
  backtestSimulation: (id: string) => `/api/backtest/simulations/${id}`,

  // Social
  socialAnalyze: '/api/social/analyze',
} as const;

// Helper to build full URL
export const apiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};
