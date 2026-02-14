export interface SocialRawEvent {
  source: string;
  symbol: string;
  timestamp: string;
  text: string;
  authorIdHash?: string;
  upvotes?: number;
  url?: string;
  metadata: Record<string, unknown>;
}

export interface SocialAnalysisResponse {
  status: 'ok' | 'no_data' | 'error';
  symbol: string;
  provider: string;
  lookbackHours: number;
  lastExecutionAt: string;
  sampleSize: number;
  sentimentScore?: number;
  sentimentConfidence?: number;
  attentionScore: number;
  attentionZ?: number;
  hypeScore?: number;
  reasons: string[];
  rawEvents: SocialRawEvent[];
  error?: string;
}

export interface SocialRawEventAPI {
  source: string;
  symbol: string;
  timestamp: string;
  text: string;
  author_id_hash?: string;
  upvotes?: number;
  url?: string;
  metadata: Record<string, unknown>;
}

export interface SocialAnalysisResponseAPI {
  status: 'ok' | 'no_data' | 'error';
  symbol: string;
  provider: string;
  lookback_hours: number;
  last_execution_at: string;
  sample_size: number;
  sentiment_score?: number;
  sentiment_confidence?: number;
  attention_score: number;
  attention_z?: number;
  hype_score?: number;
  reasons: string[];
  raw_events: SocialRawEventAPI[];
  error?: string;
}

export function transformSocialAnalysisResponse(
  api: SocialAnalysisResponseAPI
): SocialAnalysisResponse {
  return {
    status: api.status,
    symbol: api.symbol,
    provider: api.provider,
    lookbackHours: api.lookback_hours,
    lastExecutionAt: api.last_execution_at,
    sampleSize: api.sample_size,
    sentimentScore: api.sentiment_score,
    sentimentConfidence: api.sentiment_confidence,
    attentionScore: api.attention_score,
    attentionZ: api.attention_z,
    hypeScore: api.hype_score,
    reasons: api.reasons ?? [],
    rawEvents: (api.raw_events ?? []).map((ev) => ({
      source: ev.source,
      symbol: ev.symbol,
      timestamp: ev.timestamp,
      text: ev.text,
      authorIdHash: ev.author_id_hash,
      upvotes: ev.upvotes,
      url: ev.url,
      metadata: ev.metadata ?? {},
    })),
    error: api.error,
  };
}
