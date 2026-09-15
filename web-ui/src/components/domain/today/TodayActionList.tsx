import { useCallback, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import PartialCloseModalForm from '@/components/domain/positions/PartialCloseModalForm';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import { usePortfolioReview, useWatchlistNearTrigger } from '@/features/dailyReview/api';
import { dailyReviewCandidateFromScreener } from '@/features/dailyReview/types';
import { filterCandidates, prioritizeCandidates } from '@/features/screener/prioritization';
import {
  usePositions,
  useOpenPositionsIntelligence,
} from '@/features/portfolio/hooks';
import { useTodayActions } from './useTodayActions';
import { useScreenerStore } from '@/stores/screenerStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import SymbolRailRow from '@/components/domain/workspace/SymbolRailRow';
import { formatWorkflowNextStep } from '@/components/domain/recommendation/workflowPresentation';
import {
  CloseItem,
  UpdateStopItem,
  CandidateItem,
  ExitSignalItem,
  WatchlistNearTriggerItem,
  PendingOrderItem,
  OpenPositionItem,
} from './TodayActionItems';

interface TodayActionListProps {
  onTickerSelect: (ticker: string) => void;
  compact?: boolean;
}

export default function TodayActionList({ onTickerSelect, compact = false }: TodayActionListProps) {
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);
  const setWorkspaceSelection = useWorkspaceStore((state) => state.setWorkspaceSelection);
  const {
    todayRun,
    todayRunInitialized,
    setTodayRunDisplayFilters,
  } = useScreenerStore();
  const { data: review, isLoading, error, refetch, isFetching } = usePortfolioReview();
  const watchlistQuery = useWatchlistNearTrigger();

  const sourceOpportunities = useMemo(() => {
    const sourceCandidates = todayRun
      ? prioritizeCandidates(todayRun.result.candidates)
      : [];
    const visibleCandidates = todayRun
      ? filterCandidates(sourceCandidates, todayRun.displayFilters)
      : [];
    const isNewOpportunity = (mode?: string) =>
      mode == null || mode === 'NEW_ENTRY' || mode === 'RE_ENTRY';
    const isAddOn = (mode?: string) => mode === 'ADD_ON' || mode === 'SCALE_BACK';

    return {
      candidates: visibleCandidates,
      newCandidates: visibleCandidates
        .filter((candidate) => isNewOpportunity(candidate.sameSymbol?.mode))
        .map(dailyReviewCandidateFromScreener),
      addOnCandidates: visibleCandidates
        .filter((candidate) => isAddOn(candidate.sameSymbol?.mode))
        .map(dailyReviewCandidateFromScreener),
    };
  }, [todayRun]);

  const composedCandidateTickers = useMemo(
    () => new Set([
      ...sourceOpportunities.newCandidates,
      ...sourceOpportunities.addOnCandidates,
    ].map((candidate) => candidate.ticker.toUpperCase())),
    [sourceOpportunities],
  );
  const watchlistNearTrigger = useMemo(
    () => (watchlistQuery.data ?? []).filter(
      (item) => !composedCandidateTickers.has(item.ticker.toUpperCase()),
    ),
    [composedCandidateTickers, watchlistQuery.data],
  );

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

  const selectTodayTicker = useCallback((ticker: string) => {
    const normalized = ticker.trim().toUpperCase();
    const candidate = sourceOpportunities.candidates
      .find((item) => item.ticker.toUpperCase() === normalized);
    const position = openPositions.find((item) => item.ticker.toUpperCase() === normalized);
    const source = candidate
      ? 'today_run'
      : watchlistNearTrigger.some((item) => item.ticker.toUpperCase() === normalized)
        ? 'today_watchlist'
        : 'today_position';
    setWorkspaceSelection({
      ticker: normalized,
      source,
      runId: candidate ? todayRun?.completedAt : undefined,
      candidate,
      rowId: candidate
        ? `today:${todayRun?.completedAt ?? 'run'}:${normalized}`
        : position?.positionId ?? `${source}:${normalized}`,
    });
    onTickerSelect(normalized);
  }, [onTickerSelect, openPositions, setWorkspaceSelection, sourceOpportunities.candidates, todayRun?.completedAt, watchlistNearTrigger]);

  const flatItems = useMemo(
    () => [
      ...openPositions.map((i) => ({ ticker: i.ticker, id: `position-${i.positionId ?? i.ticker}` })),
      ...(review?.positionsClose.map((i) => ({ ticker: i.ticker, id: `close-${i.positionId}` })) ?? []),
      ...(review?.positionsUpdateStop.map((i) => ({ ticker: i.ticker, id: `stop-${i.positionId}` })) ?? []),
      ...(review?.positionsExitSignal.map((i) => ({ ticker: i.ticker, id: `exit-${i.positionId}` })) ?? []),
      ...(review?.pendingOrdersReview?.map((i) => ({ ticker: i.ticker, id: `pending-${i.orderId}` })) ?? []),
      ...watchlistNearTrigger.map((i) => ({ ticker: i.ticker, id: `watch-${i.ticker}-${i.watchedAt}` })),
      ...sourceOpportunities.newCandidates.map((i) => ({ ticker: i.ticker, id: `candidate-${i.ticker}-${i.priorityRank ?? i.rank ?? 'unranked'}` })),
      ...sourceOpportunities.addOnCandidates.map((i) => ({ ticker: i.ticker, id: `addon-${i.ticker}-${i.priorityRank ?? i.rank ?? 'unranked'}` })),
    ],
    [openPositions, review, sourceOpportunities, watchlistNearTrigger],
  );

  const {
    doneIds,
    acceptedStops,
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
    focusedId,
    handleListKeyDown,
    handleAcceptStop,
    handleUpdateStop,
    handleClosePosition,
    handlePartialClose,
    handleItemClick,
  } = useTodayActions(flatItems, selectTodayTicker);

  const positionsCloseCount = review?.positionsClose.length ?? 0;
  const updateStopCount = review?.positionsUpdateStop.length ?? 0;
  const requiresActionCount = positionsCloseCount + updateStopCount;
  const exitSignalCount = review?.positionsExitSignal.length ?? 0;
  const watchlistNearTriggerCount = watchlistNearTrigger.length;
  const opportunitiesCount = sourceOpportunities.newCandidates.length + sourceOpportunities.addOnCandidates.length;
  const pendingOrderCount = review?.pendingOrdersReview?.length ?? 0;
  const compactRows = useMemo(() => {
    const rows: Array<{ ticker: string; status: string; context: string | null }> = [];
    const seen = new Set<string>();
    const add = (ticker: string, status: string, context: string | null = null) => {
      const normalized = ticker.toUpperCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      rows.push({ ticker, status, context });
    };

    review?.positionsClose.forEach((item) =>
      add(item.ticker, t('todayPage.actionList.close'), item.reason));
    review?.positionsUpdateStop.forEach((item) =>
      add(item.ticker, t('todayPage.actionList.updateStop'), item.reason));
    review?.positionsExitSignal.forEach((item) =>
      add(item.ticker, t('todayPage.actionList.exitSignal'), item.reason));
    review?.pendingOrdersReview?.forEach((item) =>
      add(
        item.ticker,
        t('todayPage.actionList.pendingOrdersSection'),
        t(`todayPage.actionList.pendingOrdersCategory.${item.category}`),
      ));
    sourceOpportunities.addOnCandidates.forEach((item) =>
      add(
        item.ticker,
        t('todayPage.actionList.addOn'),
        item.recommendation?.nextStep
          ? formatWorkflowNextStep(item.recommendation.nextStep)
          : null,
      ));
    sourceOpportunities.newCandidates.forEach((item) =>
      add(
        item.ticker,
        t('todayPage.actionList.opportunities'),
        item.recommendation?.nextStep
          ? formatWorkflowNextStep(item.recommendation.nextStep)
          : null,
      ));
    watchlistNearTrigger.forEach((item) =>
      add(item.ticker, t('todayPage.actionList.watchlistNearTrigger')));
    openPositions.forEach((position) =>
      add(
        position.ticker,
        t('todayPage.actionList.openPositions'),
        position.rNow == null
          ? null
          : `${position.rNow >= 0 ? '+' : ''}${position.rNow.toFixed(2)}R`,
      ));
    return rows;
  }, [openPositions, review, sourceOpportunities, watchlistNearTrigger]);

  const isLoadingSources = !todayRunInitialized || isLoading || openPositionsQuery.isLoading || watchlistQuery.isLoading;
  const isEmpty = !isLoadingSources && openPositions.length === 0 && requiresActionCount === 0 && exitSignalCount === 0 && watchlistNearTriggerCount === 0 && opportunitiesCount === 0 && pendingOrderCount === 0;

  const compactRail = compact ? (
      <div
        className="h-full space-y-1 overflow-y-auto p-2"
        data-testid="symbol-rail-list"
      >
        {compactRows.map((row) => (
          <SymbolRailRow
            key={row.ticker}
            ticker={row.ticker}
            status={row.status}
            context={row.context}
            selected={selectedTicker?.toUpperCase() === row.ticker.toUpperCase()}
            onSelect={selectTodayTicker}
          />
        ))}
        {isEmpty ? (
          <p className="px-2 py-4 text-center text-sm text-muted">
            {t('todayPage.actionList.empty')}
          </p>
        ) : null}
      </div>
  ) : null;

  return (
    <>
      {compactRail}
      <div
        className="flex flex-col h-full overflow-hidden"
        hidden={compact}
        aria-hidden={compact || undefined}
        {...(compact ? { inert: '' } : {})}
      >
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          {review && (
            <>
              <span className="text-xs text-muted">{review.summary.reviewDate}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          title={t('dailyReview.header.refreshTitle')}
          aria-label={t('dailyReview.header.refreshTitle')}
          className="p-1 rounded hover:bg-foreground/5 text-muted disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden="true" />
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border shrink-0">
          {sourceOpportunities.newCandidates.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {t('dailyReviewBanner.newCandidates', { n: String(sourceOpportunities.newCandidates.length) })}
            </span>
          )}
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
      </div>

      <div className="mx-2 mt-2 rounded border border-border bg-surface/60 px-3 py-2 text-xs">
        {todayRun ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted">
              {t('todayPage.actionList.sourceRun', {
                source: todayRun.request.preset ?? t('todayPage.actionList.customRun'),
                date: todayRun.result.asofDate,
              })}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setTodayRunDisplayFilters({
                  ...todayRun.displayFilters,
                  recommendedOnly: true,
                })}
                className={cn(
                  'rounded px-2 py-1',
                  todayRun.displayFilters.recommendedOnly
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted hover:bg-foreground/5',
                )}
              >
                {t('todayPage.actionList.readyFilter')}
              </button>
              <button
                type="button"
                onClick={() => setTodayRunDisplayFilters({
                  ...todayRun.displayFilters,
                  recommendedOnly: false,
                })}
                className={cn(
                  'rounded px-2 py-1',
                  !todayRun.displayFilters.recommendedOnly
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted hover:bg-foreground/5',
                )}
              >
                {t('todayPage.actionList.allSourceCandidates')}
              </button>
            </div>
          </div>
        ) : (
          <span className="text-muted">{t('todayPage.actionList.noSourceRun')}</span>
        )}
      </div>

      {/* Action list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3" onKeyDown={handleListKeyDown}>
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
        {watchlistQuery.error && (
          <div className="flex items-center gap-2 px-2 text-sm text-danger">
            {t('dailyReview.header.error', { message: watchlistQuery.error instanceof Error ? watchlistQuery.error.message : t('dailyReview.header.unknownError') })}
            <button type="button" onClick={() => watchlistQuery.refetch()} className="underline">{t('todayPage.actionList.retryWatchlist')}</button>
          </div>
        )}
        {!todayRunInitialized && (
          <p className="px-2 text-sm text-muted">{t('todayPage.actionList.loadingPinnedCandidates')}</p>
        )}
        {isLoading && (
          <p className="px-2 text-sm text-muted">{t('todayPage.actionList.loadingReview')}</p>
        )}
        {openPositionsQuery.isLoading && (
          <p className="px-2 text-sm text-muted">{t('todayPage.actionList.loadingPositions')}</p>
        )}
        {watchlistQuery.isLoading && (
          <p className="px-2 text-sm text-muted">{t('todayPage.actionList.loadingWatchlist')}</p>
        )}
        {isEmpty && (
          <p className="text-sm text-muted px-2 py-4 text-center">
            {t('todayPage.actionList.empty')}
          </p>
        )}

        {openPositions.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded">
              {t('todayPage.actionList.openPositions')} · {openPositions.length}
            </div>
            <div className="space-y-0.5">
              {openPositions.map((position) => (
                <OpenPositionItem
                  key={position.positionId}
                  item={position}
                  onClick={(ticker) => handleItemClick(ticker, `position-${position.positionId ?? ticker}`)}
                  isFocused={focusedId === `position-${position.positionId ?? position.ticker}`}
                  intelligenceSummary={intelligenceByTicker.get(position.ticker)}
                  trimSuggestion={trimSuggestionByPositionId.get(position.positionId ?? '')}
                  onTrim={() => setTrimTarget(position)}
                />
              ))}
            </div>
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
                    onClick={(ticker) => handleItemClick(ticker, `close-${item.positionId}`)}
                    onAction={position ? () => setCloseTarget(position) : undefined}
                    isDone={doneIds.has(item.positionId)}
                    isFocused={focusedId === `close-${item.positionId}`}
                    intelligenceSummary={intelligenceByTicker.get(item.ticker)}
                  />
                );
              })}
              {review?.positionsUpdateStop.map((item) => {
                const position = positionById.get(item.positionId);
                return (
                  <UpdateStopItem
                    key={item.positionId}
                    item={item}
                    onClick={(ticker) => handleItemClick(ticker, `stop-${item.positionId}`)}
                    onAction={position ? () => setUpdateStopTarget(position) : undefined}
                    onAccept={(positionId, stopSuggested, reason) =>
                      handleAcceptStop(positionId, stopSuggested, reason)
                    }
                    isDone={acceptedStops.has(item.positionId) || doneIds.has(item.positionId)}
                    isAccepting={
                      acceptStopMutation.isPending &&
                      acceptStopMutation.variables?.positionId === item.positionId
                    }
                    isFocused={focusedId === `stop-${item.positionId}`}
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
                    onClick={(ticker) => handleItemClick(ticker, `exit-${item.positionId}`)}
                    isFocused={focusedId === `exit-${item.positionId}`}
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
                    onClick={(ticker) => handleItemClick(ticker, `pending-${item.orderId}`)}
                    isFocused={focusedId === `pending-${item.orderId}`}
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
              {watchlistNearTrigger.map((item) => {
                return (
                  <WatchlistNearTriggerItem
                    key={`watch-${item.ticker}-${item.watchedAt}`}
                    item={item}
                    onClick={(ticker) => handleItemClick(ticker, `watch-${item.ticker}-${item.watchedAt}`)}
                    isFocused={focusedId === `watch-${item.ticker}-${item.watchedAt}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {opportunitiesCount > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded">
              {t('todayPage.actionList.opportunities')} · {opportunitiesCount}
            </div>
            <div className="space-y-0.5">
              {sourceOpportunities.newCandidates.map((item) => {
                return (
                  <CandidateItem
                    key={`candidate-${item.ticker}-${item.priorityRank ?? item.rank ?? 'unranked'}`}
                    item={item}
                    onClick={(ticker) => handleItemClick(ticker, `candidate-${item.ticker}-${item.priorityRank ?? item.rank ?? 'unranked'}`)}
                    isFocused={focusedId === `candidate-${item.ticker}-${item.priorityRank ?? item.rank ?? 'unranked'}`}
                  />
                );
              })}
              {sourceOpportunities.addOnCandidates.map((item) => {
                return (
                  <CandidateItem
                    key={`addon-${item.ticker}-${item.priorityRank ?? item.rank ?? 'unranked'}`}
                    item={item}
                    isAddOn
                    onClick={(ticker) => handleItemClick(ticker, `addon-${item.ticker}-${item.priorityRank ?? item.rank ?? 'unranked'}`)}
                    isFocused={focusedId === `addon-${item.ticker}-${item.priorityRank ?? item.rank ?? 'unranked'}`}
                  />
                );
              })}
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
    </>
  );
}
