import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDailyReview } from '@/features/dailyReview/api';
import Card, { CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { DataTable, type ColumnDef } from '@/components/ui/DataTable';
import { Section } from '@/components/ui/Section';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { useSetActiveStrategyMutation, useStrategiesQuery } from '@/features/strategy/hooks';
import { DEFAULT_CONFIG, type RiskConfig } from '@/types/config';
import GlossaryLegend from '@/components/domain/education/GlossaryLegend';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import { DAILY_REVIEW_GLOSSARY_KEYS } from '@/content/educationGlossary';
import TradeInsightModal from '@/components/domain/recommendation/TradeInsightModal';
import CandidateOrderModal from '@/components/domain/orders/CandidateOrderModal';
import { queryKeys } from '@/lib/queryKeys';
import { t } from '@/i18n/t';
import {
  parseUniverseFromStorage,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage';
import type {
  DailyReviewCandidate,
  DailyReviewPositionUpdate,
  DailyReviewPositionClose,
} from '@/features/dailyReview/types';
import { getStrategyReadiness } from '@/features/strategy/useStrategyReadiness';
import StrategyReadinessBlocker from '@/components/domain/onboarding/StrategyReadinessBlocker';
import { useActiveStrategyStore } from '@/stores/activeStrategyStore';
import {
  useClosePositionMutation,
  usePositions,
  useUpdateStopMutation,
} from '@/features/portfolio/hooks';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import { InsightPanel } from '@/components/coach/InsightPanel';

type Step = 'new' | 'update' | 'close';
const DECISION_STEPS: Step[] = ['new', 'update', 'close'];

export default function DailyReview() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedUniverse, setSelectedUniverse] = useState(
    () => parseUniverseFromStorage(localStorage.getItem(SCREENER_UNIVERSE_STORAGE_KEY)) ?? 'usd_all'
  );
  const [hasEnteredDecision, setHasEnteredDecision] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<Step | null>(null);
  const [insightCandidate, setInsightCandidate] = useState<DailyReviewCandidate | null>(null);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<DailyReviewCandidate | null>(null);
  const [updateStopPositionId, setUpdateStopPositionId] = useState<string | null>(null);
  const [closePositionId, setClosePositionId] = useState<string | null>(null);
  const [dismissedReadinessBlocker, setDismissedReadinessBlocker] = useState(() => {
    // Persist dismissal state in localStorage
    return localStorage.getItem('dailyReview.dismissedReadinessBlocker') === 'true';
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const strategiesQuery = useStrategiesQuery();
  const setActiveStrategyMutation = useSetActiveStrategyMutation();
  const { activeStrategyId, setActiveStrategyId } = useActiveStrategyStore();
  const reviewUniverseOptions = [
    { value: 'usd_all', label: t('strategyPage.core.options.reviewUniverseUsdAll') },
    { value: 'usd_mega_stocks', label: t('strategyPage.core.options.reviewUniverseUsdMegaStocks') },
    { value: 'usd_core_etfs', label: t('strategyPage.core.options.reviewUniverseUsdCoreEtfs') },
    { value: 'usd_defense_all', label: t('strategyPage.core.options.reviewUniverseUsdDefenseAll') },
    { value: 'usd_healthcare_all', label: t('strategyPage.core.options.reviewUniverseUsdHealthcareAll') },
    { value: 'eur_europe_large', label: t('strategyPage.core.options.reviewUniverseEurEuropeLarge') },
    { value: 'eur_amsterdam_all', label: t('strategyPage.core.options.reviewUniverseEurAmsterdamAll') },
    { value: 'eur_amsterdam_aex', label: t('strategyPage.core.options.reviewUniverseEurAmsterdamAex') },
    { value: 'eur_amsterdam_amx', label: t('strategyPage.core.options.reviewUniverseEurAmsterdamAmx') },
  ];
  const strategies = strategiesQuery.data ?? [];
  const selectedStrategy = strategies.find((strategy) => strategy.id === activeStrategyId) ?? null;
  const activeReviewStrategyId = selectedStrategy?.id ?? null;
  const { data: review, isLoading, error, refetch, isFetching } = useDailyReview(activeReviewStrategyId, 10, selectedUniverse);
  const strategyReadiness = getStrategyReadiness(selectedStrategy, strategiesQuery.isLoading);
  const openPositionsQuery = usePositions('open');
  const refreshDailyReviewAfterPositionAction = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.dailyReview(activeReviewStrategyId, 10, selectedUniverse),
    });
  }, [activeReviewStrategyId, queryClient, selectedUniverse]);
  const updateStopMutation = useUpdateStopMutation(() => {
    setUpdateStopPositionId(null);
    setClosePositionId(null);
    refreshDailyReviewAfterPositionAction();
  });
  const closePositionMutation = useClosePositionMutation(() => {
    setUpdateStopPositionId(null);
    setClosePositionId(null);
    refreshDailyReviewAfterPositionAction();
  });
  const updateStopPosition = useMemo(
    () =>
      updateStopPositionId
        ? (openPositionsQuery.data ?? []).find((position) => position.positionId === updateStopPositionId) ?? null
        : null,
    [openPositionsQuery.data, updateStopPositionId],
  );
  const closePosition = useMemo(
    () =>
      closePositionId
        ? (openPositionsQuery.data ?? []).find((position) => position.positionId === closePositionId) ?? null
        : null,
    [closePositionId, openPositionsQuery.data],
  );
  
  // Persist dismissal to localStorage
  useEffect(() => {
    localStorage.setItem('dailyReview.dismissedReadinessBlocker', String(dismissedReadinessBlocker));
  }, [dismissedReadinessBlocker]);
  const riskConfig: RiskConfig = selectedStrategy?.risk ?? DEFAULT_CONFIG.risk;

  const handleSelectStrategy = useCallback(
    async (strategyId: string) => {
      if (!strategyId) return;
      try {
        await setActiveStrategyMutation.mutateAsync(strategyId);
        setActiveStrategyId(strategyId);
        setDismissedReadinessBlocker(false);
        setCurrentStepIndex(0);
        setHasEnteredDecision(false);
        setExpandedInsight(null);
      } catch {
        // Mutation state surfaces the error to the user.
      }
    },
    [setActiveStrategyId, setActiveStrategyMutation]
  );
  const recommendedCandidates = useMemo(
    () => review?.newCandidates.filter((candidate) => candidate.recommendation?.verdict === 'RECOMMENDED') ?? [],
    [review],
  );
  const hiddenCandidates = (review?.newCandidates.length ?? 0) - recommendedCandidates.length;
  const filteredSteps = useMemo(() => {
    if (!review) return [];
    return DECISION_STEPS.filter((step) => {
      if (step === 'new') return recommendedCandidates.length > 0;
      if (step === 'update') return review.positionsUpdateStop.length > 0;
      return review.positionsClose.length > 0;
    });
  }, [recommendedCandidates.length, review]);
  const totalActions = useMemo(() => {
    if (!review) return 0;
    return recommendedCandidates.length + review.positionsUpdateStop.length + review.positionsClose.length;
  }, [recommendedCandidates.length, review]);
  const safeStepIndex = filteredSteps.length === 0 ? 0 : Math.min(currentStepIndex, filteredSteps.length - 1);
  const currentStep = filteredSteps[safeStepIndex] ?? null;
  const isLastStep = filteredSteps.length > 0 && safeStepIndex === filteredSteps.length - 1;

  useEffect(() => {
    if (filteredSteps.length === 0) {
      if (currentStepIndex !== 0) {
        setCurrentStepIndex(0);
      }
      return;
    }
    if (currentStepIndex >= filteredSteps.length) {
      setCurrentStepIndex(filteredSteps.length - 1);
    }
  }, [currentStepIndex, filteredSteps.length]);

  if (strategiesQuery.isLoading) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-12rem)] max-w-2xl items-center justify-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('sidebar.loadingStrategies')}</p>
      </div>
    );
  }

  if (strategiesQuery.isError) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-2xl items-center justify-center">
        <Card>
          <CardContent>
            <p className="text-sm text-red-600 dark:text-red-400">{t('sidebar.loadError')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!activeStrategyId || !selectedStrategy) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-12rem)] w-full max-w-2xl flex-col items-center justify-center gap-5">
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('dailyReview.strategySelection.title')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('dailyReview.strategySelection.subtitle')}
          </p>
        </div>
        <Card variant="bordered" className="w-full">
          <CardContent className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="daily-review-strategy-select">
              {t('sidebar.activeStrategy')}
            </label>
            <select
              id="daily-review-strategy-select"
              defaultValue=""
              className="w-full px-3 py-2 border border-border rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              onChange={(event) => {
                const next = event.target.value;
                if (next) {
                  void handleSelectStrategy(next);
                }
              }}
              disabled={setActiveStrategyMutation.isPending}
            >
              <option value="">{t('sidebar.selectStrategy')}</option>
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
            {setActiveStrategyMutation.isError ? (
              <p className="text-xs text-red-600">{t('sidebar.updateError')}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

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
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <label htmlFor="daily-review-active-strategy" className="text-xs text-gray-500 dark:text-gray-400">
              {t('sidebar.activeStrategy')}
            </label>
            <select
              id="daily-review-active-strategy"
              value={selectedStrategy.id}
              onChange={(event) => void handleSelectStrategy(event.target.value)}
              className="w-44 px-3 py-2 border border-border rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={setActiveStrategyMutation.isPending}
            >
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="daily-review-universe" className="text-xs text-gray-500 dark:text-gray-400">
              {t('strategyPage.core.fields.reviewUniverse')}
            </label>
            <select
              id="daily-review-universe"
              value={selectedUniverse}
              onChange={(event) => {
                const nextUniverse = event.target.value;
                setSelectedUniverse(nextUniverse);
                localStorage.setItem(SCREENER_UNIVERSE_STORAGE_KEY, JSON.stringify(nextUniverse));
                setCurrentStepIndex(0);
              }}
              className="w-52 px-3 py-2 border border-border rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {reviewUniverseOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setCurrentStepIndex(0);
              setHasEnteredDecision(false);
              setExpandedInsight(null);
              void refetch();
            }}
            disabled={isFetching}
            title={t('dailyReview.header.refreshTitle')}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? t('dailyReview.header.refreshing') : t('dailyReview.header.refresh')}
          </Button>
        </div>
      </div>

      {setActiveStrategyMutation.isError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{t('sidebar.updateError')}</p>
      ) : null}

      {/* Strategy Readiness Blocker */}
      {!strategyReadiness.isReady && !dismissedReadinessBlocker && (
        <StrategyReadinessBlocker
          onDismiss={() => setDismissedReadinessBlocker(true)}
          onConfigureStrategy={() => navigate('/onboarding')}
        />
      )}

      {totalActions === 0 ? (
        <Section title={t('dailyReview.sequential.todayTitle')}>
          <div className="py-12 text-center">
            <h2 className="mb-2 text-xl font-medium">{t('dailyReview.sequential.noActionRequired')}</h2>
            <p className="text-gray-500 dark:text-gray-400">{t('dailyReview.sequential.strategyAligned')}</p>
            <p className="mt-4 text-gray-400 dark:text-gray-500">{t('dailyReview.sequential.disciplineMaintained')}</p>
          </div>
        </Section>
      ) : !hasEnteredDecision ? (
        <Section title={t('dailyReview.sequential.attentionTitle')}>
          <div className="space-y-4 py-8">
            <p>
              {t('dailyReview.sequential.attentionNewCandidates', {
                count: recommendedCandidates.length,
                suffix: recommendedCandidates.length === 1 ? '' : 's',
              })}
            </p>
            <p>
              {t('dailyReview.sequential.attentionStopUpdates', {
                count: review.positionsUpdateStop.length,
                suffix: review.positionsUpdateStop.length === 1 ? '' : 's',
              })}
            </p>
            <p>
              {t('dailyReview.sequential.attentionCloses', {
                count: review.positionsClose.length,
                suffix: review.positionsClose.length === 1 ? '' : 's',
              })}
            </p>
            <Button
              onClick={() => {
                setCurrentStepIndex(0);
                setHasEnteredDecision(true);
                setExpandedInsight(null);
              }}
            >
              {t('dailyReview.sequential.enterDecisionMode')}
            </Button>
          </div>
        </Section>
      ) : (
        <div className="space-y-6">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('dailyReview.sequential.progress', {
              step: safeStepIndex + 1,
              total: filteredSteps.length,
            })}
          </div>

          {currentStep === 'new' ? (
            <Section title={t('dailyReview.sections.newTradeCandidates', { count: recommendedCandidates.length })}>
              <div className="space-y-3">
                <GlossaryLegend metricKeys={DAILY_REVIEW_GLOSSARY_KEYS} title={t('dailyReview.sections.dailyGlossary')} />
                {hiddenCandidates > 0 ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('dailyReview.sections.showingRecommendedOnly', {
                      count: hiddenCandidates,
                      suffix: hiddenCandidates === 1 ? '' : 's',
                    })}
                  </p>
                ) : null}
                <CandidatesTable
                  candidates={recommendedCandidates}
                  onShowRecommendation={setInsightCandidate}
                  onCreateOrder={(candidate) => {
                    setSelectedCandidate(candidate);
                    setShowCreateOrderModal(true);
                  }}
                />
                <InsightPanel
                  title={t('dailyReview.insight.new.title')}
                  summary={t('dailyReview.insight.new.summary')}
                  isExpanded={expandedInsight === 'new'}
                  onToggle={() => setExpandedInsight((current) => (current === 'new' ? null : 'new'))}
                  details={
                    <div className="space-y-1">
                      <p>{t('dailyReview.insight.new.points.trend')}</p>
                      <p>{t('dailyReview.insight.new.points.rr')}</p>
                      <p>{t('dailyReview.insight.new.points.volatility')}</p>
                      <p className="mt-2 italic">{t('dailyReview.insight.new.note')}</p>
                    </div>
                  }
                />
              </div>
            </Section>
          ) : null}

          {currentStep === 'update' ? (
            <Section title={t('dailyReview.sections.updateStop', { count: review.positionsUpdateStop.length })}>
              <div className="space-y-3">
                <GlossaryLegend metricKeys={DAILY_REVIEW_GLOSSARY_KEYS} title={t('dailyReview.sections.stopGlossary')} />
                <UpdateStopTable
                  positions={review.positionsUpdateStop}
                  onAction={(position) => {
                    setClosePositionId(null);
                    setUpdateStopPositionId(position.positionId);
                  }}
                />
                <InsightPanel
                  title={t('dailyReview.insight.update.title')}
                  summary={t('dailyReview.insight.update.summary')}
                  isExpanded={expandedInsight === 'update'}
                  onToggle={() => setExpandedInsight((current) => (current === 'update' ? null : 'update'))}
                  details={
                    <div className="space-y-1">
                      <p>{t('dailyReview.insight.update.points.trailing')}</p>
                      <p>{t('dailyReview.insight.update.points.volatility')}</p>
                      <p>{t('dailyReview.insight.update.points.trend')}</p>
                    </div>
                  }
                />
              </div>
            </Section>
          ) : null}

          {currentStep === 'close' ? (
            <Section title={t('dailyReview.sections.closeSuggested', { count: review.positionsClose.length })}>
              <div className="space-y-3">
                <CloseTable
                  positions={review.positionsClose}
                  onAction={(position) => {
                    setUpdateStopPositionId(null);
                    setClosePositionId(position.positionId);
                  }}
                />
                <InsightPanel
                  title={t('dailyReview.insight.close.title')}
                  summary={t('dailyReview.insight.close.summary')}
                  isExpanded={expandedInsight === 'close'}
                  onToggle={() => setExpandedInsight((current) => (current === 'close' ? null : 'close'))}
                  details={
                    <div className="space-y-1">
                      <p>{t('dailyReview.insight.close.points.stop')}</p>
                      <p>{t('dailyReview.insight.close.points.trend')}</p>
                      <p>{t('dailyReview.insight.close.points.risk')}</p>
                    </div>
                  }
                />
              </div>
            </Section>
          ) : null}

          <div className="flex justify-between">
            <Button
              variant="secondary"
              disabled={safeStepIndex === 0}
              onClick={() => setCurrentStepIndex((index) => Math.max(index - 1, 0))}
            >
              {t('dailyReview.sequential.back')}
            </Button>
            <Button
              onClick={() => {
                if (isLastStep) {
                  setCurrentStepIndex(0);
                  return;
                }
                setCurrentStepIndex((index) => Math.min(index + 1, filteredSteps.length - 1));
              }}
            >
              {isLastStep ? t('dailyReview.sequential.finish') : t('dailyReview.sequential.continue')}
            </Button>
          </div>
        </div>
      )}

      {updateStopPosition ? (
        <UpdateStopModalForm
          position={updateStopPosition}
          onClose={() => setUpdateStopPositionId(null)}
          onSubmit={(request) => {
            if (!updateStopPosition.positionId) return;
            updateStopMutation.mutate({
              positionId: updateStopPosition.positionId,
              request,
            });
          }}
          isLoading={updateStopMutation.isPending}
          error={updateStopMutation.error?.message}
        />
      ) : null}

      {closePosition ? (
        <ClosePositionModalForm
          position={closePosition}
          onClose={() => setClosePositionId(null)}
          onSubmit={(request) => {
            if (!closePosition.positionId) return;
            closePositionMutation.mutate({
              positionId: closePosition.positionId,
              request,
            });
          }}
          isLoading={closePositionMutation.isPending}
          error={closePositionMutation.error?.message}
        />
      ) : null}

      {insightCandidate ? (
        <TradeInsightModal
          ticker={insightCandidate.ticker}
          recommendation={insightCandidate.recommendation}
          currency="USD"
          defaultTab="recommendation"
          onClose={() => setInsightCandidate(null)}
        />
      ) : null}

      {showCreateOrderModal && selectedCandidate ? (
        <CandidateOrderModal
          candidate={{
            ticker: selectedCandidate.ticker,
            signal: selectedCandidate.signal,
            entry: selectedCandidate.entry,
            stop: selectedCandidate.stop,
            shares: selectedCandidate.shares,
            recommendation: selectedCandidate.recommendation,
            sector: selectedCandidate.sector,
            rReward: selectedCandidate.rReward,
          }}
          risk={riskConfig}
          defaultNotes={t('dailyReview.defaultNotes', {
            entry: formatCurrency(selectedCandidate.entry),
            rr: formatNumber(selectedCandidate.rReward, 1),
          })}
          onClose={() => {
            setShowCreateOrderModal(false);
            setSelectedCandidate(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.orders() });
            setShowCreateOrderModal(false);
            setSelectedCandidate(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CandidatesTable({
  candidates,
  onShowRecommendation,
  onCreateOrder,
}: {
  candidates: DailyReviewCandidate[];
  onShowRecommendation: (candidate: DailyReviewCandidate) => void;
  onCreateOrder: (candidate: DailyReviewCandidate) => void;
}) {
  const columns: ColumnDef<DailyReviewCandidate>[] = [
    {
      key: 'ticker',
      header: t('dailyReview.table.candidates.headers.ticker'),
      renderCell: (candidate) => (
        <TickerWithChart
          ticker={candidate.ticker}
          title={t('dailyReview.table.candidates.yahooFinanceTooltip', { ticker: candidate.ticker })}
        />
      ),
    },
    {
      key: 'confidence',
      header: <MetricHelpLabel metricKey="CONFIDENCE" className="justify-end w-full" />,
      renderCell: (candidate) => (
        <div className="text-right">
          <span className="font-semibold text-purple-600">
            {candidate.confidence != null ? formatNumber(candidate.confidence, 1) : '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'signal',
      header: t('dailyReview.table.candidates.headers.signal'),
      renderCell: (candidate) => <Badge variant="primary">{candidate.signal}</Badge>,
    },
    {
      key: 'entry',
      header: <div className="text-right">{t('dailyReview.table.candidates.headers.entry')}</div>,
      renderCell: (candidate) => <div className="text-right">{formatCurrency(candidate.entry)}</div>,
    },
    {
      key: 'stop',
      header: <div className="text-right">{t('dailyReview.table.candidates.headers.stop')}</div>,
      renderCell: (candidate) => <div className="text-right">{formatCurrency(candidate.stop)}</div>,
    },
    {
      key: 'shares',
      header: <div className="text-right">{t('dailyReview.table.candidates.headers.shares')}</div>,
      renderCell: (candidate) => <div className="text-right">{candidate.shares}</div>,
    },
    {
      key: 'rr',
      header: <MetricHelpLabel metricKey="RR" labelOverride="R:R" className="justify-end w-full" />,
      renderCell: (candidate) => (
        <div className="flex justify-end">
          <Badge
            variant={candidate.rReward >= 2 ? 'success' : 'warning'}
            title={t('dailyReview.table.candidates.rrBadgeTitle')}
          >
            {t('common.units.rValue', { value: formatNumber(candidate.rReward, 1) })}
          </Badge>
        </div>
      ),
    },
    {
      key: 'sector',
      header: t('dailyReview.table.candidates.headers.sector'),
      renderCell: (candidate) => (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {candidate.sector || t('common.placeholders.dash')}
        </div>
      ),
    },
    {
      key: 'info',
      header: <div className="text-center">{t('dailyReview.table.candidates.headers.info')}</div>,
      renderCell: (candidate) =>
        candidate.recommendation ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => onShowRecommendation(candidate)}
              className="min-h-11 min-w-11 rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
              title={t('dailyReview.table.candidates.recommendationTitle')}
              aria-label={t('dailyReview.table.candidates.recommendationAria', { ticker: candidate.ticker })}
            >
              <Info className="w-4 h-4" />
            </button>
          </div>
        ) : null,
    },
    {
      key: 'action',
      header: <div className="text-right">{t('dailyReview.table.candidates.headers.action')}</div>,
      renderCell: (candidate) => (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onCreateOrder(candidate)}
            title={
              candidate.recommendation?.verdict === 'NOT_RECOMMENDED'
                ? t('dailyReview.table.candidates.createOrderNotRecommendedTitle')
                : t('dailyReview.table.candidates.createOrderTitle')
            }
          >
            {t('dailyReview.table.candidates.createOrder')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={candidates}
      columns={columns}
      emptyState={t('dailyReview.table.candidates.empty')}
      className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40"
    />
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
  const columns: ColumnDef<DailyReviewPositionUpdate>[] = [
    {
      key: 'ticker',
      header: t('dailyReview.table.update.headers.ticker'),
      renderCell: (pos) => (
        <TickerWithChart
          ticker={pos.ticker}
          title={t('dailyReview.table.update.yahooFinanceTooltip', { ticker: pos.ticker })}
        />
      ),
    },
    {
      key: 'entry',
      header: <div className="text-right">{t('dailyReview.table.update.headers.entry')}</div>,
      renderCell: (pos) => <div className="text-right">{formatCurrency(pos.entryPrice)}</div>,
    },
    {
      key: 'current',
      header: <div className="text-right">{t('dailyReview.table.update.headers.current')}</div>,
      renderCell: (pos) => <div className="text-right">{formatCurrency(pos.currentPrice)}</div>,
    },
    {
      key: 'stopOld',
      header: <div className="text-right">{t('dailyReview.table.update.headers.stopOld')}</div>,
      renderCell: (pos) => (
        <div className="text-right text-gray-600 dark:text-gray-400">{formatCurrency(pos.stopCurrent)}</div>
      ),
    },
    {
      key: 'stopNew',
      header: <div className="text-right">{t('dailyReview.table.update.headers.stopNew')}</div>,
      renderCell: (pos) => (
        <div className="text-right font-bold text-green-700 dark:text-green-300">
          {formatCurrency(pos.stopSuggested)}
        </div>
      ),
    },
    {
      key: 'rNow',
      header: <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />,
      renderCell: (pos) => (
        <div className="flex justify-end">
          <Badge
            variant={pos.rNow >= 1 ? 'success' : pos.rNow >= 0 ? 'warning' : 'error'}
            title={t('dailyReview.table.update.rNowBadgeTitle')}
          >
            {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
          </Badge>
        </div>
      ),
    },
    {
      key: 'reason',
      header: t('dailyReview.table.update.headers.reason'),
      renderCell: (pos) => <div className="text-sm">{formatDailyReviewReason(pos.reason)}</div>,
    },
    {
      key: 'action',
      header: <div className="text-right">{t('dailyReview.table.update.headers.action')}</div>,
      renderCell: (pos) => (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAction(pos)}
            title={t('dailyReview.table.update.actionTitle')}
          >
            {t('dailyReview.table.update.actionLabel')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={positions}
      columns={columns}
      emptyState={t('dailyReview.table.update.empty')}
      className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40"
    />
  );
}

function CloseTable({
  positions,
  onAction,
}: {
  positions: DailyReviewPositionClose[];
  onAction: (position: DailyReviewPositionClose) => void;
}) {
  const columns: ColumnDef<DailyReviewPositionClose>[] = [
    {
      key: 'ticker',
      header: t('dailyReview.table.close.headers.ticker'),
      renderCell: (pos) => (
        <TickerWithChart
          ticker={pos.ticker}
          title={t('dailyReview.table.close.yahooFinanceTooltip', { ticker: pos.ticker })}
        />
      ),
    },
    {
      key: 'entry',
      header: <div className="text-right">{t('dailyReview.table.close.headers.entry')}</div>,
      renderCell: (pos) => <div className="text-right">{formatCurrency(pos.entryPrice)}</div>,
    },
    {
      key: 'current',
      header: <div className="text-right">{t('dailyReview.table.close.headers.current')}</div>,
      renderCell: (pos) => <div className="text-right">{formatCurrency(pos.currentPrice)}</div>,
    },
    {
      key: 'stop',
      header: <div className="text-right">{t('dailyReview.table.close.headers.stop')}</div>,
      renderCell: (pos) => <div className="text-right">{formatCurrency(pos.stopPrice)}</div>,
    },
    {
      key: 'rNow',
      header: <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />,
      renderCell: (pos) => (
        <div className="flex justify-end">
          <Badge
            variant={pos.rNow > 0 ? 'warning' : 'error'}
            title={t('dailyReview.table.close.rNowBadgeTitle')}
          >
            {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
          </Badge>
        </div>
      ),
    },
    {
      key: 'reason',
      header: t('dailyReview.table.close.headers.reason'),
      renderCell: (pos) => <div className="text-sm">{formatDailyReviewReason(pos.reason)}</div>,
    },
    {
      key: 'action',
      header: <div className="text-right">{t('dailyReview.table.close.headers.action')}</div>,
      renderCell: (pos) => (
        <div className="flex justify-end">
          <Button
            variant="danger"
            size="sm"
            onClick={() => onAction(pos)}
            title={t('dailyReview.table.close.actionTitle')}
          >
            {t('dailyReview.table.close.actionLabel')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={positions}
      columns={columns}
      emptyState={t('dailyReview.table.close.empty')}
      className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40"
    />
  );
}

function TickerWithChart({ ticker, title }: { ticker: string; title: string }) {
  return (
    <div className="font-mono font-bold">
      <a
        href={`https://finance.yahoo.com/quote/${ticker}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 hover:underline"
        title={title}
      >
        {ticker}
      </a>
    </div>
  );
}
