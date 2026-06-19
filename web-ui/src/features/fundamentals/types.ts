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

export interface FundamentalSeriesPoint {
  periodEnd: string;
  value: number;
}

export interface FundamentalSeriesPointAPI {
  period_end: string;
  value: number;
}

export interface FundamentalMetricContext {
  source?: string;
  cadence: 'snapshot' | 'quarterly' | 'annual' | 'unknown';
  derived: boolean;
  derivedFrom: string[];
  periodEnd?: string;
}

export interface FundamentalMetricContextAPI {
  source?: string | null;
  cadence: 'snapshot' | 'quarterly' | 'annual' | 'unknown';
  derived: boolean;
  derived_from?: string[];
  period_end?: string | null;
}

export interface FundamentalMetricSeries {
  label: string;
  unit: 'number' | 'currency' | 'percent' | 'ratio';
  frequency: 'quarterly' | 'annual' | 'unknown';
  direction: 'improving' | 'deteriorating' | 'stable' | 'unknown' | 'not_comparable';
  source?: string;
  points: FundamentalSeriesPoint[];
}

export interface FundamentalMetricSeriesAPI {
  label: string;
  unit: 'number' | 'currency' | 'percent' | 'ratio';
  frequency: 'quarterly' | 'annual' | 'unknown';
  direction: 'improving' | 'deteriorating' | 'stable' | 'unknown' | 'not_comparable';
  source?: string | null;
  points?: FundamentalSeriesPointAPI[];
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
  sharesOutstanding?: number;
  totalEquity?: number;
  bookValuePerShare?: number;
  priceToBook?: number;
  bookToPrice?: number;
  mostRecentQuarter?: string;
  dataRegion?: string;
  pillars: Record<string, FundamentalPillarScore>;
  historicalSeries: Record<string, FundamentalMetricSeries>;
  metricContext: Record<string, FundamentalMetricContext>;
  dataQualityStatus: 'high' | 'medium' | 'low';
  dataQualityFlags: string[];
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
  shares_outstanding?: number | null;
  total_equity?: number | null;
  book_value_per_share?: number | null;
  price_to_book?: number | null;
  book_to_price?: number | null;
  most_recent_quarter?: string | null;
  data_region?: string | null;
  pillars?: Record<string, FundamentalPillarScoreAPI>;
  historical_series?: Record<string, FundamentalMetricSeriesAPI>;
  metric_context?: Record<string, FundamentalMetricContextAPI>;
  data_quality_status?: 'high' | 'medium' | 'low';
  data_quality_flags?: string[];
  red_flags?: string[];
  highlights?: string[];
  metric_sources?: Record<string, string>;
  error?: string | null;
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
  const historicalSeries = Object.entries(api.historical_series ?? {}).reduce<Record<string, FundamentalMetricSeries>>(
    (acc, [key, value]) => {
      acc[key] = {
        label: value.label,
        unit: value.unit,
        frequency: value.frequency,
        direction: value.direction,
        source: value.source ?? undefined,
        points: (value.points ?? []).map((point) => ({
          periodEnd: point.period_end,
          value: point.value,
        })),
      };
      return acc;
    },
    {}
  );
  const metricContext = Object.entries(api.metric_context ?? {}).reduce<Record<string, FundamentalMetricContext>>(
    (acc, [key, value]) => {
      acc[key] = {
        source: value.source ?? undefined,
        cadence: value.cadence,
        derived: value.derived,
        derivedFrom: value.derived_from ?? [],
        periodEnd: value.period_end ?? undefined,
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
    sharesOutstanding: api.shares_outstanding ?? undefined,
    totalEquity: api.total_equity ?? undefined,
    bookValuePerShare: api.book_value_per_share ?? undefined,
    priceToBook: api.price_to_book ?? undefined,
    bookToPrice: api.book_to_price ?? undefined,
    mostRecentQuarter: api.most_recent_quarter ?? undefined,
    dataRegion: api.data_region ?? undefined,
    pillars,
    historicalSeries,
    metricContext,
    dataQualityStatus: api.data_quality_status ?? 'low',
    dataQualityFlags: api.data_quality_flags ?? [],
    redFlags: api.red_flags ?? [],
    highlights: api.highlights ?? [],
    metricSources: api.metric_sources ?? {},
    error: api.error ?? undefined,
  };
}
