export interface TaxonomyFilterValues {
  region?: string[];
  marketCapTier?: string[];
  sector?: string[];
  indexMemberships?: string[];
  instrumentType?: string[];
  instrumentTypeDetail?: string[];
  provider?: string[];
  currency?: string[];
  exchangeMics?: string[];
  liquidityTier?: string[];
}

export interface TaxonomyPreset {
  id: string;
  label: string;
  filter: TaxonomyFilterValues;
}

/** Map a camelCase TaxonomyFilter to the snake_case API shape. */
export function toTaxonomyFilterPayload(
  filter: TaxonomyFilterValues,
): Record<string, string[] | undefined> {
  return {
    region: filter.region,
    market_cap_tier: filter.marketCapTier,
    sector: filter.sector,
    index_memberships: filter.indexMemberships,
    instrument_type: filter.instrumentType,
    instrument_type_detail: filter.instrumentTypeDetail,
    provider: filter.provider,
    currency: filter.currency,
    exchange_mics: filter.exchangeMics,
    liquidity_tier: filter.liquidityTier,
  };
}

export interface ReviewQueueEntry {
  symbol: string;
  exchangeMic?: string;
  capTier?: string;
  sector?: string;
  provider?: string;
  failureCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  reason: string;
}

interface ReviewQueueEntryAPI {
  symbol: string;
  exchange_mic?: string;
  cap_tier?: string;
  sector?: string;
  provider?: string;
  fetch_failure_count: number;
  first_failed_at: string;
  last_failed_at: string;
  reason: string;
}

export function transformReviewEntry(api: ReviewQueueEntryAPI): ReviewQueueEntry {
  return {
    symbol: api.symbol,
    exchangeMic: api.exchange_mic,
    capTier: api.cap_tier,
    sector: api.sector,
    provider: api.provider,
    failureCount: api.fetch_failure_count,
    firstFailedAt: api.first_failed_at,
    lastFailedAt: api.last_failed_at,
    reason: api.reason,
  };
}

interface TaxonomyPresetAPI {
  id: string;
  label: string;
  filter: Record<string, string[] | undefined>;
}

export function transformPreset(api: TaxonomyPresetAPI): TaxonomyPreset {
  const f = api.filter ?? {};
  return {
    id: api.id,
    label: api.label,
    filter: {
      region: f.region,
      marketCapTier: f.market_cap_tier,
      sector: f.sector,
      indexMemberships: f.index_memberships,
      instrumentType: f.instrument_type,
      instrumentTypeDetail: f.instrument_type_detail,
      provider: f.provider,
      currency: f.currency,
      exchangeMics: f.exchange_mics,
      liquidityTier: f.liquidity_tier,
    },
  };
}
