import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import { formatNumber, getSignColorClass } from '@/utils/formatters';
import WatchMetaInline from '@/components/domain/watchlist/WatchMetaInline';
import { useEarningsProximity } from '@/features/portfolio/hooks';
import type {
  DailyReviewPositionClose,
  DailyReviewPositionExitSignal,
  DailyReviewPositionUpdate,
  TrimSuggestion,
  PendingOrderReview,
} from '@/features/dailyReview/types';
import type { WatchItem } from '@/features/watchlist/types';
import type { OpenPositionIntelligenceSummary } from '@/features/intelligence/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';

export interface TimeStopBadgeProps {
  daysOpen: number;
  rNow: number;
  show: boolean;
}

export function TimeStopBadge({ daysOpen, rNow, show }: TimeStopBadgeProps) {
  if (!show) return null;
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning"
      title={t('todayPage.actionList.timeStopWarning')}
    >
      {t('todayPage.actionList.timeStopBadge', {
        days: String(daysOpen),
        r: `${rNow >= 0 ? '+' : ''}${formatNumber(rNow, 2)}`,
      })}
    </span>
  );
}

export function EarningsBadge({ ticker }: { ticker: string }) {
  const { data } = useEarningsProximity(ticker);
  if (data?.status === 'unavailable') {
    return (
      <span
        className="text-xs font-medium px-1.5 py-0.5 rounded bg-foreground/5 text-muted shrink-0"
        title={t('todayPage.actionList.earningsUnknownTitle')}
      >
        {t('todayPage.actionList.earningsUnknownBadge')}
      </span>
    );
  }
  if (!data?.warning || data.daysUntil == null) return null;
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning shrink-0"
      title={t('todayPage.actionList.earningsTitle', { days: String(data.daysUntil) })}
    >
      {t('todayPage.actionList.earningsBadge', { days: String(data.daysUntil) })}
    </span>
  );
}

export function ExhaustionBadge({ score, label }: { score: number | null; label: string | null }) {
  if (score == null || label == null) return null;
  const emoji = label === 'exit' ? '🔴' : label === 'watch' ? '🟡' : '🟢';
  const colorClass =
    label === 'exit'
      ? 'text-danger'
      : label === 'watch'
      ? 'text-warning'
      : 'text-success';
  return (
    <span
      className={`text-xs font-medium tabular-nums shrink-0 ${colorClass}`}
      title={t('todayPage.actionList.exhaustionTitle', { score: score.toFixed(1) })}
    >
      {emoji} {score.toFixed(1)}
    </span>
  );
}

export function AiSignalBadge({ summary }: { summary: OpenPositionIntelligenceSummary | undefined }) {
  const posSignal = summary?.intelligence?.positionSignal;
  if (!posSignal) return null;
  const colorClass =
    posSignal.action === 'EXIT'
      ? 'bg-danger/10 text-danger'
      : posSignal.action === 'TRIM'
      ? 'bg-warning/10 text-warning'
      : 'bg-success/10 text-success';
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${colorClass}`}>
      {t(`todayPage.actionList.aiSignal.${posSignal.action}`)}
    </span>
  );
}

export interface OpenPositionItemProps {
  item: PositionWithMetrics;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
  intelligenceSummary?: OpenPositionIntelligenceSummary;
  trimSuggestion?: TrimSuggestion | null;
  onTrim?: () => void;
}

export function OpenPositionItem({ item, onClick, isFocused, intelligenceSummary, trimSuggestion, onTrim }: OpenPositionItemProps) {
  return (
    <div
      role="group"
      aria-label={item.ticker}
      className={cn(
        'flex w-full flex-wrap items-center gap-x-3 rounded-lg border-l-2 border-primary/40 px-3 py-1 text-left transition-colors hover:bg-foreground/5',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <button type="button" data-review-row-id={`position-${item.positionId ?? item.ticker}`} data-review-ticker={item.ticker} onClick={() => onClick(item.ticker)} aria-current={isFocused || undefined} className="flex min-h-11 min-w-0 flex-1 basis-40 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-left">
      <span className="text-sm font-semibold text-foreground min-w-[60px]">
        {item.ticker}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', getSignColorClass(item.rNow))}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <span className="text-xs text-muted tabular-nums shrink-0">
        {t('todayPage.actionList.openPositionDays', { days: String(item.daysOpen) })}
      </span>
      <TimeStopBadge daysOpen={item.daysOpen} rNow={item.rNow} show={item.timeStopWarning} />
      {trimSuggestion && (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning">
          {t('todayPage.actionList.trim')}
        </span>
      )}
      <AiSignalBadge summary={intelligenceSummary} />
      <EarningsBadge ticker={item.ticker} />
      <span className={cn('text-xs tabular-nums truncate flex-1 text-right', getSignColorClass(item.pnlPercent))}>
        {item.pnlPercent >= 0 ? '+' : ''}{formatNumber(item.pnlPercent, 1)}%
      </span>
      </button>
      {trimSuggestion && onTrim && (
        <button
          type="button"
          onClick={onTrim}
          className="min-h-11 rounded bg-warning/10 px-2 text-xs text-warning hover:bg-warning/20"
        >
          {t('todayPage.actionList.trimAction')}
        </button>
      )}
    </div>
  );
}

export interface CloseItemProps {
  item: DailyReviewPositionClose;
  onClick: (ticker: string) => void;
  onAction?: () => void;
  isDone?: boolean;
  isFocused?: boolean;
  intelligenceSummary?: OpenPositionIntelligenceSummary;
}

export function CloseItem({ item, onClick, onAction, isDone, isFocused, intelligenceSummary }: CloseItemProps) {
  return (
    <div
      role="group"
      aria-label={item.ticker}
      className={cn(
        'flex w-full flex-wrap items-center gap-x-3 rounded-lg border-l-2 border-danger/40 px-3 py-1 text-left transition-colors hover:bg-foreground/5',
        isDone && 'opacity-50',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <button type="button" data-review-row-id={`close-${item.positionId}`} data-review-ticker={item.ticker} onClick={() => onClick(item.ticker)} aria-current={isFocused || undefined} className="flex min-h-11 min-w-0 flex-1 basis-40 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-left">
      <span className="text-sm font-semibold text-foreground min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-danger/10 text-danger">
        {t('todayPage.actionList.close')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', getSignColorClass(item.rNow))}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <TimeStopBadge daysOpen={item.daysOpen} rNow={item.rNow} show={item.timeStopWarning} />
      <AiSignalBadge summary={intelligenceSummary} />
      <EarningsBadge ticker={item.ticker} />
      <span className="basis-full break-words text-xs text-muted">{item.reason}</span>
      {isDone ? (
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
      ) : null}
      </button>
      {!isDone && onAction ? (
        <button type="button" onClick={onAction}
          className="min-h-11 rounded bg-danger/10 px-2 text-xs text-danger hover:bg-danger/20"
        >
          {t('todayPage.actionList.closeAction')}
        </button>
      ) : null}
    </div>
  );
}

export interface UpdateStopItemProps {
  item: DailyReviewPositionUpdate;
  onClick: (ticker: string) => void;
  onAction?: () => void;
  onAccept?: (positionId: string, stopSuggested: number, reason: string) => void;
  isDone?: boolean;
  isAccepting?: boolean;
  acceptDisabled?: boolean;
  acceptError?: string;
  onRefresh?: () => void;
  isFocused?: boolean;
}

export function UpdateStopItem({ item, onClick, onAction, onAccept, isDone, isAccepting, acceptDisabled, acceptError, onRefresh, isFocused }: UpdateStopItemProps) {
  return (
    <div
      role="group"
      aria-label={item.ticker}
      className={cn(
        'flex w-full flex-wrap items-center gap-x-3 rounded-lg border-l-2 border-warning/40 px-3 py-1 text-left transition-colors hover:bg-foreground/5',
        isDone && 'opacity-50',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <button type="button" data-review-row-id={`stop-${item.positionId}`} data-review-ticker={item.ticker} onClick={() => onClick(item.ticker)} aria-current={isFocused || undefined} className="flex min-h-11 min-w-0 flex-1 basis-40 flex-wrap items-center gap-x-3 gap-y-1 py-2 text-left">
      <span className="text-sm font-semibold text-foreground min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning">
        {t('todayPage.actionList.updateStop')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', getSignColorClass(item.rNow))}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <TimeStopBadge daysOpen={item.daysOpen} rNow={item.rNow} show={item.timeStopWarning} />
      <ExhaustionBadge score={item.exhaustionScore} label={item.exhaustionLabel} />
      <EarningsBadge ticker={item.ticker} />
      <span className="basis-full break-words text-xs text-muted">{item.reason}</span>
      {isDone ? (
        <span className="text-xs font-medium text-success shrink-0">
          {t('todayPage.actionList.acceptStopDone')}
        </span>
      ) : null}
      </button>
      {!isDone && onAccept ? (
        <button type="button" disabled={isAccepting || acceptDisabled}
          onClick={() => onAccept(item.positionId, item.stopSuggested, item.reason)}
          className={cn(
            'min-h-11 rounded px-2 text-xs',
            'bg-warning/10 text-warning',
            'hover:bg-warning/20',
            isAccepting && 'opacity-50 cursor-not-allowed',
          )}
        >
          {isAccepting ? t('todayPage.actionList.acceptingStop') : t('todayPage.actionList.acceptStop')}
        </button>
      ) : !isDone && onAction ? (
        <button type="button" onClick={onAction}
          className="min-h-11 rounded bg-warning/10 px-2 text-xs text-warning hover:bg-warning/20"
        >
          {t('todayPage.actionList.updateAction')}
        </button>
      ) : null}
      {acceptError && !isDone && (
        <div role="alert" className="basis-full break-words text-xs text-danger">
          {t('todayPage.actionList.acceptStopFailed', { message: acceptError })}
          <button type="button" onClick={onRefresh} className="ml-2 min-h-11 underline">
            {t('todayPage.actionList.refreshPortfolio')}
          </button>
        </div>
      )}
    </div>
  );
}

export interface ExitSignalItemProps {
  item: DailyReviewPositionExitSignal;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
  intelligenceSummary?: OpenPositionIntelligenceSummary;
}

export function ExitSignalItem({ item, onClick, isFocused, intelligenceSummary }: ExitSignalItemProps) {
  return (
    <button
      type="button"
      data-review-row-id={`exit-${item.positionId}`}
      data-review-ticker={item.ticker}
      onClick={() => onClick(item.ticker)}
      aria-current={isFocused || undefined}
      className={cn(
        'flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-l-2 border-warning/40 px-3 py-2 text-left transition-colors hover:bg-foreground/5',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-foreground min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning">
        {t('todayPage.actionList.exitSignal')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', getSignColorClass(item.rNow))}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <AiSignalBadge summary={intelligenceSummary} />
      <EarningsBadge ticker={item.ticker} />
      <span className="basis-full break-words text-xs text-muted">{item.reason}</span>
    </button>
  );
}

export function WatchlistNearTriggerItem({ item, onClick, isFocused }: { item: WatchItem; onClick: (ticker: string) => void; isFocused?: boolean }) {
  const distance = item.distanceToTriggerPct;
  return (
    <button
      type="button"
      data-review-row-id={`watch-${item.ticker}-${item.watchedAt}`}
      data-review-ticker={item.ticker}
      onClick={() => onClick(item.ticker)}
      aria-current={isFocused || undefined}
      className={cn(
        'flex min-h-11 w-full flex-wrap items-start gap-x-3 gap-y-1 rounded-lg border-l-2 border-warning/40 px-3 py-2 text-left transition-colors hover:bg-foreground/5',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-foreground min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning">
        {t('todayPage.actionList.watchlistNearTrigger')}
      </span>
      <div className="min-w-0 flex-1 basis-28">
        <div className="text-xs font-semibold tabular-nums text-warning">
          {distance != null
            ? t('watchlist.pipeline.distanceToBuyZone', { value: `${distance >= 0 ? '+' : ''}${formatNumber(distance, 1)}%` })
            : '—'}
        </div>
        <WatchMetaInline
          watchedAt={item.watchedAt}
          watchPrice={item.watchPrice}
          currentPrice={item.currentPrice}
          currency={item.currency}
          className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]"
        />
      </div>
    </button>
  );
}

export interface PendingOrderItemProps {
  item: PendingOrderReview;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
}

export function PendingOrderItem({ item, onClick, isFocused }: PendingOrderItemProps) {
  const isStale = item.category === 'stale';
  return (
    <button
      type="button"
      data-review-row-id={`pending-${item.orderId}`}
      data-review-ticker={item.ticker}
      onClick={() => onClick(item.ticker)}
      aria-current={isFocused || undefined}
      className={cn(
        'flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-l-2 px-3 py-2 text-left transition-colors hover:bg-foreground/5',
        isStale ? 'border-warning/40' : 'border-border',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-foreground min-w-[60px]">
        {item.ticker}
      </span>
      <span className={cn(
        'text-xs font-medium px-1.5 py-0.5 rounded',
        isStale
          ? 'bg-warning/10 text-warning'
          : 'bg-foreground/5 text-muted',
      )}>
        {t(`todayPage.actionList.pendingOrdersCategory.${item.category}`)}
      </span>
      <span className="text-xs text-muted tabular-nums">
        {t('todayPage.actionList.pendingOrdersDaysPending', { n: String(item.daysPending) })}
      </span>
      {item.note && (
        <span className="basis-full break-words text-xs text-muted">
          {item.note}
        </span>
      )}
    </button>
  );
}
