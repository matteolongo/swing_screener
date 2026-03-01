import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDailyReview } from '@/features/dailyReview/api';
import Card, { CardHeader, CardTitle, CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import { DataTable, type ColumnDef } from '@/components/ui/DataTable';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { useSetActiveStrategyMutation, useStrategiesQuery } from '@/features/strategy/hooks';
import { DEFAULT_CONFIG, type RiskConfig } from '@/types/config';
import GlossaryLegend from '@/components/domain/education/GlossaryLegend';
import MetricHelpLabel from '@/components/domain/education/MetricHelpLabel';
import { DAILY_REVIEW_GLOSSARY_KEYS } from '@/content/educationGlossary';
import TradeInsightModal from '@/components/domain/recommendation/TradeInsightModal';
import CandidateOrderModal from '@/components/domain/orders/CandidateOrderModal';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import { queryKeys } from '@/lib/queryKeys';
import { t } from '@/i18n/t';
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

export default function DailyReview() {
  const [expandedSections, setExpandedSections] = useState({
    candidates: true,
    hold: false,
    update: true,
    close: true,
  });
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
  const selectedUniverse = parseUniverseFromStorage(localStorage.getItem(SCREENER_UNIVERSE_STORAGE_KEY));
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
      } catch {
        // Mutation state surfaces the error to the user.
      }
    },
    [setActiveStrategyId, setActiveStrategyMutation]
  );
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

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
  const recommendedCandidates = review.newCandidates.filter(
    (candidate) => candidate.recommendation?.verdict === 'RECOMMENDED',
  );
  const hiddenCandidates = review.newCandidates.length - recommendedCandidates.length;
  const quickActionCandidate = recommendedCandidates[0] ?? null;

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title={t('dailyReview.summary.newCandidates')} value={summary.newCandidates} variant="blue" icon="📈" />
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
                {t('dailyReview.quickAction.description', { ticker: quickActionCandidate.ticker })}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                setSelectedCandidate(quickActionCandidate);
                setShowCreateOrderModal(true);
              }}
            >
              {t('dailyReview.quickAction.cta', { ticker: quickActionCandidate.ticker })}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <CollapsibleSection
        title={t('dailyReview.sections.newTradeCandidates', { count: recommendedCandidates.length })}
        isExpanded={expandedSections.candidates}
        onToggle={() => toggleSection('candidates')}
        count={recommendedCandidates.length}
      >
        {recommendedCandidates.length === 0 ? (
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noRecommended')}</p>
            {hiddenCandidates > 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dailyReview.sections.hiddenByVerdict', {
                  count: hiddenCandidates,
                  suffix: hiddenCandidates === 1 ? '' : 's',
                })}
              </p>
            ) : null}
          </div>
        ) : (
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
              onAction={(position) => {
                setClosePositionId(null);
                setUpdateStopPositionId(position.positionId);
              }}
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
              onAction={(position) => {
                setUpdateStopPositionId(null);
                setClosePositionId(position.positionId);
              }}
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
          <HoldTable positions={review.positionsHold} />
        )}
      </CollapsibleSection>

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
        <div className="text-right font-bold">
          {t('common.units.rValue', { value: formatNumber(candidate.rReward, 1) })}
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
        <div className="text-right">
          <span className={pos.rNow >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
            {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
          </span>
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
        <div className="text-right">
          <span className="font-bold text-red-700 dark:text-red-300">
            {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
          </span>
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

function HoldTable({
  positions,
}: {
  positions: DailyReviewPositionHold[];
}) {
  const columns: ColumnDef<DailyReviewPositionHold>[] = [
    {
      key: 'ticker',
      header: t('dailyReview.table.hold.headers.ticker'),
      renderCell: (pos) => (
        <TickerWithChart
          ticker={pos.ticker}
          title={t('dailyReview.table.hold.yahooFinanceTooltip', { ticker: pos.ticker })}
        />
      ),
    },
    {
      key: 'entry',
      header: <div className="text-right">{t('dailyReview.table.hold.headers.entry')}</div>,
      renderCell: (pos) => <div className="text-right">{formatCurrency(pos.entryPrice)}</div>,
    },
    {
      key: 'current',
      header: <div className="text-right">{t('dailyReview.table.hold.headers.current')}</div>,
      renderCell: (pos) => <div className="text-right">{formatCurrency(pos.currentPrice)}</div>,
    },
    {
      key: 'stop',
      header: <div className="text-right">{t('dailyReview.table.hold.headers.stop')}</div>,
      renderCell: (pos) => <div className="text-right">{formatCurrency(pos.stopPrice)}</div>,
    },
    {
      key: 'rNow',
      header: <MetricHelpLabel metricKey="R_NOW" className="justify-end w-full" />,
      renderCell: (pos) => (
        <div className="text-right">
          <span className={pos.rNow >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
            {t('common.units.rValue', { value: formatNumber(pos.rNow, 2) })}
          </span>
        </div>
      ),
    },
    {
      key: 'reason',
      header: t('dailyReview.table.hold.headers.reason'),
      renderCell: (pos) => (
        <div className="text-sm text-gray-600 dark:text-gray-400">{formatDailyReviewReason(pos.reason)}</div>
      ),
    },
  ];

  return (
    <DataTable
      data={positions}
      columns={columns}
      emptyState={t('dailyReview.table.hold.empty')}
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
      <CachedSymbolPriceChart ticker={ticker} className="mt-1" />
    </div>
  );
}
