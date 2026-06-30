// Morningstar/yfinance sector vocabulary used to tag pool symbols. Static list
// (the screener pre-filter matches these exact strings against PoolSymbol.sector).
export const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Energy',
  'Industrials',
  'Basic Materials',
  'Utilities',
  'Real Estate',
  'Communication Services',
] as const;

// Known index-membership ids (old universe ids) surfaced in the Index filter.
export const INDEX_OPTIONS: { id: string; label: string }[] = [
  { id: 'us_sp500', label: 'S&P 500' },
  { id: 'us_nasdaq100', label: 'NASDAQ 100' },
  { id: 'us_dow30', label: 'Dow 30' },
  { id: 'germany_dax', label: 'DAX' },
  { id: 'france_cac40', label: 'CAC 40' },
  { id: 'uk_ftse100', label: 'FTSE 100' },
  { id: 'spain_ibex35', label: 'IBEX 35' },
  { id: 'europe_eurostoxx50', label: 'Euro Stoxx 50' },
  { id: 'amsterdam_aex', label: 'AEX' },
  { id: 'italy_ftse_mib', label: 'FTSE MIB' },
  { id: 'broad_market_stocks', label: 'Broad Market' },
];
