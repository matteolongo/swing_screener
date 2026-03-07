import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useDailyReview } from '@/features/dailyReview/api';
import Card, { CardContent } from '@/components/common/Card';
import Button from '@/components/common/Button';
import CollapsibleSection from '@/components/common/CollapsibleSection';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { useActiveStrategyQuery } from '@/features/strategy/hooks';
import { DEFAULT_CONFIG, type RiskConfig } from '@/types/config';
import GlossaryLegend from '@/components/domain/education/GlossaryLegend';
import { DAILY_REVIEW_GLOSSARY_KEYS } from '@/content/educationGlossary';
import TradeInsightModal from '@/components/domain/recommendation/TradeInsightModal';
import CandidateOrderModal from '@/components/domain/orders/CandidateOrderModal';
import { RefreshCw } from 'lucide-react';
import { queryKeys } from '@/lib/queryKeys';
import { t } from '@/i18n/t';
import {
  parseUniverseFromStorage,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage';
import { useBeginnerModeStore } from '@/stores/beginnerModeStore';
import { useStrategyReadiness } from '@/features/strategy/useStrategyReadiness';
import StrategyReadinessBlocker from '@/components/domain/onboarding/StrategyReadinessBlocker';
import DailyReviewSummaryCard from '@/components/domain/dailyReview/DailyReviewSummaryCard';
import DailyReviewCandidatesTable from '@/components/domain/dailyReview/DailyReviewCandidatesTable';
import DailyReviewUpdateStopTable from '@/components/domain/dailyReview/DailyReviewUpdateStopTable';
import DailyReviewCloseTable from '@/components/domain/dailyReview/DailyReviewCloseTable';
import DailyReviewHoldTable from '@/components/domain/dailyReview/DailyReviewHoldTable';
import { useDailyReviewPageState } from '@/features/dailyReview/useDailyReviewPageState';

export default function DailyReview() {
  const {
    expandedSections,
    toggleSection,
    insightCandidate,
    setInsightCandidate,
    showCreateOrderModal,
    setShowCreateOrderModal,
    selectedCandidate,
    setSelectedCandidate,
    dismissedReadinessBlocker,
    setDismissedReadinessBlocker,
    isCompactMobileLayout,
    watchItemsByTicker,
    watchPending,
    handleWatch,
    handleUnwatch,
    openWorkspacePortfolioAction,
  } = useDailyReviewPageState();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const selectedUniverse = parseUniverseFromStorage(localStorage.getItem(SCREENER_UNIVERSE_STORAGE_KEY));
  const { data: review, isLoading, error, refetch, isFetching } = useDailyReview(200, selectedUniverse);
  const activeStrategyQuery = useActiveStrategyQuery();
  const { isBeginnerMode } = useBeginnerModeStore();
  const { isReady: strategyReady } = useStrategyReadiness();
  const riskConfig: RiskConfig = activeStrategyQuery.data?.risk ?? DEFAULT_CONFIG.risk;

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

  const sectionExpandLabel = t('dailyReview.sections.expand');
  const sectionCollapseLabel = t('dailyReview.sections.collapse');
  const actionsBadgeLabel = (count: number) =>
    t('dailyReview.sections.actionsBadge', { count, suffix: count !== 1 ? 's' : '' });

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <DailyReviewSummaryCard title={t('dailyReview.summary.newCandidates')} value={summary.newCandidates} variant="blue" icon="📈" />
        <DailyReviewSummaryCard
          title={t('dailyReview.summary.updateStop')}
          value={summary.updateStop}
          variant={summary.updateStop > 0 ? 'yellow' : 'gray'}
          icon="🔄"
        />
        <DailyReviewSummaryCard
          title={t('dailyReview.summary.closePositions')}
          value={summary.closePositions}
          variant={summary.closePositions > 0 ? 'red' : 'gray'}
          icon="❌"
        />
        <DailyReviewSummaryCard title={t('dailyReview.summary.holdPositions')} value={summary.noAction} variant="green" icon="✅" />
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
        expandLabel={sectionExpandLabel}
        collapseLabel={sectionCollapseLabel}
      >
        {recommendedCandidates.length === 0 ? (
          <div className="space-y-3">
            <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noRecommended')}</p>
            {hiddenCandidates > 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('dailyReview.sections.hiddenByVerdict', {
                  count: hiddenCandidates,
                  suffix: hiddenCandidates === 1 ? '' : 's',
                })}
              </p>
            ) : null}
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
            <DailyReviewCandidatesTable
              candidates={recommendedCandidates}
              onShowRecommendation={setInsightCandidate}
              onCreateOrder={(candidate) => {
                setSelectedCandidate(candidate);
                setShowCreateOrderModal(true);
              }}
              isCompactMobileLayout={isCompactMobileLayout}
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
        badgeLabel={actionsBadgeLabel(review.positionsUpdateStop.length)}
        expandLabel={sectionExpandLabel}
        collapseLabel={sectionCollapseLabel}
      >
        {review.positionsUpdateStop.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noStopUpdates')}</p>
        ) : (
          <div className="space-y-3">
            <GlossaryLegend metricKeys={DAILY_REVIEW_GLOSSARY_KEYS} title={t('dailyReview.sections.stopGlossary')} />
            <DailyReviewUpdateStopTable
              positions={review.positionsUpdateStop}
              onAction={(position) =>
                openWorkspacePortfolioAction({
                  action: 'update-stop',
                  ticker: position.ticker,
                  positionId: position.positionId,
                })
              }
              isCompactMobileLayout={isCompactMobileLayout}
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
        badgeLabel={actionsBadgeLabel(review.positionsClose.length)}
        expandLabel={sectionExpandLabel}
        collapseLabel={sectionCollapseLabel}
      >
        {review.positionsClose.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noClose')}</p>
        ) : (
          <DailyReviewCloseTable
            positions={review.positionsClose}
            onAction={(position) =>
              openWorkspacePortfolioAction({
                action: 'close-position',
                ticker: position.ticker,
                positionId: position.positionId,
              })
            }
            isCompactMobileLayout={isCompactMobileLayout}
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
        expandLabel={sectionExpandLabel}
        collapseLabel={sectionCollapseLabel}
      >
        {review.positionsHold.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">{t('dailyReview.sections.noHold')}</p>
        ) : (
          <DailyReviewHoldTable
            positions={review.positionsHold}
            isCompactMobileLayout={isCompactMobileLayout}
            watchItemsByTicker={watchItemsByTicker}
            watchPending={watchPending}
            onWatch={handleWatch}
            onUnwatch={handleUnwatch}
          />
        )}
      </CollapsibleSection>

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

