import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Badge from '@/components/common/Badge';
import Card from '@/components/common/Card';
import ScreenerForm from '@/components/domain/screener/ScreenerForm';
import ScreenerCandidatesTable from '@/components/domain/screener/ScreenerCandidatesTable';
import ScreenerCandidateReviewList from '@/components/domain/screener/ScreenerCandidateReviewList';
import BeginnerScreenerSummary from '@/components/domain/screener/BeginnerScreenerSummary';
import { useConfigDefaultsQuery } from '@/features/config/hooks';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { useUniverses, useRunScreenerMutation } from '@/features/screener/hooks';
import { filterCandidates, filterOutAddOns, prioritizeCandidates, type DecisionActionFilter } from '@/features/screener/prioritization';
import OpenPositionIntelligencePanel from '@/components/domain/positions/OpenPositionIntelligencePanel';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { WorkspaceAnalysisTab } from '@/components/domain/workspace/types';
import { t } from '@/i18n/t';
import { useLocalStorage } from '@/hooks';
import { formatDate } from '@/utils/formatters';
import {
  parseUniverseValue,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage';

const TOP_N_MAX = 200;

type CurrencyFilter = 'all' | 'usd' | 'eur';
type ExchangeFilter = 'all' | 'us_primary' | 'europe_primary' | 'xams' | 'xetr' | 'xpar' | 'xmil' | 'xmad';
type InstrumentFilter = 'all' | 'equity' | 'etf';
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


export const currencyFilterToRequest = (value: CurrencyFilter): string[] | undefined => {
  if (value === 'usd') return ['USD'];
  if (value === 'eur') return ['EUR'];
  return undefined;
};

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

const instrumentFilterToRequest = (value: InstrumentFilter): Array<'equity' | 'etf'> | undefined => {
  if (value === 'all') return undefined;
  return [value];
};

const RUNNING_STEPS = [
  'screener.running.steps.preparingUniverse',
  'screener.running.steps.downloadingPrices',
  'screener.running.steps.scoringSetups',
  'screener.running.steps.applyingRisk',
  'screener.running.steps.buildingPlans',
] as const;

export function ScreenerRunningPanel() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => Math.min(prev + 1, RUNNING_STEPS.length - 1));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-2">
      {RUNNING_STEPS.map((stepKey, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        return (
          <div key={stepKey} className="flex items-center gap-2 text-sm">
            {isCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : isCurrent ? (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
            ) : (
              <div className="w-4 h-4 rounded-full border border-border flex-shrink-0" />
            )}
            <span
              className={
                isCompleted
                  ? 'text-muted line-through'
                  : isCurrent
                    ? 'text-blue-800 font-medium'
                    : 'text-muted'
              }
            >
              {t(stepKey)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ScreenerInboxPanel() {
  const [viewMode, setViewMode] = useState<'guided' | 'advanced'>('guided');
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

  const riskConfig = activeStrategy?.risk ?? configDefaultsQuery.data?.risk;

  const [selectedUniverse, setSelectedUniverse] = useLocalStorage(
    SCREENER_UNIVERSE_STORAGE_KEY,
    'broad_market_stocks',
    (value: unknown) => parseUniverseValue(value) ?? 'broad_market_stocks'
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
  const [instrumentFilter, setInstrumentFilter] = useLocalStorage<InstrumentFilter>(
    'screener.instrumentFilter',
    'all',
    (val: unknown) => (val === 'equity' || val === 'etf' || val === 'all' ? val : 'all')
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

  const universesQuery = useUniverses();
  const screenerMutation = useRunScreenerMutation((data) => {
    setLastResult(data);
    if (data.candidates.length > 0) {
      setSelectedTicker(data.candidates[0].ticker, 'screener');
    }
    setIsFormCollapsed(true);
  });

  const handleRunScreener = useCallback(() => {
    screenerMutation.mutate({
      universe: selectedUniverse,
      top: topN,
      minPrice,
      maxPrice,
      currencies: currencyFilterToRequest(currencyFilter),
      exchangeMics: exchangeFilterToRequest(exchangeFilter),
      includeOtc,
      requireWeeklyUptrend: requireWeeklyUptrend || undefined,
      instrumentTypes: instrumentFilterToRequest(instrumentFilter),
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
    exchangeFilter,
    instrumentFilter,
    includeOtc,
    requireWeeklyUptrend,
    strategySignals?.breakoutLookback,
    strategySignals?.pullbackMa,
    strategySignals?.minHistory,
  ]);

  const result = screenerMutation.data ?? lastResult;
  const allCandidates = result ? prioritizeCandidates(result.candidates) : [];
  const filteredCandidates = filterCandidates(allCandidates, { recommendedOnly, actionFilter });
  const displayCandidates = filterOutAddOns(filteredCandidates);

  useEffect(() => {
    if (!displayCandidates.length || !selectedTicker || selectedTickerSource === 'portfolio') {
      return;
    }
    const stillPresent = displayCandidates.some((candidate) => candidate.ticker.toUpperCase() === selectedTicker.toUpperCase());
    if (!stillPresent) {
      setSelectedTicker(displayCandidates[0].ticker, 'screener');
    }
  }, [displayCandidates, selectedTicker, selectedTickerSource, setSelectedTicker]);

  const handleRunScreenerRef = useRef(handleRunScreener);
  useEffect(() => {
    handleRunScreenerRef.current = handleRunScreener;
  });

  useEffect(() => {
    if (runScreenerTrigger > 0) {
      handleRunScreenerRef.current();
    }
  }, [runScreenerTrigger]);

  const handleSelectCandidate = useCallback(
    (ticker: string, tab: WorkspaceAnalysisTab) => {
      setSelectedTicker(ticker);
      setAnalysisTab(tab);
    },
    [setAnalysisTab, setSelectedTicker]
  );

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
    <Card variant="bordered" className="p-3 md:p-4 flex min-h-0 flex-col gap-3 xl:h-full xl:overflow-hidden">
      <ScreenerForm
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
        exchangeFilter={exchangeFilter}
        setExchangeFilter={setExchangeFilter}
        instrumentFilter={instrumentFilter}
        setInstrumentFilter={setInstrumentFilter}
        includeOtc={includeOtc}
        setIncludeOtc={setIncludeOtc}
        recommendedOnly={recommendedOnly}
        setRecommendedOnly={setRecommendedOnly}
        requireWeeklyUptrend={requireWeeklyUptrend}
        setRequireWeeklyUptrend={setRequireWeeklyUptrend}
        actionFilter={actionFilter}
        setActionFilter={setActionFilter}
        universes={universesQuery.data?.universes ?? []}
        isLoading={screenerMutation.isPending}
        onRun={handleRunScreener}
        isCollapsed={isFormCollapsed}
        onToggleCollapsed={() => setIsFormCollapsed(!isFormCollapsed)}
      />

      {screenerMutation.isPending && <ScreenerRunningPanel />}

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

      {!screenerMutation.isPending && !result && !screenerMutation.isError ? (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
          <div className="text-xs md:text-sm text-blue-800">
            <strong>{t('screener.info.noteTitle')}</strong> {t('screener.info.noteBody')}
          </div>
        </div>
      ) : null}

      <div className="px-3 pt-3">
        <OpenPositionIntelligencePanel
          onTickerSelect={(ticker) => setSelectedTicker(ticker, 'portfolio')}
        />
      </div>

      {result ? (
        <div className="rounded-lg border border-border bg-surface p-3 flex-1 min-h-0 flex flex-col gap-3">
          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-xs md:text-sm text-gray-600 dark:text-gray-400">
              <div>
                {t('workspacePage.panels.screener.resultSummary', {
                  shown: displayCandidates.length,
                  total: allCandidates.length,
                  screened: result.totalScreened,
                })}
              </div>
              <div className="text-[11px] md:text-xs">
                {t('workspacePage.panels.screener.priorityExplanation')}
              </div>
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
          <BeginnerScreenerSummary
            candidates={displayCandidates}
            onReviewCandidate={(ticker) => handleSelectCandidate(ticker, 'overview')}
          />
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
          {result.warnings && result.warnings.length > 0 ? (
            <div className="flex flex-col gap-1">
              {result.warnings.map((warning, i) => (
                <div
                  key={i}
                  className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                >
                  {warning}
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex gap-1 rounded-lg border border-border p-0.5 w-fit self-start">
            <button
              onClick={() => setViewMode('guided')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${viewMode === 'guided' ? 'bg-surface shadow-sm text-foreground' : 'text-muted hover:text-gray-700'}`}
            >
              {t('screener.viewToggle.guided')}
            </button>
            <button
              onClick={() => setViewMode('advanced')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${viewMode === 'advanced' ? 'bg-surface shadow-sm text-foreground' : 'text-muted hover:text-gray-700'}`}
            >
              {t('screener.viewToggle.advanced')}
            </button>
          </div>
          {viewMode === 'guided' ? (
            <ScreenerCandidateReviewList
              candidates={displayCandidates}
              selectedTicker={selectedTicker}
              onReview={(ticker) => handleSelectCandidate(ticker, 'overview')}
            />
          ) : (
            <div className="flex-1 min-h-0 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
              <ScreenerCandidatesTable
                candidates={displayCandidates}
                selectedTicker={selectedTicker}
                onSymbolClick={(ticker) => handleSelectCandidate(ticker, 'overview')}
                onRowClick={(candidate) => handleSelectCandidate(candidate.ticker, analysisTab === 'order' ? 'order' : 'overview')}
                onCreateOrder={(candidate) => handleSelectCandidate(candidate.ticker, 'order')}
                onRecommendationDetails={(candidate) => handleSelectCandidate(candidate.ticker, 'overview')}
              />
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}
