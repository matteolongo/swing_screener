import { useEffect, useMemo, useState } from 'react';

import ModalShell from '@/components/common/ModalShell';
import ActionPanel from '@/components/domain/workspace/ActionPanel';
import SymbolAnalysisContent from '@/components/domain/workspace/SymbolAnalysisContent';
import type { WorkspaceAnalysisTab } from '@/components/domain/workspace/types';
import UniverseListSidebar from '@/components/domain/universes/UniverseListSidebar';
import UniverseConfigTab from '@/components/domain/universes/UniverseConfigTab';
import UniverseConstituentsTab from '@/components/domain/universes/UniverseConstituentsTab';
import UniverseDiscoveryTab from '@/components/domain/universes/UniverseDiscoveryTab';
import UniverseScreenerTab from '@/components/domain/universes/UniverseScreenerTab';
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
import { useOpenPositions } from '@/features/portfolio/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

function UniverseSymbolModal({ ticker, onBack }: { ticker: string; onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<WorkspaceAnalysisTab>('overview');
  const candidate = useScreenerStore((state) =>
    state.lastResult?.candidates.find((c) => c.ticker.toUpperCase() === ticker.toUpperCase())
  );
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
        orderPanel={<ActionPanel ticker={ticker} />}
      />
    </ModalShell>
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
        <h1 className="text-2xl font-bold text-foreground">Universe Management</h1>
        <p className="mt-1 text-sm text-muted">
          Review source coverage, freshness, validation, and refresh official universes without editing snapshots by hand.
        </p>
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
              onSelectTicker={setDetailTicker}
            />
          )}
        </div>
      </div>

      {detailTicker ? (
        <UniverseSymbolModal ticker={detailTicker} onBack={() => setDetailTicker(null)} />
      ) : null}
    </div>
  );
}
