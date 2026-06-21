import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import PartialCloseModalForm from '@/components/domain/positions/PartialCloseModalForm';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import { useDailyReview } from '@/features/dailyReview/api';
import { parseUniverseFromStorage, SCREENER_UNIVERSE_STORAGE_KEY } from '@/features/screener/universeStorage';
import {
  usePositions,
  useUpdateStopMutation,
  useClosePositionMutation,
  useOpenPositionsIntelligence,
  usePartialClosePositionMutation,
} from '@/features/portfolio/hooks';
import type { ClosePositionRequest, PartialCloseRequest, Position, UpdateStopRequest } from '@/features/portfolio/types';
import {
  CloseItem,
  UpdateStopItem,
  CandidateItem,
  HoldItem,
  ExitSignalItem,
  WatchlistNearTriggerItem,
  PendingOrderItem,
} from './TodayActionItems';

interface SectionHeaderProps {
  label: string;
  count: number;
  colorClass: string;
  expanded: boolean;
  onToggle: () => void;
}

function SectionHeader({ label, count, colorClass, expanded, onToggle }: SectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'w-full flex items-center justify-between px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wide',
        colorClass
      )}
    >
      <span>{label}</span>
      <span className="font-bold">{count} {expanded ? '▲' : '▼'}</span>
    </button>
  );
}

interface TodayActionListProps {
  onTickerSelect: (ticker: string) => void;
}

export default function TodayActionList({ onTickerSelect }: TodayActionListProps) {
  const selectedUniverse = parseUniverseFromStorage(localStorage.getItem(SCREENER_UNIVERSE_STORAGE_KEY));
  const { data: review, isLoading, error, refetch, isFetching } = useDailyReview(200, selectedUniverse);

  const { data: intelligenceSummaries } = useOpenPositionsIntelligence();
  const intelligenceByTicker = useMemo(
    () => new Map(intelligenceSummaries?.map((s) => [s.ticker, s]) ?? []),
    [intelligenceSummaries],
  );

  const openPositionsQuery = usePositions('open');
  const positionById = useMemo(
    () => new Map(openPositionsQuery.data?.map((p) => [p.positionId, p]) ?? []),
    [openPositionsQuery.data],
  );

  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());

  const acceptStopMutation = useUpdateStopMutation();
  const [acceptedStops, setAcceptedStops] = useState<Set<string>>(new Set());

  const handleAcceptStop = useCallback(
    (positionId: string, stopSuggested: number, reason: string) => {
      acceptStopMutation.mutate(
        { positionId, request: { newStop: stopSuggested, reason } },
        { onSuccess: () => setAcceptedStops((prev) => new Set([...prev, positionId])) },
      );
    },
    [acceptStopMutation],
  );

  const [updateStopTarget, setUpdateStopTarget] = useState<Position | null>(null);
  const [closeTarget, setCloseTarget] = useState<Position | null>(null);
  const [trimTarget, setTrimTarget] = useState<Position | null>(null);

  const updateStopMutation = useUpdateStopMutation();
  const closePositionMutation = useClosePositionMutation();
  const partialCloseMutation = usePartialClosePositionMutation();

  const handleUpdateStop = useCallback((position: Position, req: UpdateStopRequest) => {
    updateStopMutation.mutate(
      { positionId: position.positionId!, request: req },
      {
        onSuccess: () => {
          setUpdateStopTarget(null);
          setDoneIds((prev) => new Set([...prev, position.positionId!]));
        },
      },
    );
  }, [updateStopMutation]);

  const handleClosePosition = useCallback((position: Position, req: ClosePositionRequest) => {
    closePositionMutation.mutate(
      { positionId: position.positionId!, request: req },
      {
        onSuccess: () => {
          setCloseTarget(null);
          setDoneIds((prev) => new Set([...prev, position.positionId!]));
        },
      },
    );
  }, [closePositionMutation]);

  const handlePartialClose = useCallback((position: Position, req: PartialCloseRequest) => {
    partialCloseMutation.mutate(
      { positionId: position.positionId!, request: req },
      {
        onSuccess: () => {
          setTrimTarget(null);
        },
      },
    );
  }, [partialCloseMutation]);

  const [holdExpanded, setHoldExpanded] = useState(false);

  const [focusedIndex, setFocusedIndex] = useState(-1);

  const flatItems = useMemo(
    () => [
      ...(review?.watchlistNearTrigger.map((i) => ({ ticker: i.ticker, id: `watch-${i.ticker}` })) ?? []),
      ...(review?.positionsClose.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
      ...(review?.positionsUpdateStop.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
      ...(review?.positionsExitSignal.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
      ...(review?.pendingOrdersReview?.map((i) => ({ ticker: i.ticker, id: `pending-${i.orderId}` })) ?? []),
      ...(review?.newCandidates.map((i) => ({ ticker: i.ticker, id: i.ticker })) ?? []),
      ...(review?.positionsAddOnCandidates.map((i) => ({ ticker: i.ticker, id: i.ticker + '-addon' })) ?? []),
      ...(review?.positionsHold.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
    ],
    [review],
  );

  const handleItemClick = useCallback((ticker: string) => {
    setFocusedIndex((prev) => {
      const idx = flatItems.findIndex((fi) => fi.ticker === ticker);
      return idx !== -1 ? idx : prev;
    });
    onTickerSelect(ticker);
  }, [flatItems, onTickerSelect]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => {
          const next = Math.min(i + 1, flatItems.length - 1);
          if (flatItems[next]) onTickerSelect(flatItems[next].ticker);
          return next;
        });
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => {
          const prev = Math.max(i - 1, 0);
          if (flatItems[prev]) onTickerSelect(flatItems[prev].ticker);
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [flatItems, onTickerSelect]);

  const requiresActionCount =
    (review?.positionsClose.length ?? 0) + (review?.positionsUpdateStop.length ?? 0);
  const exitSignalCount = review?.positionsExitSignal.length ?? 0;
  const watchlistNearTriggerCount = review?.watchlistNearTrigger.length ?? 0;
  const opportunitiesCount = (review?.newCandidates.length ?? 0) + (review?.positionsAddOnCandidates.length ?? 0);
  const holdCount = review?.positionsHold.length ?? 0;

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

  const isEmpty = requiresActionCount === 0 && exitSignalCount === 0 && watchlistNearTriggerCount === 0 && opportunitiesCount === 0 && holdCount === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
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

      {/* Action list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {isEmpty && (
          <p className="text-sm text-muted px-2 py-4 text-center">
            {t('todayPage.actionList.empty')}
          </p>
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
              {review?.watchlistNearTrigger.map((item) => {
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
              {review?.newCandidates.map((item) => {
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
              {review?.positionsAddOnCandidates.map((item) => {
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

        {holdCount > 0 && (
          <div className="space-y-1">
            <SectionHeader
              label={t('todayPage.actionList.holding')}
              count={holdCount}
              colorClass="text-muted bg-foreground/5 hover:bg-foreground/10"
              expanded={holdExpanded}
              onToggle={() => setHoldExpanded((v) => !v)}
            />
            {holdExpanded && (
              <div className="space-y-0.5">
                {review?.positionsHold.map((item) => {
                  const idx = flatItems.findIndex((fi) => fi.id === item.positionId);
                  const position = positionById.get(item.positionId);
                  return (
                    <HoldItem
                      key={item.positionId}
                      item={item}
                      onClick={handleItemClick}
                      onTrim={item.trimSuggestion && position ? () => setTrimTarget(position) : undefined}
                      isFocused={focusedIndex === idx}
                      intelligenceSummary={intelligenceByTicker.get(item.ticker)}
                    />
                  );
                })}
              </div>
            )}
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
