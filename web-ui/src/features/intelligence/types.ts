export interface IntelligenceRunRequest {
  symbols?: string[];
  symbolSetId?: string;
  technicalReadiness?: Record<string, number>;
  providers?: string[];
  lookbackHours?: number;
  maxOpportunities?: number;
}

export interface IntelligenceRunRequestAPI {
  symbols?: string[];
  symbol_set_id?: string;
  technical_readiness?: Record<string, number>;
  providers?: string[];
  lookback_hours?: number;
  max_opportunities?: number;
}

export type IntelligenceLlmProvider = 'ollama' | 'mock' | 'openai';

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

export interface IntelligenceLLMConfig {
  enabled: boolean;
  provider: IntelligenceLlmProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  enableCache: boolean;
  enableAudit: boolean;
  cachePath: string;
  auditPath: string;
  maxConcurrency: number;
}

export interface IntelligenceCatalystConfig {
  lookbackHours: number;
  recencyHalfLifeHours: number;
  falseCatalystReturnZ: number;
  minPriceReactionAtr: number;
  requirePriceConfirmation: boolean;
}

export interface IntelligenceThemeConfig {
  enabled: boolean;
  minClusterSize: number;
  minPeerConfirmation: number;
  curatedPeerMapPath: string;
}

export interface IntelligenceOpportunityConfig {
  technicalWeight: number;
  catalystWeight: number;
  maxDailyOpportunities: number;
  minOpportunityScore: number;
}

export interface IntelligenceConfig {
  enabled: boolean;
  providers: string[];
  universeScope: 'screener_universe' | 'strategy_universe';
  marketContextSymbols: string[];
  llm: IntelligenceLLMConfig;
  catalyst: IntelligenceCatalystConfig;
  theme: IntelligenceThemeConfig;
  opportunity: IntelligenceOpportunityConfig;
}

export interface IntelligenceLLMConfigAPI {
  enabled: boolean;
  provider: IntelligenceLlmProvider;
  model: string;
  base_url: string;
  api_key?: string;
  enable_cache: boolean;
  enable_audit: boolean;
  cache_path: string;
  audit_path: string;
  max_concurrency: number;
}

export interface IntelligenceCatalystConfigAPI {
  lookback_hours: number;
  recency_half_life_hours: number;
  false_catalyst_return_z: number;
  min_price_reaction_atr: number;
  require_price_confirmation: boolean;
}

export interface IntelligenceThemeConfigAPI {
  enabled: boolean;
  min_cluster_size: number;
  min_peer_confirmation: number;
  curated_peer_map_path: string;
}

export interface IntelligenceOpportunityConfigAPI {
  technical_weight: number;
  catalyst_weight: number;
  max_daily_opportunities: number;
  min_opportunity_score: number;
}

export interface IntelligenceConfigAPI {
  enabled: boolean;
  providers: string[];
  universe_scope: 'screener_universe' | 'strategy_universe';
  market_context_symbols: string[];
  llm: IntelligenceLLMConfigAPI;
  catalyst: IntelligenceCatalystConfigAPI;
  theme: IntelligenceThemeConfigAPI;
  opportunity: IntelligenceOpportunityConfigAPI;
}

export interface IntelligenceProviderInfo {
  provider: string;
  available: boolean;
  detail?: string;
}

export interface IntelligenceProviderInfoAPI {
  provider: string;
  available: boolean;
  detail?: string | null;
}

export interface IntelligenceProviderTestRequest {
  provider: IntelligenceLlmProvider;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface IntelligenceProviderTestRequestAPI {
  provider: IntelligenceLlmProvider;
  model: string;
  base_url?: string;
  api_key?: string;
}

export interface IntelligenceProviderTestResponse {
  provider: string;
  model: string;
  available: boolean;
  detail?: string;
}

export interface IntelligenceProviderTestResponseAPI {
  provider: string;
  model: string;
  available: boolean;
  detail?: string | null;
}

export interface IntelligenceSymbolSet {
  id: string;
  name: string;
  symbols: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IntelligenceSymbolSetAPI {
  id: string;
  name: string;
  symbols: string[];
  created_at: string;
  updated_at: string;
}

export interface IntelligenceSymbolSetsResponse {
  items: IntelligenceSymbolSet[];
}

export interface IntelligenceSymbolSetsResponseAPI {
  items: IntelligenceSymbolSetAPI[];
}

export interface IntelligenceSymbolSetUpsertRequest {
  name: string;
  symbols: string[];
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

export function transformIntelligenceConfig(api: IntelligenceConfigAPI): IntelligenceConfig {
  return {
    enabled: api.enabled,
    providers: api.providers,
    universeScope: api.universe_scope,
    marketContextSymbols: api.market_context_symbols,
    llm: {
      enabled: api.llm.enabled,
      provider: api.llm.provider,
      model: api.llm.model,
      baseUrl: api.llm.base_url,
      apiKey: api.llm.api_key ?? '',
      enableCache: api.llm.enable_cache,
      enableAudit: api.llm.enable_audit,
      cachePath: api.llm.cache_path,
      auditPath: api.llm.audit_path,
      maxConcurrency: api.llm.max_concurrency,
    },
    catalyst: {
      lookbackHours: api.catalyst.lookback_hours,
      recencyHalfLifeHours: api.catalyst.recency_half_life_hours,
      falseCatalystReturnZ: api.catalyst.false_catalyst_return_z,
      minPriceReactionAtr: api.catalyst.min_price_reaction_atr,
      requirePriceConfirmation: api.catalyst.require_price_confirmation,
    },
    theme: {
      enabled: api.theme.enabled,
      minClusterSize: api.theme.min_cluster_size,
      minPeerConfirmation: api.theme.min_peer_confirmation,
      curatedPeerMapPath: api.theme.curated_peer_map_path,
    },
    opportunity: {
      technicalWeight: api.opportunity.technical_weight,
      catalystWeight: api.opportunity.catalyst_weight,
      maxDailyOpportunities: api.opportunity.max_daily_opportunities,
      minOpportunityScore: api.opportunity.min_opportunity_score,
    },
  };
}

export function toIntelligenceConfigAPI(config: IntelligenceConfig): IntelligenceConfigAPI {
  return {
    enabled: config.enabled,
    providers: config.providers,
    universe_scope: config.universeScope,
    market_context_symbols: config.marketContextSymbols,
    llm: {
      enabled: config.llm.enabled,
      provider: config.llm.provider,
      model: config.llm.model,
      base_url: config.llm.baseUrl,
      api_key: config.llm.apiKey,
      enable_cache: config.llm.enableCache,
      enable_audit: config.llm.enableAudit,
      cache_path: config.llm.cachePath,
      audit_path: config.llm.auditPath,
      max_concurrency: config.llm.maxConcurrency,
    },
    catalyst: {
      lookback_hours: config.catalyst.lookbackHours,
      recency_half_life_hours: config.catalyst.recencyHalfLifeHours,
      false_catalyst_return_z: config.catalyst.falseCatalystReturnZ,
      min_price_reaction_atr: config.catalyst.minPriceReactionAtr,
      require_price_confirmation: config.catalyst.requirePriceConfirmation,
    },
    theme: {
      enabled: config.theme.enabled,
      min_cluster_size: config.theme.minClusterSize,
      min_peer_confirmation: config.theme.minPeerConfirmation,
      curated_peer_map_path: config.theme.curatedPeerMapPath,
    },
    opportunity: {
      technical_weight: config.opportunity.technicalWeight,
      catalyst_weight: config.opportunity.catalystWeight,
      max_daily_opportunities: config.opportunity.maxDailyOpportunities,
      min_opportunity_score: config.opportunity.minOpportunityScore,
    },
  };
}

export function transformProviderInfo(api: IntelligenceProviderInfoAPI): IntelligenceProviderInfo {
  return {
    provider: api.provider,
    available: api.available,
    detail: api.detail ?? undefined,
  };
}

export function toProviderTestRequestAPI(
  request: IntelligenceProviderTestRequest
): IntelligenceProviderTestRequestAPI {
  return {
    provider: request.provider,
    model: request.model,
    base_url: request.baseUrl,
    api_key: request.apiKey,
  };
}

export function transformProviderTestResponse(
  api: IntelligenceProviderTestResponseAPI
): IntelligenceProviderTestResponse {
  return {
    provider: api.provider,
    model: api.model,
    available: api.available,
    detail: api.detail ?? undefined,
  };
}

export function transformSymbolSet(api: IntelligenceSymbolSetAPI): IntelligenceSymbolSet {
  return {
    id: api.id,
    name: api.name,
    symbols: api.symbols,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export function transformSymbolSetsResponse(
  api: IntelligenceSymbolSetsResponseAPI
): IntelligenceSymbolSetsResponse {
  return {
    items: (api.items ?? []).map(transformSymbolSet),
  };
}
