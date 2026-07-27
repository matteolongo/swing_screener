import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { API_BASE_URL } from '@/lib/api';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/utils';
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

  it('shows zones when candle rendering fails and exposes the candle retry', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, () => HttpResponse.json(payload())),
      http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () =>
        HttpResponse.json({ detail: 'prices unavailable' }, { status: 503 }),
      ),
    );

    renderWithProviders(<VolumeZonesTab ticker="AAPL" />);

    expect(
      await screen.findByText(t('workspacePage.panels.analysis.volumeZones.summary')),
    ).toBeVisible();
    expect(screen.getByText(t('workspacePage.panels.analysis.volumeZones.candlesFailed'))).toBeVisible();
    expect(
      screen.getByRole('button', { name: t('workspacePage.data.retryPrices') }),
    ).toBeEnabled();
    expect(screen.getByText(t('workspacePage.data.partial'))).toBeVisible();
  });

  it('rejects a response for another symbol', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, () =>
        HttpResponse.json(payload({ symbol: 'MSFT' })),
      ),
      http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () =>
        HttpResponse.json({ ticker: 'AAPL', price_history: [], patterns: [] }),
      ),
    );

    renderWithProviders(<VolumeZonesTab ticker="AAPL" />);

    expect(await screen.findByText(t('workspacePage.data.identityMismatch'))).toBeVisible();
    expect(screen.queryByTestId('volume-zone-chart')).not.toBeInTheDocument();
  });

  it('retries only the failed candle source', async () => {
    let candleAttempts = 0;
    let analysisAttempts = 0;
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, () => {
        analysisAttempts += 1;
        return HttpResponse.json(payload());
      }),
      http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () => {
        candleAttempts += 1;
        return candleAttempts === 1
          ? HttpResponse.json({ detail: 'prices unavailable' }, { status: 503 })
          : HttpResponse.json({ ticker: 'AAPL', price_history: [], patterns: [] });
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<VolumeZonesTab ticker=" aapl " />);
    await screen.findByText(t('workspacePage.panels.analysis.volumeZones.candlesFailed'));
    await user.click(screen.getByRole('button', { name: t('workspacePage.data.retryPrices') }));

    await waitFor(() => expect(candleAttempts).toBe(2));
    expect(analysisAttempts).toBe(1);
  });

  it('keeps available candles visible when analysis fails and exposes the analysis retry', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, () =>
        HttpResponse.json({ detail: 'analysis unavailable' }, { status: 503 }),
      ),
      http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () =>
        HttpResponse.json({ ticker: 'AAPL', price_history: [], patterns: [] }),
      ),
    );

    renderWithProviders(<VolumeZonesTab ticker="AAPL" />);

    expect(await screen.findByText(t('workspacePage.panels.analysis.volumeZones.loadError'))).toBeVisible();
    expect(screen.getByTestId('volume-zone-chart')).toBeVisible();
    expect(
      screen.getByRole('button', { name: t('workspacePage.data.retryAnalysis') }),
    ).toBeEnabled();
    expect(screen.getByText(t('workspacePage.data.partial'))).toBeVisible();
  });
});
