import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import { usePortfolioReview } from '@/features/dailyReview/api';
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
  const {
    todayRun,
    setTodayRunDisplayFilters,
  } = useScreenerStore();
  const { data: review, isLoading, error, refetch, isFetching } = usePortfolioReview();

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
      newCandidates: visibleCandidates
        .filter((candidate) => isNewOpportunity(candidate.sameSymbol?.mode))
        .map(dailyReviewCandidateFromScreener),
      addOnCandidates: visibleCandidates
        .filter((candidate) => isAddOn(candidate.sameSymbol?.mode))
        .map(dailyReviewCandidateFromScreener),
      sourceTickers: new Set(sourceCandidates.map((candidate) => candidate.ticker.toUpperCase())),
    };
  }, [todayRun]);

  const watchlistNearTrigger = useMemo(
    () => (review?.watchlistNearTrigger ?? []).filter(
      (item) => !sourceOpportunities.sourceTickers.has(item.ticker.toUpperCase()),
    ),
    [review?.watchlistNearTrigger, sourceOpportunities.sourceTickers],
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

  const flatItems = useMemo(
    () => [
      ...watchlistNearTrigger.map((i) => ({ ticker: i.ticker, id: `watch-${i.ticker}` })),
      ...(review?.positionsClose.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
      ...(review?.positionsUpdateStop.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
      ...(review?.positionsExitSignal.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
      ...(review?.pendingOrdersReview?.map((i) => ({ ticker: i.ticker, id: `pending-${i.orderId}` })) ?? []),
      ...sourceOpportunities.newCandidates.map((i) => ({ ticker: i.ticker, id: i.ticker })),
      ...sourceOpportunities.addOnCandidates.map((i) => ({ ticker: i.ticker, id: i.ticker + '-addon' })),
    ],
    [review, sourceOpportunities, watchlistNearTrigger],
  );

  const {
    doneIds,
    acceptedStops,
    acceptStopMutation,
    updateStopMutation,
    closePositionMutation,
    updateStopTarget,
    setUpdateStopTarget,
    closeTarget,
    setCloseTarget,
    focusedIndex,
    handleAcceptStop,
    handleUpdateStop,
    handleClosePosition,
    handleItemClick,
  } = useTodayActions(flatItems, onTickerSelect);

  const requiresActionCount =
    (review?.positionsClose.length ?? 0) + (review?.positionsUpdateStop.length ?? 0);
  const exitSignalCount = review?.positionsExitSignal.length ?? 0;
  const watchlistNearTriggerCount = watchlistNearTrigger.length;
  const opportunitiesCount = sourceOpportunities.newCandidates.length + sourceOpportunities.addOnCandidates.length;
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-muted">
        {t('todayPage.actionList.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 text-sm text-danger">
        {t('dailyReview.header.error', { message: error instanceof Error ? error.message : t('dailyReview.header.unknownError') })}
      </div>
    );
  }

  const isEmpty = openPositions.length === 0 && requiresActionCount === 0 && exitSignalCount === 0 && watchlistNearTriggerCount === 0 && opportunitiesCount === 0;

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
            onSelect={onTickerSelect}
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
      {review && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border shrink-0">
          {review.summary.newCandidates > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {t('dailyReviewBanner.newCandidates', { n: String(review.summary.newCandidates) })}
            </span>
          )}
          {review.summary.updateStop > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-medium">
              {t('dailyReviewBanner.stopsToUpdate', { n: String(review.summary.updateStop) })}
            </span>
          )}
          {review.summary.closePositions > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-danger/10 text-danger font-medium">
              {t('dailyReviewBanner.positionsToClose', { n: String(review.summary.closePositions) })}
            </span>
          )}
        </div>
      )}

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
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
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
                  onClick={handleItemClick}
                  intelligenceSummary={intelligenceByTicker.get(position.ticker)}
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
                const idx = flatItems.findIndex((fi) => fi.ticker === item.ticker);
                return (
                  <CloseItem
                    key={item.positionId}
                    item={item}
                    onClick={handleItemClick}
                    onAction={position ? () => setCloseTarget(position) : undefined}
                    isDone={doneIds.has(item.positionId)}
                    isFocused={focusedIndex === idx}
                    intelligenceSummary={intelligenceByTicker.get(item.ticker)}
                  />
                );
              })}
              {review?.positionsUpdateStop.map((item) => {
                const position = positionById.get(item.positionId);
                const idx = flatItems.findIndex((fi) => fi.ticker === item.ticker);
                return (
                  <UpdateStopItem
                    key={item.positionId}
                    item={item}
                    onClick={handleItemClick}
                    onAction={position ? () => setUpdateStopTarget(position) : undefined}
                    onAccept={(positionId, stopSuggested, reason) =>
                      handleAcceptStop(positionId, stopSuggested, reason)
                    }
                    isDone={acceptedStops.has(item.positionId) || doneIds.has(item.positionId)}
                    isAccepting={
                      acceptStopMutation.isPending &&
                      acceptStopMutation.variables?.positionId === item.positionId
                    }
                    isFocused={focusedIndex === idx}
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
                const idx = flatItems.findIndex((fi) => fi.id === item.positionId);
                return (
                  <ExitSignalItem
                    key={item.positionId}
                    item={item}
                    onClick={handleItemClick}
                    isFocused={focusedIndex === idx}
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
                const idx = flatItems.findIndex((fi) => fi.id === `pending-${item.orderId}`);
                return (
                  <PendingOrderItem
                    key={item.orderId}
                    item={item}
                    onClick={handleItemClick}
                    isFocused={focusedIndex === idx}
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
                const idx = flatItems.findIndex((fi) => fi.id === `watch-${item.ticker}`);
                return (
                  <WatchlistNearTriggerItem
                    key={item.ticker}
                    item={item}
                    onClick={onTickerSelect}
                    isFocused={focusedIndex === idx}
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
                const idx = flatItems.findIndex((fi) => fi.id === item.ticker);
                return (
                  <CandidateItem
                    key={item.ticker}
                    item={item}
                    onClick={handleItemClick}
                    isFocused={focusedIndex === idx}
                  />
                );
              })}
              {sourceOpportunities.addOnCandidates.map((item) => {
                const idx = flatItems.findIndex((fi) => fi.id === item.ticker + '-addon');
                return (
                  <CandidateItem
                    key={item.ticker}
                    item={item}
                    isAddOn
                    onClick={handleItemClick}
                    isFocused={focusedIndex === idx}
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
      </div>
    </>
  );
}
