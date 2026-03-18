export type StrategyCurrency = 'USD' | 'EUR';

export interface StrategyTrend {
  smaFast: number;
  smaMid: number;
  smaLong: number;
}

export interface StrategyVol {
  atrWindow: number;
}

export interface StrategyMom {
  lookback6m: number;
  lookback12m: number;
  benchmark: string;
}

export interface StrategyFilt {
  minPrice: number;
  maxPrice: number;
  maxAtrPct: number;
  requireTrendOk: boolean;
  requireRsPositive: boolean;
  currencies: StrategyCurrency[];
}

export interface StrategyUniverse {
  trend: StrategyTrend;
  vol: StrategyVol;
  mom: StrategyMom;
  filt: StrategyFilt;
}

export interface StrategyRanking {
  wMom6m: number;
  wMom12m: number;
  wRs6m: number;
  topN: number;
}

export interface StrategySignals {
  breakoutLookback: number;
  pullbackMa: number;
  minHistory: number;
}

export interface StrategyRisk {
  accountSize: number;
  riskPct: number;
  maxPositionPct: number;
  minShares: number;
  kAtr: number;
  minRr: number;
  rrTarget: number;
  commissionPct: number;
  maxFeeRiskPct: number;
  regimeEnabled: boolean;
  regimeTrendSma: number;
  regimeTrendMultiplier: number;
  regimeVolAtrWindow: number;
  regimeVolAtrPctThreshold: number;
  regimeVolMultiplier: number;
}

export interface StrategyManage {
  breakevenAtR: number;
  trailAfterR: number;
  trailSma: number;
  smaBufferPct: number;
  maxHoldingDays: number;
  benchmark: string;
}

export interface StrategySocialOverlay {
  enabled: boolean;
  lookbackHours: number;
  attentionZThreshold: number;
  minSampleSize: number;
  negativeSentThreshold: number;
  sentimentConfThreshold: number;
  hypePercentileThreshold: number;
  providers: string[];
  sentimentAnalyzer: string;
}

export interface StrategyIntelligenceLLM {
  enabled: boolean;
  provider: 'mock' | 'openai';
  model: string;
  baseUrl: string;
  enableCache: boolean;
  enableAudit: boolean;
  cachePath: string;
  auditPath: string;
  maxConcurrency: number;
}

export interface StrategyIntelligenceCatalyst {
  lookbackHours: number;
  recencyHalfLifeHours: number;
  falseCatalystReturnZ: number;
  minPriceReactionAtr: number;
  requirePriceConfirmation: boolean;
}

export interface StrategyIntelligenceTheme {
  enabled: boolean;
  minClusterSize: number;
  minPeerConfirmation: number;
  curatedPeerMapPath: string;
}

export interface StrategyIntelligenceOpportunity {
  technicalWeight: number;
  catalystWeight: number;
  maxDailyOpportunities: number;
  minOpportunityScore: number;
}

export interface StrategyMarketIntelligence {
  enabled: boolean;
  providers: string[];
  universeScope: 'screener_universe' | 'strategy_universe';
  marketContextSymbols: string[];
  llm: StrategyIntelligenceLLM;
  catalyst: StrategyIntelligenceCatalyst;
  theme: StrategyIntelligenceTheme;
  opportunity: StrategyIntelligenceOpportunity;
}

export interface Strategy {
  id: string;
  name: string;
  description?: string;
  module: string;
  universe: StrategyUniverse;
  ranking: StrategyRanking;
  signals: StrategySignals;
  risk: StrategyRisk;
  manage: StrategyManage;
  socialOverlay: StrategySocialOverlay;
  marketIntelligence: StrategyMarketIntelligence;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyTrendAPI {
  sma_fast: number;
  sma_mid: number;
  sma_long: number;
}

export interface StrategyVolAPI {
  atr_window: number;
}

export interface StrategyMomAPI {
  lookback_6m: number;
  lookback_12m: number;
  benchmark: string;
}

export interface StrategyFiltAPI {
  min_price: number;
  max_price: number;
  max_atr_pct: number;
  require_trend_ok: boolean;
  require_rs_positive: boolean;
  currencies?: string[];
}

export interface StrategyUniverseAPI {
  trend: StrategyTrendAPI;
  vol: StrategyVolAPI;
  mom: StrategyMomAPI;
  filt: StrategyFiltAPI;
}

export interface StrategyRankingAPI {
  w_mom_6m: number;
  w_mom_12m: number;
  w_rs_6m: number;
  top_n: number;
}

export interface StrategySignalsAPI {
  breakout_lookback: number;
  pullback_ma: number;
  min_history: number;
}

export interface StrategyRiskAPI {
  account_size: number;
  risk_pct: number;
  max_position_pct: number;
  min_shares: number;
  k_atr: number;
  min_rr?: number;
  rr_target?: number;
  commission_pct?: number;
  max_fee_risk_pct?: number;
  regime_enabled?: boolean;
  regime_trend_sma?: number;
  regime_trend_multiplier?: number;
  regime_vol_atr_window?: number;
  regime_vol_atr_pct_threshold?: number;
  regime_vol_multiplier?: number;
}

export interface StrategyManageAPI {
  breakeven_at_r: number;
  trail_after_r: number;
  trail_sma: number;
  sma_buffer_pct: number;
  max_holding_days: number;
  benchmark: string;
}

export interface StrategySocialOverlayAPI {
  enabled?: boolean;
  lookback_hours?: number;
  attention_z_threshold?: number;
  min_sample_size?: number;
  negative_sent_threshold?: number;
  sentiment_conf_threshold?: number;
  hype_percentile_threshold?: number;
  providers?: string[];
  sentiment_analyzer?: string;
}

export interface StrategyIntelligenceLLMAPI {
  enabled?: boolean;
  provider?: 'mock' | 'openai';
  model?: string;
  base_url?: string;
  enable_cache?: boolean;
  enable_audit?: boolean;
  cache_path?: string;
  audit_path?: string;
  max_concurrency?: number;
}

export interface StrategyIntelligenceCatalystAPI {
  lookback_hours?: number;
  recency_half_life_hours?: number;
  false_catalyst_return_z?: number;
  min_price_reaction_atr?: number;
  require_price_confirmation?: boolean;
}

export interface StrategyIntelligenceThemeAPI {
  enabled?: boolean;
  min_cluster_size?: number;
  min_peer_confirmation?: number;
  curated_peer_map_path?: string;
}

export interface StrategyIntelligenceOpportunityAPI {
  technical_weight?: number;
  catalyst_weight?: number;
  max_daily_opportunities?: number;
  min_opportunity_score?: number;
}

export interface StrategyMarketIntelligenceAPI {
  enabled?: boolean;
  providers?: string[];
  universe_scope?: 'screener_universe' | 'strategy_universe';
  market_context_symbols?: string[];
  llm?: StrategyIntelligenceLLMAPI;
  catalyst?: StrategyIntelligenceCatalystAPI;
  theme?: StrategyIntelligenceThemeAPI;
  opportunity?: StrategyIntelligenceOpportunityAPI;
}

export interface StrategyAPI {
  id: string;
  name: string;
  description?: string | null;
  module?: string;
  universe: StrategyUniverseAPI;
  ranking: StrategyRankingAPI;
  signals: StrategySignalsAPI;
  risk: StrategyRiskAPI;
  manage: StrategyManageAPI;
  social_overlay?: StrategySocialOverlayAPI;
  market_intelligence?: StrategyMarketIntelligenceAPI;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface StrategyUpdateRequestAPI {
  name: string;
  description?: string | null;
  module?: string;
  universe: StrategyUniverseAPI;
  ranking: StrategyRankingAPI;
  signals: StrategySignalsAPI;
  risk: StrategyRiskAPI;
  manage: StrategyManageAPI;
  social_overlay: StrategySocialOverlayAPI;
  market_intelligence: StrategyMarketIntelligenceAPI;
}

export interface StrategyCreateRequestAPI extends StrategyUpdateRequestAPI {
  id: string;
}

export interface ActiveStrategyRequestAPI {
  strategy_id: string;
}

export function transformStrategy(api: StrategyAPI): Strategy {
  const socialOverlayApi = api.social_overlay ?? {};
  const marketIntelligenceApi = api.market_intelligence ?? {};
  const marketIntelligenceLlmApi = marketIntelligenceApi.llm ?? {};
  const marketIntelligenceCatalystApi = marketIntelligenceApi.catalyst ?? {};
  const marketIntelligenceThemeApi = marketIntelligenceApi.theme ?? {};
  const marketIntelligenceOpportunityApi = marketIntelligenceApi.opportunity ?? {};
  const currenciesRaw = api.universe.filt.currencies ?? ['USD', 'EUR'];
  const currencies = currenciesRaw
    .map((value) => value.toUpperCase())
    .filter((value): value is StrategyCurrency => value === 'USD' || value === 'EUR');
  const uniqueCurrencies: StrategyCurrency[] = Array.from(new Set(currencies));
  const normalizedCurrencies: StrategyCurrency[] = uniqueCurrencies.length
    ? uniqueCurrencies
    : ['USD', 'EUR'];

  return {
    id: api.id,
    name: api.name,
    description: api.description ?? undefined,
    module: api.module ?? 'momentum',
    universe: {
      trend: {
        smaFast: api.universe.trend.sma_fast,
        smaMid: api.universe.trend.sma_mid,
        smaLong: api.universe.trend.sma_long,
      },
      vol: {
        atrWindow: api.universe.vol.atr_window,
      },
      mom: {
        lookback6m: api.universe.mom.lookback_6m,
        lookback12m: api.universe.mom.lookback_12m,
        benchmark: api.universe.mom.benchmark,
      },
      filt: {
        minPrice: api.universe.filt.min_price,
        maxPrice: api.universe.filt.max_price,
        maxAtrPct: api.universe.filt.max_atr_pct,
        requireTrendOk: api.universe.filt.require_trend_ok,
        requireRsPositive: api.universe.filt.require_rs_positive,
        currencies: normalizedCurrencies,
      },
    },
    ranking: {
      wMom6m: api.ranking.w_mom_6m,
      wMom12m: api.ranking.w_mom_12m,
      wRs6m: api.ranking.w_rs_6m,
      topN: api.ranking.top_n,
    },
    signals: {
      breakoutLookback: api.signals.breakout_lookback,
      pullbackMa: api.signals.pullback_ma,
      minHistory: api.signals.min_history,
    },
    risk: {
      accountSize: api.risk.account_size,
      riskPct: api.risk.risk_pct,
      maxPositionPct: api.risk.max_position_pct,
      minShares: api.risk.min_shares,
      kAtr: api.risk.k_atr,
      minRr: api.risk.min_rr ?? 2.0,
      rrTarget: api.risk.rr_target ?? 2.0,
      commissionPct: api.risk.commission_pct ?? 0.0,
      maxFeeRiskPct: api.risk.max_fee_risk_pct ?? 0.2,
      regimeEnabled: api.risk.regime_enabled ?? false,
      regimeTrendSma: api.risk.regime_trend_sma ?? 200,
      regimeTrendMultiplier: api.risk.regime_trend_multiplier ?? 0.5,
      regimeVolAtrWindow: api.risk.regime_vol_atr_window ?? 14,
      regimeVolAtrPctThreshold: api.risk.regime_vol_atr_pct_threshold ?? 6.0,
      regimeVolMultiplier: api.risk.regime_vol_multiplier ?? 0.5,
    },
    manage: {
      breakevenAtR: api.manage.breakeven_at_r,
      trailAfterR: api.manage.trail_after_r,
      trailSma: api.manage.trail_sma,
      smaBufferPct: api.manage.sma_buffer_pct,
      maxHoldingDays: api.manage.max_holding_days,
      benchmark: api.manage.benchmark,
    },
    socialOverlay: {
      enabled: socialOverlayApi.enabled ?? false,
      lookbackHours: socialOverlayApi.lookback_hours ?? 24,
      attentionZThreshold: socialOverlayApi.attention_z_threshold ?? 3.0,
      minSampleSize: socialOverlayApi.min_sample_size ?? 20,
      negativeSentThreshold: socialOverlayApi.negative_sent_threshold ?? -0.4,
      sentimentConfThreshold: socialOverlayApi.sentiment_conf_threshold ?? 0.7,
      hypePercentileThreshold: socialOverlayApi.hype_percentile_threshold ?? 95.0,
      providers: socialOverlayApi.providers ?? ['reddit'],
      sentimentAnalyzer: socialOverlayApi.sentiment_analyzer ?? 'keyword',
    },
    marketIntelligence: {
      enabled: marketIntelligenceApi.enabled ?? false,
      providers: marketIntelligenceApi.providers ?? ['yahoo_finance'],
      universeScope: marketIntelligenceApi.universe_scope ?? 'screener_universe',
      marketContextSymbols: marketIntelligenceApi.market_context_symbols ?? ['SPY', 'QQQ', 'XLK', 'SMH', 'XBI'],
      llm: {
        enabled: marketIntelligenceLlmApi.enabled ?? false,
        provider: marketIntelligenceLlmApi.provider ?? 'openai',
        model: marketIntelligenceLlmApi.model ?? 'gpt-4.1-mini',
        baseUrl: marketIntelligenceLlmApi.base_url ?? 'https://api.openai.com/v1',
        enableCache: marketIntelligenceLlmApi.enable_cache ?? true,
        enableAudit: marketIntelligenceLlmApi.enable_audit ?? true,
        cachePath: marketIntelligenceLlmApi.cache_path ?? 'data/intelligence/llm_cache.json',
        auditPath: marketIntelligenceLlmApi.audit_path ?? 'data/intelligence/llm_audit',
        maxConcurrency: marketIntelligenceLlmApi.max_concurrency ?? 4,
      },
      catalyst: {
        lookbackHours: marketIntelligenceCatalystApi.lookback_hours ?? 72,
        recencyHalfLifeHours: marketIntelligenceCatalystApi.recency_half_life_hours ?? 36,
        falseCatalystReturnZ: marketIntelligenceCatalystApi.false_catalyst_return_z ?? 1.5,
        minPriceReactionAtr: marketIntelligenceCatalystApi.min_price_reaction_atr ?? 0.8,
        requirePriceConfirmation: marketIntelligenceCatalystApi.require_price_confirmation ?? true,
      },
      theme: {
        enabled: marketIntelligenceThemeApi.enabled ?? true,
        minClusterSize: marketIntelligenceThemeApi.min_cluster_size ?? 3,
        minPeerConfirmation: marketIntelligenceThemeApi.min_peer_confirmation ?? 2,
        curatedPeerMapPath: marketIntelligenceThemeApi.curated_peer_map_path ?? 'data/intelligence/peer_map.yaml',
      },
      opportunity: {
        technicalWeight: marketIntelligenceOpportunityApi.technical_weight ?? 0.55,
        catalystWeight: marketIntelligenceOpportunityApi.catalyst_weight ?? 0.45,
        maxDailyOpportunities: marketIntelligenceOpportunityApi.max_daily_opportunities ?? 8,
        minOpportunityScore: marketIntelligenceOpportunityApi.min_opportunity_score ?? 0.55,
      },
    },
    isDefault: api.is_default,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export function toStrategyUpdateRequest(strategy: Strategy): StrategyUpdateRequestAPI {
  const currencies = Array.from(
    new Set(
      strategy.universe.filt.currencies
        .map((value) => value.toUpperCase())
        .filter((value) => value === 'USD' || value === 'EUR')
    )
  );
  return {
    name: strategy.name,
    description: strategy.description ?? undefined,
    module: strategy.module ?? 'momentum',
    universe: {
      trend: {
        sma_fast: strategy.universe.trend.smaFast,
        sma_mid: strategy.universe.trend.smaMid,
        sma_long: strategy.universe.trend.smaLong,
      },
      vol: {
        atr_window: strategy.universe.vol.atrWindow,
      },
      mom: {
        lookback_6m: strategy.universe.mom.lookback6m,
        lookback_12m: strategy.universe.mom.lookback12m,
        benchmark: strategy.universe.mom.benchmark,
      },
      filt: {
        min_price: strategy.universe.filt.minPrice,
        max_price: strategy.universe.filt.maxPrice,
        max_atr_pct: strategy.universe.filt.maxAtrPct,
        require_trend_ok: strategy.universe.filt.requireTrendOk,
        require_rs_positive: strategy.universe.filt.requireRsPositive,
        currencies: currencies.length ? currencies : ['USD', 'EUR'],
      },
    },
    ranking: {
      w_mom_6m: strategy.ranking.wMom6m,
      w_mom_12m: strategy.ranking.wMom12m,
      w_rs_6m: strategy.ranking.wRs6m,
      top_n: strategy.ranking.topN,
    },
    signals: {
      breakout_lookback: strategy.signals.breakoutLookback,
      pullback_ma: strategy.signals.pullbackMa,
      min_history: strategy.signals.minHistory,
    },
    risk: {
      account_size: strategy.risk.accountSize,
      risk_pct: strategy.risk.riskPct,
      max_position_pct: strategy.risk.maxPositionPct,
      min_shares: strategy.risk.minShares,
      k_atr: strategy.risk.kAtr,
      min_rr: strategy.risk.minRr,
      rr_target: strategy.risk.rrTarget,
      commission_pct: strategy.risk.commissionPct,
      max_fee_risk_pct: strategy.risk.maxFeeRiskPct,
      regime_enabled: strategy.risk.regimeEnabled,
      regime_trend_sma: strategy.risk.regimeTrendSma,
      regime_trend_multiplier: strategy.risk.regimeTrendMultiplier,
      regime_vol_atr_window: strategy.risk.regimeVolAtrWindow,
      regime_vol_atr_pct_threshold: strategy.risk.regimeVolAtrPctThreshold,
      regime_vol_multiplier: strategy.risk.regimeVolMultiplier,
    },
    manage: {
      breakeven_at_r: strategy.manage.breakevenAtR,
      trail_after_r: strategy.manage.trailAfterR,
      trail_sma: strategy.manage.trailSma,
      sma_buffer_pct: strategy.manage.smaBufferPct,
      max_holding_days: strategy.manage.maxHoldingDays,
      benchmark: strategy.manage.benchmark,
    },
    social_overlay: {
      enabled: strategy.socialOverlay.enabled,
      lookback_hours: strategy.socialOverlay.lookbackHours,
      attention_z_threshold: strategy.socialOverlay.attentionZThreshold,
      min_sample_size: strategy.socialOverlay.minSampleSize,
      negative_sent_threshold: strategy.socialOverlay.negativeSentThreshold,
      sentiment_conf_threshold: strategy.socialOverlay.sentimentConfThreshold,
      hype_percentile_threshold: strategy.socialOverlay.hypePercentileThreshold,
      providers: strategy.socialOverlay.providers,
      sentiment_analyzer: strategy.socialOverlay.sentimentAnalyzer,
    },
    market_intelligence: {
      enabled: strategy.marketIntelligence.enabled,
      providers: strategy.marketIntelligence.providers,
      universe_scope: strategy.marketIntelligence.universeScope,
      market_context_symbols: strategy.marketIntelligence.marketContextSymbols,
      llm: {
        enabled: strategy.marketIntelligence.llm.enabled,
        provider: strategy.marketIntelligence.llm.provider,
        model: strategy.marketIntelligence.llm.model,
        base_url: strategy.marketIntelligence.llm.baseUrl,
        enable_cache: strategy.marketIntelligence.llm.enableCache,
        enable_audit: strategy.marketIntelligence.llm.enableAudit,
        cache_path: strategy.marketIntelligence.llm.cachePath,
        audit_path: strategy.marketIntelligence.llm.auditPath,
        max_concurrency: strategy.marketIntelligence.llm.maxConcurrency,
      },
      catalyst: {
        lookback_hours: strategy.marketIntelligence.catalyst.lookbackHours,
        recency_half_life_hours: strategy.marketIntelligence.catalyst.recencyHalfLifeHours,
        false_catalyst_return_z: strategy.marketIntelligence.catalyst.falseCatalystReturnZ,
        min_price_reaction_atr: strategy.marketIntelligence.catalyst.minPriceReactionAtr,
        require_price_confirmation: strategy.marketIntelligence.catalyst.requirePriceConfirmation,
      },
      theme: {
        enabled: strategy.marketIntelligence.theme.enabled,
        min_cluster_size: strategy.marketIntelligence.theme.minClusterSize,
        min_peer_confirmation: strategy.marketIntelligence.theme.minPeerConfirmation,
        curated_peer_map_path: strategy.marketIntelligence.theme.curatedPeerMapPath,
      },
      opportunity: {
        technical_weight: strategy.marketIntelligence.opportunity.technicalWeight,
        catalyst_weight: strategy.marketIntelligence.opportunity.catalystWeight,
        max_daily_opportunities: strategy.marketIntelligence.opportunity.maxDailyOpportunities,
        min_opportunity_score: strategy.marketIntelligence.opportunity.minOpportunityScore,
      },
    },
  };
}

export function toStrategyCreateRequest(
  strategy: Strategy,
  payload: { id: string; name: string; description?: string }
): StrategyCreateRequestAPI {
  const base = {
    ...strategy,
    name: payload.name,
    description: payload.description ?? strategy.description,
  };
  return {
    id: payload.id,
    ...toStrategyUpdateRequest(base),
  };
}
