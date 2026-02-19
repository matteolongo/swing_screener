import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import Card from '@/components/common/Card';
import ScreenerForm from '@/components/domain/screener/ScreenerForm';
import ScreenerCandidatesTable from '@/components/domain/screener/ScreenerCandidatesTable';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { useUniverses, useRunScreenerMutation } from '@/features/screener/hooks';
import { useConfigStore } from '@/stores/configStore';
import { useScreenerStore } from '@/stores/screenerStore';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';
import { useLocalStorage } from '@/hooks';
import {
  migrateLegacyScreenerStorage,
  parseUniverseValue,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage';

const TOP_N_MAX = 200;

type CurrencyFilter = 'all' | 'usd' | 'eur';

const normalizeCurrencies = (currencies?: string[]): ('USD' | 'EUR')[] => {
  const normalized = (currencies ?? [])
    .map((value) => value.toUpperCase())
    .filter((value): value is 'USD' | 'EUR' => value === 'USD' || value === 'EUR');
  return normalized.length ? Array.from(new Set(normalized)) : ['USD', 'EUR'];
};

const currencyFilterToRequest = (value: CurrencyFilter): string[] => {
  if (value === 'usd') return ['USD'];
  if (value === 'eur') return ['EUR'];
  return ['USD', 'EUR'];
};

export default function ScreenerInboxPanel() {
  const { config } = useConfigStore();
  const { isBeginnerMode } = useBeginnerModeStore();
  const { lastResult, setLastResult } = useScreenerStore();
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);
  const activeStrategyQuery = useActiveStrategyQuery();
  const activeCurrencies = normalizeCurrencies(activeStrategyQuery.data?.universe?.filt?.currencies);
  const riskConfig = activeStrategyQuery.data?.risk ?? config.risk;

  useEffect(() => {
    migrateLegacyScreenerStorage(localStorage);
  }, []);

  const [selectedUniverse, setSelectedUniverse] = useLocalStorage(
    SCREENER_UNIVERSE_STORAGE_KEY,
    'usd_all',
    (value: unknown) => parseUniverseValue(value) ?? 'usd_all'
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
  const [recommendedOnly, setRecommendedOnly] = useLocalStorage('screener.recommendedOnly', false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useLocalStorage(
    'screener.showAdvancedFilters',
    !isBeginnerMode
  );

  const universesQuery = useUniverses();
  const screenerMutation = useRunScreenerMutation((data) => {
    setLastResult(data);
    if (data.candidates.length > 0) {
      setSelectedTicker(data.candidates[0].ticker);
    }
  });

  const handleRunScreener = () => {
    screenerMutation.mutate({
      universe: selectedUniverse,
      top: topN,
      minPrice,
      maxPrice,
      currencies: currencyFilterToRequest(currencyFilter),
      breakoutLookback: config.indicators.breakoutLookback,
      pullbackMa: config.indicators.pullbackMa,
      minHistory: config.indicators.minHistory,
    });
  };

  const result = screenerMutation.data ?? lastResult;
  const allCandidates = result?.candidates ?? [];
  const candidates = recommendedOnly
    ? allCandidates.filter((candidate) => candidate.recommendation?.verdict === 'RECOMMENDED')
    : allCandidates;

  useEffect(() => {
    if (!candidates.length || !selectedTicker) {
      return;
    }
    const stillPresent = candidates.some((candidate) => candidate.ticker.toUpperCase() === selectedTicker.toUpperCase());
    if (!stillPresent) {
      setSelectedTicker(candidates[0].ticker);
    }
  }, [candidates, selectedTicker, setSelectedTicker]);

  return (
    <Card variant="bordered" className="h-full flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{t('workspacePage.panels.screener.title')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('workspacePage.panels.screener.description')}
        </p>
      </div>

      <ScreenerForm
        isBeginnerMode={isBeginnerMode}
        selectedUniverse={selectedUniverse}
        setSelectedUniverse={setSelectedUniverse}
        topN={topN}
        setTopN={setTopN}
        minPrice={minPrice}
        setMinPrice={setMinPrice}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        currencyFilter={currencyFilter}
        setCurrencyFilter={setCurrencyFilter}
        recommendedOnly={recommendedOnly}
        setRecommendedOnly={setRecommendedOnly}
        showAdvancedFilters={showAdvancedFilters}
        setShowAdvancedFilters={setShowAdvancedFilters}
        universes={universesQuery.data?.universes ?? []}
        isLoading={screenerMutation.isPending}
        accountSize={riskConfig.accountSize}
        riskPct={riskConfig.riskPct}
        activeCurrencies={activeCurrencies}
        onRun={handleRunScreener}
      />

      {screenerMutation.isError ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            {t('screener.error.prefix')}:{' '}
            {screenerMutation.error instanceof Error
              ? screenerMutation.error.message
              : t('screener.error.unknown')}
          </p>
        </div>
      ) : null}

      {!screenerMutation.isPending && !result ? (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>{t('screener.info.noteTitle')}</strong> {t('screener.info.noteBody')}
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="space-y-3">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t('workspacePage.panels.screener.resultSummary', {
              shown: candidates.length,
              total: allCandidates.length,
              screened: result.totalScreened,
            })}
          </div>
          <div className="overflow-x-auto">
            <ScreenerCandidatesTable
              candidates={candidates}
              selectedTicker={selectedTicker}
              onRowClick={(candidate) => setSelectedTicker(candidate.ticker)}
              onCreateOrder={(candidate) => setSelectedTicker(candidate.ticker)}
              onRecommendationDetails={(candidate) => setSelectedTicker(candidate.ticker)}
              onSocialAnalysis={(ticker) => setSelectedTicker(ticker)}
              onTradeThesis={(candidate) => setSelectedTicker(candidate.ticker)}
              onQuickBacktest={(candidate) => setSelectedTicker(candidate.ticker)}
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
