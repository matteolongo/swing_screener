import { describe, expect, it } from 'vitest';
import {
  assertVolumeAnalysisIdentity,
  VolumeAnalysisIdentityError,
  transformVolumeAnalysis,
  type VolumeAnalysisAPI,
} from './types';

const raw: VolumeAnalysisAPI = {
  symbol: 'AAPL',
  provider: 'mock',
  interval: '1d',
  lookback: 120,
  data_quality: { ok: true, bars: 160, warnings: [] },
  profile_type: 'approximate_bar_based',
  market_bias: 'bullish',
  setup_type: 'hvn_support_retest',
  action: 'Long',
  confidence_score: 72.5,
  rationale: ['Market bias is bullish.'],
  key_levels: {
    price: 100,
    poc: 95,
    vwap: 96,
    sma20: 94,
    sma50: 90,
    sma200: 80,
    atr14: 2.5,
    swing_high: 105,
    swing_low: 88,
    rel_volume: 1.3,
  },
  volume_zones: [
    { kind: 'poc', role: 'buyer_defense', price_low: 94, price_high: 96, center: 95, volume_share: 0.18 },
  ],
  trade_plan: { direction: 'long', entry: 100, stop: 93, target: 114, rr: 2.0 },
  warnings: ['Approximate volume profile built from OHLCV bars, not tick-level trades.'],
};

describe('transformVolumeAnalysis', () => {
  it('maps snake_case API payload to camelCase domain type', () => {
    const r = transformVolumeAnalysis(raw);
    expect(r.action).toBe('Long');
    expect(r.confidenceScore).toBe(72.5);
    expect(r.marketBias).toBe('bullish');
    expect(r.profileType).toBe('approximate_bar_based');
    expect(r.keyLevels.poc).toBe(95);
    expect(r.keyLevels.relVolume).toBe(1.3);
    expect(r.volumeZones[0].priceLow).toBe(94);
    expect(r.volumeZones[0].role).toBe('buyer_defense');
    expect(r.tradePlan.rr).toBe(2.0);
    expect(r.dataQuality.ok).toBe(true);
    expect(r.warnings[0]).toContain('Approximate volume profile');
  });

  it('maps nulls to undefined', () => {
    const r = transformVolumeAnalysis({
      ...raw,
      key_levels: { ...raw.key_levels, poc: null },
      trade_plan: { direction: 'none', entry: null, stop: null, target: null, rr: null },
    });
    expect(r.keyLevels.poc).toBeUndefined();
    expect(r.tradePlan.entry).toBeUndefined();
  });

  it('rejects analysis whose symbol does not match the normalized request', () => {
    const analysis = transformVolumeAnalysis({ ...raw, symbol: 'MSFT' });

    expect(VolumeAnalysisIdentityError).toBeDefined();
    expect(() => assertVolumeAnalysisIdentity(analysis, ' aapl ', 120)).toThrow('identity mismatch');
  });

  it('rejects analysis whose lookback does not match the requested parameter', () => {
    const analysis = transformVolumeAnalysis({ ...raw, lookback: 90 });

    expect(() => assertVolumeAnalysisIdentity(analysis, 'AAPL', 120)).toThrow('identity mismatch');
  });
});
