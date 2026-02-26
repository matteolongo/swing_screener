import { useCallback, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import Badge from '@/components/common/Badge';
import Card from '@/components/common/Card';
import ScreenerForm from '@/components/domain/screener/ScreenerForm';
import ScreenerCandidatesTable from '@/components/domain/screener/ScreenerCandidatesTable';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { useUniverses, useRunScreenerMutation } from '@/features/screener/hooks';
import type { ScreenerCandidate } from '@/features/screener/types';
import { useScreenerStore } from '@/stores/screenerStore';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCreateOrderMutation } from '@/features/portfolio/hooks';
import { t } from '@/i18n/t';
import { useLocalStorage } from '@/hooks';
import { formatDate } from '@/utils/formatters';
import { DEFAULT_CONFIG } from '@/types/config';
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
  const { isBeginnerMode } = useBeginnerModeStore();
  const { lastResult, setLastResult } = useScreenerStore();
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const analysisTab = useWorkspaceStore((state) => state.analysisTab);
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const runScreenerTrigger = useWorkspaceStore((state) => state.runScreenerTrigger);
  const activeStrategyQuery = useActiveStrategyQuery();
  const activeStrategy = activeStrategyQuery.data;
  const strategySignals = activeStrategy?.signals;
  const activeCurrencies = normalizeCurrencies(activeStrategyQuery.data?.universe?.filt?.currencies);
  const riskConfig = activeStrategy?.risk ?? DEFAULT_CONFIG.risk;

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
  const quickCreateOrderMutation = useCreateOrderMutation();
  const screenerMutation = useRunScreenerMutation((data) => {
    setLastResult(data);
    if (data.candidates.length > 0) {
      setSelectedTicker(data.candidates[0].ticker);
    }
  });

  const handleRunScreener = useCallback(() => {
    screenerMutation.mutate({
      universe: selectedUniverse,
      top: topN,
      minPrice,
      maxPrice,
      currencies: currencyFilterToRequest(currencyFilter),
      breakoutLookback: strategySignals?.breakoutLookback ?? DEFAULT_CONFIG.indicators.breakoutLookback,
      pullbackMa: strategySignals?.pullbackMa ?? DEFAULT_CONFIG.indicators.pullbackMa,
      minHistory: strategySignals?.minHistory ?? DEFAULT_CONFIG.indicators.minHistory,
    });
  }, [
    screenerMutation.mutate,
    selectedUniverse,
    topN,
    minPrice,
    maxPrice,
    currencyFilter,
    strategySignals?.breakoutLookback,
    strategySignals?.pullbackMa,
    strategySignals?.minHistory,
  ]);

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

  useEffect(() => {
    if (runScreenerTrigger > 0) {
      handleRunScreener();
    }
  }, [handleRunScreener, runScreenerTrigger]);

  const handleSelectCandidate = useCallback((ticker: string, tab: 'overview' | 'sentiment' | 'order') => {
    setSelectedTicker(ticker);
    setAnalysisTab(tab);
  }, [setAnalysisTab, setSelectedTicker]);

  const handleCreateOrder = useCallback(
    (candidate: ScreenerCandidate) => {
      handleSelectCandidate(candidate.ticker, 'order');

      if (quickCreateOrderMutation.isPending || candidate.recommendation?.verdict === 'NOT_RECOMMENDED') {
        return;
      }

      const entry = candidate.recommendation?.risk?.entry ?? candidate.entry ?? candidate.close;
      if (typeof entry !== 'number' || !Number.isFinite(entry) || entry <= 0) {
        return;
      }

      const atr = Number.isFinite(candidate.atr) && candidate.atr > 0 ? candidate.atr : entry * 0.03;
      const fallbackStop = Math.max(0.01, entry - atr);
      const stopCandidate = candidate.recommendation?.risk?.stop ?? candidate.stop ?? fallbackStop;
      const stop =
        Number.isFinite(stopCandidate) && stopCandidate > 0 && stopCandidate < entry
          ? stopCandidate
          : Math.max(0.01, entry - Math.max(atr * 0.5, entry * 0.01));
      const shares = candidate.recommendation?.risk?.shares ?? candidate.shares ?? riskConfig.minShares ?? 1;
      const quantity = Number.isFinite(shares) && shares > 0 ? Math.max(1, Math.round(shares)) : 1;

      quickCreateOrderMutation.mutate({
        ticker: candidate.ticker,
        orderType: 'BUY_LIMIT',
        quantity,
        limitPrice: parseFloat(entry.toFixed(2)),
        stopPrice: parseFloat(stop.toFixed(2)),
        orderKind: 'entry',
        notes: t('screener.defaultNotes', {
          score: (candidate.score * 100).toFixed(1),
          rank: candidate.rank,
        }),
      });
    },
    [handleSelectCandidate, quickCreateOrderMutation, riskConfig.minShares],
  );

  const handleTradeThesisAction = useCallback((candidate: ScreenerCandidate) => {
    handleSelectCandidate(candidate.ticker, 'order');
  }, [handleSelectCandidate]);

  return (
    <Card variant="bordered" className="h-full p-4 md:p-5 flex flex-col gap-3 overflow-hidden">
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
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs md:text-sm text-red-800">
            {t('screener.error.prefix')}:{' '}
            {screenerMutation.error instanceof Error
              ? screenerMutation.error.message
              : t('screener.error.unknown')}
          </p>
        </div>
      ) : null}
      {quickCreateOrderMutation.isError ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs md:text-sm text-red-800">
            {t('screener.error.prefix')}:{' '}
            {quickCreateOrderMutation.error instanceof Error
              ? quickCreateOrderMutation.error.message
              : t('screener.error.unknown')}
          </p>
        </div>
      ) : null}

      {!screenerMutation.isPending && !result ? (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-xs md:text-sm text-blue-800">
            <strong>{t('screener.info.noteTitle')}</strong> {t('screener.info.noteBody')}
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-lg border border-gray-200 bg-white p-3 flex-1 min-h-0 flex flex-col gap-3">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
              {t('workspacePage.panels.screener.resultSummary', {
                shown: candidates.length,
                total: allCandidates.length,
                screened: result.totalScreened,
              })}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span>
                {t('workspacePage.panels.screener.asOf', {
                  date: formatDate(result.asofDate),
                })}
              </span>
              <Badge variant={result.dataFreshness === 'intraday' ? 'warning' : 'success'}>
                {result.dataFreshness === 'intraday'
                  ? t('workspacePage.panels.screener.freshness.intraday')
                  : t('workspacePage.panels.screener.freshness.finalClose')}
              </Badge>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
            <ScreenerCandidatesTable
              candidates={candidates}
              selectedTicker={selectedTicker}
              onRowClick={(candidate) =>
                handleSelectCandidate(candidate.ticker, analysisTab === 'sentiment' ? 'sentiment' : 'overview')
              }
              onCreateOrder={handleCreateOrder}
              onRecommendationDetails={(candidate) => handleSelectCandidate(candidate.ticker, 'overview')}
              onSocialAnalysis={(ticker) => handleSelectCandidate(ticker, 'sentiment')}
              onTradeThesis={handleTradeThesisAction}
              disableCreateOrder={quickCreateOrderMutation.isPending}
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
