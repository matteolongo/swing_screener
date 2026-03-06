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
  llmWarningsCount: number;
  llmWarningSample?: string;
  eventsKeptCount: number;
  eventsDroppedCount: number;
  duplicateSuppressedCount: number;
  analysisSummary?: string;
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
  llm_warnings_count?: number;
  llm_warning_sample?: string | null;
  events_kept_count?: number;
  events_dropped_count?: number;
  duplicate_suppressed_count?: number;
  analysis_summary?: string | null;
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
  scoreBreakdownV2?: Record<string, number>;
  topCatalysts?: Array<Record<string, string | number | boolean>>;
  evidenceQualityFlag?: 'high' | 'medium' | 'low';
}

export interface IntelligenceOpportunityAPI {
  symbol: string;
  technical_readiness: number;
  catalyst_strength: number;
  opportunity_score: number;
  state: string;
  explanations: string[];
  score_breakdown_v2?: Record<string, number>;
  top_catalysts?: Array<Record<string, string | number | boolean>>;
  evidence_quality_flag?: 'high' | 'medium' | 'low';
}

export interface IntelligenceOpportunitiesResponse {
  asofDate: string;
  opportunities: IntelligenceOpportunity[];
}

export interface IntelligenceOpportunitiesResponseAPI {
  asof_date: string;
  opportunities: IntelligenceOpportunityAPI[];
}

export interface IntelligenceEvent {
  eventId: string;
  symbol: string;
  eventType: string;
  eventSubtype: string;
  timingType: 'scheduled' | 'unscheduled';
  materiality: number;
  confidence: number;
  primarySourceReliability: number;
  confirmationCount: number;
  publishedAt: string;
  eventAt?: string;
  sourceName: string;
  rawUrl?: string;
  llmFields: Record<string, string | number | boolean>;
  dynamicSourceQuality?: number;
  resolutionSource?: string;
  dedupeMethod?: string;
}

export interface IntelligenceEventAPI {
  event_id: string;
  symbol: string;
  event_type: string;
  event_subtype: string;
  timing_type: 'scheduled' | 'unscheduled';
  materiality: number;
  confidence: number;
  primary_source_reliability: number;
  confirmation_count: number;
  published_at: string;
  event_at?: string | null;
  source_name: string;
  raw_url?: string | null;
  llm_fields?: Record<string, string | number | boolean>;
  dynamic_source_quality?: number;
  resolution_source?: string;
  dedupe_method?: string;
}

export interface IntelligenceEventsResponse {
  asofDate: string;
  events: IntelligenceEvent[];
}

export interface IntelligenceEventsResponseAPI {
  asof_date: string;
  events: IntelligenceEventAPI[];
}

export interface IntelligenceUpcomingCatalyst {
  symbol: string;
  eventType: string;
  eventSubtype: string;
  eventAt: string;
  publishedAt: string;
  materiality: number;
  confidence: number;
  sourceName: string;
  confirmationCount: number;
  rawUrl?: string;
}

export interface IntelligenceUpcomingCatalystAPI {
  symbol: string;
  event_type: string;
  event_subtype: string;
  event_at: string;
  published_at: string;
  materiality: number;
  confidence: number;
  source_name: string;
  confirmation_count: number;
  raw_url?: string | null;
}

export interface IntelligenceUpcomingCatalystsResponse {
  asofDate: string;
  daysAhead: number;
  items: IntelligenceUpcomingCatalyst[];
}

export interface IntelligenceUpcomingCatalystsResponseAPI {
  asof_date: string;
  days_ahead: number;
  items: IntelligenceUpcomingCatalystAPI[];
}

export interface IntelligenceSourceHealth {
  sourceName: string;
  enabled: boolean;
  status: string;
  latencyMs: number;
  errorCount: number;
  eventCount: number;
  errorRate: number;
  blockedCount: number;
  blockedReasons: string[];
  coverageRatio: number;
  meanConfidence: number;
  lastIngest?: string;
}

export interface IntelligenceSourceHealthAPI {
  source_name: string;
  enabled: boolean;
  status: string;
  latency_ms: number;
  error_count: number;
  event_count: number;
  error_rate: number;
  blocked_count?: number;
  blocked_reasons?: string[];
  coverage_ratio?: number;
  mean_confidence?: number;
  last_ingest?: string | null;
}

export interface IntelligenceSourcesHealthResponse {
  sources: IntelligenceSourceHealth[];
}

export interface IntelligenceSourcesHealthResponseAPI {
  sources: IntelligenceSourceHealthAPI[];
}

export interface IntelligenceMetricsResponse {
  asofDate: string;
  coverageGlobal: number;
  meanConfidenceGlobal: number;
  dedupeRatio: number;
  eventsPerSource: Record<string, number>;
}

export interface IntelligenceMetricsResponseAPI {
  asof_date: string;
  coverage_global: number;
  mean_confidence_global: number;
  dedupe_ratio: number;
  events_per_source: Record<string, number>;
}

export interface IntelligenceLLMConfig {
  enabled: boolean;
  provider: IntelligenceLlmProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  systemPrompt: string;
  userPromptTemplate: string;
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

export interface IntelligenceSourcesRateLimitsConfig {
  requestsPerMinute: number;
  maxConcurrency: number;
}

export interface IntelligenceSourcesTimeoutsConfig {
  connectSeconds: number;
  readSeconds: number;
}

export interface IntelligenceScrapePolicyConfig {
  requireRobotsAllow: boolean;
  denyIfRobotsUnreachable: boolean;
  requireTosAllowFlag: boolean;
  userAgent: string;
  maxRobotsCacheHours: number;
}

export interface IntelligenceSourcesConfig {
  enabled: string[];
  scrapingEnabled: boolean;
  allowedDomains: string[];
  rateLimits: IntelligenceSourcesRateLimitsConfig;
  timeouts: IntelligenceSourcesTimeoutsConfig;
  scrapePolicy: IntelligenceScrapePolicyConfig;
}

export interface IntelligenceScoringV2Weights {
  reactionZComponent: number;
  atrShockComponent: number;
  recencyComponent: number;
  proximityComponent: number;
  materialityComponent: number;
  sourceQualityComponent: number;
  confirmationComponent: number;
  filingImpactComponent: number;
  uncertaintyPenaltyComponent: number;
}

export interface IntelligenceScoringV2Config {
  enabled: boolean;
  weights: IntelligenceScoringV2Weights;
  lowEvidenceConfirmationThreshold: number;
  lowEvidenceSourceQualityThreshold: number;
  staleEventDecayHours: number;
}

export interface IntelligenceCalendarConfig {
  binaryEventWindowDays: number;
  binaryEventMinMateriality: number;
  binaryEventMinThresholdBoost: number;
  lowEvidenceMinThresholdBoost: number;
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
  sources: IntelligenceSourcesConfig;
  scoringV2: IntelligenceScoringV2Config;
  calendar: IntelligenceCalendarConfig;
}

export interface IntelligenceLLMConfigAPI {
  enabled: boolean;
  provider: IntelligenceLlmProvider;
  model: string;
  base_url: string;
  api_key?: string;
  system_prompt?: string;
  user_prompt_template?: string;
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

export interface IntelligenceSourcesRateLimitsConfigAPI {
  requests_per_minute: number;
  max_concurrency: number;
}

export interface IntelligenceSourcesTimeoutsConfigAPI {
  connect_seconds: number;
  read_seconds: number;
}

export interface IntelligenceScrapePolicyConfigAPI {
  require_robots_allow: boolean;
  deny_if_robots_unreachable: boolean;
  require_tos_allow_flag: boolean;
  user_agent: string;
  max_robots_cache_hours: number;
}

export interface IntelligenceSourcesConfigAPI {
  enabled: string[];
  scraping_enabled: boolean;
  allowed_domains: string[];
  rate_limits: IntelligenceSourcesRateLimitsConfigAPI;
  timeouts: IntelligenceSourcesTimeoutsConfigAPI;
  scrape_policy?: IntelligenceScrapePolicyConfigAPI;
}

export interface IntelligenceScoringV2WeightsAPI {
  reaction_z_component: number;
  atr_shock_component: number;
  recency_component: number;
  proximity_component: number;
  materiality_component: number;
  source_quality_component: number;
  confirmation_component: number;
  filing_impact_component: number;
  uncertainty_penalty_component: number;
}

export interface IntelligenceScoringV2ConfigAPI {
  enabled: boolean;
  weights: IntelligenceScoringV2WeightsAPI;
  low_evidence_confirmation_threshold: number;
  low_evidence_source_quality_threshold: number;
  stale_event_decay_hours: number;
}

export interface IntelligenceCalendarConfigAPI {
  binary_event_window_days: number;
  binary_event_min_materiality: number;
  binary_event_min_threshold_boost: number;
  low_evidence_min_threshold_boost: number;
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
  sources: IntelligenceSourcesConfigAPI;
  scoring_v2: IntelligenceScoringV2ConfigAPI;
  calendar: IntelligenceCalendarConfigAPI;
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

export interface IntelligenceExplainCandidateContext {
  signal?: string;
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
  confidence?: number;
  close?: number;
  atr?: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  momentum6m?: number;
  momentum12m?: number;
  relStrength?: number;
}

export interface IntelligenceExplainCandidateContextAPI {
  signal?: string;
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
  confidence?: number;
  close?: number;
  atr?: number;
  sma_20?: number;
  sma_50?: number;
  sma_200?: number;
  momentum_6m?: number;
  momentum_12m?: number;
  rel_strength?: number;
}

export interface IntelligenceExplainSymbolRequest {
  symbol: string;
  asofDate?: string;
  candidateContext?: IntelligenceExplainCandidateContext;
}

export interface IntelligenceExplainSymbolRequestAPI {
  symbol: string;
  asof_date?: string;
  candidate_context?: IntelligenceExplainCandidateContextAPI;
}

export interface IntelligenceExplainSymbolResponse {
  symbol: string;
  asofDate: string;
  explanation: string;
  source: 'llm' | 'deterministic_fallback';
  model?: string;
  warning?: string;
  generatedAt: string;
}

export type IntelligenceEducationView = 'recommendation' | 'thesis' | 'learn';
export type IntelligenceEducationSource = 'llm' | 'deterministic_fallback';
export type IntelligenceEducationRequestSource = 'llm' | 'deterministic_fallback' | 'cache';

export interface IntelligenceEducationError {
  view: IntelligenceEducationView;
  code: string;
  message: string;
  retryable: boolean;
  providerErrorId?: string;
}

export interface IntelligenceEducationViewOutput {
  title: string;
  summary: string;
  bullets: string[];
  watchouts: string[];
  nextSteps: string[];
  glossaryLinks: string[];
  factsUsed: string[];
  source: IntelligenceEducationSource;
  templateVersion: string;
  generatedAt: string;
  debugRef?: string;
}

export interface IntelligenceEducationGenerateRequest {
  symbol: string;
  asofDate?: string;
  views?: IntelligenceEducationView[];
  forceRefresh?: boolean;
  candidateContext?: IntelligenceExplainCandidateContext;
}

export interface IntelligenceEducationGenerateResponse {
  symbol: string;
  asofDate: string;
  generatedAt: string;
  outputs: Partial<Record<IntelligenceEducationView, IntelligenceEducationViewOutput>>;
  status: 'ok' | 'partial' | 'error';
  source: IntelligenceEducationRequestSource;
  templateVersion: string;
  deterministicFacts: Record<string, string>;
  errors: IntelligenceEducationError[];
}

export interface IntelligenceExplainSymbolResponseAPI {
  symbol: string;
  asof_date: string;
  explanation: string;
  source: 'llm' | 'deterministic_fallback';
  model?: string | null;
  warning?: string | null;
  generated_at: string;
}

export interface IntelligenceEducationErrorAPI {
  view: IntelligenceEducationView;
  code: string;
  message: string;
  retryable: boolean;
  provider_error_id?: string | null;
}

export interface IntelligenceEducationViewOutputAPI {
  title: string;
  summary: string;
  bullets: string[];
  watchouts: string[];
  next_steps: string[];
  glossary_links: string[];
  facts_used: string[];
  source: IntelligenceEducationSource;
  template_version: string;
  generated_at: string;
  debug_ref?: string | null;
}

export interface IntelligenceEducationGenerateRequestAPI {
  symbol: string;
  asof_date?: string;
  views?: IntelligenceEducationView[];
  force_refresh?: boolean;
  candidate_context?: IntelligenceExplainCandidateContextAPI;
}

export interface IntelligenceEducationGenerateResponseAPI {
  symbol: string;
  asof_date: string;
  generated_at: string;
  outputs: Partial<Record<IntelligenceEducationView, IntelligenceEducationViewOutputAPI>>;
  status: 'ok' | 'partial' | 'error';
  source: IntelligenceEducationRequestSource;
  template_version: string;
  deterministic_facts: Record<string, string>;
  errors?: IntelligenceEducationErrorAPI[] | null;
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
    llmWarningsCount: api.llm_warnings_count ?? 0,
    llmWarningSample: api.llm_warning_sample ?? undefined,
    eventsKeptCount: api.events_kept_count ?? 0,
    eventsDroppedCount: api.events_dropped_count ?? 0,
    duplicateSuppressedCount: api.duplicate_suppressed_count ?? 0,
    analysisSummary: api.analysis_summary ?? undefined,
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
      scoreBreakdownV2: opportunity.score_breakdown_v2 ?? {},
      topCatalysts: opportunity.top_catalysts ?? [],
      evidenceQualityFlag: opportunity.evidence_quality_flag ?? 'medium',
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
      systemPrompt: api.llm.system_prompt ?? '',
      userPromptTemplate: api.llm.user_prompt_template ?? '',
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
    sources: {
      enabled:
        api.sources?.enabled ??
        ['yahoo_finance', 'earnings_calendar', 'sec_edgar', 'company_ir_rss'],
      scrapingEnabled: api.sources?.scraping_enabled ?? false,
      allowedDomains: api.sources?.allowed_domains ?? [],
      rateLimits: {
        requestsPerMinute: api.sources?.rate_limits?.requests_per_minute ?? 90,
        maxConcurrency: api.sources?.rate_limits?.max_concurrency ?? 4,
      },
      timeouts: {
        connectSeconds: api.sources?.timeouts?.connect_seconds ?? 5,
        readSeconds: api.sources?.timeouts?.read_seconds ?? 20,
      },
      scrapePolicy: {
        requireRobotsAllow: api.sources?.scrape_policy?.require_robots_allow ?? true,
        denyIfRobotsUnreachable: api.sources?.scrape_policy?.deny_if_robots_unreachable ?? true,
        requireTosAllowFlag: api.sources?.scrape_policy?.require_tos_allow_flag ?? true,
        userAgent:
          api.sources?.scrape_policy?.user_agent ?? 'swing-screener-intelligence-bot/1.0',
        maxRobotsCacheHours: api.sources?.scrape_policy?.max_robots_cache_hours ?? 24,
      },
    },
    scoringV2: {
      enabled: api.scoring_v2?.enabled ?? true,
      weights: {
        reactionZComponent: api.scoring_v2?.weights?.reaction_z_component ?? 0.22,
        atrShockComponent: api.scoring_v2?.weights?.atr_shock_component ?? 0.12,
        recencyComponent: api.scoring_v2?.weights?.recency_component ?? 0.14,
        proximityComponent: api.scoring_v2?.weights?.proximity_component ?? 0.14,
        materialityComponent: api.scoring_v2?.weights?.materiality_component ?? 0.14,
        sourceQualityComponent: api.scoring_v2?.weights?.source_quality_component ?? 0.1,
        confirmationComponent: api.scoring_v2?.weights?.confirmation_component ?? 0.08,
        filingImpactComponent: api.scoring_v2?.weights?.filing_impact_component ?? 0.06,
        uncertaintyPenaltyComponent: api.scoring_v2?.weights?.uncertainty_penalty_component ?? 0.1,
      },
      lowEvidenceConfirmationThreshold:
        api.scoring_v2?.low_evidence_confirmation_threshold ?? 0.25,
      lowEvidenceSourceQualityThreshold:
        api.scoring_v2?.low_evidence_source_quality_threshold ?? 0.45,
      staleEventDecayHours: api.scoring_v2?.stale_event_decay_hours ?? 120,
    },
    calendar: {
      binaryEventWindowDays: api.calendar?.binary_event_window_days ?? 3,
      binaryEventMinMateriality: api.calendar?.binary_event_min_materiality ?? 0.75,
      binaryEventMinThresholdBoost: api.calendar?.binary_event_min_threshold_boost ?? 0.08,
      lowEvidenceMinThresholdBoost: api.calendar?.low_evidence_min_threshold_boost ?? 0.06,
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
      system_prompt: config.llm.systemPrompt,
      user_prompt_template: config.llm.userPromptTemplate,
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
    sources: {
      enabled: config.sources.enabled,
      scraping_enabled: config.sources.scrapingEnabled,
      allowed_domains: config.sources.allowedDomains,
      rate_limits: {
        requests_per_minute: config.sources.rateLimits.requestsPerMinute,
        max_concurrency: config.sources.rateLimits.maxConcurrency,
      },
      timeouts: {
        connect_seconds: config.sources.timeouts.connectSeconds,
        read_seconds: config.sources.timeouts.readSeconds,
      },
      scrape_policy: {
        require_robots_allow: config.sources.scrapePolicy.requireRobotsAllow,
        deny_if_robots_unreachable: config.sources.scrapePolicy.denyIfRobotsUnreachable,
        require_tos_allow_flag: config.sources.scrapePolicy.requireTosAllowFlag,
        user_agent: config.sources.scrapePolicy.userAgent,
        max_robots_cache_hours: config.sources.scrapePolicy.maxRobotsCacheHours,
      },
    },
    scoring_v2: {
      enabled: config.scoringV2.enabled,
      weights: {
        reaction_z_component: config.scoringV2.weights.reactionZComponent,
        atr_shock_component: config.scoringV2.weights.atrShockComponent,
        recency_component: config.scoringV2.weights.recencyComponent,
        proximity_component: config.scoringV2.weights.proximityComponent,
        materiality_component: config.scoringV2.weights.materialityComponent,
        source_quality_component: config.scoringV2.weights.sourceQualityComponent,
        confirmation_component: config.scoringV2.weights.confirmationComponent,
        filing_impact_component: config.scoringV2.weights.filingImpactComponent,
        uncertainty_penalty_component: config.scoringV2.weights.uncertaintyPenaltyComponent,
      },
      low_evidence_confirmation_threshold: config.scoringV2.lowEvidenceConfirmationThreshold,
      low_evidence_source_quality_threshold: config.scoringV2.lowEvidenceSourceQualityThreshold,
      stale_event_decay_hours: config.scoringV2.staleEventDecayHours,
    },
    calendar: {
      binary_event_window_days: config.calendar.binaryEventWindowDays,
      binary_event_min_materiality: config.calendar.binaryEventMinMateriality,
      binary_event_min_threshold_boost: config.calendar.binaryEventMinThresholdBoost,
      low_evidence_min_threshold_boost: config.calendar.lowEvidenceMinThresholdBoost,
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

export function toExplainCandidateContextAPI(
  context?: IntelligenceExplainCandidateContext
): IntelligenceExplainCandidateContextAPI | undefined {
  if (!context) {
    return undefined;
  }
  return {
    signal: context.signal,
    entry: context.entry,
    stop: context.stop,
    target: context.target,
    rr: context.rr,
    confidence: context.confidence,
    close: context.close,
    atr: context.atr,
    sma_20: context.sma20,
    sma_50: context.sma50,
    sma_200: context.sma200,
    momentum_6m: context.momentum6m,
    momentum_12m: context.momentum12m,
    rel_strength: context.relStrength,
  };
}

export function toExplainSymbolRequestAPI(
  request: IntelligenceExplainSymbolRequest
): IntelligenceExplainSymbolRequestAPI {
  return {
    symbol: request.symbol.trim().toUpperCase(),
    asof_date: request.asofDate,
    candidate_context: toExplainCandidateContextAPI(request.candidateContext),
  };
}

export function transformExplainSymbolResponse(
  api: IntelligenceExplainSymbolResponseAPI
): IntelligenceExplainSymbolResponse {
  return {
    symbol: api.symbol,
    asofDate: api.asof_date,
    explanation: api.explanation,
    source: api.source,
    model: api.model ?? undefined,
    warning: api.warning ?? undefined,
    generatedAt: api.generated_at,
  };
}

export function toEducationGenerateRequestAPI(
  request: IntelligenceEducationGenerateRequest
): IntelligenceEducationGenerateRequestAPI {
  return {
    symbol: request.symbol.trim().toUpperCase(),
    asof_date: request.asofDate,
    views: request.views,
    force_refresh: request.forceRefresh,
    candidate_context: toExplainCandidateContextAPI(request.candidateContext),
  };
}

function transformEducationViewOutput(
  api?: IntelligenceEducationViewOutputAPI
): IntelligenceEducationViewOutput | undefined {
  if (!api) {
    return undefined;
  }
  return {
    title: api.title,
    summary: api.summary,
    bullets: api.bullets ?? [],
    watchouts: api.watchouts ?? [],
    nextSteps: api.next_steps ?? [],
    glossaryLinks: api.glossary_links ?? [],
    factsUsed: api.facts_used ?? [],
    source: api.source,
    templateVersion: api.template_version,
    generatedAt: api.generated_at,
    debugRef: api.debug_ref ?? undefined,
  };
}

export function transformEducationGenerateResponse(
  api: IntelligenceEducationGenerateResponseAPI
): IntelligenceEducationGenerateResponse {
  return {
    symbol: api.symbol,
    asofDate: api.asof_date,
    generatedAt: api.generated_at,
    outputs: {
      recommendation: transformEducationViewOutput(api.outputs?.recommendation),
      thesis: transformEducationViewOutput(api.outputs?.thesis),
      learn: transformEducationViewOutput(api.outputs?.learn),
    },
    status: api.status,
    source: api.source,
    templateVersion: api.template_version,
    deterministicFacts: api.deterministic_facts ?? {},
    errors: (api.errors ?? []).map((error) => ({
      view: error.view,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      providerErrorId: error.provider_error_id ?? undefined,
    })),
  };
}

export function transformIntelligenceEventsResponse(
  api: IntelligenceEventsResponseAPI
): IntelligenceEventsResponse {
  return {
    asofDate: api.asof_date,
    events: (api.events ?? []).map((event) => ({
      eventId: event.event_id,
      symbol: event.symbol,
      eventType: event.event_type,
      eventSubtype: event.event_subtype,
      timingType: event.timing_type,
      materiality: event.materiality,
      confidence: event.confidence,
      primarySourceReliability: event.primary_source_reliability,
      confirmationCount: event.confirmation_count,
      publishedAt: event.published_at,
      eventAt: event.event_at ?? undefined,
      sourceName: event.source_name,
      rawUrl: event.raw_url ?? undefined,
      llmFields: event.llm_fields ?? {},
      dynamicSourceQuality: event.dynamic_source_quality ?? undefined,
      resolutionSource: event.resolution_source ?? undefined,
      dedupeMethod: event.dedupe_method ?? undefined,
    })),
  };
}

export function transformIntelligenceUpcomingCatalystsResponse(
  api: IntelligenceUpcomingCatalystsResponseAPI
): IntelligenceUpcomingCatalystsResponse {
  return {
    asofDate: api.asof_date,
    daysAhead: api.days_ahead,
    items: (api.items ?? []).map((item) => ({
      symbol: item.symbol,
      eventType: item.event_type,
      eventSubtype: item.event_subtype,
      eventAt: item.event_at,
      publishedAt: item.published_at,
      materiality: item.materiality,
      confidence: item.confidence,
      sourceName: item.source_name,
      confirmationCount: item.confirmation_count,
      rawUrl: item.raw_url ?? undefined,
    })),
  };
}

export function transformIntelligenceSourcesHealthResponse(
  api: IntelligenceSourcesHealthResponseAPI
): IntelligenceSourcesHealthResponse {
  return {
    sources: (api.sources ?? []).map((source) => ({
      sourceName: source.source_name,
      enabled: source.enabled,
      status: source.status,
      latencyMs: source.latency_ms,
      errorCount: source.error_count,
      eventCount: source.event_count,
      errorRate: source.error_rate,
      blockedCount: source.blocked_count ?? 0,
      blockedReasons: source.blocked_reasons ?? [],
      coverageRatio: source.coverage_ratio ?? 0,
      meanConfidence: source.mean_confidence ?? 0,
      lastIngest: source.last_ingest ?? undefined,
    })),
  };
}

export function transformIntelligenceMetricsResponse(
  api: IntelligenceMetricsResponseAPI
): IntelligenceMetricsResponse {
  return {
    asofDate: api.asof_date,
    coverageGlobal: api.coverage_global,
    meanConfidenceGlobal: api.mean_confidence_global,
    dedupeRatio: api.dedupe_ratio,
    eventsPerSource: api.events_per_source ?? {},
  };
}
