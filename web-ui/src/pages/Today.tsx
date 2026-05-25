import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import ScreenerInboxPanel from '@/components/domain/workspace/ScreenerInboxPanel';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import WatchMetaInline from '@/components/domain/watchlist/WatchMetaInline';
import TodayPriorityCard from '@/components/domain/today/TodayPriorityCard';
import Button from '@/components/common/Button';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useDailyReview } from '@/features/dailyReview/api';
import { filterDailyReviewCandidates } from '@/features/dailyReview/prioritization';
import {
  parseUniverseFromStorage,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage';
import { useOrders, usePositions, useUpdateStopMutation, useClosePositionMutation } from '@/features/portfolio/hooks';
import type { ClosePositionRequest, Position, UpdateStopRequest } from '@/features/portfolio/types';
import { pickTodayPriority } from '@/features/dailyReview/beginnerPriority';
import { toBeginnerDecisionFromDailyCandidate } from '@/features/screener/beginnerDecision';
import { useIntelligenceSweepMutation } from '@/features/intelligence/hooks';
import { useDailyCatalystScanMutation, useLatestCatalystReportQuery } from '@/features/intelligence/catalysts/hooks';
import type { SweepSymbolPayload } from '@/features/intelligence/types';
import { useNavigate } from 'react-router-dom';
import { useLocalStorage } from '@/hooks';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import { formatNumber } from '@/utils/formatters';
import type {
  DailyReviewCandidate,
  DailyReviewPositionClose,
  DailyReviewPositionExitSignal,
  DailyReviewPositionHold,
  DailyReviewPositionUpdate,
  PendingOrderReview,
} from '@/features/dailyReview/types';
import type { WatchItem } from '@/features/watchlist/types';

// ─── Action item row components ─────────────────────────────────────────────

interface TimeStopBadgeProps {
  daysOpen: number;
  rNow: number;
  show: boolean;
}

function TimeStopBadge({ daysOpen, rNow, show }: TimeStopBadgeProps) {
  if (!show) return null;
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      title={t('todayPage.actionList.timeStopWarning')}
    >
      {t('todayPage.actionList.timeStopBadge', {
        days: String(daysOpen),
        r: `${rNow >= 0 ? '+' : ''}${formatNumber(rNow, 2)}`,
      })}
    </span>
  );
}

interface CloseItemProps {
  item: DailyReviewPositionClose;
  onClick: (ticker: string) => void;
  onAction?: () => void;
  isDone?: boolean;
  isFocused?: boolean;
}

function CloseItem({ item, onClick, onAction, isDone, isFocused }: CloseItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-red-500',
        isDone && 'opacity-50',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        {t('todayPage.actionList.close')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', item.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <TimeStopBadge daysOpen={item.daysOpen} rNow={item.rNow} show={item.timeStopWarning} />
      <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{item.reason}</span>
      {isDone ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
      ) : onAction ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onAction(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onAction(); } }}
          className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40 shrink-0 cursor-pointer"
        >
          {t('todayPage.actionList.closeAction')}
        </span>
      ) : null}
    </button>
  );
}

interface UpdateStopItemProps {
  item: DailyReviewPositionUpdate;
  onClick: (ticker: string) => void;
  onAction?: () => void;
  isDone?: boolean;
  isFocused?: boolean;
}

function UpdateStopItem({ item, onClick, onAction, isDone, isFocused }: UpdateStopItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-amber-500',
        isDone && 'opacity-50',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        {t('todayPage.actionList.updateStop')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', item.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <TimeStopBadge daysOpen={item.daysOpen} rNow={item.rNow} show={item.timeStopWarning} />
      <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{item.reason}</span>
      {isDone ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
      ) : onAction ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onAction(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onAction(); } }}
          className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40 shrink-0 cursor-pointer"
        >
          {t('todayPage.actionList.updateAction')}
        </span>
      ) : null}
    </button>
  );
}

interface CandidateItemProps {
  item: DailyReviewCandidate;
  isAddOn?: boolean;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
}

function CandidateItem({ item, isAddOn, onClick, isFocused }: CandidateItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-blue-500',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
        {item.ticker}
      </span>
      {isAddOn ? (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
          {t('todayPage.actionList.addOn')}
        </span>
      ) : (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          {item.decisionSummary?.action ?? item.signal}
        </span>
      )}
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        r/r: {formatNumber(item.rReward, 2)}R
      </span>
      {item.name && (
        <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">{item.name}</span>
      )}
    </button>
  );
}

interface HoldItemProps {
  item: DailyReviewPositionHold;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
}

function HoldItem({ item, onClick, isFocused }: HoldItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-gray-300 dark:border-gray-600',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        {t('dailyReview.table.hold.holdBadge')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', item.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <TimeStopBadge daysOpen={item.daysOpen} rNow={item.rNow} show={item.timeStopWarning} />
      <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">{item.reason}</span>
    </button>
  );
}

interface ExitSignalItemProps {
  item: DailyReviewPositionExitSignal;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
}

function ExitSignalItem({ item, onClick, isFocused }: ExitSignalItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-orange-400',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
        {t('todayPage.actionList.exitSignal')}
      </span>
      <span className={cn('text-xs font-semibold tabular-nums', item.rNow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{item.reason}</span>
    </button>
  );
}

function WatchlistNearTriggerItem({ item, onClick, isFocused }: { item: WatchItem; onClick: (ticker: string) => void; isFocused?: boolean }) {
  const distance = item.distanceToTriggerPct;
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2 border-amber-400',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        {t('todayPage.actionList.watchlistNearTrigger')}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-300">
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

interface PendingOrderItemProps {
  item: PendingOrderReview;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
}

function PendingOrderItem({ item, onClick, isFocused }: PendingOrderItemProps) {
  const isStale = item.category === 'stale';
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-l-2',
        isStale ? 'border-amber-500' : 'border-gray-300 dark:border-gray-600',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 min-w-[60px]">
        {item.ticker}
      </span>
      <span className={cn(
        'text-xs font-medium px-1.5 py-0.5 rounded',
        isStale
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      )}>
        {t(`todayPage.actionList.pendingOrdersCategory.${item.category}`)}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
        {t('todayPage.actionList.pendingOrdersDaysPending', { n: String(item.daysPending) })}
      </span>
      {item.note && (
        <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">
          {item.note}
        </span>
      )}
    </button>
  );
}

// ─── Section header ──────────────────────────────────────────────────────────

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

// ─── Today priority section ──────────────────────────────────────────────────

interface TodayPrioritySectionProps {
  onTickerSelect: (ticker: string) => void;
  onSwitchToScreener: () => void;
}

function TodayPrioritySection({ onTickerSelect, onSwitchToScreener }: TodayPrioritySectionProps) {
  const selectedUniverse = parseUniverseFromStorage(localStorage.getItem(SCREENER_UNIVERSE_STORAGE_KEY));
  const { data: review } = useDailyReview(200, selectedUniverse);
  const ordersQuery = useOrders('pending');
  const navigate = useNavigate();

  const pendingEntryOrderCount = (ordersQuery.data ?? []).filter((o) => o.orderKind === 'entry').length;

  const firstCandidate = review?.newCandidates[0] ?? review?.positionsAddOnCandidates[0];
  const bestDecision = firstCandidate ? toBeginnerDecisionFromDailyCandidate(firstCandidate) : undefined;

  const priority = pickTodayPriority(review ?? null, pendingEntryOrderCount, bestDecision, review?.pendingOrdersReview);

  const handleAction = useCallback(() => {
    switch (priority.kind) {
      case 'close_position':
        if (priority.ticker) onTickerSelect(priority.ticker);
        break;
      case 'update_stop':
        if (priority.ticker) onTickerSelect(priority.ticker);
        break;
      case 'pending_orders':
        navigate('/book', { state: { tab: 'orders' } });
        break;
      case 'watchlist_near_trigger':
        if (priority.watchItem) onTickerSelect(priority.watchItem.ticker);
        break;
      case 'best_candidate':
        if (priority.ticker) onTickerSelect(priority.ticker);
        break;
      case 'run_screener':
        onSwitchToScreener();
        break;
      case 'no_action':
        break;
    }
  }, [priority, onTickerSelect, onSwitchToScreener, navigate]);

  return (
    <div className="mb-3">
      <TodayPriorityCard priority={priority} onAction={handleAction} />
    </div>
  );
}

// ─── Pending orders badge ────────────────────────────────────────────────────

function PendingOrdersBadge() {
  const ordersQuery = useOrders('pending');
  const navigate = useNavigate();
  const count = (ordersQuery.data ?? []).filter((o) => o.orderKind === 'entry').length;
  if (count === 0) return null;

  const label =
    count === 1
      ? t('todayPage.pendingBadge.singular', { count: String(count) })
      : t('todayPage.pendingBadge.plural', { count: String(count) });

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-700 dark:bg-amber-950">
      <span className="text-sm text-amber-800 dark:text-amber-200">
        <span aria-hidden="true">⏳ </span>
        <span>{label}</span>
      </span>
      <button
        type="button"
        onClick={() => navigate('/book', { state: { tab: 'orders' } })}
        className="ml-auto text-xs font-medium text-amber-700 hover:underline dark:text-amber-300"
      >
        {t('todayPage.pendingBadge.goToOrders')}
      </button>
    </div>
  );
}

// ─── Today action list panel ─────────────────────────────────────────────────

interface TodayActionListProps {
  onTickerSelect: (ticker: string) => void;
}

function TodayActionList({ onTickerSelect }: TodayActionListProps) {
  const selectedUniverse = parseUniverseFromStorage(localStorage.getItem(SCREENER_UNIVERSE_STORAGE_KEY));
  const { data: review, isLoading, error, refetch, isFetching } = useDailyReview(200, selectedUniverse);

  // Open positions lookup for modal actions
  const openPositionsQuery = usePositions('open');
  const positionById = useMemo(
    () => new Map(openPositionsQuery.data?.map((p) => [p.positionId, p]) ?? []),
    [openPositionsQuery.data],
  );

  // Filter state (persisted)
  const [recommendedOnly, setRecommendedOnly] = useLocalStorage('today.recommendedOnly', false);
  const [actionFilter, setActionFilter] = useLocalStorage<string>('today.actionFilter', 'all');

  // Done state after executing actions
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());

  // Modal targets
  const [updateStopTarget, setUpdateStopTarget] = useState<Position | null>(null);
  const [closeTarget, setCloseTarget] = useState<Position | null>(null);

  // Mutations (no built-in onSuccess — we use per-call callbacks)
  const updateStopMutation = useUpdateStopMutation();
  const closePositionMutation = useClosePositionMutation();
  const sweepMutation = useIntelligenceSweepMutation();
  const catalystScanMutation = useDailyCatalystScanMutation();
  const latestCatalystQuery = useLatestCatalystReportQuery();

  function handleSweep() {
    if (!review) return;
    const symbols: SweepSymbolPayload[] = [];

    // Watchlist symbols near trigger (technical context only)
    for (const item of review.watchlistNearTrigger ?? []) {
      symbols.push({
        ticker: item.ticker,
        request: { close: item.watchPrice ?? 0, signal: 'watchlist' },
      });
    }

    // New candidates
    for (const c of review.newCandidates ?? []) {
      symbols.push({
        ticker: c.ticker,
        request: {
          close: c.close, signal: c.signal,
          entry: c.entry, stop: c.stop,
          sma_20: c.sma20 ?? null, sma_50: c.sma50 ?? null, sma_200: c.sma200 ?? null,
          momentum_6m: c.momentum6m ?? null, momentum_12m: c.momentum12m ?? null,
          sector: c.sector ?? null, currency: c.currency ?? 'USD',
        },
      });
    }

    // Positions (with position context)
    const allPositions = [
      ...(review.positionsHold ?? []),
      ...(review.positionsUpdateStop ?? []),
      ...(review.positionsClose ?? []),
      ...(review.positionsExitSignal ?? []),
    ];
    for (const p of allPositions) {
      symbols.push({
        ticker: p.ticker,
        request: {
          close: p.currentPrice, signal: 'position',
          entry_price: p.entryPrice, r_now: p.rNow, days_open: p.daysOpen,
        },
      });
    }

    if (symbols.length > 0) sweepMutation.mutate(symbols);
  }

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

  const [holdExpanded, setHoldExpanded] = useState(false);

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Apply filters to candidates
  const filteredCandidates = useMemo(
    () =>
      filterDailyReviewCandidates(review?.newCandidates ?? [], {
        recommendedOnly,
        actionFilter: actionFilter as Parameters<typeof filterDailyReviewCandidates>[1]['actionFilter'],
      }),
    [review?.newCandidates, recommendedOnly, actionFilter],
  );

  const filteredAddOns = useMemo(
    () =>
      filterDailyReviewCandidates(review?.positionsAddOnCandidates ?? [], {
        recommendedOnly,
        actionFilter: actionFilter as Parameters<typeof filterDailyReviewCandidates>[1]['actionFilter'],
      }),
    [review?.positionsAddOnCandidates, recommendedOnly, actionFilter],
  );

  // Flat ordered list for keyboard navigation
  const flatItems = useMemo(
    () => [
      ...(review?.watchlistNearTrigger.map((i) => ({ ticker: i.ticker, id: `watch-${i.ticker}` })) ?? []),
      ...(review?.positionsClose.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
      ...(review?.positionsUpdateStop.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
      ...(review?.positionsExitSignal.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
      ...(review?.pendingOrdersReview?.map((i) => ({ ticker: i.ticker, id: `pending-${i.orderId}` })) ?? []),
      ...filteredCandidates.map((i) => ({ ticker: i.ticker, id: i.ticker })),
      ...filteredAddOns.map((i) => ({ ticker: i.ticker, id: i.ticker + '-addon' })),
      ...(review?.positionsHold.map((i) => ({ ticker: i.ticker, id: i.positionId })) ?? []),
    ],
    [review, filteredCandidates, filteredAddOns],
  );

  // Syncs focusedIndex when the user clicks an item so the next j/k press
  // continues from the clicked position rather than from the last keyboard position.
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
  const opportunitiesCount = filteredCandidates.length + filteredAddOns.length;
  const holdCount = review?.positionsHold.length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-gray-500 dark:text-gray-400">
        {t('todayPage.actionList.loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 text-sm text-red-600 dark:text-red-400">
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
              <span className="text-xs text-gray-500 dark:text-gray-400">{review.summary.reviewDate}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          title={t('dailyReview.header.refreshTitle')}
          aria-label={t('dailyReview.header.refreshTitle')}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} aria-hidden="true" />
        </button>
      </div>

      {/* Summary chips */}
      {review && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border shrink-0">
          {review.summary.newCandidates > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
              {t('dailyReviewBanner.newCandidates', { n: String(review.summary.newCandidates) })}
            </span>
          )}
          {review.summary.updateStop > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
              {t('dailyReviewBanner.stopsToUpdate', { n: String(review.summary.updateStop) })}
            </span>
          )}
          {review.summary.closePositions > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">
              {t('dailyReviewBanner.positionsToClose', { n: String(review.summary.closePositions) })}
            </span>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border shrink-0">
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={recommendedOnly}
            onChange={(e) => setRecommendedOnly(e.target.checked)}
            className="rounded"
          />
          {t('dailyReview.filter.recommendedOnly')}
        </label>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="text-xs border border-border rounded px-1.5 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          {([
            ['all',               t('dailyReview.filter.all')],
            ['BUY_NOW',          t('screener.guidedList.action.BUY_NOW')],
            ['BUY_ON_PULLBACK',  t('screener.guidedList.action.BUY_ON_PULLBACK')],
            ['WAIT_FOR_BREAKOUT',t('screener.guidedList.action.WAIT_FOR_BREAKOUT')],
            ['WATCH',            t('screener.guidedList.action.WATCH')],
            ['TACTICAL_ONLY',    t('screener.guidedList.action.TACTICAL_ONLY')],
            ['AVOID',            t('screener.guidedList.action.AVOID')],
            ['MANAGE_ONLY',      t('screener.guidedList.action.MANAGE_ONLY')],
          ] as [string, string][]).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Intelligence Sweep bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border shrink-0">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={sweepMutation.isPending || !review}
          onClick={handleSweep}
        >
          {sweepMutation.isPending
            ? t('todayPage.actionList.intelligenceSweepRunning')
            : t('todayPage.actionList.intelligenceSweep')}
        </Button>
        {sweepMutation.isSuccess && (
          <span className="text-xs text-gray-500">
            {t('todayPage.actionList.intelligenceSweepDone', {
              analyzed: String(sweepMutation.data.analyzed.length),
              failed: sweepMutation.data.failed.length > 0
                ? t('todayPage.actionList.intelligenceSweepFailed', { n: String(sweepMutation.data.failed.length) })
                : '',
            })}
          </span>
        )}
      </div>

      {/* Catalyst Scan bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border shrink-0">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={catalystScanMutation.isPending}
          onClick={() => catalystScanMutation.mutate()}
        >
          {catalystScanMutation.isPending
            ? t('todayPage.actionList.catalystScanRunning')
            : t('todayPage.actionList.catalystScan')}
        </Button>
        {catalystScanMutation.isSuccess && (
          <span className="text-xs text-gray-500">
            {t('todayPage.actionList.catalystScanDone', {
              count: String(catalystScanMutation.data.themes.length),
            })}
          </span>
        )}
        {catalystScanMutation.isError && (
          <span className="text-xs text-rose-600">
            {t('todayPage.actionList.catalystScanError')}
            {catalystScanMutation.error instanceof Error && catalystScanMutation.error.message
              ? `: ${catalystScanMutation.error.message}`
              : null}
          </span>
        )}
        {!catalystScanMutation.isPending && !catalystScanMutation.isSuccess && !catalystScanMutation.isError && latestCatalystQuery.data && (
          <span className="text-xs text-gray-400">
            {t('todayPage.actionList.catalystScanLastRun')}:{' '}
            {new Date(latestCatalystQuery.data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Action list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {isEmpty && (
          <p className="text-sm text-gray-500 dark:text-gray-400 px-2 py-4 text-center">
            {t('todayPage.actionList.empty')}
          </p>
        )}

        {/* Requires Action section — close and update-stop before watchlist triggers */}
        {requiresActionCount > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded">
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
                    isDone={doneIds.has(item.positionId)}
                    isFocused={focusedIndex === idx}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Exit Signal section — advisory, below hard requires-action */}
        {exitSignalCount > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded">
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
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Pending Orders section — individual order rows between requires-action and watchlist */}
        {(review?.pendingOrdersReview ?? []).length > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded">
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

        {/* Watchlist near-trigger section — below required position actions */}
        {watchlistNearTriggerCount > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded">
              {t('watchlist.pipeline.dailyReviewTitle')} · {watchlistNearTriggerCount}
            </div>
            <p className="px-3 text-[11px] text-gray-500 dark:text-gray-400">
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

        {/* New Opportunities section */}
        {opportunitiesCount > 0 && (
          <div className="space-y-1">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded">
              {t('todayPage.actionList.opportunities')} · {opportunitiesCount}
            </div>
            <div className="space-y-0.5">
              {filteredCandidates.map((item) => {
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
              {filteredAddOns.map((item) => {
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

        {/* Holding section (collapsed by default) */}
        {holdCount > 0 && (
          <div className="space-y-1">
            <SectionHeader
              label={t('todayPage.actionList.holding')}
              count={holdCount}
              colorClass="text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-700/50"
              expanded={holdExpanded}
              onToggle={() => setHoldExpanded((v) => !v)}
            />
            {holdExpanded && (
              <div className="space-y-0.5">
                {review?.positionsHold.map((item) => {
                  const idx = flatItems.findIndex((fi) => fi.id === item.positionId);
                  return (
                    <HoldItem
                      key={item.positionId}
                      item={item}
                      onClick={handleItemClick}
                      isFocused={focusedIndex === idx}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Keyboard hint */}
      <div className="px-3 py-1.5 border-t border-border shrink-0">
        <p className="text-[10px] text-gray-400 dark:text-gray-600">{t('todayPage.keyboard.hint')}</p>
      </div>

      {/* Modals */}
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

// ─── Today page ──────────────────────────────────────────────────────────────

type LeftTab = 'today' | 'screener';
type TabletTab = 'left' | 'analysis';

export default function Today() {
  const setSelectedTicker = useWorkspaceStore((state) => state.setSelectedTicker);
  const selectedTicker = useWorkspaceStore((state) => state.selectedTicker);

  const [leftTab, setLeftTab] = useState<LeftTab>('today');
  const [activeTablet, setActiveTablet] = useState<TabletTab>('left');
  const prevTickerRef = useRef<string | null>(null);

  // On narrow screens, auto-switch to analysis panel when a symbol is selected
  useEffect(() => {
    if (selectedTicker && selectedTicker !== prevTickerRef.current) {
      prevTickerRef.current = selectedTicker;
      setActiveTablet('analysis');
    }
  }, [selectedTicker]);

  const handleTickerSelect = useCallback((ticker: string) => {
    setSelectedTicker(ticker, 'screener');
  }, [setSelectedTicker]);

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Tablet tab switcher — only visible below xl breakpoint */}
      <div className="xl:hidden flex border-b border-border mb-3">
        {(['left', 'analysis'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTablet(tab)}
            className={cn(
              'flex-1 py-2 text-sm font-medium capitalize transition-colors',
              activeTablet === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            )}
          >
            {tab === 'left' ? t('todayPage.tabs.today') : t('workspacePage.panels.analysis.title')}
          </button>
        ))}
      </div>

      <div className="flex gap-4 xl:h-[calc(100vh-120px)] min-h-[500px]">
        {/* Left panel */}
        <div
          className={cn(
            'min-w-0 flex flex-col xl:overflow-hidden xl:w-7/12',
            activeTablet === 'left' ? 'w-full' : 'hidden xl:flex'
          )}
        >
          {/* Left panel tab bar */}
          <div className="flex border-b border-border shrink-0">
            {(['today', 'screener'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setLeftTab(tab)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium transition-colors capitalize',
                  leftTab === tab
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                )}
              >
                {tab === 'today' ? t('todayPage.tabs.today') : t('todayPage.tabs.screener')}
              </button>
            ))}
          </div>

          {/* Left panel content */}
          <div className="flex-1 overflow-hidden">
            {leftTab === 'today' && (
              <>
                <div className="px-3 pt-3">
                  <TodayPrioritySection onTickerSelect={handleTickerSelect} onSwitchToScreener={() => setLeftTab('screener')} />
                  <PendingOrdersBadge />
                </div>
                <TodayActionList onTickerSelect={handleTickerSelect} />
              </>
            )}
            {leftTab === 'screener' && (
              <ScreenerInboxPanel />
            )}
          </div>
        </div>

        {/* Right panel */}
        <div
          className={cn(
            'min-w-0 flex flex-col xl:overflow-hidden xl:w-5/12',
            activeTablet === 'analysis' ? 'w-full' : 'hidden xl:flex'
          )}
        >
          <AnalysisCanvasPanel />
        </div>
      </div>
    </div>
  );
}
