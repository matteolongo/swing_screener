// Screener types

export interface ScreenerCandidate {
  ticker: string;
  name?: string;
  sector?: string;
  close: number;
  sma20: number;
  sma50: number;
  sma200: number;
  atr: number;
  momentum6m: number;
  momentum12m: number;
  relStrength: number;
  score: number;
  confidence: number;
  rank: number;
}

// API response format (snake_case)
export interface ScreenerCandidateAPI {
  ticker: string;
  name?: string;
  sector?: string;
  close: number;
  sma_20: number;
  sma_50: number;
  sma_200: number;
  atr: number;
  momentum_6m: number;
  momentum_12m: number;
  rel_strength: number;
  score: number;
  confidence: number;
  rank: number;
}

export interface ScreenerRequest {
  universe?: string;
  tickers?: string[];
  top?: number;
  asofDate?: string;
  minPrice?: number;
  maxPrice?: number;
  breakoutLookback?: number;
  pullbackMa?: number;
  minHistory?: number;
}

export interface ScreenerResponse {
  candidates: ScreenerCandidate[];
  asofDate: string;
  totalScreened: number;
}

// API response format (snake_case)
export interface ScreenerResponseAPI {
  candidates: ScreenerCandidateAPI[];
  asof_date: string;
  total_screened: number;
}

export interface OrderPreview {
  ticker: string;
  entryPrice: number;
  stopPrice: number;
  atr: number;
  shares: number;
  positionSizeUsd: number;
  riskUsd: number;
  riskPct: number;
}

export interface UniversesResponse {
  universes: string[];
}

// Transform API response to UI format
export function transformScreenerResponse(apiResponse: ScreenerResponseAPI): ScreenerResponse {
  return {
    candidates: apiResponse.candidates.map(c => ({
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      close: c.close,
      sma20: c.sma_20,
      sma50: c.sma_50,
      sma200: c.sma_200,
      atr: c.atr,
      momentum6m: c.momentum_6m,
      momentum12m: c.momentum_12m,
      relStrength: c.rel_strength,
      score: c.score,
      confidence: c.confidence,
      rank: c.rank,
    })),
    asofDate: apiResponse.asof_date,
    totalScreened: apiResponse.total_screened,
  };
}
