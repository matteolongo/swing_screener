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
  providers: string[];
  sentimentAnalyzer: string;
  lookbackHours: number;
  lastExecutionAt: string;
  sampleSize: number;
  sentimentScore?: number;
  sentimentConfidence?: number;
  attentionScore?: number;
  attentionZ?: number;
  hypeScore?: number;
  sourceBreakdown: Record<string, number>;
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
  providers: string[];
  sentiment_analyzer: string;
  lookback_hours: number;
  last_execution_at: string;
  sample_size: number;
  sentiment_score?: number | null;
  sentiment_confidence?: number | null;
  attention_score?: number | null;
  attention_z?: number | null;
  hype_score?: number | null;
  source_breakdown: Record<string, number>;
  reasons: string[];
  raw_events: SocialRawEventAPI[];
  error?: string;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export interface SocialProvidersResponse {
  providers: string[];
  analyzers: string[];
}

export interface SocialWarmupStatus {
  jobId: string;
  status: 'queued' | 'running' | 'completed';
  totalSymbols: number;
  completedSymbols: number;
  okSymbols: number;
  noDataSymbols: number;
  errorSymbols: number;
  createdAt: string;
  updatedAt: string;
}

export interface SocialWarmupStatusAPI {
  job_id: string;
  status: 'queued' | 'running' | 'completed';
  total_symbols: number;
  completed_symbols: number;
  ok_symbols: number;
  no_data_symbols: number;
  error_symbols: number;
  created_at: string;
  updated_at: string;
}

export function transformSocialAnalysisResponse(
  api: SocialAnalysisResponseAPI
): SocialAnalysisResponse {
  return {
    status: api.status,
    symbol: api.symbol,
    providers: api.providers,
    sentimentAnalyzer: api.sentiment_analyzer,
    lookbackHours: api.lookback_hours,
    lastExecutionAt: api.last_execution_at,
    sampleSize: api.sample_size,
    sentimentScore: asOptionalNumber(api.sentiment_score),
    sentimentConfidence: asOptionalNumber(api.sentiment_confidence),
    attentionScore: asOptionalNumber(api.attention_score),
    attentionZ: asOptionalNumber(api.attention_z),
    hypeScore: asOptionalNumber(api.hype_score),
    sourceBreakdown: api.source_breakdown ?? {},
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

export function transformSocialWarmupStatus(api: SocialWarmupStatusAPI): SocialWarmupStatus {
  return {
    jobId: api.job_id,
    status: api.status,
    totalSymbols: api.total_symbols,
    completedSymbols: api.completed_symbols,
    okSymbols: api.ok_symbols,
    noDataSymbols: api.no_data_symbols,
    errorSymbols: api.error_symbols,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}
