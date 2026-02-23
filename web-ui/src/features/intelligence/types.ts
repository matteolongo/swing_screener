export interface IntelligenceRunRequest {
  symbols: string[];
  technicalReadiness?: Record<string, number>;
  providers?: string[];
  lookbackHours?: number;
  maxOpportunities?: number;
}

export interface IntelligenceRunRequestAPI {
  symbols: string[];
  technical_readiness?: Record<string, number>;
  providers?: string[];
  lookback_hours?: number;
  max_opportunities?: number;
}

export interface IntelligenceRunLaunchResponse {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  totalSymbols: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceRunLaunchResponseAPI {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  total_symbols: number;
  created_at: string;
  updated_at: string;
}

export interface IntelligenceRunStatus {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  totalSymbols: number;
  completedSymbols: number;
  asofDate?: string;
  opportunitiesCount: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceRunStatusAPI {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  total_symbols: number;
  completed_symbols: number;
  asof_date?: string | null;
  opportunities_count: number;
  error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntelligenceOpportunity {
  symbol: string;
  technicalReadiness: number;
  catalystStrength: number;
  opportunityScore: number;
  state: string;
  explanations: string[];
}

export interface IntelligenceEventLLMTrace {
  provider?: string;
  model?: string;
  cached?: boolean;
  latencyMs?: number;
  eventType?: string;
  severity?: string;
  confidence?: number;
  isMaterial?: boolean;
  summary?: string;
  error?: string;
}

export interface IntelligenceEvent {
  eventId: string;
  symbol: string;
  source: string;
  occurredAt: string;
  headline: string;
  eventType: string;
  credibility: number;
  url?: string;
  llmTrace?: IntelligenceEventLLMTrace;
  metadata: Record<string, unknown>;
}

export interface IntelligenceOpportunityAPI {
  symbol: string;
  technical_readiness: number;
  catalyst_strength: number;
  opportunity_score: number;
  state: string;
  explanations: string[];
}

export interface IntelligenceEventAPI {
  event_id: string;
  symbol: string;
  source: string;
  occurred_at: string;
  headline: string;
  event_type: string;
  credibility: number;
  url?: string | null;
  metadata?: Record<string, unknown>;
}

export interface IntelligenceOpportunitiesResponse {
  asofDate: string;
  opportunities: IntelligenceOpportunity[];
}

export interface IntelligenceEventsResponse {
  asofDate: string;
  events: IntelligenceEvent[];
}

export interface IntelligenceOpportunitiesResponseAPI {
  asof_date: string;
  opportunities: IntelligenceOpportunityAPI[];
}

export interface IntelligenceEventsResponseAPI {
  asof_date: string;
  events: IntelligenceEventAPI[];
}

export function transformIntelligenceRunLaunchResponse(
  api: IntelligenceRunLaunchResponseAPI
): IntelligenceRunLaunchResponse {
  return {
    jobId: api.job_id,
    status: api.status,
    totalSymbols: api.total_symbols,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export function transformIntelligenceRunStatus(api: IntelligenceRunStatusAPI): IntelligenceRunStatus {
  return {
    jobId: api.job_id,
    status: api.status,
    totalSymbols: api.total_symbols,
    completedSymbols: api.completed_symbols,
    asofDate: api.asof_date ?? undefined,
    opportunitiesCount: api.opportunities_count,
    error: api.error ?? undefined,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export function transformIntelligenceOpportunitiesResponse(
  api: IntelligenceOpportunitiesResponseAPI
): IntelligenceOpportunitiesResponse {
  return {
    asofDate: api.asof_date,
    opportunities: (api.opportunities ?? []).map((opportunity) => ({
      symbol: opportunity.symbol,
      technicalReadiness: opportunity.technical_readiness,
      catalystStrength: opportunity.catalyst_strength,
      opportunityScore: opportunity.opportunity_score,
      state: opportunity.state,
      explanations: opportunity.explanations ?? [],
    })),
  };
}

export function transformIntelligenceEventsResponse(
  api: IntelligenceEventsResponseAPI
): IntelligenceEventsResponse {
  return {
    asofDate: api.asof_date,
    events: (api.events ?? []).map((event): IntelligenceEvent => {
      const metadata = event.metadata ?? {};
      const llmTraceRaw =
        typeof metadata.llm_trace === 'object' && metadata.llm_trace != null
          ? (metadata.llm_trace as Record<string, unknown>)
          : null;
      return {
        eventId: event.event_id,
        symbol: event.symbol,
        source: event.source,
        occurredAt: event.occurred_at,
        headline: event.headline,
        eventType: event.event_type,
        credibility: event.credibility,
        url: event.url ?? undefined,
        llmTrace: llmTraceRaw
          ? {
              provider:
                typeof llmTraceRaw.provider === 'string' ? llmTraceRaw.provider : undefined,
              model: typeof llmTraceRaw.model === 'string' ? llmTraceRaw.model : undefined,
              cached:
                typeof llmTraceRaw.cached === 'boolean' ? llmTraceRaw.cached : undefined,
              latencyMs:
                typeof llmTraceRaw.latency_ms === 'number'
                  ? llmTraceRaw.latency_ms
                  : undefined,
              eventType:
                typeof llmTraceRaw.event_type === 'string'
                  ? llmTraceRaw.event_type
                  : undefined,
              severity:
                typeof llmTraceRaw.severity === 'string' ? llmTraceRaw.severity : undefined,
              confidence:
                typeof llmTraceRaw.confidence === 'number' ? llmTraceRaw.confidence : undefined,
              isMaterial:
                typeof llmTraceRaw.is_material === 'boolean'
                  ? llmTraceRaw.is_material
                  : undefined,
              summary:
                typeof llmTraceRaw.summary === 'string' ? llmTraceRaw.summary : undefined,
              error: typeof llmTraceRaw.error === 'string' ? llmTraceRaw.error : undefined,
            }
          : undefined,
        metadata,
      };
    }),
  };
}
