import { useCallback, useEffect, useState } from 'react';
import { useLocalStorage } from '@/hooks';
import { ExternalLink, RefreshCw } from 'lucide-react';
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
import OrderActionPanel from '@/components/domain/orders/OrderActionPanel';
import SymbolAnalysisModal from '@/components/domain/workspace/SymbolAnalysisModal';
import type { WorkspaceAnalysisTab } from '@/components/domain/workspace/types';
import { queryKeys } from '@/lib/queryKeys';
import { t } from '@/i18n/t';
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
import { createOrder } from '@/features/portfolio/api';
import { useSymbolIntelligenceRunner } from '@/features/intelligence/useSymbolIntelligenceRunner';
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
  const [selectedAnalysisTab, setSelectedAnalysisTab] = useState<WorkspaceAnalysisTab>('overview');
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
  const { runForTicker, getStatusForTicker } = useSymbolIntelligenceRunner();

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

  const openCandidateAnalysis = useCallback(
    (candidate: DailyReviewCandidate, tab: WorkspaceAnalysisTab) => {
      setSelectedCandidate(candidate);
      setSelectedAnalysisTab(tab);
    },
    [],
  );

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

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300">
          📈 {t('dailyReviewBanner.newCandidates', { n: String(summary.newCandidates) })}
        </span>
        {summary.addOnCandidates > 0 && (
          <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-3 py-1.5 text-sm font-medium text-purple-700 dark:text-purple-300">
            ➕ {t('dailyReviewBanner.addOns', { n: String(summary.addOnCandidates) })}
          </span>
        )}
        {summary.updateStop > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 text-sm font-medium text-amber-700 dark:text-amber-300">
            🔄 {t('dailyReviewBanner.stopsToUpdate', { n: String(summary.updateStop) })}
          </span>
        )}
        {summary.closePositions > 0 && (
          <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300">
            ❌ {t('dailyReviewBanner.positionsToClose', { n: String(summary.closePositions) })}
          </span>
        )}
        <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400">
          ✅ {t('dailyReviewBanner.onHold', { n: String(summary.noAction) })}
        </span>
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
                openCandidateAnalysis(quickActionCandidate, 'order');
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
              onOpenCandidate={(candidate) => openCandidateAnalysis(candidate, 'overview')}
              onOpenOrderReview={(candidate) => openCandidateAnalysis(candidate, 'order')}
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
              onOpenCandidate={(candidate) => openCandidateAnalysis(candidate, 'overview')}
              onOpenOrderReview={(candidate) => openCandidateAnalysis(candidate, 'order')}
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
          />
        )}
      </CollapsibleSection>

      {selectedCandidate ? (
        <SymbolAnalysisModal
          ticker={selectedCandidate.ticker}
          candidate={selectedCandidate}
          activeTab={selectedAnalysisTab}
          onTabChange={setSelectedAnalysisTab}
          onClose={() => {
            setSelectedCandidate(null);
            setSelectedAnalysisTab('overview');
          }}
          onRunSymbolIntelligence={runForTicker}
          symbolIntelligenceStatus={getStatusForTicker(selectedCandidate.ticker)}
          orderPanel={
            <OrderActionPanel
              context={{
                ticker: selectedCandidate.ticker,
                signal: selectedCandidate.signal,
                close: selectedCandidate.close,
                entry: selectedCandidate.entry,
                stop:
                  selectedCandidate.sameSymbol?.mode === 'ADD_ON' &&
                  selectedCandidate.sameSymbol.executionStop != null
                    ? selectedCandidate.sameSymbol.executionStop
                    : selectedCandidate.stop,
                shares: selectedCandidate.shares,
                recommendation: selectedCandidate.recommendation,
                sector: selectedCandidate.sector ?? undefined,
                rReward: selectedCandidate.rReward,
                score: selectedCandidate.score,
                rank: selectedCandidate.rank,
                atr: selectedCandidate.atr,
                currency: selectedCandidate.currency,
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
                          ? formatCurrency(selectedCandidate.sameSymbol.currentPositionStop, selectedCandidate.currency)
                          : t('common.placeholders.emDash'),
                      freshStop:
                        selectedCandidate.sameSymbol.freshSetupStop != null
                          ? formatCurrency(selectedCandidate.sameSymbol.freshSetupStop, selectedCandidate.currency)
                          : t('common.placeholders.emDash'),
                      rr: formatNumber(selectedCandidate.rReward, 1),
                    })
                  : t('dailyReview.defaultNotes', {
                      entry: formatCurrency(selectedCandidate.entry, selectedCandidate.currency),
                      rr: formatNumber(selectedCandidate.rReward, 1),
                    })
              }
              onSubmitOrder={createOrder}
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
                queryClient.invalidateQueries({ queryKey: queryKeys.dailyReview(200, selectedUniverse) });
                setSelectedCandidate(null);
                setSelectedAnalysisTab('overview');
              }}
            />
          }
        />
      ) : null}
    </div>
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

function CandidatesTable({
  candidates,
  onOpenCandidate,
  onOpenOrderReview,
}: {
  candidates: DailyReviewCandidate[];
  onOpenCandidate: (candidate: DailyReviewCandidate) => void;
  onOpenOrderReview: (candidate: DailyReviewCandidate) => void;
}) {
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
          <th className="text-left p-2">{t('dailyReview.table.candidates.headers.signal')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.entry')}</th>
          <th className="text-right p-2">{t('dailyReview.table.candidates.headers.stop')}</th>
          <th className="text-right p-2">
            <MetricHelpLabel metricKey="RR" labelOverride="R:R" className="justify-end w-full" />
          </th>
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
          <td className="p-2 font-mono font-bold">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenCandidate(candidate)}
                className="text-blue-600 hover:text-blue-800 hover:underline"
                title={t('workspacePage.symbolDetails.openTitle', { ticker: candidate.ticker })}
              >
                {candidate.ticker}
              </button>
              <a
                href={`https://finance.yahoo.com/quote/${candidate.ticker}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title={t('dailyReview.table.candidates.yahooFinanceTooltip', { ticker: candidate.ticker })}
                aria-label={t('dailyReview.table.candidates.yahooFinanceTooltip', { ticker: candidate.ticker })}
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </td>
          <td className="p-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="primary">{candidate.signal}</Badge>
              {candidate.sameSymbol?.mode === 'ADD_ON' ? (
                <Badge variant="warning">{t('dailyReview.table.candidates.addOnBadge')}</Badge>
              ) : null}
            </div>
          </td>
          <td className="p-2 text-right">{formatCurrency(candidate.entry)}</td>
          <td className="p-2 text-right">{formatCurrency(candidate.stop)}</td>
          <td className="p-2 text-right font-bold">
            {t('common.units.rValue', { value: formatNumber(candidate.rReward, 1) })}
          </td>
          <td className="p-2 text-right">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenOrderReview(candidate)}
              title={actionTitle(candidate)}
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
}: {
  positions: DailyReviewPositionUpdate[];
  onAction: (position: DailyReviewPositionUpdate) => void;
}) {
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
}: {
  positions: DailyReviewPositionClose[];
  onAction: (position: DailyReviewPositionClose) => void;
}) {
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
}: {
  positions: DailyReviewPositionHold[];
}) {
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
