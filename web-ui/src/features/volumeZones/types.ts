export type VolumeZoneAction = 'Long' | 'Short' | 'Watch' | 'No Trade';
export type MarketBias = 'bullish' | 'bearish' | 'neutral';
export type ZoneKind = 'poc' | 'hvn' | 'lvn';
export type ZoneRole = 'buyer_defense' | 'seller_defense' | 'neutral';

export interface VolumeZoneAPI {
  kind: string;
  role: string;
  price_low: number;
  price_high: number;
  center: number;
  volume_share: number;
}

export interface VolumeZone {
  kind: ZoneKind;
  role: ZoneRole;
  priceLow: number;
  priceHigh: number;
  center: number;
  volumeShare: number;
}

export interface DataQualityAPI {
  ok: boolean;
  bars: number;
  warnings: string[];
}

export interface DataQuality {
  ok: boolean;
  bars: number;
  warnings: string[];
}

export interface KeyLevelsAPI {
  price: number | null;
  poc: number | null;
  vwap: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  atr14: number | null;
  swing_high: number | null;
  swing_low: number | null;
  rel_volume: number | null;
}

export interface KeyLevels {
  price?: number;
  poc?: number;
  vwap?: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  atr14?: number;
  swingHigh?: number;
  swingLow?: number;
  relVolume?: number;
}

export interface TradePlanAPI {
  direction: string;
  entry: number | null;
  stop: number | null;
  target: number | null;
  rr: number | null;
}

export interface TradePlan {
  direction: string;
  entry?: number;
  stop?: number;
  target?: number;
  rr?: number;
}

export interface VolumeAnalysisAPI {
  symbol: string;
  provider: string;
  interval: string;
  lookback: number;
  data_quality: DataQualityAPI;
  profile_type: string;
  market_bias: string;
  setup_type: string;
  action: string;
  confidence_score: number;
  rationale: string[];
  key_levels: KeyLevelsAPI;
  volume_zones: VolumeZoneAPI[];
  trade_plan: TradePlanAPI;
  warnings: string[];
}

export interface VolumeAnalysis {
  symbol: string;
  provider: string;
  interval: string;
  lookback: number;
  dataQuality: DataQuality;
  profileType: string;
  marketBias: MarketBias;
  setupType: string;
  action: VolumeZoneAction;
  confidenceScore: number;
  rationale: string[];
  keyLevels: KeyLevels;
  volumeZones: VolumeZone[];
  tradePlan: TradePlan;
  warnings: string[];
}

export class VolumeAnalysisIdentityError extends Error {
  constructor() {
    super('Volume analysis identity mismatch');
    this.name = 'VolumeAnalysisIdentityError';
  }
}

export function assertVolumeAnalysisIdentity(
  analysis: VolumeAnalysis,
  requestedTicker: string,
  requestedLookback: number,
): void {
  const ticker = requestedTicker.trim().toUpperCase();
  if (analysis.symbol.trim().toUpperCase() !== ticker || analysis.lookback !== requestedLookback) {
    throw new VolumeAnalysisIdentityError();
  }
}

export function transformVolumeAnalysis(api: VolumeAnalysisAPI): VolumeAnalysis {
  return {
    symbol: api.symbol,
    provider: api.provider,
    interval: api.interval,
    lookback: api.lookback,
    dataQuality: {
      ok: api.data_quality.ok,
      bars: api.data_quality.bars,
      warnings: api.data_quality.warnings ?? [],
    },
    profileType: api.profile_type,
    marketBias: api.market_bias as MarketBias,
    setupType: api.setup_type,
    action: api.action as VolumeZoneAction,
    confidenceScore: api.confidence_score,
    rationale: api.rationale ?? [],
    keyLevels: {
      price: api.key_levels.price ?? undefined,
      poc: api.key_levels.poc ?? undefined,
      vwap: api.key_levels.vwap ?? undefined,
      sma20: api.key_levels.sma20 ?? undefined,
      sma50: api.key_levels.sma50 ?? undefined,
      sma200: api.key_levels.sma200 ?? undefined,
      atr14: api.key_levels.atr14 ?? undefined,
      swingHigh: api.key_levels.swing_high ?? undefined,
      swingLow: api.key_levels.swing_low ?? undefined,
      relVolume: api.key_levels.rel_volume ?? undefined,
    },
    volumeZones: (api.volume_zones ?? []).map((z) => ({
      kind: z.kind as ZoneKind,
      role: z.role as ZoneRole,
      priceLow: z.price_low,
      priceHigh: z.price_high,
      center: z.center,
      volumeShare: z.volume_share,
    })),
    tradePlan: {
      direction: api.trade_plan.direction,
      entry: api.trade_plan.entry ?? undefined,
      stop: api.trade_plan.stop ?? undefined,
      target: api.trade_plan.target ?? undefined,
      rr: api.trade_plan.rr ?? undefined,
    },
    warnings: api.warnings ?? [],
  };
}
