import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import AnalysisCanvasPanel from '@/components/domain/workspace/AnalysisCanvasPanel';
import ScreenerInboxPanel from '@/components/domain/workspace/ScreenerInboxPanel';
import ClosePositionModalForm from '@/components/domain/positions/ClosePositionModalForm';
import PartialCloseModalForm from '@/components/domain/positions/PartialCloseModalForm';
import UpdateStopModalForm from '@/components/domain/positions/UpdateStopModalForm';
import WatchMetaInline from '@/components/domain/watchlist/WatchMetaInline';
import TodayPriorityCard from '@/components/domain/today/TodayPriorityCard';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useDailyReview } from '@/features/dailyReview/api';
import {
  parseUniverseFromStorage,
  SCREENER_UNIVERSE_STORAGE_KEY,
} from '@/features/screener/universeStorage';
import { useOrders, usePositions, useUpdateStopMutation, useClosePositionMutation, useOpenPositionsIntelligence, useEarningsProximity, usePartialClosePositionMutation } from '@/features/portfolio/hooks';
import type { ClosePositionRequest, PartialCloseRequest, Position, UpdateStopRequest } from '@/features/portfolio/types';
import type { OpenPositionIntelligenceSummary } from '@/features/intelligence/types';
import { pickTodayPriority } from '@/features/dailyReview/beginnerPriority';
import { toBeginnerDecisionFromDailyCandidate } from '@/features/screener/beginnerDecision';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import { useWeeklyReviews } from '@/features/weeklyReview/hooks';
import { getCurrentWeekId } from '@/components/domain/weeklyReview/WeeklyReviewForm';
import { formatNumber, getSignColorClass } from '@/utils/formatters';
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
  intelligenceSummary?: OpenPositionIntelligenceSummary;
}

function CloseItem({ item, onClick, onAction, isDone, isFocused, intelligenceSummary }: CloseItemProps) {
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
      <span className={cn('text-xs font-semibold tabular-nums', getSignColorClass(item.rNow))}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <TimeStopBadge daysOpen={item.daysOpen} rNow={item.rNow} show={item.timeStopWarning} />
      <AiSignalBadge summary={intelligenceSummary} />
      <EarningsBadge ticker={item.ticker} />
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
  onAccept?: (positionId: string, stopSuggested: number, reason: string) => void;
  isDone?: boolean;
  isAccepting?: boolean;
  isFocused?: boolean;
}

function UpdateStopItem({ item, onClick, onAction, onAccept, isDone, isAccepting, isFocused }: UpdateStopItemProps) {
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
      <span className={cn('text-xs font-semibold tabular-nums', getSignColorClass(item.rNow))}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <TimeStopBadge daysOpen={item.daysOpen} rNow={item.rNow} show={item.timeStopWarning} />
      <ExhaustionBadge score={item.exhaustionScore} label={item.exhaustionLabel} />
      <EarningsBadge ticker={item.ticker} />
      <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">{item.reason}</span>
      {isDone ? (
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
          {t('todayPage.actionList.acceptStopDone')}
        </span>
      ) : onAccept ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onAccept(item.positionId, item.stopSuggested, item.reason);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onAccept(item.positionId, item.stopSuggested, item.reason);
            }
          }}
          className={cn(
            'text-xs px-2 py-0.5 rounded shrink-0 cursor-pointer',
            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            'hover:bg-amber-200 dark:hover:bg-amber-800/40',
            isAccepting && 'opacity-50 cursor-not-allowed',
          )}
        >
          {isAccepting ? '…' : t('todayPage.actionList.acceptStop')}
        </span>
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

function VolumeDot({ ratio }: { ratio: number | undefined }) {
  if (ratio == null) return null;
  if (ratio >= 1.5) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0"
        title={`Volume ${ratio.toFixed(1)}× avg (strong)`}
      />
    );
  }
  if (ratio < 0.8) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-gray-400 shrink-0"
        title={`Volume ${ratio.toFixed(1)}× avg (weak)`}
      />
    );
  }
  return null;
}

interface CandidateItemProps {
  item: DailyReviewCandidate;
  isAddOn?: boolean;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
}

function candidateModeBadge(item: DailyReviewCandidate, isAddOn?: boolean) {
  const mode = item.sameSymbol?.mode;
  if (mode === 'RE_ENTRY') {
    return (
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        {t('todayPage.actionList.reEnter')}
      </span>
    );
  }
  if (mode === 'SCALE_BACK') {
    return (
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
        {t('todayPage.actionList.scaleBack')}
      </span>
    );
  }
  if (isAddOn || mode === 'ADD_ON') {
    return (
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
        {t('todayPage.actionList.addOn')}
      </span>
    );
  }
  return (
    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      {item.decisionSummary?.action ?? item.signal}
    </span>
  );
}

function CandidateItem({ item, isAddOn, onClick, isFocused }: CandidateItemProps) {
  const showCatalyst =
    !isAddOn &&
    item.decisionSummary?.catalystLabel === 'active' &&
    !!item.decisionSummary.catalystSummary;

  return (
    <div>
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
        {candidateModeBadge(item, isAddOn)}
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          r/r: {formatNumber(item.rReward, 2)}R
        </span>
        {item.confidence != null && (
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums shrink-0">
            {t('todayPage.actionList.candidateConfidence', { pct: String(Math.round(item.confidence)) })}
          </span>
        )}
        <VolumeDot ratio={item.volumeRatio} />
        {item.name && (
          <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">{item.name}</span>
        )}
      </button>
      {showCatalyst && (
        <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <p className="font-semibold text-emerald-800 text-xs uppercase tracking-wide mb-1">
            {t('todayPage.candidateCard.catalystContext')}
          </p>
          <p className="text-emerald-900">{item.decisionSummary!.catalystSummary}</p>
          {item.decisionSummary!.catalystSources.length > 0 && (
            <details className="mt-1">
              <summary className="text-xs text-emerald-700 cursor-pointer select-none">
                {t('todayPage.candidateCard.catalystSources')} ({item.decisionSummary!.catalystSources.length})
              </summary>
              <ul className="mt-1 space-y-0.5">
                {item.decisionSummary!.catalystSources.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-700 hover:underline break-all"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function EarningsBadge({ ticker }: { ticker: string }) {
  const { data } = useEarningsProximity(ticker);
  if (!data?.warning || data.daysUntil == null) return null;
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 shrink-0"
      title={`Earnings in ${data.daysUntil} day${data.daysUntil === 1 ? '' : 's'}`}
    >
      {t('todayPage.actionList.earningsBadge', { days: String(data.daysUntil) })}
    </span>
  );
}

function ExhaustionBadge({ score, label }: { score: number | null; label: string | null }) {
  if (score == null || label == null) return null;
  const emoji = label === 'exit' ? '🔴' : label === 'watch' ? '🟡' : '🟢';
  const colorClass =
    label === 'exit'
      ? 'text-rose-700 dark:text-rose-400'
      : label === 'watch'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-emerald-700 dark:text-emerald-400';
  return (
    <span
      className={`text-xs font-medium tabular-nums shrink-0 ${colorClass}`}
      title={`Exhaustion: ${score.toFixed(1)}/10`}
    >
      {emoji} {score.toFixed(1)}
    </span>
  );
}

function AiSignalBadge({ summary }: { summary: OpenPositionIntelligenceSummary | undefined }) {
  const posSignal = summary?.intelligence?.positionSignal;
  if (!posSignal) return null;
  const colorClass =
    posSignal.action === 'EXIT'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : posSignal.action === 'TRIM'
      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  const labelMap: Record<string, string> = { HOLD: 'Hold', TRIM: 'Trim', EXIT: 'Exit' };
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${colorClass}`}>
      {labelMap[posSignal.action] ?? posSignal.action}
    </span>
  );
}

interface HoldItemProps {
  item: DailyReviewPositionHold;
  onClick: (ticker: string) => void;
  onTrim?: () => void;
  isFocused?: boolean;
  intelligenceSummary?: OpenPositionIntelligenceSummary;
}

function HoldItem({ item, onClick, onTrim, isFocused, intelligenceSummary }: HoldItemProps) {
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
      {item.trimSuggestion && (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          {t('todayPage.actionList.trim')}
        </span>
      )}
      <span className={cn('text-xs font-semibold tabular-nums', getSignColorClass(item.rNow))}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <TimeStopBadge daysOpen={item.daysOpen} rNow={item.rNow} show={item.timeStopWarning} />
      <ExhaustionBadge score={item.exhaustionScore} label={item.exhaustionLabel} />
      <AiSignalBadge summary={intelligenceSummary} />
      <EarningsBadge ticker={item.ticker} />
      <span className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1">{item.reason}</span>
      {item.trimSuggestion && onTrim && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onTrim(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onTrim(); } }}
          className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800/40 shrink-0 cursor-pointer"
        >
          {t('todayPage.actionList.trimAction')}
        </span>
      )}
    </button>
  );
}

interface ExitSignalItemProps {
  item: DailyReviewPositionExitSignal;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
  intelligenceSummary?: OpenPositionIntelligenceSummary;
}

function ExitSignalItem({ item, onClick, isFocused, intelligenceSummary }: ExitSignalItemProps) {
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
      <span className={cn('text-xs font-semibold tabular-nums', getSignColorClass(item.rNow))}>
        {item.rNow >= 0 ? '+' : ''}{formatNumber(item.rNow, 2)}R
      </span>
      <AiSignalBadge summary={intelligenceSummary} />
      <EarningsBadge ticker={item.ticker} />
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

// ─── Weekly review nudge ─────────────────────────────────────────────────────

function WeeklyReviewNudge() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const { data: reviews } = useWeeklyReviews();
  const currentWeekId = getCurrentWeekId();
  const isFriday = new Date().getDay() === 5;
  const hasCurrentWeekReview = (reviews ?? []).some((r) => r.week_id === currentWeekId);
  if (!isFriday || hasCurrentWeekReview || dismissed) return null;
  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 dark:border-purple-700 dark:bg-purple-950">
      <span className="text-sm text-purple-800 dark:text-purple-200 flex-1">
        {t('todayPage.weeklyNudge.message')}
      </span>
      <button
        type="button"
        onClick={() => navigate('/book', { state: { tab: 'review' } })}
        className="text-xs font-medium text-purple-700 hover:underline dark:text-purple-300 shrink-0"
      >
        {t('todayPage.weeklyNudge.action')}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-xs text-purple-500 hover:text-purple-700 dark:text-purple-400 shrink-0"
        aria-label={t('todayPage.weeklyNudge.dismiss')}
      >
        ✕
      </button>
    </div>
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

  // Intelligence summaries for inline AI signal badges
  const { data: intelligenceSummaries } = useOpenPositionsIntelligence();
  const intelligenceByTicker = useMemo(
    () => new Map(intelligenceSummaries?.map((s) => [s.ticker, s]) ?? []),
    [intelligenceSummaries],
  );

  // Open positions lookup for modal actions
  const openPositionsQuery = usePositions('open');
  const positionById = useMemo(
    () => new Map(openPositionsQuery.data?.map((p) => [p.positionId, p]) ?? []),
    [openPositionsQuery.data],
  );

  // Done state after executing actions
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());

  // 1-click accept stop state
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

  // Modal targets
  const [updateStopTarget, setUpdateStopTarget] = useState<Position | null>(null);
  const [closeTarget, setCloseTarget] = useState<Position | null>(null);
  const [trimTarget, setTrimTarget] = useState<Position | null>(null);

  // Mutations (no built-in onSuccess — we use per-call callbacks)
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

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Flat ordered list for keyboard navigation
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
  const opportunitiesCount = (review?.newCandidates.length ?? 0) + (review?.positionsAddOnCandidates.length ?? 0);
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
                    intelligenceSummary={intelligenceByTicker.get(item.ticker)}
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
                : 'text-gray-600 dark:text-gray-400 hover:text-foreground'
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
                  <WeeklyReviewNudge />
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
