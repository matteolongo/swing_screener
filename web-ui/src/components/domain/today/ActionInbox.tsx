import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import { useDailyReview } from '@/features/dailyReview/api';
import { readScreenerSelection } from '@/features/screener/selectionStorage';
import { buildInboxItems, type InboxItem } from '@/features/dailyReview/inbox';
import InboxRow, { type InboxAction } from '@/components/domain/today/InboxRow';
import {
  usePositions,
  useOpenPositionsIntelligence,
  useCancelOrderMutation,
} from '@/features/portfolio/hooks';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { useWeeklyReviews } from '@/features/weeklyReview/hooks';
import { getCurrentWeekId } from '@/components/domain/weeklyReview/WeeklyReviewForm';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTodayActions } from './useTodayActions';

export interface ActionInboxProps {
  onTickerSelect: (ticker: string) => void;
}

function useWeeklyReviewDue(): boolean {
  const { data: reviews } = useWeeklyReviews();
  const isFriday = new Date().getDay() === 5;
  const currentWeekId = getCurrentWeekId();
  const hasCurrentWeekReview = (reviews ?? []).some((r) => r.week_id === currentWeekId);
  return isFriday && !hasCurrentWeekReview;
}

export default function ActionInbox({ onTickerSelect }: ActionInboxProps) {
  const selection = readScreenerSelection();
  const { data: review, isLoading, error, refetch, isFetching, dataUpdatedAt } = useDailyReview(200, selection);

  const { data: intelligenceSummaries } = useOpenPositionsIntelligence();
  const intelligenceByTicker = useMemo(
    () => new Map(intelligenceSummaries?.map((s) => [s.ticker, s]) ?? []),
    [intelligenceSummaries],
  );

  const openPositionsQuery = usePositions('open');
  const positionById = useMemo(() => {
    const map = new Map<string, PositionWithMetrics>();
    for (const position of openPositionsQuery.data ?? []) {
      if (position.positionId) map.set(position.positionId, position);
    }
    return map;
  }, [openPositionsQuery.data]);

  const weeklyReviewDue = useWeeklyReviewDue();

  const items = useMemo(
    () => buildInboxItems({ review, positionById, intelligenceByTicker, weeklyReviewDue }),
    [review, positionById, intelligenceByTicker, weeklyReviewDue],
  );

  const {
    doneIds,
    acceptedStops,
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
  } = useTodayActions(items, onTickerSelect);

  const cancelOrderMutation = useCancelOrderMutation();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAction = useCallback(
    (action: InboxAction, item: InboxItem) => {
      switch (action) {
        case 'close':
          if (item.position) setCloseTarget(item.position);
          break;
        case 'applyStop':
          if (item.position && item.stopSuggested != null) {
            handleAcceptStop(item.id, item.position.positionId!, item.stopSuggested, item.reason);
          }
          break;
        case 'updateStop':
          if (item.position) setUpdateStopTarget(item.position);
          break;
        case 'cancelOrder':
          if (item.orderId && window.confirm(t('todayPage.inbox.cancelOrderConfirm'))) {
            cancelOrderMutation.mutate(item.orderId);
          }
          break;
        case 'planOrder':
          if (item.ticker) {
            onTickerSelect(item.ticker);
            useWorkspaceStore.getState().setAnalysisTab('order');
          }
          break;
        case 'analyze':
          if (item.ticker) onTickerSelect(item.ticker);
          break;
        case 'goToReview':
          navigate('/book');
          break;
      }
    },
    [cancelOrderMutation, handleAcceptStop, navigate, onTickerSelect, setCloseTarget, setUpdateStopTarget],
  );

  const asOfLabel = review
    ? t('todayPage.inbox.asOf', {
        date: review.summary.reviewDate,
        time: dataUpdatedAt
          ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '—',
      })
    : null;

  const isColdLoading = isLoading && !review;
  const isZero = !isLoading && !error && items.length === 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{t('todayPage.inbox.header')}</span>
          {items.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {items.length}
            </span>
          )}
          {asOfLabel && <span className="text-xs text-muted">{asOfLabel}</span>}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          title={t('todayPage.inbox.refresh')}
          aria-label={t('todayPage.inbox.refresh')}
          className="p-1 rounded hover:bg-foreground/5 text-muted disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-3 py-2 text-sm text-danger border-b border-danger/30 bg-danger/5 shrink-0">
          <span className="flex-1">
            {t('dailyReview.header.error', {
              message: error instanceof Error ? error.message : t('dailyReview.header.unknownError'),
            })}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs font-medium text-danger underline shrink-0"
          >
            {t('todayPage.inbox.refresh')}
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {isColdLoading ? (
          <div className="px-2 py-2 space-y-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                data-testid="inbox-skeleton-row"
                className="h-9 rounded bg-foreground/5 animate-pulse"
              />
            ))}
          </div>
        ) : isZero ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">{t('todayPage.inbox.zeroTitle')}</p>
            <p className="text-xs text-muted">{t('todayPage.inbox.zeroSubtitle')}</p>
            {asOfLabel && <p className="text-xs text-muted">{asOfLabel}</p>}
          </div>
        ) : (
          items.map((item, idx) => (
            <InboxRow
              key={item.id}
              item={item}
              isFocused={focusedIndex === idx}
              done={doneIds.has(item.id) || acceptedStops.has(item.id)}
              onSelectTicker={handleItemClick}
              onAction={handleAction}
              expanded={expandedId === item.id}
              onToggleExpand={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
            />
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="px-3 py-1 text-[11px] text-muted border-t border-border shrink-0">
          {t('todayPage.keyboard.hint')}
        </div>
      )}

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
  );
}
