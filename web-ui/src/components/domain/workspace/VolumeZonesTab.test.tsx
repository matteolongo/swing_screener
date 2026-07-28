import { describe, it, expect } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
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
    min_rr: 2,
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
  const candleSuccess = () =>
    http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () =>
      HttpResponse.json({
        ticker: 'AAPL',
        provider: 'mock',
        interval: '1d',
        data_as_of: '2026-07-27',
        fetched_at: '2026-07-27T20:00:00Z',
        price_history: [],
        patterns: [],
      }),
    );
  const reliabilityCases = [
    { name: 'no-data', analysis: payload({ volume_zones: [], rationale: [] }), candles: candleSuccess(), expected: t('workspacePage.panels.analysis.volumeZones.summary') },
    { name: 'fresh', phase: 'fresh', analysis: payload(), candles: candleSuccess(), expected: t('workspacePage.data.phases.fresh') },
    { name: 'cached', phase: 'cached', analysis: payload(), candles: candleSuccess(), expected: t('workspacePage.data.phases.cached') },
    { name: 'stale', phase: 'stale', analysis: payload({ warnings: ['Stale volume snapshot'] }), candles: candleSuccess(), expected: t('workspacePage.data.phases.stale') },
    { name: 'refreshing-with-data', phase: 'loading', analysis: payload(), candles: candleSuccess(), expected: t('workspacePage.data.phases.loading') },
    { name: 'partial', analysis: payload(), candles: http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () => HttpResponse.json({ detail: 'partial candles' }, { status: 503 })), expected: t('workspacePage.data.partial') },
    { name: 'failed', analysis: { detail: 'failed' }, analysisStatus: 500, candles: candleSuccess(), expected: t('workspacePage.panels.analysis.volumeZones.loadError') },
    { name: 'timeout', analysis: { detail: 'timeout' }, analysisStatus: 504, candles: candleSuccess(), expected: t('workspacePage.panels.analysis.volumeZones.loadError') },
    { name: 'malformed', analysis: { symbol: 'AAPL' }, candles: candleSuccess(), expected: t('workspacePage.panels.analysis.volumeZones.loadError') },
  ] as const;

  it.each(reliabilityCases)('renders its own $name contract without an empty panel', async (testCase) => {
    const { analysis, candles, expected } = testCase;
    const analysisStatus = 'analysisStatus' in testCase ? testCase.analysisStatus : 200;
    const sources = 'phase' in testCase ? [{
      id: 'prices' as const,
      ticker: 'AAPL',
      selectionVersion: 1,
      phase: testCase.phase,
      provider: 'mock',
      dataAsOf: '2026-07-27',
      fetchedAt: '2026-07-27T20:00:00Z',
      cacheOrigin: testCase.phase === 'cached' ? 'memory' as const : 'network' as const,
      missingInputs: [],
      error: null,
    }] : [];
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, () =>
        HttpResponse.json(analysis, { status: analysisStatus }),
      ),
      candles,
    );
    renderWithProviders(<VolumeZonesTab ticker="AAPL" sources={sources} />);
    expect(await screen.findByText(expected)).toBeVisible();
  });

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

  it('shows candle provenance and keeps content date separate from fetch time', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, () =>
        HttpResponse.json(payload({ provider: 'analysis-provider' })),
      ),
      http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () =>
        HttpResponse.json({
          ticker: 'AAPL',
          provider: 'polygon',
          interval: '1d',
          data_as_of: '2026-07-25',
          fetched_at: '2026-07-28T10:30:00+00:00',
          price_history: [],
          patterns: [],
        }),
      ),
    );

    renderWithProviders(<VolumeZonesTab ticker="AAPL" />);

    expect(await screen.findByText('polygon')).toBeVisible();
    expect(screen.getByText('2026-07-25')).toBeVisible();
    expect(screen.getByText(new Date('2026-07-28T10:30:00+00:00').toLocaleString())).toBeVisible();
    expect(screen.getByText(t('workspacePage.panels.analysis.volumeZones.latestCandleDate'))).toBeVisible();
    expect(screen.getByText(t('workspacePage.panels.analysis.volumeZones.fetchedAt'))).toBeVisible();
  });

  it('shows candle loading explicitly instead of rendering an empty chart', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, () => HttpResponse.json(payload())),
      http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, async () => {
        await delay(200);
        return HttpResponse.json({
          ticker: 'AAPL',
          provider: 'mock',
          interval: '1d',
          data_as_of: null,
          fetched_at: '2026-07-28T10:30:00+00:00',
          price_history: [],
          patterns: [],
        });
      }),
    );

    renderWithProviders(<VolumeZonesTab ticker="AAPL" />);

    expect(await screen.findByText(t('workspacePage.panels.analysis.volumeZones.candlesLoading'))).toBeVisible();
    expect(screen.queryByTestId('volume-zone-chart')).not.toBeInTheDocument();
    expect(await screen.findByTestId('volume-zone-chart')).toBeVisible();
  });

  it('renders a typed candle identity mismatch without accepting the chart', async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, () => HttpResponse.json(payload())),
      http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () =>
        HttpResponse.json({
          ticker: 'MSFT',
          provider: 'mock',
          interval: '1d',
          data_as_of: null,
          fetched_at: '2026-07-28T10:30:00+00:00',
          price_history: [],
          patterns: [],
        }),
      ),
    );

    renderWithProviders(<VolumeZonesTab ticker="AAPL" />);

    expect(await screen.findByText(t('workspacePage.data.identityMismatch'))).toBeVisible();
    expect(screen.queryByTestId('volume-zone-chart')).not.toBeInTheDocument();
    expect(screen.getByText(t('workspacePage.panels.analysis.volumeZones.summary'))).toBeVisible();
  });

  it('passes and displays the exact analysis parameters owned by the tab', async () => {
    let requestedSearch = '';
    server.use(
      http.get(`${API_BASE_URL}/api/market-data/AAPL/volume-analysis`, ({ request }) => {
        requestedSearch = new URL(request.url).search;
        return HttpResponse.json(payload({ lookback: 90, min_rr: 2.5 }));
      }),
      http.get(`${API_BASE_URL}/api/market-data/AAPL/candles`, () =>
        HttpResponse.json({
          ticker: 'AAPL',
          provider: 'mock',
          interval: '1d',
          data_as_of: null,
          fetched_at: '2026-07-28T10:30:00+00:00',
          price_history: [],
          patterns: [],
        }),
      ),
    );

    renderWithProviders(<VolumeZonesTab ticker="AAPL" lookback={90} minRr={2.5} />);

    expect(await screen.findByText('90')).toBeVisible();
    expect(screen.getByText('2.5')).toBeVisible();
    expect(requestedSearch).toBe('?lookback=90&min_rr=2.5');
  });
});
