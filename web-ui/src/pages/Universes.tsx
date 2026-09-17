import { useCallback, useEffect, useMemo, useState } from 'react';

import ModalShell from '@/components/common/ModalShell';
import Card from '@/components/common/Card';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import SymbolAnalysisContent from '@/components/domain/workspace/SymbolAnalysisContent';
import type { WorkspaceAnalysisTab } from '@/components/domain/workspace/types';
import UniverseListSidebar from '@/components/domain/universes/UniverseListSidebar';
import UniverseConfigTab from '@/components/domain/universes/UniverseConfigTab';
import UniverseConstituentsTab from '@/components/domain/universes/UniverseConstituentsTab';
import UniverseDiscoveryTab from '@/components/domain/universes/UniverseDiscoveryTab';
import UniverseScreenerTab from '@/components/domain/universes/UniverseScreenerTab';
import PoolTab from '@/components/domain/universes/PoolTab';
import ScreenerForm from '@/components/domain/screener/ScreenerForm';
import { currencyFilterToRequest, ScreenerRunningPanel } from '@/components/domain/workspace/ScreenerInboxPanel';
import {
  CURRENCY_PRESETS,
  DETAIL_TABS,
  MARKET_PRESETS,
  TYPE_PRESETS,
  YAHOO_SUPPORTED_MICS,
  type DetailTab,
} from '@/components/domain/universes/universesShared';
import { useRefreshUniverseMutation, useSymbolDiscoveryMutation, useUniverseCatalog, useUniverseDetail, useUpdateUniverseBenchmarkMutation } from '@/features/universes/hooks';
import type { SymbolDiscoveryRequest } from '@/features/universes/types';
import { useRunScreenerMutation } from '@/features/screener/hooks';
import type { ScreenerCandidate } from '@/features/screener/types';
import type { DecisionActionFilter } from '@/features/screener/prioritization';
import type { TaxonomyFilterValues } from '@/features/pool/types';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { useConfigDefaultsQuery } from '@/features/config/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { useLocalStorage } from '@/hooks';
import { useOpenPositions } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

function UniverseSymbolModal({ candidate, onBack }: { candidate: ScreenerCandidate; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<WorkspaceAnalysisTab>('overview');
  const ticker = candidate.ticker;
  const openPositionsQuery = useOpenPositions();
  const openPosition =
    openPositionsQuery.data?.find((p) => p.ticker.toUpperCase() === ticker.toUpperCase()) ?? null;

  return (
    <ModalShell title={t('workspacePage.symbolDetails.title', { ticker })} onClose={onBack} className="max-w-5xl" closeOnBackdrop={false}>
      <SymbolAnalysisContent
        ticker={ticker}
        candidate={candidate}
        position={openPosition}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        orderPanel={<ActionPanel ticker={ticker} candidate={candidate} />}
      />
    </ModalShell>
  );
}

type CurrencyFilter = 'all' | 'usd' | 'eur';
type ExchangeFilter = 'all' | 'us_primary' | 'europe_primary' | 'xams' | 'xetr' | 'xpar' | 'xmil' | 'xmad';

const TOP_N_MAX = 200;
const DECISION_ACTION_FILTERS: DecisionActionFilter[] = [
  'all',
  'BUY_NOW',
  'BUY_ON_PULLBACK',
  'WAIT_FOR_BREAKOUT',
  'WATCH',
  'TACTICAL_ONLY',
  'AVOID',
  'MANAGE_ONLY',
];

const exchangeFilterToRequest = (value: ExchangeFilter): string[] | undefined => {
  switch (value) {
    case 'us_primary':
      return ['XNYS', 'XNAS', 'ARCX'];
    case 'europe_primary':
      return ['XAMS', 'XETR', 'XPAR', 'XMIL', 'XMAD'];
    case 'xams':
      return ['XAMS'];
    case 'xetr':
      return ['XETR'];
    case 'xpar':
      return ['XPAR'];
    case 'xmil':
      return ['XMIL'];
    case 'xmad':
      return ['XMAD'];
    default:
      return undefined;
  }
};

// Home of the full-universe screener run flow: the shared run form plus the
// running indicator. Completing a run feeds the pinned/last-run store that
// powers Today, so Today itself needs no run entry point. Candidate tables and
// symbol selection stay where they are (discovery/screener tabs, Today queue).
function ScreenerRunSection() {
  const recordScreenerRun = useScreenerStore((state) => state.recordScreenerRun);
  const setTodayRunFromLastRun = useScreenerStore((state) => state.setTodayRunFromLastRun);
  const todayRun = useScreenerStore((state) => state.todayRun);
  const lastRunContext = useScreenerStore((state) => state.lastRunContext);
  const activeStrategyQuery = useActiveStrategyQuery();
  const configDefaultsQuery = useConfigDefaultsQuery();
  const activeStrategy = activeStrategyQuery.data;
  const strategySignals = activeStrategy?.signals;
  const defaultIndicators = configDefaultsQuery.data?.indicators;

  const riskConfig = activeStrategy?.risk ?? configDefaultsQuery.data?.risk;

  const [taxonomyFilter, setTaxonomyFilter] = useLocalStorage<TaxonomyFilterValues>(
    'screener.taxonomyFilter',
    {},
    (value: unknown) => (value && typeof value === 'object' ? (value as TaxonomyFilterValues) : {})
  );
  const [presetId, setPresetId] = useLocalStorage<string | null>(
    'screener.presetId',
    'broad_market',
    (value: unknown) => (typeof value === 'string' ? value : null)
  );
  const [topN, setTopN] = useLocalStorage('screener.topN', 20, (val: unknown) => {
    const parsed = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (Number.isNaN(parsed)) return 20;
    return Math.min(Math.max(parsed, 1), TOP_N_MAX);
  });
  const [minPrice, setMinPrice] = useLocalStorage('screener.minPrice', 5);
  const [maxPrice, setMaxPrice] = useLocalStorage('screener.maxPrice', 500);
  const [currencyFilter, setCurrencyFilter] = useLocalStorage<CurrencyFilter>(
    'screener.currencyFilter',
    'all',
    (val: unknown) => {
      if (val === 'usd' || val === 'eur' || val === 'all') return val;
      return 'all';
    }
  );
  const [exchangeFilter, setExchangeFilter] = useLocalStorage<ExchangeFilter>(
    'screener.exchangeFilter',
    'all',
    (val: unknown) => {
      if (val === 'all' || val === 'us_primary' || val === 'europe_primary' || val === 'xams' || val === 'xetr' || val === 'xpar' || val === 'xmil' || val === 'xmad') {
        return val;
      }
      return 'all';
    }
  );
  const [includeOtc, setIncludeOtc] = useLocalStorage('screener.includeOtc', false);
  const [recommendedOnly, setRecommendedOnly] = useLocalStorage('screener.recommendedOnly', false);
  const [requireWeeklyUptrend, setRequireWeeklyUptrend] = useLocalStorage('screener.requireWeeklyUptrend', false);
  const [actionFilter, setActionFilter] = useLocalStorage<DecisionActionFilter>(
    'screener.actionFilter',
    'all',
    (val: unknown) => {
      if (typeof val === 'string' && DECISION_ACTION_FILTERS.includes(val as DecisionActionFilter)) {
        return val as DecisionActionFilter;
      }
      return 'all';
    }
  );
  const [isFormCollapsed, setIsFormCollapsed] = useLocalStorage('screener-form-collapsed', true);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [useForToday, setUseForToday] = useLocalStorage('screener.useForToday', true);

  const screenerMutation = useRunScreenerMutation((data, request) => {
    recordScreenerRun(
      data,
      {
        request,
        displayFilters: { recommendedOnly, actionFilter },
      },
      useForToday,
    );
    setIsFormCollapsed(true);
    setForceRefresh(false);
  });

  const handleRunScreener = useCallback(() => {
    const request = {
      taxonomyFilter,
      preset: presetId ?? undefined,
      top: topN,
      minPrice,
      maxPrice,
      currencies: currencyFilterToRequest(currencyFilter),
      exchangeMics: exchangeFilterToRequest(exchangeFilter),
      includeOtc,
      requireWeeklyUptrend: requireWeeklyUptrend || undefined,
      breakoutLookback: strategySignals?.breakoutLookback ?? defaultIndicators?.breakoutLookback ?? 50,
      pullbackMa: strategySignals?.pullbackMa ?? defaultIndicators?.pullbackMa ?? 20,
      minHistory: strategySignals?.minHistory ?? defaultIndicators?.minHistory ?? 260,
      forceRefresh: forceRefresh || undefined,
    };
    screenerMutation.mutate(request);
  }, [
    defaultIndicators?.breakoutLookback,
    defaultIndicators?.minHistory,
    defaultIndicators?.pullbackMa,
    screenerMutation.mutate,
    taxonomyFilter,
    presetId,
    topN,
    minPrice,
    maxPrice,
    currencyFilter,
    exchangeFilter,
    includeOtc,
    requireWeeklyUptrend,
    forceRefresh,
    strategySignals?.breakoutLookback,
    strategySignals?.pullbackMa,
    strategySignals?.minHistory,
  ]);

  const isLastRunTodaySource = Boolean(
    todayRun &&
      lastRunContext &&
      todayRun.completedAt === lastRunContext.completedAt,
  );

  return (
    <Card variant="bordered" className="p-4">
      <section aria-label={t('universesPage.screenerRun.title')} data-testid="screener-run-section" className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('universesPage.screenerRun.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('universesPage.screenerRun.description')}</p>
        </div>
        {riskConfig ? (
          <ScreenerForm
            taxonomyFilter={taxonomyFilter}
            setTaxonomyFilter={setTaxonomyFilter}
            presetId={presetId}
            setPresetId={setPresetId}
            topN={topN}
            setTopN={setTopN}
            minPrice={minPrice}
            setMinPrice={setMinPrice}
            maxPrice={maxPrice}
            setMaxPrice={setMaxPrice}
            currencyFilter={currencyFilter}
            setCurrencyFilter={setCurrencyFilter}
            exchangeFilter={exchangeFilter}
            setExchangeFilter={setExchangeFilter}
            includeOtc={includeOtc}
            setIncludeOtc={setIncludeOtc}
            recommendedOnly={recommendedOnly}
            setRecommendedOnly={setRecommendedOnly}
            requireWeeklyUptrend={requireWeeklyUptrend}
            setRequireWeeklyUptrend={setRequireWeeklyUptrend}
            actionFilter={actionFilter}
            setActionFilter={setActionFilter}
            isLoading={screenerMutation.isPending}
            onRun={handleRunScreener}
            isCollapsed={isFormCollapsed}
            onToggleCollapsed={() => setIsFormCollapsed(!isFormCollapsed)}
            forceRefresh={forceRefresh}
            setForceRefresh={setForceRefresh}
            useForToday={useForToday}
            setUseForToday={setUseForToday}
          />
        ) : (
          <div className="text-sm text-muted">{t('common.table.loading')}</div>
        )}

        {screenerMutation.isPending && <ScreenerRunningPanel />}

        {screenerMutation.isError ? (
          <div className="p-3 bg-danger/10 border border-danger/40 rounded-lg">
            <p className="text-xs md:text-sm text-danger">
              {t('screener.error.prefix')}:{' '}
              {screenerMutation.error instanceof Error
                ? screenerMutation.error.message
                : t('screener.error.unknown')}
            </p>
          </div>
        ) : null}

        {!isLastRunTodaySource && lastRunContext ? (
          <div className="flex items-center justify-between gap-3 rounded border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
            <span>{t('screener.summary.notTodaySource')}</span>
            <button
              type="button"
              onClick={setTodayRunFromLastRun}
              className="shrink-0 font-medium underline underline-offset-2 hover:text-foreground"
            >
              {t('screener.summary.useForToday')}
            </button>
          </div>
        ) : null}
      </section>
    </Card>
  );
}

export default function Universes() {
  const catalogQuery = useUniverseCatalog();
  const universes = catalogQuery.data?.universes ?? [];
  const [selectedUniverseId, setSelectedUniverseId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('config');
  const [discoveryProvider, setDiscoveryProvider] = useState<SymbolDiscoveryRequest['provider']>('yahoo_predefined');
  const [selectedScreens, setSelectedScreens] = useState<string[]>(['most_actives', 'day_gainers', 'day_losers']);
  const [marketPreset, setMarketPreset] = useState<(typeof MARKET_PRESETS)[number]['value']>('us_major');
  const [currencyPreset, setCurrencyPreset] = useState<(typeof CURRENCY_PRESETS)[number]['value']>('preset');
  const [typePreset, setTypePreset] = useState<(typeof TYPE_PRESETS)[number]['value']>('EQUITY');
  const [discoveryLimit, setDiscoveryLimit] = useState(50);
  const [discoveryMinVolume, setDiscoveryMinVolume] = useState(1_000_000);
  const [discoveryMinMarketCap, setDiscoveryMinMarketCap] = useState(0);
  const [screenerTop, setScreenerTop] = useState(20);
  const [detailCandidate, setDetailCandidate] = useState<ScreenerCandidate | null>(null);

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

  const handleMarketPresetChange = (nextMarket: (typeof MARKET_PRESETS)[number]['value']) => {
    setMarketPreset(nextMarket);
    if (nextMarket === 'us_major') {
      setDiscoveryProvider('yahoo_predefined');
    }
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

  const handleRunScreener = () => {
    runScreenerForDiscovery();
    setActiveDetailTab('screener');
  };

  return (
    <div className="mx-auto max-w-[1680px] px-4 py-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground">{t('universesPage.title')}</h1>
        <p className="mt-1 text-sm text-muted">
          {t('universesPage.subtitle')}
        </p>
      </div>

      <div className="mb-4">
        <ScreenerRunSection />
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <UniverseListSidebar
          universes={universes}
          selectedUniverseId={selectedUniverseId}
          isLoading={catalogQuery.isLoading}
          isError={catalogQuery.isError}
          onSelect={setSelectedUniverseId}
        />

        {/* Tabbed detail panel */}
        <div>
          <div className="flex border-b border-border mb-4">
            {DETAIL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveDetailTab(tab.id)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-colors',
                  activeDetailTab === tab.id
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeDetailTab === 'config' && (
            <UniverseConfigTab
              universes={universes}
              selectedSummary={selectedSummary}
              detail={detail}
              detailLoading={detailQuery.isLoading}
              detailError={detailQuery.isError}
              benchmarkDraft={benchmarkDraft}
              onBenchmarkDraftChange={setBenchmarkDraft}
              benchmarkMutation={benchmarkMutation}
              refreshMutation={refreshMutation}
            />
          )}

          {activeDetailTab === 'constituents' && (
            <UniverseConstituentsTab detail={detail} />
          )}

          {activeDetailTab === 'discovery' && (
            <UniverseDiscoveryTab
              discoveryProvider={discoveryProvider}
              onProviderChange={setDiscoveryProvider}
              marketPreset={marketPreset}
              onMarketPresetChange={handleMarketPresetChange}
              currencyPreset={currencyPreset}
              onCurrencyPresetChange={setCurrencyPreset}
              typePreset={typePreset}
              onTypePresetChange={setTypePreset}
              discoveryMinVolume={discoveryMinVolume}
              onMinVolumeChange={setDiscoveryMinVolume}
              discoveryMinMarketCap={discoveryMinMarketCap}
              onMinMarketCapChange={setDiscoveryMinMarketCap}
              discoveryLimit={discoveryLimit}
              onLimitChange={setDiscoveryLimit}
              screenerTop={screenerTop}
              onScreenerTopChange={setScreenerTop}
              selectedScreens={selectedScreens}
              onToggleScreen={toggleScreen}
              selectedMarket={selectedMarket}
              yahooUsesCustomScreener={yahooUsesCustomScreener}
              eodhdNeedsKey={eodhdNeedsKey}
              discoveryMutation={discoveryMutation}
              discoveryScreenerMutation={discoveryScreenerMutation}
              onDiscover={runDiscovery}
              onRunScreener={handleRunScreener}
            />
          )}

          {activeDetailTab === 'screener' && (
            <UniverseScreenerTab
              discoveryScreenerMutation={discoveryScreenerMutation}
              onSelectCandidate={setDetailCandidate}
            />
          )}

          {activeDetailTab === 'pool' && <PoolTab />}
        </div>
      </div>

      {detailCandidate ? (
        <UniverseSymbolModal candidate={detailCandidate} onBack={() => setDetailCandidate(null)} />
      ) : null}
    </div>
  );
}
