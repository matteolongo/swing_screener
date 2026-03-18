export interface FundamentalsConfig {
  enabled: boolean;
  providers: string[];
  cacheTtlHours: number;
  staleAfterDays: number;
  compareLimit: number;
}

export interface FundamentalsConfigAPI {
  enabled: boolean;
  providers: string[];
  cache_ttl_hours: number;
  stale_after_days: number;
  compare_limit: number;
}

export interface FundamentalPillarScore {
  score?: number;
  status: 'strong' | 'neutral' | 'weak' | 'unavailable';
  summary: string;
}

export interface FundamentalPillarScoreAPI {
  score?: number | null;
  status: 'strong' | 'neutral' | 'weak' | 'unavailable';
  summary: string;
}

export interface FundamentalSnapshot {
  symbol: string;
  asofDate: string;
  provider: string;
  updatedAt: string;
  instrumentType: string;
  supported: boolean;
  coverageStatus: 'supported' | 'partial' | 'insufficient' | 'unsupported';
  freshnessStatus: 'current' | 'stale' | 'unknown';
  companyName?: string;
  sector?: string;
  currency?: string;
  marketCap?: number;
  revenueGrowthYoy?: number;
  earningsGrowthYoy?: number;
  grossMargin?: number;
  operatingMargin?: number;
  freeCashFlow?: number;
  freeCashFlowMargin?: number;
  debtToEquity?: number;
  currentRatio?: number;
  returnOnEquity?: number;
  trailingPe?: number;
  priceToSales?: number;
  mostRecentQuarter?: string;
  pillars: Record<string, FundamentalPillarScore>;
  redFlags: string[];
  highlights: string[];
  metricSources: Record<string, string>;
  error?: string;
}

export interface FundamentalSnapshotAPI {
  symbol: string;
  asof_date: string;
  provider: string;
  updated_at: string;
  instrument_type: string;
  supported: boolean;
  coverage_status: 'supported' | 'partial' | 'insufficient' | 'unsupported';
  freshness_status: 'current' | 'stale' | 'unknown';
  company_name?: string | null;
  sector?: string | null;
  currency?: string | null;
  market_cap?: number | null;
  revenue_growth_yoy?: number | null;
  earnings_growth_yoy?: number | null;
  gross_margin?: number | null;
  operating_margin?: number | null;
  free_cash_flow?: number | null;
  free_cash_flow_margin?: number | null;
  debt_to_equity?: number | null;
  current_ratio?: number | null;
  return_on_equity?: number | null;
  trailing_pe?: number | null;
  price_to_sales?: number | null;
  most_recent_quarter?: string | null;
  pillars?: Record<string, FundamentalPillarScoreAPI>;
  red_flags?: string[];
  highlights?: string[];
  metric_sources?: Record<string, string>;
  error?: string | null;
}

export interface FundamentalsCompareRequest {
  symbols: string[];
  forceRefresh?: boolean;
}

export interface FundamentalsCompareRequestAPI {
  symbols: string[];
  force_refresh?: boolean;
}

export interface FundamentalsCompareResponse {
  snapshots: FundamentalSnapshot[];
}

export interface FundamentalsCompareResponseAPI {
  snapshots: FundamentalSnapshotAPI[];
}

export function transformFundamentalsConfig(api: FundamentalsConfigAPI): FundamentalsConfig {
  return {
    enabled: api.enabled,
    providers: api.providers,
    cacheTtlHours: api.cache_ttl_hours,
    staleAfterDays: api.stale_after_days,
    compareLimit: api.compare_limit,
  };
}

export function transformFundamentalSnapshot(api: FundamentalSnapshotAPI): FundamentalSnapshot {
  const pillars = Object.entries(api.pillars ?? {}).reduce<Record<string, FundamentalPillarScore>>(
    (acc, [key, value]) => {
      acc[key] = {
        score: value.score ?? undefined,
        status: value.status,
        summary: value.summary,
      };
      return acc;
    },
    {}
  );

  return {
    symbol: api.symbol,
    asofDate: api.asof_date,
    provider: api.provider,
    updatedAt: api.updated_at,
    instrumentType: api.instrument_type,
    supported: api.supported,
    coverageStatus: api.coverage_status,
    freshnessStatus: api.freshness_status,
    companyName: api.company_name ?? undefined,
    sector: api.sector ?? undefined,
    currency: api.currency ?? undefined,
    marketCap: api.market_cap ?? undefined,
    revenueGrowthYoy: api.revenue_growth_yoy ?? undefined,
    earningsGrowthYoy: api.earnings_growth_yoy ?? undefined,
    grossMargin: api.gross_margin ?? undefined,
    operatingMargin: api.operating_margin ?? undefined,
    freeCashFlow: api.free_cash_flow ?? undefined,
    freeCashFlowMargin: api.free_cash_flow_margin ?? undefined,
    debtToEquity: api.debt_to_equity ?? undefined,
    currentRatio: api.current_ratio ?? undefined,
    returnOnEquity: api.return_on_equity ?? undefined,
    trailingPe: api.trailing_pe ?? undefined,
    priceToSales: api.price_to_sales ?? undefined,
    mostRecentQuarter: api.most_recent_quarter ?? undefined,
    pillars,
    redFlags: api.red_flags ?? [],
    highlights: api.highlights ?? [],
    metricSources: api.metric_sources ?? {},
    error: api.error ?? undefined,
  };
}

export function transformFundamentalsCompareResponse(
  api: FundamentalsCompareResponseAPI
): FundamentalsCompareResponse {
  return {
    snapshots: (api.snapshots ?? []).map(transformFundamentalSnapshot),
  };
}
