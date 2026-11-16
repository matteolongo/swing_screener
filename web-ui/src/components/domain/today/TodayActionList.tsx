import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import PartialCloseModalForm from '@/components/domain/positions/PartialCloseModalForm';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import { usePortfolioReview, refetchTodayPortfolio } from '@/features/dailyReview/api';
import {
  usePositions,
  useOpenPositionsIntelligence,
} from '@/features/portfolio/hooks';
import { useTodayActions } from './useTodayActions';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import {
  CloseItem,
  UpdateStopItem,
  ExitSignalItem,
  WatchlistNearTriggerItem,
  PendingOrderItem,
  OpenPositionItem,
} from './TodayActionItems';

interface TodayActionListProps {
  onTickerSelect: (ticker: string, focusInspector?: boolean) => void;
}

export default function TodayActionList({ onTickerSelect }: TodayActionListProps) {
  const selectedItemId = useWorkspaceStore((state) => state.selection?.rowId);
  const setWorkspaceSelection = useWorkspaceStore((state) => state.setWorkspaceSelection);
  const setAnalysisTab = useWorkspaceStore((state) => state.setAnalysisTab);
  const todayRun = useScreenerStore((state) => state.todayRun);
  const queryClient = useQueryClient();
  const { data: review, isLoading, error, refetch, isFetching } = usePortfolioReview();
  const watchlistNearTrigger = review?.watchlistNearTrigger;
  const { data: intelligenceSummaries } = useOpenPositionsIntelligence();
  const intelligenceByTicker = useMemo(
    () => new Map(intelligenceSummaries?.map((s) => [s.ticker, s]) ?? []),
    [intelligenceSummaries],
  );

  const openPositionsQuery = usePositions('open');
  const openPositions = openPositionsQuery.data ?? [];
  const positionById = useMemo(
    () => new Map(openPositionsQuery.data?.map((p) => [p.positionId, p]) ?? []),
    [openPositionsQuery.data],
  );
  const trimSuggestionByPositionId = useMemo(
    () => new Map(review?.positionsHold.map((item) => [item.positionId, item.trimSuggestion]) ?? []),
    [review?.positionsHold],
  );

  const selectTodayTicker = useCallback((ticker: string, rowId: string, focusInspector = true) => {
    const normalized = ticker.trim().toUpperCase();
    const candidate = todayRun?.result.candidates.find((item) => item.ticker.toUpperCase() === normalized);
    setWorkspaceSelection({
      ticker: normalized,
      source: rowId.startsWith('watch-') ? 'today_watchlist' : 'today_position',
      runId: candidate ? todayRun?.completedAt : undefined,
      candidate,
      rowId,
    });
    setAnalysisTab('overview');
    onTickerSelect(normalized, focusInspector);
  }, [onTickerSelect, setAnalysisTab, setWorkspaceSelection, todayRun]);

  const {
    doneIds,
    acceptStopMutation,
    updateStopMutation,
    closePositionMutation,
    partialCloseMutation,
    updateStopTarget,
    setUpdateStopTarget,
    closeTarget,
    setCloseTarget,
    trimTarget,
    setTrimTarget,
    handleListKeyDown,
    handleAcceptStop,
    handleUpdateStop,
    handleClosePosition,
    handlePartialClose,
  } = useTodayActions(selectTodayTicker, openPositions, openPositionsQuery.isError);

  const positionsCloseCount = review?.positionsClose.length ?? 0;
  const updateStopCount = review?.positionsUpdateStop.length ?? 0;
  const requiresActionCount = positionsCloseCount + updateStopCount;
  const exitSignalCount = review?.positionsExitSignal.length ?? 0;
  const watchlistNearTriggerCount = watchlistNearTrigger?.length ?? 0;
  const pendingOrderCount = review?.pendingOrdersReview?.length ?? 0;
  const evaluationErrors = review?.evaluationErrors ?? [];
  const sectionErrors = review?.sectionErrors ?? [];
  const isRefreshing = isFetching || openPositionsQuery.isFetching;
  const refreshPortfolio = () => refetchTodayPortfolio(queryClient);
  const isEmpty = !isLoading && !openPositionsQuery.isLoading && !error && !openPositionsQuery.error &&
    openPositions.length === 0 && requiresActionCount === 0 && exitSignalCount === 0 &&
    watchlistNearTriggerCount === 0 && pendingOrderCount === 0 && evaluationErrors.length === 0 &&
    sectionErrors.length === 0;

  return (
    <div className="flex min-w-0 flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          {review && (
            <>
              <span className="text-xs text-muted">{t('cockpit.review.portfolioChecked', { date: review.summary.reviewDate })}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => void refreshPortfolio()}
          disabled={isRefreshing}
          title={t('dailyReview.header.refreshTitle')}
          aria-label={t('dailyReview.header.refreshTitle')}
          className="grid h-11 w-11 place-items-center rounded hover:bg-foreground/5 text-muted disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', (isRefreshing) && 'motion-safe:animate-spin')} aria-hidden="true" />
        </button>
      </div>

      {/* Summary chips */}
      {(requiresActionCount > 0 || pendingOrderCount > 0) && <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border shrink-0">
          {updateStopCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">
              {t('dailyReviewBanner.stopsToUpdate', { n: String(review?.positionsUpdateStop.length ?? 0) })}
            </span>
          )}
          {positionsCloseCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-danger/10 text-danger font-medium">
              {t('dailyReviewBanner.positionsToClose', { n: String(review?.positionsClose.length ?? 0) })}
            </span>
          )}
          {pendingOrderCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">
              {t('todayPage.actionList.pendingOrdersSection')} · {pendingOrderCount}
            </span>
          )}
      </div>}

      {/* Action list */}
      <div
        className="space-y-3 px-2 py-2"
        onKeyDown={handleListKeyDown}
      >
        {error && (
          <div className="flex items-center gap-2 px-2 text-sm text-danger">
            {t('dailyReview.header.error', { message: error instanceof Error ? error.message : t('dailyReview.header.unknownError') })}
            <button type="button" onClick={() => refetch()} className="underline">{t('todayPage.actionList.retryReview')}</button>
          </div>
        )}
        {openPositionsQuery.error && (
          <div className="flex items-center gap-2 px-2 text-sm text-danger">
            {t('dailyReview.header.error', { message: openPositionsQuery.error instanceof Error ? openPositionsQuery.error.message : t('dailyReview.header.unknownError') })}
            <button type="button" onClick={() => openPositionsQuery.refetch()} className="underline">{t('todayPage.actionList.retryPositions')}</button>
          </div>
        )}
        {isLoading && (
          <p className="px-2 text-sm text-muted">{t('todayPage.actionList.loadingReview')}</p>
        )}
        {openPositionsQuery.isLoading && (
          <p className="px-2 text-sm text-muted">{t('todayPage.actionList.loadingPositions')}</p>
        )}
        {isEmpty && (
          <p className="text-sm text-muted px-2 py-4 text-center">
            {t('todayPage.actionList.empty')}
          </p>
        )}

        {sectionErrors.length > 0 && (
          <div role="alert" className="space-y-1 rounded bg-warning/10 px-3 py-2 text-sm text-warning">
            <p className="font-semibold">{t('todayPage.actionList.sectionsUnavailable')}</p>
            <ul className="list-inside list-disc break-words">
              {sectionErrors.map(({ section }) => (
                <li key={section}>{t(`todayPage.actionList.sectionUnavailable.${section}`)}</li>
              ))}
            </ul>
            <button type="button" disabled={isFetching} onClick={() => void refetch()} className="min-h-11 underline">
              {t('todayPage.actionList.retryReview')}
            </button>
          </div>
        )}

        {evaluationErrors.length > 0 && (
          <div role="alert" className="space-y-1 rounded bg-warning/10 px-3 py-2 text-sm text-warning">
            <p className="font-semibold">{t('todayPage.actionList.incompleteReview')}</p>
            <ul className="list-inside list-disc break-words">
              {evaluationErrors.map(({ symbol, message }, index) => (
                <li key={symbol + index}>{t('todayPage.actionList.evaluationFailed', { symbol, message })}</li>
              ))}
            </ul>
            <button type="button" disabled={isFetching} onClick={() => void refetch()} className="min-h-11 underline">
              {t('todayPage.actionList.retryReview')}
            </button>
          </div>
        )}

        {requiresActionCount > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-danger bg-danger/10 rounded">
              {t('todayPage.actionList.requiresAction')} · {requiresActionCount}
            </div>
            <div className="space-y-0.5">
              {review?.positionsClose.map((item) => {
                const position = positionById.get(item.positionId);
                return (
                  <CloseItem
                    key={item.positionId}
                    item={item}
                    onClick={(ticker) => selectTodayTicker(ticker, `close-${item.positionId}`)}
                    onAction={position ? () => setCloseTarget(position) : undefined}
                    isDone={doneIds.has(item.positionId)}
                    isFocused={selectedItemId === `close-${item.positionId}`}
                    intelligenceSummary={intelligenceByTicker.get(item.ticker)}
                  />
                );
              })}
              {review?.positionsUpdateStop.map((item) => {
                const position = positionById.get(item.positionId);
                const matchesAttempt = acceptStopMutation.variables?.positionId === item.positionId &&
                  acceptStopMutation.variables.request.newStop === item.stopSuggested;
                return (
                  <UpdateStopItem
                    key={item.positionId}
                    item={item}
                    onClick={(ticker) => selectTodayTicker(ticker, `stop-${item.positionId}`)}
                    onAction={position ? () => setUpdateStopTarget(position) : undefined}
                    onAccept={position && !openPositionsQuery.isError ? (positionId, stopSuggested, reason) =>
                      handleAcceptStop(positionId, stopSuggested, reason)
                    : undefined}
                    isDone={doneIds.has(item.positionId) ||
                      (position != null && position.stopPrice >= item.stopSuggested) ||
                      (matchesAttempt && acceptStopMutation.isSuccess)}
                    isAccepting={matchesAttempt && acceptStopMutation.isPending}
                    acceptDisabled={acceptStopMutation.isPending || isRefreshing || Boolean(error)}
                    acceptError={matchesAttempt ? acceptStopMutation.error?.message : undefined}
                    onRefresh={refreshPortfolio}
                    isFocused={selectedItemId === `stop-${item.positionId}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {exitSignalCount > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warning bg-warning/10 rounded">
              {t('todayPage.actionList.exitSignal')} · {exitSignalCount}
            </div>
            <div className="space-y-0.5">
              {review?.positionsExitSignal.map((item) => {
                return (
                  <ExitSignalItem
                    key={item.positionId}
                    item={item}
                    onClick={(ticker) => selectTodayTicker(ticker, `exit-${item.positionId}`)}
                  isFocused={selectedItemId === `exit-${item.positionId}`}
                    intelligenceSummary={intelligenceByTicker.get(item.ticker)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {(review?.pendingOrdersReview ?? []).length > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warning bg-warning/10 rounded">
              {t('todayPage.actionList.pendingOrdersSection')} · {review!.pendingOrdersReview!.length}
            </div>
            <div className="space-y-0.5">
              {review!.pendingOrdersReview!.map((item) => {
                return (
                  <PendingOrderItem
                    key={item.orderId}
                    item={item}
                    onClick={(ticker) => selectTodayTicker(ticker, `pending-${item.orderId}`)}
                    isFocused={selectedItemId === `pending-${item.orderId}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {watchlistNearTriggerCount > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warning bg-warning/10 rounded">
              {t('watchlist.pipeline.dailyReviewTitle')} · {watchlistNearTriggerCount}
            </div>
            <p className="px-3 text-[11px] text-muted">
              {t('watchlist.pipeline.dailyReviewSubtitle', { count: String(watchlistNearTriggerCount) })}
            </p>
            <div className="space-y-0.5">
              {watchlistNearTrigger?.map((item) => {
                return (
                  <WatchlistNearTriggerItem
                    key={`watch-${item.ticker}-${item.watchedAt}`}
                    item={item}
                    onClick={(ticker) => selectTodayTicker(ticker, `watch-${item.ticker}-${item.watchedAt}`)}
                    isFocused={selectedItemId === `watch-${item.ticker}-${item.watchedAt}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {openPositions.length > 0 && (
          <div className="space-y-1">
            <div className="rounded bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {t('todayPage.actionList.openPositions')} · {openPositions.length}
            </div>
            <div className="space-y-0.5">
              {openPositions.map((position) => (
                <OpenPositionItem
                  key={position.positionId}
                  item={position}
                  onClick={(ticker) => selectTodayTicker(ticker, `position-${position.positionId ?? ticker}`)}
                  isFocused={selectedItemId === `position-${position.positionId ?? position.ticker}`}
                  intelligenceSummary={intelligenceByTicker.get(position.ticker)}
                  trimSuggestion={trimSuggestionByPositionId.get(position.positionId ?? '')}
                  onTrim={() => setTrimTarget(position)}
                />
              ))}
            </div>
          </div>
        )}

      </div>

      {updateStopTarget && (
        <UpdateStopModalForm
          position={updateStopTarget}
          isLoading={updateStopMutation.isPending}
          error={updateStopMutation.error instanceof Error ? updateStopMutation.error.message : undefined}
          onClose={() => setUpdateStopTarget(null)}
          onSubmit={(req) => handleUpdateStop(updateStopTarget, req)}
        />
      )}
      {closeTarget && (
        <ClosePositionModalForm
          position={closeTarget}
          isLoading={closePositionMutation.isPending}
          error={closePositionMutation.error instanceof Error ? closePositionMutation.error.message : undefined}
          onClose={() => setCloseTarget(null)}
          onSubmit={(req) => handleClosePosition(closeTarget, req)}
        />
      )}
      {trimTarget && (
        <PartialCloseModalForm
          position={trimTarget}
          isLoading={partialCloseMutation.isPending}
          error={partialCloseMutation.error instanceof Error ? partialCloseMutation.error.message : undefined}
          onClose={() => setTrimTarget(null)}
          onSubmit={(req) => handlePartialClose(trimTarget, req)}
        />
      )}
    </div>
  );
}
