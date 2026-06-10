import { RefreshCw, Database, AlertTriangle, CheckCircle2, Target, Search, Globe2, ListChecks } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import WorkspaceSymbolModal from '@/components/domain/workspace/WorkspaceSymbolModal';
import { useRefreshUniverseMutation, useSymbolDiscoveryMutation, useUniverseCatalog, useUniverseDetail, useUpdateUniverseBenchmarkMutation } from '@/features/universes/hooks';
import type { ScreenerCandidate, UniverseSummary } from '@/features/screener/types';
import type { SymbolDiscoveryRequest } from '@/features/universes/types';
import { useRunScreenerMutation } from '@/features/screener/hooks';
import { formatCompactNumber, formatCurrency, formatPercent } from '@/utils/formatters';

const BENCHMARK_OPTIONS = [
  'ACWI',
  'SPY',
  'QQQ',
  'IWM',
  'VXUS',
  'VGK',
  'IXC',
  'IXG',
  'IXJ',
  'SMH',
  'SOXX',
  'ITA',
  'XLI',
  'XLP',
  'XLY',
  '^AEX',
  '^AMX',
  '^STOXX50E',
  '^GDAXI',
  '^FCHI',
  '^IBEX',
  '^FTSE',
  '^GSPC',
] as const;

const DISCOVERY_SCREENS = [
  { value: 'most_actives', label: 'Most active' },
  { value: 'day_gainers', label: 'Day gainers' },
  { value: 'day_losers', label: 'Day losers' },
] as const;

const MARKET_PRESETS = [
  { value: 'us_major', label: 'US major exchanges', currencies: ['USD'], exchangeMics: ['XNAS', 'XNYS'], eodhdExchanges: ['NASDAQ', 'NYSE'] },
  { value: 'amsterdam', label: 'Amsterdam', currencies: ['EUR'], exchangeMics: ['XAMS'], eodhdExchanges: ['AS'] },
  { value: 'euronext_core', label: 'Euronext core', currencies: ['EUR'], exchangeMics: ['XAMS', 'XPAR', 'XBRU'], eodhdExchanges: ['AS', 'PA', 'BR'] },
  { value: 'global_keyed', label: 'Global keyed sample', currencies: [], exchangeMics: [], eodhdExchanges: ['NASDAQ', 'NYSE', 'AS', 'PA', 'LSE', 'HK'] },
  { value: 'custom_any', label: 'Any market', currencies: [], exchangeMics: [], eodhdExchanges: [] },
] as const;

const CURRENCY_PRESETS = [
  { value: 'preset', label: 'Market preset' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'USD,EUR', label: 'USD + EUR' },
  { value: 'any', label: 'Any currency' },
] as const;

const TYPE_PRESETS = [
  { value: 'EQUITY', label: 'Equities' },
  { value: 'ETF', label: 'ETFs' },
  { value: 'EQUITY,ETF', label: 'Equities + ETFs' },
] as const;

const VOLUME_PRESETS = [
  { value: 0, label: 'Any volume' },
  { value: 500_000, label: '500K+' },
  { value: 1_000_000, label: '1M+' },
  { value: 5_000_000, label: '5M+' },
] as const;

const MARKET_CAP_PRESETS = [
  { value: 0, label: 'Any market cap' },
  { value: 1_000_000_000, label: '$1B+' },
  { value: 10_000_000_000, label: '$10B+' },
  { value: 50_000_000_000, label: '$50B+' },
] as const;

const YAHOO_SUPPORTED_MICS = new Set(['ARCX', 'BATS', 'XASE', 'XNAS', 'XNYS', 'XOTC']);

const freshnessVariant = (status: UniverseSummary['freshness_status']): 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'fresh':
      return 'success';
    case 'review_due':
      return 'warning';
    case 'stale':
      return 'error';
    default:
      return 'default';
  }
};

const freshnessLabel = (status: UniverseSummary['freshness_status']): string => {
  switch (status) {
    case 'fresh':
      return 'Fresh';
    case 'review_due':
      return 'Review due';
    case 'stale':
      return 'Stale';
    default:
      return 'Unknown';
  }
};

const sourceLabel = (source: string): string => {
  if (source === 'euronext_review') return 'Euronext review';
  if (source === 'manual') return 'Manual';
  return source;
};

const taxonomyRows = (taxonomy: Record<string, Record<string, number>>, key: string): Array<[string, number]> => (
  Object.entries(taxonomy[key] ?? {}).sort((a, b) => b[1] - a[1])
);

const actionLabel = (candidate: ScreenerCandidate): string => {
  const action = candidate.decisionSummary?.action;
  if (action === 'BUY_NOW') return 'Buy Now';
  if (action === 'BUY_ON_PULLBACK') return 'Pullback';
  if (action === 'WAIT_FOR_BREAKOUT') return 'Breakout';
  if (action === 'WATCH') return 'Watch';
  if (action === 'TACTICAL_ONLY') return 'Tactical';
  if (action === 'AVOID') return 'Avoid';
  if (action === 'MANAGE_ONLY') return 'Manage';
  return candidate.signal ?? '—';
};

export default function Universes() {
  const catalogQuery = useUniverseCatalog();
  const universes = catalogQuery.data?.universes ?? [];
  const [selectedUniverseId, setSelectedUniverseId] = useState<string | null>(null);
  const [discoveryProvider, setDiscoveryProvider] = useState<SymbolDiscoveryRequest['provider']>('yahoo_predefined');
  const [selectedScreens, setSelectedScreens] = useState<string[]>(['most_actives', 'day_gainers', 'day_losers']);
  const [marketPreset, setMarketPreset] = useState<(typeof MARKET_PRESETS)[number]['value']>('us_major');
  const [currencyPreset, setCurrencyPreset] = useState<(typeof CURRENCY_PRESETS)[number]['value']>('preset');
  const [typePreset, setTypePreset] = useState<(typeof TYPE_PRESETS)[number]['value']>('EQUITY');
  const [discoveryLimit, setDiscoveryLimit] = useState(50);
  const [discoveryMinVolume, setDiscoveryMinVolume] = useState(1_000_000);
  const [discoveryMinMarketCap, setDiscoveryMinMarketCap] = useState(0);
  const [screenerTop, setScreenerTop] = useState(20);
  const [detailTicker, setDetailTicker] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedUniverseId && universes.length > 0) {
      setSelectedUniverseId(universes[0].id);
    }
  }, [selectedUniverseId, universes]);

  const detailQuery = useUniverseDetail(selectedUniverseId);
  const refreshMutation = useRefreshUniverseMutation(selectedUniverseId);
  const benchmarkMutation = useUpdateUniverseBenchmarkMutation(selectedUniverseId);
  const discoveryMutation = useSymbolDiscoveryMutation();
  const discoveryScreenerMutation = useRunScreenerMutation();
  const [benchmarkDraft, setBenchmarkDraft] = useState('');
  const selectedSummary = useMemo(
    () => universes.find((item) => item.id === selectedUniverseId) ?? null,
    [selectedUniverseId, universes],
  );
  const detail = detailQuery.data;
  const refreshResult = refreshMutation.data;

  useEffect(() => {
    const benchmark = detail?.benchmark ?? selectedSummary?.benchmark ?? '';
    setBenchmarkDraft(benchmark);
  }, [detail?.benchmark, selectedSummary?.benchmark, selectedUniverseId]);

  const selectedMarket = MARKET_PRESETS.find((preset) => preset.value === marketPreset) ?? MARKET_PRESETS[0];
  const discoveryCurrencies = currencyPreset === 'preset'
    ? selectedMarket.currencies
    : currencyPreset === 'any'
      ? []
      : currencyPreset.split(',');
  const discoveryQuoteTypes = typePreset.split(',');
  const yahooUsesCustomScreener = discoveryProvider === 'yahoo_predefined' && (
    discoveryCurrencies.some((currency) => currency !== 'USD')
    || selectedMarket.exchangeMics.some((mic) => !YAHOO_SUPPORTED_MICS.has(mic))
  );
  const eodhdNeedsKey = discoveryProvider === 'eodhd_exchange';

  const toggleScreen = (screen: string) => {
    setSelectedScreens((current) => {
      if (current.includes(screen)) {
        const next = current.filter((item) => item !== screen);
        return next.length ? next : current;
      }
      return [...current, screen];
    });
  };

  const discoveryRequest = (): SymbolDiscoveryRequest => ({
    provider: discoveryProvider,
    screens: selectedScreens,
    exchanges: [...selectedMarket.eodhdExchanges],
    currencies: [...discoveryCurrencies],
    exchange_mics: [...selectedMarket.exchangeMics],
    quote_types: discoveryQuoteTypes,
    limit: discoveryLimit,
    min_volume: discoveryMinVolume > 0 ? discoveryMinVolume : null,
    min_market_cap: discoveryMinMarketCap > 0 ? discoveryMinMarketCap : null,
  });

  const runDiscovery = () => {
    discoveryScreenerMutation.reset();
    discoveryMutation.mutate(discoveryRequest());
  };

  const runScreenerForDiscovery = () => {
    const symbols = (discoveryMutation.data?.symbols ?? []).map((symbol) => symbol.symbol);
    if (!symbols.length) return;
    discoveryScreenerMutation.mutate({
      tickers: symbols,
      top: screenerTop,
      currencies: discoveryCurrencies.length ? [...discoveryCurrencies] : undefined,
      exchangeMics: selectedMarket.exchangeMics.length ? [...selectedMarket.exchangeMics] : undefined,
      instrumentTypes: discoveryQuoteTypes
        .map((item) => item.toLowerCase())
        .filter((item): item is 'equity' | 'etf' => item === 'equity' || item === 'etf'),
    });
  };

  const discoveryResult = discoveryMutation.data;
  const discoveryScreenerResult = discoveryScreenerMutation.data;

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Universe Management</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Review source coverage, freshness, validation, and refresh official universes without editing snapshots by hand.
        </p>
      </div>

      <Card variant="bordered" className="mb-4 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Live Discovery</h2>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Pull fresh candidate symbols from free sources, then review their market, currency, and exchange taxonomy before screening.
              </p>
            </div>
            <Button onClick={runDiscovery} disabled={discoveryMutation.isPending || discoveryLimit <= 0} size="sm">
              {discoveryMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Discovering…
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Discover Symbols
                </>
              )}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Provider</span>
              <select
                value={discoveryProvider}
                onChange={(event) => setDiscoveryProvider(event.target.value as SymbolDiscoveryRequest['provider'])}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                <option value="yahoo_predefined">Yahoo predefined</option>
                <option value="eodhd_exchange">EODHD exchange list</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Market</span>
              <select
                value={marketPreset}
                onChange={(event) => {
                  const nextMarket = event.target.value as (typeof MARKET_PRESETS)[number]['value'];
                  setMarketPreset(nextMarket);
                  if (nextMarket === 'us_major') {
                    setDiscoveryProvider('yahoo_predefined');
                  }
                }}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                {MARKET_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Currency</span>
              <select
                value={currencyPreset}
                onChange={(event) => setCurrencyPreset(event.target.value as (typeof CURRENCY_PRESETS)[number]['value'])}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                {CURRENCY_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Instrument type</span>
              <select
                value={typePreset}
                onChange={(event) => setTypePreset(event.target.value as (typeof TYPE_PRESETS)[number]['value'])}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                {TYPE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Min volume</span>
              <select
                value={discoveryMinVolume}
                onChange={(event) => setDiscoveryMinVolume(Number(event.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                {VOLUME_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Min market cap</span>
              <select
                value={discoveryMinMarketCap}
                onChange={(event) => setDiscoveryMinMarketCap(Number(event.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                {MARKET_CAP_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>{preset.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Discovery limit</span>
              <select
                value={discoveryLimit}
                onChange={(event) => setDiscoveryLimit(Number(event.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                {[25, 50, 100, 200].map((value) => (
                  <option key={value} value={value}>{value} symbols</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Screener results</span>
              <select
                value={screenerTop}
                onChange={(event) => setScreenerTop(Number(event.target.value))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              >
                {[10, 20, 50, 100].map((value) => (
                  <option key={value} value={value}>Top {value}</option>
                ))}
              </select>
            </label>
            <div className="md:col-span-2 xl:col-span-4">
              <div className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Yahoo status screens</div>
              <div className="flex flex-wrap gap-2">
                {DISCOVERY_SCREENS.map((screen) => {
                  const active = selectedScreens.includes(screen.value);
                  return (
                    <button
                      key={screen.value}
                      type="button"
                      onClick={() => toggleScreen(screen.value)}
                      disabled={discoveryProvider !== 'yahoo_predefined'}
                      className={`rounded-md border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        active
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {screen.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {yahooUsesCustomScreener ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Yahoo will use its custom screener endpoint for this market because predefined screeners are mostly US-centric.
            </div>
          ) : null}

          {eodhdNeedsKey ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              EODHD exchange discovery needs `EODHD_API_KEY` configured in the backend environment. Without it, the request will return a setup error instead of live EUR symbols.
            </div>
          ) : null}

          {discoveryMutation.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {discoveryMutation.error instanceof Error ? discoveryMutation.error.message : 'Symbol discovery failed.'}
            </div>
          ) : null}

          {discoveryResult ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <Badge variant="default">{discoveryResult.symbols.length} candidates</Badge>
                  <Badge variant="default">{discoveryResult.provider}</Badge>
                  <Badge variant="default">{selectedMarket.label}</Badge>
                  <span>as of {discoveryResult.source_asof}</span>
                </div>
                <Button
                  onClick={runScreenerForDiscovery}
                  disabled={discoveryScreenerMutation.isPending || discoveryResult.symbols.length === 0}
                  size="sm"
                  variant="secondary"
                >
                  {discoveryScreenerMutation.isPending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Screening…
                    </>
                  ) : (
                    <>
                      <ListChecks className="mr-2 h-4 w-4" />
                      Run Screener on These Symbols
                    </>
                  )}
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(['currency', 'exchange_mic', 'market', 'instrument_type'] as const).map((key) => (
                  <div key={key} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{key.replace('_', ' ')}</div>
                    <div className="flex flex-wrap gap-2">
                      {taxonomyRows(discoveryResult.taxonomy, key).map(([value, count]) => (
                        <Badge key={`${key}-${value}`} variant="default">
                          {value} {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {discoveryResult.notes.length ? (
                <div className="space-y-1 text-sm text-gray-500">
                  {discoveryResult.notes.map((note) => (
                    <div key={note}>{note}</div>
                  ))}
                </div>
              ) : null}
              {discoveryResult.symbols.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  No symbols matched this discovery source and filter set. Try a broader market, lower liquidity filters, or screen one of the configured universes below.
                </div>
              ) : null}
              <div className="max-h-[420px] overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Exchange</th>
                      <th className="px-3 py-2">Currency</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Volume</th>
                      <th className="px-3 py-2">Market Cap</th>
                      <th className="px-3 py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {discoveryResult.symbols.map((symbol) => (
                      <tr key={`${symbol.symbol}-${symbol.source_screen ?? symbol.provider_exchange ?? 'source'}`}>
                        <td className="px-3 py-2 font-medium text-gray-900">{symbol.symbol}</td>
                        <td className="px-3 py-2 text-gray-600">{symbol.name ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{symbol.exchange_mic ?? symbol.provider_exchange ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{symbol.currency ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{symbol.instrument_type ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{formatCompactNumber(symbol.volume)}</td>
                        <td className="px-3 py-2 text-gray-600">{formatCompactNumber(symbol.market_cap)}</td>
                        <td className="px-3 py-2 text-gray-600">{symbol.source_screen ?? symbol.source ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {discoveryScreenerMutation.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {discoveryScreenerMutation.error instanceof Error ? discoveryScreenerMutation.error.message : 'Screener run failed.'}
            </div>
          ) : null}

          {discoveryScreenerResult ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Screener Results for Discovered Symbols</h3>
                <Badge variant="default">{discoveryScreenerResult.candidates.length} candidates</Badge>
                <Badge variant="default">{discoveryScreenerResult.totalScreened} screened</Badge>
                {discoveryScreenerResult.benchmarkTicker ? (
                  <Badge variant="default">Benchmark {discoveryScreenerResult.benchmarkTicker}</Badge>
                ) : null}
              </div>
              {discoveryScreenerResult.warnings?.length ? (
                <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {discoveryScreenerResult.warnings.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              ) : null}
              <div className="max-h-[520px] overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Rank</th>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Signal</th>
                      <th className="px-3 py-2 text-right">Close</th>
                      <th className="px-3 py-2 text-right">Score</th>
                      <th className="px-3 py-2 text-right">6M momentum</th>
                      <th className="px-3 py-2 text-right">Rel strength</th>
                      <th className="px-3 py-2 text-right">R:R</th>
                      <th className="px-3 py-2">Fundamentals</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {discoveryScreenerResult.candidates.map((candidate) => (
                      <tr
                        key={candidate.ticker}
                        onClick={() => setDetailTicker(candidate.ticker)}
                        className="cursor-pointer hover:bg-gray-50"
                      >
                        <td className="px-3 py-2 font-medium text-gray-900">#{candidate.priorityRank ?? candidate.rank}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-gray-900">{candidate.ticker}</div>
                          <div className="text-xs text-gray-500">
                            {candidate.name ?? '—'}
                            {candidate.sector ? ` · ${candidate.sector}` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-700">{actionLabel(candidate)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">{formatCurrency(candidate.close, candidate.currency)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">{candidate.score.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">{formatPercent(candidate.momentum6m, 1)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">{formatPercent(candidate.relStrength, 1)}</td>
                        <td className="px-3 py-2 text-right font-mono text-gray-900">{candidate.rr != null ? candidate.rr.toFixed(1) : '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{candidate.fundamentalsCoverageStatus ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card variant="bordered" className="p-3">
          <div className="mb-3 flex items-center gap-2">
            <Database className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Configured Universes</h2>
          </div>
          {catalogQuery.isLoading ? (
            <div className="text-sm text-gray-500">Loading universe catalog…</div>
          ) : catalogQuery.isError ? (
            <div className="text-sm text-red-600">Failed to load universe catalog.</div>
          ) : (
            <div className="space-y-2">
              {universes.map((universe) => {
                const selected = universe.id === selectedUniverseId;
                return (
                  <button
                    key={universe.id}
                    type="button"
                    onClick={() => setSelectedUniverseId(universe.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{universe.description}</div>
                        <div className="mt-1 text-xs text-gray-500">{universe.id}</div>
                      </div>
                      <Badge variant={freshnessVariant(universe.freshness_status)}>
                        {freshnessLabel(universe.freshness_status)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                      <span>{universe.member_count} members</span>
                      <span>{sourceLabel(universe.source)}</span>
                      <span>as of {universe.source_asof}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card variant="bordered" className="p-4">
            {!selectedSummary ? (
              <div className="text-sm text-gray-500">Select a universe to inspect it.</div>
            ) : detailQuery.isLoading ? (
              <div className="text-sm text-gray-500">Loading universe detail…</div>
            ) : detailQuery.isError || !detail ? (
              <div className="text-sm text-red-600">Failed to load universe detail.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{detail.description}</h2>
                    <p className="mt-1 text-sm text-gray-500">{detail.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={freshnessVariant(detail.freshness_status)}>
                      {freshnessLabel(detail.freshness_status)}
                    </Badge>
                    <Badge variant="default">{detail.kind}</Badge>
                    <Badge variant="default">{detail.member_count} members</Badge>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Source</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">{sourceLabel(detail.source)}</div>
                    <div className="mt-1 text-xs text-gray-500">{detail.source_adapter}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Freshness</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">Reviewed {detail.last_reviewed_at}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {detail.days_since_review == null ? 'Unknown age' : `${detail.days_since_review} days ago`}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Source As Of</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">{detail.source_asof}</div>
                    <div className="mt-1 text-xs text-gray-500">Configured benchmark {detail.benchmark}</div>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500">Rules</div>
                    <div className="mt-1 text-sm font-medium text-gray-900">
                      {(detail.rules.currencies ?? []).join(', ') || 'No currency rule'}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {(detail.rules.exchange_mics ?? []).join(', ') || 'Any exchange'}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        <Target className="h-4 w-4 text-gray-500" />
                        Benchmark
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Select the index or ETF used for performance comparison in the screener and chart overlay.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:min-w-[360px] sm:flex-row">
                      <div className="flex-1">
                        <label htmlFor="universe-benchmark" className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                          Benchmark symbol
                        </label>
                        <input
                          id="universe-benchmark"
                          type="text"
                          list="universe-benchmark-options"
                          value={benchmarkDraft}
                          onChange={(event) => setBenchmarkDraft(event.target.value.toUpperCase())}
                          placeholder="SPY"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                        />
                      </div>
                      <Button
                        onClick={() => benchmarkMutation.mutate({ benchmark: benchmarkDraft.trim().toUpperCase() })}
                        disabled={benchmarkMutation.isPending || benchmarkDraft.trim().length === 0}
                        variant="secondary"
                        size="sm"
                        className="self-end"
                      >
                        {benchmarkMutation.isPending ? 'Saving…' : 'Save benchmark'}
                      </Button>
                    </div>
                  </div>
                  <datalist id="universe-benchmark-options">
                    {Array.from(new Set([...BENCHMARK_OPTIONS, ...universes.map((item) => item.benchmark)]))
                      .filter((value) => value && value.trim().length > 0)
                      .map((value) => (
                        <option key={value} value={value} />
                      ))}
                  </datalist>
                  {benchmarkMutation.isError ? (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {benchmarkMutation.error instanceof Error ? benchmarkMutation.error.message : 'Failed to update benchmark.'}
                    </div>
                  ) : null}
                  {benchmarkMutation.data ? (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      Benchmark updated to {benchmarkMutation.data.benchmark}. The catalog and screener will pick it up after refresh.
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {detail.refreshable ? (
                    <>
                      <Button
                        onClick={() => refreshMutation.mutate({ apply: false })}
                        disabled={refreshMutation.isPending}
                        size="sm"
                      >
                        {refreshMutation.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Refreshing…
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Preview Refresh
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => refreshMutation.mutate({ apply: true })}
                        disabled={refreshMutation.isPending}
                        variant="secondary"
                        size="sm"
                      >
                        Apply Refresh
                      </Button>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">This universe is manual-only for now.</div>
                  )}
                </div>

                {refreshMutation.isError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {refreshMutation.error instanceof Error ? refreshMutation.error.message : 'Refresh failed.'}
                  </div>
                ) : null}

                {refreshResult ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      {refreshResult.changed ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                      Refresh Preview
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                      <span>{refreshResult.current_member_count} current</span>
                      <span>{refreshResult.proposed_member_count} proposed</span>
                      <span>{refreshResult.applied ? 'Applied locally' : 'Preview only'}</span>
                    </div>
                    {refreshResult.notes.length ? (
                      <div className="mt-3 space-y-1 text-sm text-gray-600">
                        {refreshResult.notes.map((note) => (
                          <div key={note}>{note}</div>
                        ))}
                      </div>
                    ) : null}
                    {(refreshResult.additions.length || refreshResult.removals.length) ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Additions</div>
                          <div className="flex flex-wrap gap-2">
                            {refreshResult.additions.map((symbol) => (
                              <Badge key={symbol} variant="success">{symbol}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-700">Removals</div>
                          <div className="flex flex-wrap gap-2">
                            {refreshResult.removals.map((symbol) => (
                              <Badge key={symbol} variant="error">{symbol}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {detail.validation_errors.length ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="mb-2 text-sm font-semibold text-red-700">Validation Issues</div>
                    <div className="space-y-1 text-sm text-red-700">
                      {detail.validation_errors.map((error) => (
                        <div key={error}>{error}</div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {detail.source_documents.length ? (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Source Documents</div>
                    <div className="space-y-1">
                      {detail.source_documents.map((document) => (
                        <a
                          key={`${document.label}-${document.url}`}
                          href={document.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-sm text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {document.label}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          {detail ? (
            <Card variant="bordered" className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Constituents</h3>
                <div className="text-xs text-gray-500">{detail.constituents.length} rows</div>
              </div>
              <div className="max-h-[520px] overflow-auto rounded-xl border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Source Name</th>
                      <th className="px-3 py-2">Exchange</th>
                      <th className="px-3 py-2">Currency</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {detail.constituents.map((constituent) => (
                      <tr key={constituent.symbol}>
                        <td className="px-3 py-2 font-medium text-gray-900">{constituent.symbol}</td>
                        <td className="px-3 py-2 text-gray-600">{constituent.source_name ?? constituent.source_symbol ?? constituent.symbol}</td>
                        <td className="px-3 py-2 text-gray-600">{constituent.exchange_mic ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{constituent.currency ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{constituent.instrument_type ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{constituent.status ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {detailTicker ? (
        <WorkspaceSymbolModal ticker={detailTicker} onBack={() => setDetailTicker(null)} />
      ) : null}
    </div>
  );
}
