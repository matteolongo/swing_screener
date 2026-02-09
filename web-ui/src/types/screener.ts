// Screener types

export interface ScreenerCandidate {
  ticker: string;
  name?: string;
  sector?: string;
  lastBar?: string;
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
  overlayStatus?: string;
  overlayReasons?: string[];
  overlayRiskMultiplier?: number;
  overlayMaxPosMultiplier?: number;
  overlayAttentionZ?: number;
  overlaySentimentScore?: number;
  overlaySentimentConfidence?: number;
  overlayHypeScore?: number;
  overlaySampleSize?: number;
}

// API response format (snake_case)
export interface ScreenerCandidateAPI {
  ticker: string;
  name?: string;
  sector?: string;
  last_bar?: string;
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
  overlay_status?: string;
  overlay_reasons?: string[];
  overlay_risk_multiplier?: number;
  overlay_max_pos_multiplier?: number;
  overlay_attention_z?: number;
  overlay_sentiment_score?: number;
  overlay_sentiment_confidence?: number;
  overlay_hype_score?: number;
  overlay_sample_size?: number;
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
  warnings?: string[];
}

// API response format (snake_case)
export interface ScreenerResponseAPI {
  candidates: ScreenerCandidateAPI[];
  asof_date: string;
  total_screened: number;
  warnings?: string[];
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
      lastBar: c.last_bar,
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
      overlayStatus: c.overlay_status,
      overlayReasons: c.overlay_reasons,
      overlayRiskMultiplier: c.overlay_risk_multiplier,
      overlayMaxPosMultiplier: c.overlay_max_pos_multiplier,
      overlayAttentionZ: c.overlay_attention_z,
      overlaySentimentScore: c.overlay_sentiment_score,
      overlaySentimentConfidence: c.overlay_sentiment_confidence,
      overlayHypeScore: c.overlay_hype_score,
      overlaySampleSize: c.overlay_sample_size,
    })),
    asofDate: apiResponse.asof_date,
    totalScreened: apiResponse.total_screened,
    warnings: apiResponse.warnings ?? [],
  };
}
