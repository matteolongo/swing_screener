import { useCallback, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import Badge from '@/components/common/Badge';
import Card from '@/components/common/Card';
import ScreenerForm from '@/components/domain/screener/ScreenerForm';
import ScreenerCandidatesTable from '@/components/domain/screener/ScreenerCandidatesTable';
import { useConfigDefaultsQuery } from '@/features/config/hooks';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { useUniverses, useRunScreenerMutation } from '@/features/screener/hooks';
import type { ScreenerCandidate } from '@/features/screener/types';
import { useScreenerStore } from '@/stores/screenerStore';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { WorkspaceAnalysisTab } from '@/stores/workspaceStore';
import { t } from '@/i18n/t';
import { useLocalStorage } from '@/hooks';
import { formatDate } from '@/utils/formatters';
import {
  migrateLegacyScreenerStorage,
  parseUniverseValue,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage';
import type { SymbolIntelligenceStatus } from '@/features/intelligence/useSymbolIntelligenceRunner';

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
const ANALYSIS_CANVAS_ID = 'workspace-analysis-canvas';
const MOBILE_LAYOUT_MEDIA_QUERY = '(max-width: 1279px)';

interface ScreenerInboxPanelProps {
  onRunSymbolIntelligence?: (ticker: string) => void;
  getSymbolIntelligenceStatus?: (ticker: string) => SymbolIntelligenceStatus | undefined;
}

export default function ScreenerInboxPanel({
  onRunSymbolIntelligence,
  getSymbolIntelligenceStatus,
}: ScreenerInboxPanelProps) {
  const { isBeginnerMode } = useBeginnerModeStore();
  const { lastResult, setLastResult } = useScreenerStore();
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const selectedTickerSource = useWorkspaceStore((state) => state.selectedTickerSource);
  const analysisTab = useWorkspaceStore((state) => state.analysisTab);
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const runScreenerTrigger = useWorkspaceStore((state) => state.runScreenerTrigger);
  const activeStrategyQuery = useActiveStrategyQuery();
  const configDefaultsQuery = useConfigDefaultsQuery();
  const activeStrategy = activeStrategyQuery.data;
  const strategySignals = activeStrategy?.signals;
  const defaultIndicators = configDefaultsQuery.data?.indicators;
  const activeCurrencies = normalizeCurrencies(activeStrategyQuery.data?.universe?.filt?.currencies);
  const riskConfig = activeStrategy?.risk ?? configDefaultsQuery.data?.risk;

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
      setSelectedTicker(data.candidates[0].ticker, 'screener');
    }
  });

  const handleRunScreener = useCallback(() => {
    screenerMutation.mutate({
      universe: selectedUniverse,
      top: topN,
      minPrice,
      maxPrice,
      currencies: currencyFilterToRequest(currencyFilter),
      breakoutLookback: strategySignals?.breakoutLookback ?? defaultIndicators?.breakoutLookback ?? 50,
      pullbackMa: strategySignals?.pullbackMa ?? defaultIndicators?.pullbackMa ?? 20,
      minHistory: strategySignals?.minHistory ?? defaultIndicators?.minHistory ?? 260,
    });
  }, [
    defaultIndicators?.breakoutLookback,
    defaultIndicators?.minHistory,
    defaultIndicators?.pullbackMa,
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
    if (!candidates.length || !selectedTicker || selectedTickerSource === 'portfolio') {
      return;
    }
    const stillPresent = candidates.some((candidate) => candidate.ticker.toUpperCase() === selectedTicker.toUpperCase());
    if (!stillPresent) {
      setSelectedTicker(candidates[0].ticker, 'screener');
    }
  }, [candidates, selectedTicker, selectedTickerSource, setSelectedTicker]);

  useEffect(() => {
    if (runScreenerTrigger > 0) {
      handleRunScreener();
    }
  }, [handleRunScreener, runScreenerTrigger]);

  const scrollAnalysisCanvasIntoView = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    if (!window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY).matches) {
      return;
    }
    document.getElementById(ANALYSIS_CANVAS_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleSelectCandidate = useCallback(
    (ticker: string, tab: WorkspaceAnalysisTab) => {
      setSelectedTicker(ticker);
      setAnalysisTab(tab);
      scrollAnalysisCanvasIntoView();
    },
    [scrollAnalysisCanvasIntoView, setAnalysisTab, setSelectedTicker]
  );

  const handleTradeThesisAction = useCallback((candidate: ScreenerCandidate) => {
    handleSelectCandidate(candidate.ticker, 'order');
  }, [handleSelectCandidate]);

  if (!riskConfig) {
    const configFailed = configDefaultsQuery.isError && !activeStrategy?.risk;
    return (
      <Card variant="bordered" className="p-4 md:p-5">
        <div className={`text-sm ${configFailed ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
          {configFailed ? t('common.errors.generic') : t('common.table.loading')}
        </div>
      </Card>
    );
  }

  return (
    <Card variant="bordered" className="p-4 md:p-5 flex min-h-0 flex-col gap-3 xl:h-full xl:overflow-hidden">
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
          {result.sameSymbolSuppressedCount || result.sameSymbolAddOnCount ? (
            <div className="flex flex-wrap gap-2 text-xs">
              {result.sameSymbolSuppressedCount ? (
                <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  {t('screener.summary.sameSymbolSuppressed', {
                    count: result.sameSymbolSuppressedCount,
                    suffix: result.sameSymbolSuppressedCount === 1 ? '' : 's',
                  })}
                </div>
              ) : null}
              {result.sameSymbolAddOnCount ? (
                <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  {t('screener.summary.sameSymbolAddOns', {
                    count: result.sameSymbolAddOnCount,
                    suffix: result.sameSymbolAddOnCount === 1 ? '' : 's',
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex-1 min-h-0 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
            <ScreenerCandidatesTable
              candidates={candidates}
              selectedTicker={selectedTicker}
              onSymbolClick={(ticker) => handleSelectCandidate(ticker, 'overview')}
              onRowClick={(candidate) =>
                handleSelectCandidate(candidate.ticker, analysisTab === 'sentiment' ? 'sentiment' : 'overview')
              }
              onCreateOrder={(candidate) => handleSelectCandidate(candidate.ticker, 'order')}
              onRecommendationDetails={(candidate) => handleSelectCandidate(candidate.ticker, 'overview')}
              onSocialAnalysis={(ticker) => handleSelectCandidate(ticker, 'sentiment')}
              onTradeThesis={handleTradeThesisAction}
              onRunIntelligence={(ticker) => onRunSymbolIntelligence?.(ticker)}
              getSymbolIntelligenceStatus={getSymbolIntelligenceStatus}
            />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
