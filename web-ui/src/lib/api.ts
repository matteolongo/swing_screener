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
  screenerRunStatus: (jobId: string) => `/api/screener/run/${jobId}`,
  screenerUniverses: '/api/screener/universes',
  screenerPreview: '/api/screener/preview-order',
  
  // Portfolio - Positions
  positions: '/api/portfolio/positions',
  positionMetrics: (id: string) => `/api/portfolio/positions/${id}/metrics`,
  positionStop: (id: string) => `/api/portfolio/positions/${id}/stop`,
  positionStopSuggestion: (id: string) => `/api/portfolio/positions/${id}/stop-suggestion`,
  positionStopSuggestionCompute: '/api/portfolio/stop-suggestion/compute',
  positionClose: (id: string) => `/api/portfolio/positions/${id}/close`,
  portfolioSummary: '/api/portfolio/summary',
  
  // Portfolio - Orders
  orders: '/api/portfolio/orders',
  order: (id: string) => `/api/portfolio/orders/${id}`,
  orderFill: (id: string) => `/api/portfolio/orders/${id}/fill`,

  // Watchlist
  watchlist: '/api/watchlist',
  watchlistItem: (ticker: string) => `/api/watchlist/${encodeURIComponent(ticker)}`,

  // Social
  socialAnalyze: '/api/social/analyze',
  socialWarmupStatus: (jobId: string) => `/api/social/warmup/${jobId}`,

  // Intelligence
  intelligenceConfig: '/api/intelligence/config',
  intelligenceProviders: '/api/intelligence/providers',
  intelligenceProviderTest: '/api/intelligence/providers/test',
  intelligenceSymbolSets: '/api/intelligence/symbol-sets',
  intelligenceSymbolSetById: (id: string) => `/api/intelligence/symbol-sets/${id}`,
  intelligenceRun: '/api/intelligence/run',
  intelligenceRunStatus: (jobId: string) => `/api/intelligence/run/${jobId}`,
  intelligenceOpportunities: '/api/intelligence/opportunities',
  intelligenceEvents: '/api/intelligence/events',
  intelligenceUpcomingCatalysts: '/api/intelligence/upcoming-catalysts',
  intelligenceSourcesHealth: '/api/intelligence/sources/health',
  intelligenceMetrics: '/api/intelligence/metrics',
  intelligenceEducationGenerate: '/api/intelligence/education/generate',
  intelligenceEducationBySymbol: (symbol: string) => `/api/intelligence/education/${encodeURIComponent(symbol)}`,

  // Chat
  chatAnswer: '/api/chat/answer',

  // Daily Review
  dailyReview: '/api/daily-review',
  dailyReviewCompute: '/api/daily-review/compute',
} as const;

// Helper to build full URL
export const apiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};
