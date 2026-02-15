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

export interface IntelligenceOpportunityAPI {
  symbol: string;
  technical_readiness: number;
  catalyst_strength: number;
  opportunity_score: number;
  state: string;
  explanations: string[];
}

export interface IntelligenceOpportunitiesResponse {
  asofDate: string;
  opportunities: IntelligenceOpportunity[];
}

export interface IntelligenceOpportunitiesResponseAPI {
  asof_date: string;
  opportunities: IntelligenceOpportunityAPI[];
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

