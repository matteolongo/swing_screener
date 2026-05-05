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
  screenerUniverses: '/api/screener/universes',
  screenerPreview: '/api/screener/preview-order',

  // Universe management
  universes: '/api/universes',
  universeById: (id: string) => `/api/universes/${encodeURIComponent(id)}`,
  universeRefresh: (id: string) => `/api/universes/${encodeURIComponent(id)}/refresh`,
  universeBenchmark: (id: string) => `/api/universes/${encodeURIComponent(id)}/benchmark`,
  
  // Portfolio - Positions
  positions: '/api/portfolio/positions',
  positionMetrics: (id: string) => `/api/portfolio/positions/${id}/metrics`,
  positionStop: (id: string) => `/api/portfolio/positions/${id}/stop`,
  positionStopSuggestion: (id: string) => `/api/portfolio/positions/${id}/stop-suggestion`,
  positionStopSuggestionCompute: '/api/portfolio/stop-suggestion/compute',
  positionClose: (id: string) => `/api/portfolio/positions/${id}/close`,
  portfolioSummary: '/api/portfolio/summary',
  earningsProximity: (ticker: string) => `/api/portfolio/earnings-proximity/${encodeURIComponent(ticker)}`,
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

  // Fundamentals
  fundamentalsConfig: '/api/fundamentals/config',
  fundamentalsSnapshot: (symbol: string) => `/api/fundamentals/snapshot/${encodeURIComponent(symbol)}`,
  fundamentalsRefresh: '/api/fundamentals/refresh',
  fundamentalsCompare: '/api/fundamentals/compare',
  fundamentalsWarmup: '/api/fundamentals/warmup',
  fundamentalsWarmupStatus: (jobId: string) => `/api/fundamentals/warmup/${jobId}`,
  degiroPortfolioAudit: '/api/fundamentals/degiro/portfolio-audit',
  degiroCapabilityAudit: '/api/fundamentals/degiro/capability-audit',

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
