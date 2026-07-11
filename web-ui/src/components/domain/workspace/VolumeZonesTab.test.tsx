import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import { renderWithProviders, screen } from '@/test/utils';
import { t } from '@/i18n/t';
import VolumeZonesTab from './VolumeZonesTab';

function payload(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe('VolumeZonesTab', () => {
  it('renders the action, confidence and the approximate-profile warning', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, () => HttpResponse.json(payload())),
      http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () =>
        HttpResponse.json({ ticker: 'AAPL', price_history: [], patterns: [] }),
      ),
    );
    renderWithProviders(<VolumeZonesTab ticker="AAPL" />);
    expect(await screen.findByText('Long')).toBeInTheDocument();
    expect(screen.getByText(t('workspacePage.panels.analysis.volumeZones.confidence'))).toBeInTheDocument();
    expect(screen.getByText(/Approximate volume profile/)).toBeInTheDocument();
  });

  it('shows the load-error state on failure', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
      http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () =>
        HttpResponse.json({ ticker: 'AAPL', price_history: [], patterns: [] }),
      ),
    );
    renderWithProviders(<VolumeZonesTab ticker="AAPL" />);
    expect(await screen.findByText(t('workspacePage.panels.analysis.volumeZones.loadError'))).toBeInTheDocument();
  });
});
