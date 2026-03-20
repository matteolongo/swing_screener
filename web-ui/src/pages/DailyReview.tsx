import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '@/hooks';
import { Info, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDailyReview } from '@/features/dailyReview/api';
import { useConfigDefaultsQuery } from '@/features/config/hooks';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import TableShell from '@/components/common/TableShell';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import type { RiskConfig } from '@/types/config';
import GlossaryLegend from '@/components/domain/education/GlossaryLegend';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import { DAILY_REVIEW_GLOSSARY_KEYS } from '@/content/educationGlossary';
import CandidateOrderModal from '@/components/domain/orders/CandidateOrderModal';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import WatchMetaInline from '@/components/domain/watchlist/WatchMetaInline';
import WatchToggleButton from '@/components/domain/watchlist/WatchToggleButton';
import { queryKeys } from '@/lib/queryKeys';
import { t } from '@/i18n/t';
import { useUnwatchSymbolMutation, useWatchSymbolMutation, useWatchlist } from '@/features/watchlist/hooks';
import type { WatchItem } from '@/features/watchlist/types';
import { filterDailyReviewCandidates } from '@/features/dailyReview/prioritization';
import type { DecisionActionFilter } from '@/features/screener/prioritization';
import {
  parseUniverseFromStorage,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage';
import type {
  DailyReviewCandidate,
  DailyReviewPositionHold,
  DailyReviewPositionUpdate,
  DailyReviewPositionClose,
} from '@/features/dailyReview/types';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';
import { useStrategyReadiness } from '@/features/strategy/useStrategyReadiness';
import StrategyReadinessBlocker from '@/components/domain/onboarding/StrategyReadinessBlocker';

const DAILY_REVIEW_ACTION_FILTERS: DecisionActionFilter[] = [
  'all',
  'BUY_NOW',
  'BUY_ON_PULLBACK',
  'WAIT_FOR_BREAKOUT',
  'WATCH',
  'TACTICAL_ONLY',
  'AVOID',
  'MANAGE_ONLY',
];

function decisionActionLabel(action?: string): string | null {
  switch (action) {
    case 'BUY_NOW':
      return t('workspacePage.panels.analysis.decisionSummary.actions.buyNow');
    case 'BUY_ON_PULLBACK':
      return t('workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback');
    case 'WAIT_FOR_BREAKOUT':
      return t('workspacePage.panels.analysis.decisionSummary.actions.waitForBreakout');
    case 'WATCH':
      return t('workspacePage.panels.analysis.decisionSummary.actions.watch');
    case 'TACTICAL_ONLY':
      return t('workspacePage.panels.analysis.decisionSummary.actions.tacticalOnly');
    case 'AVOID':
      return t('workspacePage.panels.analysis.decisionSummary.actions.avoid');
    case 'MANAGE_ONLY':
      return t('workspacePage.panels.analysis.decisionSummary.actions.manageOnly');
    default:
      return null;
  }
}

function decisionConvictionLabel(conviction?: string): string | null {
  switch (conviction) {
    case 'high':
      return t('workspacePage.panels.analysis.decisionSummary.conviction.high');
    case 'medium':
      return t('workspacePage.panels.analysis.decisionSummary.conviction.medium');
    case 'low':
      return t('workspacePage.panels.analysis.decisionSummary.conviction.low');
    default:
      return null;
  }
}

function actionFilterLabel(value: DecisionActionFilter): string {
  return decisionActionLabel(value) ?? t('screener.controls.allActions');
}

export default function DailyReview() {
  const [expandedSections, setExpandedSections] = useLocalStorage(
    'dailyreview-expanded-sections',
    { candidates: true, addOns: true, hold: false, update: true, close: true },
    (val: unknown) => {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const v = val as Record<string, unknown>;
        return {
          candidates: typeof v.candidates === 'boolean' ? v.candidates : true,
          addOns: typeof v.addOns === 'boolean' ? v.addOns : true,
          hold: typeof v.hold === 'boolean' ? v.hold : false,
          update: typeof v.update === 'boolean' ? v.update : true,
          close: typeof v.close === 'boolean' ? v.close : true,
        };
      }
      return { candidates: true, addOns: true, hold: false, update: true, close: true };
    }
  );
  const [selectedCandidate, setSelectedCandidate] = useState<DailyReviewCandidate | null>(null);
  const [candidateRecommendedOnly, setCandidateRecommendedOnly] = useState(true);
  const [candidateActionFilter, setCandidateActionFilter] = useState<DecisionActionFilter>('all');
  const [dismissedReadinessBlocker, setDismissedReadinessBlocker] = useState(() => {
    // Persist dismissal state in localStorage
    return localStorage.getItem('dailyReview.dismissedReadinessBlocker') === 'true';
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const selectedUniverse = parseUniverseFromStorage(localStorage.getItem(SCREENER_UNIVERSE_STORAGE_KEY));
  const { data: review, isLoading, error, refetch, isFetching } = useDailyReview(200, selectedUniverse);
  const activeStrategyQuery = useActiveStrategyQuery();
  const configDefaultsQuery = useConfigDefaultsQuery();
  const { isBeginnerMode } = useBeginnerModeStore();
  const { isReady: strategyReady } = useStrategyReadiness();
  const watchlistQuery = useWatchlist();
  const watchSymbolMutation = useWatchSymbolMutation();
  const unwatchSymbolMutation = useUnwatchSymbolMutation();

  const watchItemsByTicker = useMemo(() => {
    const map = new Map<string, WatchItem>();
    for (const item of watchlistQuery.data ?? []) {
      map.set(item.ticker.toUpperCase(), item);
    }
    return map;
  }, [watchlistQuery.data]);

  const handleWatch = useCallback(
    (ticker: string, currentPrice: number | null | undefined, source: string) => {
      const normalizedTicker = ticker.trim().toUpperCase();
      if (!normalizedTicker || watchItemsByTicker.has(normalizedTicker)) {
        return;
      }
      watchSymbolMutation.mutate({
        ticker: normalizedTicker,
        watchPrice: currentPrice ?? null,
        currency: null,
        source,
      });
    },
    [watchItemsByTicker, watchSymbolMutation],
  );

  const handleUnwatch = useCallback(
    (ticker: string) => {
      const normalizedTicker = ticker.trim().toUpperCase();
      if (!normalizedTicker || !watchItemsByTicker.has(normalizedTicker)) {
        return;
      }
      unwatchSymbolMutation.mutate(normalizedTicker);
    },
    [watchItemsByTicker, unwatchSymbolMutation],
  );
  const watchPending = watchSymbolMutation.isPending || unwatchSymbolMutation.isPending;
  
  // Persist dismissal to localStorage
  useEffect(() => {
    localStorage.setItem('dailyReview.dismissedReadinessBlocker', String(dismissedReadinessBlocker));
  }, [dismissedReadinessBlocker]);
  const riskConfig: RiskConfig | undefined = activeStrategyQuery.data?.risk ?? configDefaultsQuery.data?.risk;
  const openWorkspacePortfolioAction = useCallback(
    (params: { action: 'update-stop' | 'close-position'; ticker: string; positionId: string }) => {
      const searchParams = new URLSearchParams();
      searchParams.set('portfolioAction', params.action);
      searchParams.set('ticker', params.ticker);
      searchParams.set('positionId', params.positionId);
      navigate(`/workspace?${searchParams.toString()}`);
    },
    [navigate],
  );
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t('dailyReview.header.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.header.loading')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-gray-200 bg-white/70 dark:border-gray-700 dark:bg-gray-800/60" />
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-11 animate-pulse rounded-xl border border-gray-200 bg-white/70 dark:border-gray-700 dark:bg-gray-800/60" />
          <div className="h-36 animate-pulse rounded-xl border border-gray-200 bg-white/70 dark:border-gray-700 dark:bg-gray-800/60" />
        </div>
      </div>
    );
  }

  if (!riskConfig) {
    const configFailed = configDefaultsQuery.isError && !activeStrategyQuery.data?.risk;
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t('dailyReview.header.title')}</h1>
          <p className={configFailed ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
            {configFailed
              ? t('dailyReview.header.error', {
                  message:
                    configDefaultsQuery.error instanceof Error
                      ? configDefaultsQuery.error.message
                      : t('dailyReview.header.unknownError'),
                })
              : t('dailyReview.header.loading')}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t('dailyReview.header.title')}</h1>
        <Card>
          <CardContent>
            <p className="text-red-600 dark:text-red-400">
              {t('dailyReview.header.error', {
                message: error instanceof Error ? error.message : t('dailyReview.header.unknownError'),
              })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!review) {
    return null;
  }

  const { summary } = review;
  const recommendedCandidates = review.newCandidates.filter(
    (candidate) => candidate.recommendation?.verdict === 'RECOMMENDED',
  );
  const recommendedAddOnCandidates = review.positionsAddOnCandidates.filter(
    (candidate) => candidate.recommendation?.verdict === 'RECOMMENDED',
  );
  const visibleCandidates = filterDailyReviewCandidates(review.newCandidates, {
    recommendedOnly: candidateRecommendedOnly,
    actionFilter: candidateActionFilter,
  });
  const visibleAddOnCandidates = filterDailyReviewCandidates(review.positionsAddOnCandidates, {
    recommendedOnly: candidateRecommendedOnly,
    actionFilter: candidateActionFilter,
  });
  const hiddenCandidates = candidateRecommendedOnly ? review.newCandidates.length - recommendedCandidates.length : 0;
  const hiddenAddOnCandidates = candidateRecommendedOnly
    ? review.positionsAddOnCandidates.length - recommendedAddOnCandidates.length
    : 0;
  const candidateBaseCount = candidateRecommendedOnly ? recommendedCandidates.length : review.newCandidates.length;
  const addOnBaseCount = candidateRecommendedOnly
    ? recommendedAddOnCandidates.length
    : review.positionsAddOnCandidates.length;
  const actionFilteredCandidates =
    candidateActionFilter === 'all' ? 0 : Math.max(candidateBaseCount - visibleCandidates.length, 0);
  const actionFilteredAddOns =
    candidateActionFilter === 'all' ? 0 : Math.max(addOnBaseCount - visibleAddOnCandidates.length, 0);
  const usesDefaultCandidateFilter = candidateRecommendedOnly && candidateActionFilter === 'all';
  const quickActionCandidate = recommendedCandidates[0] ?? recommendedAddOnCandidates[0] ?? null;
  const quickActionIsAddOn = quickActionCandidate?.sameSymbol?.mode === 'ADD_ON';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{t('dailyReview.header.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {new Date(`${summary.reviewDate}T00:00:00`).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => refetch()}
          disabled={isFetching}
          title={t('dailyReview.header.refreshTitle')}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? t('dailyReview.header.refreshing') : t('dailyReview.header.refresh')}
        </Button>
      </div>

      {/* Strategy Readiness Blocker - Beginner Mode */}
      {isBeginnerMode && !strategyReady && !dismissedReadinessBlocker && (
        <StrategyReadinessBlocker
          onDismiss={() => setDismissedReadinessBlocker(true)}
          onConfigureStrategy={() => navigate('/onboarding?step=2')}
        />
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title={t('dailyReview.summary.newCandidates')} value={summary.newCandidates} variant="blue" icon="📈" />
        <SummaryCard
          title={t('dailyReview.summary.addOnCandidates')}
          value={summary.addOnCandidates}
          variant={summary.addOnCandidates > 0 ? 'blue' : 'gray'}
          icon="➕"
        />
        <SummaryCard
          title={t('dailyReview.summary.updateStop')}
          value={summary.updateStop}
          variant={summary.updateStop > 0 ? 'yellow' : 'gray'}
          icon="🔄"
        />
        <SummaryCard
          title={t('dailyReview.summary.closePositions')}
          value={summary.closePositions}
          variant={summary.closePositions > 0 ? 'red' : 'gray'}
          icon="❌"
        />
        <SummaryCard title={t('dailyReview.summary.holdPositions')} value={summary.noAction} variant="green" icon="✅" />
      </div>

      {quickActionCandidate ? (
        <Card className="border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                {t('dailyReview.quickAction.label')}
              </p>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                {quickActionIsAddOn
                  ? t('dailyReview.quickAction.addOnDescription', { ticker: quickActionCandidate.ticker })
                  : t('dailyReview.quickAction.description', { ticker: quickActionCandidate.ticker })}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                setSelectedCandidate(quickActionCandidate);
              }}
            >
              {quickActionIsAddOn
                ? t('dailyReview.quickAction.addOnCta', { ticker: quickActionCandidate.ticker })
                : t('dailyReview.quickAction.cta', { ticker: quickActionCandidate.ticker })}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('dailyReview.filters.title')}
            </p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {t('dailyReview.filters.explanation')}
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={candidateRecommendedOnly}
                onChange={(event) => setCandidateRecommendedOnly(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{t('screener.controls.recommendedOnly')}</span>
            </label>
            <div className="w-full md:min-w-[14rem]">
              <label
                htmlFor="daily-review-action-filter"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t('screener.controls.actionFilter')}
              </label>
              <select
                id="daily-review-action-filter"
                value={candidateActionFilter}
                onChange={(event) => setCandidateActionFilter(event.target.value as DecisionActionFilter)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                {DAILY_REVIEW_ACTION_FILTERS.map((value) => (
                  <option key={value} value={value}>
                    {actionFilterLabel(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <CollapsibleSection
        title={t('dailyReview.sections.newTradeCandidates', { count: visibleCandidates.length })}
        isExpanded={expandedSections.candidates}
        onToggle={() => toggleSection('candidates')}
        count={visibleCandidates.length}
      >
        {visibleCandidates.length === 0 ? (
          <div className="space-y-3">
            <p className="text-gray-600 dark:text-gray-400">
              {usesDefaultCandidateFilter
                ? t('dailyReview.sections.noRecommended')
                : t('dailyReview.sections.noCandidatesForFilters')}
            </p>
            {hiddenCandidates > 0 && usesDefaultCandidateFilter ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dailyReview.sections.hiddenByVerdict', {
                  count: hiddenCandidates,
                  suffix: hiddenCandidates === 1 ? '' : 's',
                })}
              </p>
            ) : null}
            {hiddenCandidates > 0 || actionFilteredCandidates > 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dailyReview.sections.showingFilteredCandidates', {
                  shown: visibleCandidates.length,
                  total: review.newCandidates.length,
                })}
              </p>
            ) : null}
            {usesDefaultCandidateFilter ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  {t('dailyReview.sections.noRecommendedExplainTitle')}
                </p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                  {t('dailyReview.sections.noRecommendedExplainBody')}
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-300">
                  <li>{t('dailyReview.sections.noRecommendedReasonSignal')}</li>
                  <li>{t('dailyReview.sections.noRecommendedReasonRisk')}</li>
                  <li>{t('dailyReview.sections.noRecommendedReasonReward')}</li>
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <GlossaryLegend metricKeys={DAILY_REVIEW_GLOSSARY_KEYS} title={t('dailyReview.sections.dailyGlossary')} />
            {hiddenCandidates > 0 && usesDefaultCandidateFilter ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dailyReview.sections.showingRecommendedOnly', {
                  count: hiddenCandidates,
                  suffix: hiddenCandidates === 1 ? '' : 's',
                })}
              </p>
            ) : null}
            {(!usesDefaultCandidateFilter && (hiddenCandidates > 0 || actionFilteredCandidates > 0)) ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dailyReview.sections.showingFilteredCandidates', {
                  shown: visibleCandidates.length,
                  total: review.newCandidates.length,
                })}
              </p>
            ) : null}
            <CandidatesTable
              candidates={visibleCandidates}
              onOpenOrderReview={setSelectedCandidate}
              watchItemsByTicker={watchItemsByTicker}
              watchPending={watchPending}
              onWatch={handleWatch}
              onUnwatch={handleUnwatch}
            />
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t('dailyReview.sections.addOnCandidates', { count: visibleAddOnCandidates.length })}
        isExpanded={expandedSections.addOns}
        onToggle={() => toggleSection('addOns')}
        count={visibleAddOnCandidates.length}
      >
        {visibleAddOnCandidates.length === 0 ? (
          <div className="space-y-3">
            <p className="text-gray-600 dark:text-gray-400">
              {usesDefaultCandidateFilter
                ? t('dailyReview.sections.noAddOns')
                : t('dailyReview.sections.noCandidatesForFilters')}
            </p>
            {hiddenAddOnCandidates > 0 || actionFilteredAddOns > 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dailyReview.sections.showingFilteredCandidates', {
                  shown: visibleAddOnCandidates.length,
                  total: review.positionsAddOnCandidates.length,
                })}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {hiddenAddOnCandidates > 0 || actionFilteredAddOns > 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dailyReview.sections.showingFilteredCandidates', {
                  shown: visibleAddOnCandidates.length,
                  total: review.positionsAddOnCandidates.length,
                })}
              </p>
            ) : null}
            <CandidatesTable
              candidates={visibleAddOnCandidates}
              onOpenOrderReview={setSelectedCandidate}
              watchItemsByTicker={watchItemsByTicker}
              watchPending={watchPending}
              onWatch={handleWatch}
              onUnwatch={handleUnwatch}
            />
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t('dailyReview.sections.updateStop', { count: review.positionsUpdateStop.length })}
        isExpanded={expandedSections.update}
        onToggle={() => toggleSection('update')}
        count={review.positionsUpdateStop.length}
        variant="warning"
      >
        {review.positionsUpdateStop.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noStopUpdates')}</p>
        ) : (
          <div className="space-y-3">
            <GlossaryLegend metricKeys={DAILY_REVIEW_GLOSSARY_KEYS} title={t('dailyReview.sections.stopGlossary')} />
            <UpdateStopTable
              positions={review.positionsUpdateStop}
              onAction={(position) =>
                openWorkspacePortfolioAction({
                  action: 'update-stop',
                  ticker: position.ticker,
                  positionId: position.positionId,
                })
              }
              watchItemsByTicker={watchItemsByTicker}
              watchPending={watchPending}
              onWatch={handleWatch}
              onUnwatch={handleUnwatch}
            />
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t('dailyReview.sections.closeSuggested', { count: review.positionsClose.length })}
        isExpanded={expandedSections.close}
        onToggle={() => toggleSection('close')}
        count={review.positionsClose.length}
        variant="danger"
      >
        {review.positionsClose.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noClose')}</p>
        ) : (
            <CloseTable
              positions={review.positionsClose}
              onAction={(position) =>
                openWorkspacePortfolioAction({
                  action: 'close-position',
                ticker: position.ticker,
                  positionId: position.positionId,
                })
              }
              watchItemsByTicker={watchItemsByTicker}
              watchPending={watchPending}
              onWatch={handleWatch}
            onUnwatch={handleUnwatch}
          />
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title={t('dailyReview.sections.noActionNeeded', { count: review.positionsHold.length })}
        isExpanded={expandedSections.hold}
        onToggle={() => toggleSection('hold')}
        count={review.positionsHold.length}
      >
        {review.positionsHold.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noHold')}</p>
        ) : (
          <HoldTable
            positions={review.positionsHold}
            watchItemsByTicker={watchItemsByTicker}
            watchPending={watchPending}
            onWatch={handleWatch}
            onUnwatch={handleUnwatch}
          />
        )}
      </CollapsibleSection>

      {selectedCandidate ? (
        <CandidateOrderModal
          candidate={{
            ticker: selectedCandidate.ticker,
            signal: selectedCandidate.signal,
            close: selectedCandidate.close,
            entry: selectedCandidate.entry,
            stop: selectedCandidate.stop,
            shares: selectedCandidate.shares,
            recommendation: selectedCandidate.recommendation,
            sector: selectedCandidate.sector,
            rReward: selectedCandidate.rReward,
            suggestedOrderType: selectedCandidate.suggestedOrderType,
            suggestedOrderPrice: selectedCandidate.suggestedOrderPrice,
            executionNote: selectedCandidate.executionNote,
            positionId: selectedCandidate.sameSymbol?.positionId,
            sameSymbol: selectedCandidate.sameSymbol,
          }}
          risk={riskConfig}
          defaultNotes={
            selectedCandidate.sameSymbol?.mode === 'ADD_ON'
              ? t('dailyReview.defaultAddOnNotes', {
                  liveStop:
                    selectedCandidate.sameSymbol.currentPositionStop != null
                      ? formatCurrency(selectedCandidate.sameSymbol.currentPositionStop)
                      : t('common.placeholders.emDash'),
                  freshStop:
                    selectedCandidate.sameSymbol.freshSetupStop != null
                      ? formatCurrency(selectedCandidate.sameSymbol.freshSetupStop)
                      : t('common.placeholders.emDash'),
                  rr: formatNumber(selectedCandidate.rReward, 1),
                })
              : t('dailyReview.defaultNotes', {
                  entry: formatCurrency(selectedCandidate.entry),
                  rr: formatNumber(selectedCandidate.rReward, 1),
                })
          }
          onClose={() => {
            setSelectedCandidate(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
            setSelectedCandidate(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  variant,
  icon,
}: {
  title: string;
  value: number;
  variant: 'blue' | 'yellow' | 'red' | 'green' | 'gray';
  icon: string;
}) {
  const variantClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    gray: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800',
  };

  return (
    <Card className={variantClasses[variant]}>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <span className="text-4xl">{icon}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  count,
  variant,
  children,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  count: number;
  variant?: 'warning' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>{title}</CardTitle>
            {count > 0 && variant === 'warning' ? (
              <Badge variant="warning">
                {t('dailyReview.sections.actionsBadge', { count, suffix: count !== 1 ? 's' : '' })}
              </Badge>
            ) : null}
            {count > 0 && variant === 'danger' ? (
              <Badge variant="error">
                {t('dailyReview.sections.actionsBadge', { count, suffix: count !== 1 ? 's' : '' })}
              </Badge>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            title={isExpanded ? t('dailyReview.sections.collapse') : t('dailyReview.sections.expand')}
            aria-label={isExpanded ? t('dailyReview.sections.collapse') : t('dailyReview.sections.expand')}
          >
            {isExpanded ? '▼' : '▶'}
          </Button>
        </div>
      </CardHeader>
      {isExpanded ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}

interface DailyReviewWatchProps {
  watchItemsByTicker: Map<string, WatchItem>;
  watchPending: boolean;
  onWatch: (ticker: string, currentPrice: number | null | undefined, source: string) => void;
  onUnwatch: (ticker: string) => void;
}

function WatchInlineBlock({
  ticker,
  currentPrice,
  source,
  watchItemsByTicker,
  watchPending,
  onWatch,
  onUnwatch,
}: {
  ticker: string;
  currentPrice: number | null | undefined;
  source: string;
} & DailyReviewWatchProps) {
  const watchItem = watchItemsByTicker.get(ticker.trim().toUpperCase());
  return (
    <div className="mt-1 flex flex-col gap-1">
      <WatchToggleButton
        ticker={ticker}
        isWatched={Boolean(watchItem)}
        isPending={watchPending}
        onWatch={(nextTicker) => onWatch(nextTicker, currentPrice, source)}
        onUnwatch={onUnwatch}
      />
      {watchItem ? (
        <WatchMetaInline
          watchedAt={watchItem.watchedAt}
          watchPrice={watchItem.watchPrice}
          currentPrice={currentPrice}
          currency={null}
        />
      ) : null}
    </div>
  );
}

function CandidatesTable({
  candidates,
  onOpenOrderReview,
  watchItemsByTicker,
  watchPending,
  onWatch,
  onUnwatch,
}: {
  candidates: DailyReviewCandidate[];
  onOpenOrderReview: (candidate: DailyReviewCandidate) => void;
} & DailyReviewWatchProps) {
  const actionLabel = (candidate: DailyReviewCandidate) =>
    candidate.sameSymbol?.mode === 'ADD_ON'
      ? t('dailyReview.table.candidates.addOnAction')
      : t('dailyReview.table.candidates.createOrder');
  const actionTitle = (candidate: DailyReviewCandidate) =>
    candidate.recommendation?.verdict === 'NOT_RECOMMENDED'
      ? t('dailyReview.table.candidates.createOrderNotRecommendedTitle')
      : candidate.sameSymbol?.mode === 'ADD_ON'
        ? t('dailyReview.table.candidates.addOnTitle')
        : t('dailyReview.table.candidates.createOrderTitle');

  return (
    <TableShell
      empty={candidates.length === 0}
      emptyMessage={t('dailyReview.table.candidates.empty')}
      tableClassName="text-sm"
      headers={(
        <tr>
          <th className="text-left p-2">{t('dailyReview.table.candidates.headers.priority')}</th>
          <th className="text-left p-2">{t('dailyReview.table.candidates.headers.ticker')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="CONFIDENCE" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.candidates.headers.signal')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.stop')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.shares')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="RR" labelOverride="R:R" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.candidates.headers.sector')}</th>
          <th className="text-center p-2">{t('dailyReview.table.candidates.headers.info')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.action')}</th>
        </tr>
      )}
    >
      {candidates.map((candidate) => {
        const action = decisionActionLabel(candidate.decisionSummary?.action);
        const conviction = decisionConvictionLabel(candidate.decisionSummary?.conviction);
        const priorityRank = candidate.priorityRank ?? candidate.rank;

        return (
        <tr key={candidate.ticker} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
          <td className="p-2 align-top">
            <div className="flex flex-col font-mono font-bold">
              <span>{priorityRank != null ? `#${priorityRank}` : t('common.placeholders.emDash')}</span>
              {candidate.rank != null && priorityRank != null && candidate.rank !== priorityRank ? (
                <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                  {t('dailyReview.table.candidates.rawRank', { rank: candidate.rank })}
                </span>
              ) : null}
              {action && conviction ? (
                <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">
                  {t('dailyReview.table.candidates.priorityMeta', { action, conviction })}
                </span>
              ) : null}
            </div>
          </td>
          <td className="p-2 font-mono font-bold align-top">
            <a
              href={`https://finance.yahoo.com/quote/${candidate.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
              title={t('dailyReview.table.candidates.yahooFinanceTooltip', { ticker: candidate.ticker })}
            >
              {candidate.ticker}
            </a>
            <WatchInlineBlock
              ticker={candidate.ticker}
              currentPrice={candidate.close}
              source="daily_review_candidates"
              watchItemsByTicker={watchItemsByTicker}
              watchPending={watchPending}
              onWatch={onWatch}
              onUnwatch={onUnwatch}
            />
            <CachedSymbolPriceChart ticker={candidate.ticker} className="mt-1" />
          </td>
          <td className="p-2 text-right">
            <span className="font-semibold text-purple-600">
              {candidate.confidence != null ? formatNumber(candidate.confidence, 1) : '-'}
            </span>
          </td>
          <td className="p-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary">{candidate.signal}</Badge>
              {candidate.sameSymbol?.mode === 'ADD_ON' ? (
                <Badge variant="warning">{t('dailyReview.table.candidates.addOnBadge')}</Badge>
              ) : null}
            </div>
          </td>
          <td className="p-2 text-right">{formatCurrency(candidate.entry)}</td>
          <td className="p-2 text-right">{formatCurrency(candidate.stop)}</td>
          <td className="p-2 text-right">{candidate.shares}</td>
          <td className="p-2 text-right font-bold">
            {t('common.units.rValue', { value: formatNumber(candidate.rReward, 1) })}
          </td>
          <td className="p-2 text-sm text-gray-600 dark:text-gray-400">
            <div>{candidate.sector || t('common.placeholders.dash')}</div>
            {candidate.sameSymbol?.mode === 'ADD_ON' ? (
              <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {t('dailyReview.table.candidates.addOnReason', {
                  liveStop:
                    candidate.sameSymbol.currentPositionStop != null
                      ? formatCurrency(candidate.sameSymbol.currentPositionStop)
                      : t('common.placeholders.emDash'),
                  freshStop:
                    candidate.sameSymbol.freshSetupStop != null
                      ? formatCurrency(candidate.sameSymbol.freshSetupStop)
                      : t('common.placeholders.emDash'),
                })}
              </div>
            ) : null}
          </td>
          <td className="p-2 text-center">
            {candidate.recommendation ? (
              <button
                onClick={() => onOpenOrderReview(candidate)}
                className="min-h-11 min-w-11 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title={t('dailyReview.table.candidates.recommendationTitle')}
                aria-label={t('dailyReview.table.candidates.recommendationAria', { ticker: candidate.ticker })}
              >
                <Info className="w-4 h-4" />
              </button>
            ) : null}
          </td>
          <td className="p-2 text-right">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenOrderReview(candidate)}
              title={
                actionTitle(candidate)
              }
            >
              {actionLabel(candidate)}
            </Button>
          </td>
        </tr>
      )})}
    </TableShell>
  );
}

const TIME_EXIT_REASON_PATTERN = /Time exit:\s*(\d+)\s*bars since entry_date\s*>=\s*(\d+)/i;

function formatDailyReviewReason(reason: string): string {
  const timeExitMatch = reason.match(TIME_EXIT_REASON_PATTERN);
  if (timeExitMatch) {
    return t('dailyReview.reason.timeExit', {
      barsSince: Number(timeExitMatch[1]),
      maxBars: Number(timeExitMatch[2]),
    });
  }
  return reason;
}

function UpdateStopTable({
  positions,
  onAction,
  watchItemsByTicker,
  watchPending,
  onWatch,
  onUnwatch,
}: {
  positions: DailyReviewPositionUpdate[];
  onAction: (position: DailyReviewPositionUpdate) => void;
} & DailyReviewWatchProps) {
  return (
    <TableShell
      empty={positions.length === 0}
      emptyMessage={t('dailyReview.table.update.empty')}
      tableClassName="text-sm"
      headers={(
        <tr>
          <th className="text-left p-2">{t('dailyReview.table.update.headers.ticker')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.current')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.stopOld')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.stopNew')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.update.headers.reason')}</th>
          <th className="text-right p-2">{t('dailyReview.table.update.headers.action')}</th>
        </tr>
      )}
    >
      {positions.map((pos) => (
        <tr key={pos.positionId} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
          <td className="p-2 font-mono font-bold">
            <a
              href={`https://finance.yahoo.com/quote/${pos.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
              title={t('dailyReview.table.update.yahooFinanceTooltip', { ticker: pos.ticker })}
            >
              {pos.ticker}
            </a>
            <WatchInlineBlock
              ticker={pos.ticker}
              currentPrice={pos.currentPrice}
              source="daily_review_update_stop"
              watchItemsByTicker={watchItemsByTicker}
              watchPending={watchPending}
              onWatch={onWatch}
              onUnwatch={onUnwatch}
            />
            <CachedSymbolPriceChart ticker={pos.ticker} className="mt-1" />
          </td>
          <td className="p-2 text-right">{formatCurrency(pos.entryPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.currentPrice)}</td>
          <td className="p-2 text-right text-gray-600 dark:text-gray-400">{formatCurrency(pos.stopCurrent)}</td>
          <td className="p-2 text-right font-bold text-green-700 dark:text-green-300">{formatCurrency(pos.stopSuggested)}</td>
          <td className="p-2 text-right">
            <span className={pos.rNow >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
              {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
            </span>
          </td>
          <td className="p-2 text-sm">{formatDailyReviewReason(pos.reason)}</td>
          <td className="p-2 text-right">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAction(pos)}
              title={t('dailyReview.table.update.actionTitle')}
            >
              {t('dailyReview.table.update.actionLabel')}
            </Button>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function CloseTable({
  positions,
  onAction,
  watchItemsByTicker,
  watchPending,
  onWatch,
  onUnwatch,
}: {
  positions: DailyReviewPositionClose[];
  onAction: (position: DailyReviewPositionClose) => void;
} & DailyReviewWatchProps) {
  return (
    <TableShell
      empty={positions.length === 0}
      emptyMessage={t('dailyReview.table.close.empty')}
      tableClassName="text-sm"
      headers={(
        <tr>
          <th className="text-left p-2">{t('dailyReview.table.close.headers.ticker')}</th>
          <th className="text-right p-2">{t('dailyReview.table.close.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.close.headers.current')}</th>
          <th className="text-right p-2">{t('dailyReview.table.close.headers.stop')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.close.headers.reason')}</th>
          <th className="text-right p-2">{t('dailyReview.table.close.headers.action')}</th>
        </tr>
      )}
    >
      {positions.map((pos) => (
        <tr key={pos.positionId} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
          <td className="p-2 font-mono font-bold">
            <a
              href={`https://finance.yahoo.com/quote/${pos.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
              title={t('dailyReview.table.close.yahooFinanceTooltip', { ticker: pos.ticker })}
            >
              {pos.ticker}
            </a>
            <WatchInlineBlock
              ticker={pos.ticker}
              currentPrice={pos.currentPrice}
              source="daily_review_close"
              watchItemsByTicker={watchItemsByTicker}
              watchPending={watchPending}
              onWatch={onWatch}
              onUnwatch={onUnwatch}
            />
            <CachedSymbolPriceChart ticker={pos.ticker} className="mt-1" />
          </td>
          <td className="p-2 text-right">{formatCurrency(pos.entryPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.currentPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.stopPrice)}</td>
          <td className="p-2 text-right">
            <span className="text-red-700 dark:text-red-300 font-bold">
              {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
            </span>
          </td>
          <td className="p-2 text-sm">{formatDailyReviewReason(pos.reason)}</td>
          <td className="p-2 text-right">
            <Button
              variant="danger"
              size="sm"
              onClick={() => onAction(pos)}
              title={t('dailyReview.table.close.actionTitle')}
            >
              {t('dailyReview.table.close.actionLabel')}
            </Button>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function HoldTable({
  positions,
  watchItemsByTicker,
  watchPending,
  onWatch,
  onUnwatch,
}: {
  positions: DailyReviewPositionHold[];
} & DailyReviewWatchProps) {
  return (
    <TableShell
      empty={positions.length === 0}
      emptyMessage={t('dailyReview.table.hold.empty')}
      tableClassName="text-sm"
      headers={(
        <tr>
          <th className="text-left p-2">{t('dailyReview.table.hold.headers.ticker')}</th>
          <th className="text-right p-2">{t('dailyReview.table.hold.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.hold.headers.current')}</th>
          <th className="text-right p-2">{t('dailyReview.table.hold.headers.stop')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />
          </th>
          <th className="text-left p-2">{t('dailyReview.table.hold.headers.reason')}</th>
        </tr>
      )}
    >
      {positions.map((pos) => (
        <tr key={pos.positionId} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
          <td className="p-2 font-mono font-bold">
            <a
              href={`https://finance.yahoo.com/quote/${pos.ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline"
              title={t('dailyReview.table.hold.yahooFinanceTooltip', { ticker: pos.ticker })}
            >
              {pos.ticker}
            </a>
            <WatchInlineBlock
              ticker={pos.ticker}
              currentPrice={pos.currentPrice}
              source="daily_review_hold"
              watchItemsByTicker={watchItemsByTicker}
              watchPending={watchPending}
              onWatch={onWatch}
              onUnwatch={onUnwatch}
            />
            <CachedSymbolPriceChart ticker={pos.ticker} className="mt-1" />
          </td>
          <td className="p-2 text-right">{formatCurrency(pos.entryPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.currentPrice)}</td>
          <td className="p-2 text-right">{formatCurrency(pos.stopPrice)}</td>
          <td className="p-2 text-right">
            <span className={pos.rNow >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
              {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
            </span>
          </td>
          <td className="p-2 text-sm text-gray-600 dark:text-gray-400">{formatDailyReviewReason(pos.reason)}</td>
        </tr>
      ))}
    </TableShell>
  );
}
