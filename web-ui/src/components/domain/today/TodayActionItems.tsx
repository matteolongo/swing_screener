import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import { formatNumber, getSignColorClass } from '@/utils/formatters';
import WatchMetaInline from '@/components/domain/watchlist/WatchMetaInline';
import { useEarningsProximity } from '@/features/portfolio/hooks';
import type {
  DailyReviewCandidate,
  DailyReviewPositionClose,
  DailyReviewPositionExitSignal,
  DailyReviewPositionHold,
  DailyReviewPositionUpdate,
  PendingOrderReview,
} from '@/features/dailyReview/types';
import type { WatchItem } from '@/features/watchlist/types';
import type { OpenPositionIntelligenceSummary } from '@/features/intelligence/types';

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
  if (!data?.warning || data.daysUntil == null) return null;
  return (
    <span
      className="text-xs font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning shrink-0"
      title={`Earnings in ${data.daysUntil} day${data.daysUntil === 1 ? '' : 's'}`}
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
      title={`Exhaustion: ${score.toFixed(1)}/10`}
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
  const labelMap: Record<string, string> = { HOLD: 'Hold', TRIM: 'Trim', EXIT: 'Exit' };
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${colorClass}`}>
      {labelMap[posSignal.action] ?? posSignal.action}
    </span>
  );
}

export function VolumeDot({ ratio }: { ratio: number | undefined }) {
  if (ratio == null) return null;
  if (ratio >= 1.5) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-success shrink-0"
        title={`Volume ${ratio.toFixed(1)}× avg (strong)`}
      />
    );
  }
  if (ratio < 0.8) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-foreground/10 shrink-0"
        title={`Volume ${ratio.toFixed(1)}× avg (weak)`}
      />
    );
  }
  return null;
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
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors border-l-2 border-danger/40',
        isDone && 'opacity-50',
        isFocused && 'ring-1 ring-primary',
      )}
    >
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
      <span className="text-xs text-muted truncate flex-1">{item.reason}</span>
      {isDone ? (
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
      ) : onAction ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onAction(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onAction(); } }}
          className="text-xs px-2 py-0.5 rounded bg-danger/10 text-danger hover:bg-danger/20 shrink-0 cursor-pointer"
        >
          {t('todayPage.actionList.closeAction')}
        </span>
      ) : null}
    </button>
  );
}

export interface UpdateStopItemProps {
  item: DailyReviewPositionUpdate;
  onClick: (ticker: string) => void;
  onAction?: () => void;
  onAccept?: (positionId: string, stopSuggested: number, reason: string) => void;
  isDone?: boolean;
  isAccepting?: boolean;
  isFocused?: boolean;
}

export function UpdateStopItem({ item, onClick, onAction, onAccept, isDone, isAccepting, isFocused }: UpdateStopItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors border-l-2 border-warning/40',
        isDone && 'opacity-50',
        isFocused && 'ring-1 ring-primary',
      )}
    >
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
      <span className="text-xs text-muted truncate flex-1">{item.reason}</span>
      {isDone ? (
        <span className="text-xs font-medium text-success shrink-0">
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
            'bg-warning/10 text-warning',
            'hover:bg-warning/20',
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
          className="text-xs px-2 py-0.5 rounded bg-warning/10 text-warning hover:bg-warning/20 shrink-0 cursor-pointer"
        >
          {t('todayPage.actionList.updateAction')}
        </span>
      ) : null}
    </button>
  );
}

export interface CandidateItemProps {
  item: DailyReviewCandidate;
  isAddOn?: boolean;
  onClick: (ticker: string) => void;
  isFocused?: boolean;
}

function candidateModeBadge(item: DailyReviewCandidate, isAddOn?: boolean) {
  const mode = item.sameSymbol?.mode;
  if (mode === 'RE_ENTRY') {
    return (
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-success/10 text-success">
        {t('todayPage.actionList.reEnter')}
      </span>
    );
  }
  if (mode === 'SCALE_BACK') {
    return (
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
        {t('todayPage.actionList.scaleBack')}
      </span>
    );
  }
  if (isAddOn || mode === 'ADD_ON') {
    return (
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
        {t('todayPage.actionList.addOn')}
      </span>
    );
  }
  return (
    <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
      {item.decisionSummary?.action ?? item.signal}
    </span>
  );
}

export function CandidateItem({ item, isAddOn, onClick, isFocused }: CandidateItemProps) {
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
          'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors border-l-2 border-primary/40',
          isFocused && 'ring-1 ring-primary',
        )}
      >
        <span className="text-sm font-semibold text-foreground min-w-[60px]">
          {item.ticker}
        </span>
        {candidateModeBadge(item, isAddOn)}
        <span className="text-xs text-muted tabular-nums">
          r/r: {formatNumber(item.rReward, 2)}R
        </span>
        {item.confidence != null && (
          <span className="text-xs text-muted tabular-nums shrink-0">
            {t('todayPage.actionList.candidateConfidence', { pct: String(Math.round(item.confidence)) })}
          </span>
        )}
        <VolumeDot ratio={item.volumeRatio} />
        {item.name && (
          <span className="text-xs text-muted truncate flex-1">{item.name}</span>
        )}
      </button>
      {showCatalyst && (
        <div className="mt-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm">
          <p className="font-semibold text-success text-xs uppercase tracking-wide mb-1">
            {t('todayPage.candidateCard.catalystContext')}
          </p>
          <p className="text-success">{item.decisionSummary!.catalystSummary}</p>
          {item.decisionSummary!.catalystSources.length > 0 && (
            <details className="mt-1">
              <summary className="text-xs text-success cursor-pointer select-none">
                {t('todayPage.candidateCard.catalystSources')} ({item.decisionSummary!.catalystSources.length})
              </summary>
              <ul className="mt-1 space-y-0.5">
                {item.decisionSummary!.catalystSources.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-success hover:underline break-all"
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

export interface HoldItemProps {
  item: DailyReviewPositionHold;
  onClick: (ticker: string) => void;
  onTrim?: () => void;
  isFocused?: boolean;
  intelligenceSummary?: OpenPositionIntelligenceSummary;
}

export function HoldItem({ item, onClick, onTrim, isFocused, intelligenceSummary }: HoldItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors border-l-2 border-border',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-muted min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-foreground/5 text-muted">
        {t('dailyReview.table.hold.holdBadge')}
      </span>
      {item.trimSuggestion && (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning">
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
      <span className="text-xs text-muted truncate flex-1">{item.reason}</span>
      {item.trimSuggestion && onTrim && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onTrim(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onTrim(); } }}
          className="text-xs px-2 py-0.5 rounded bg-warning/10 text-warning hover:bg-warning/20 shrink-0 cursor-pointer"
        >
          {t('todayPage.actionList.trimAction')}
        </span>
      )}
    </button>
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
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors border-l-2 border-warning/40',
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
      <span className="text-xs text-muted truncate flex-1">{item.reason}</span>
    </button>
  );
}

export function WatchlistNearTriggerItem({ item, onClick, isFocused }: { item: WatchItem; onClick: (ticker: string) => void; isFocused?: boolean }) {
  const distance = item.distanceToTriggerPct;
  return (
    <button
      type="button"
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors border-l-2 border-warning/40',
        isFocused && 'ring-1 ring-primary',
      )}
    >
      <span className="text-sm font-semibold text-foreground min-w-[60px]">
        {item.ticker}
      </span>
      <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning">
        {t('todayPage.actionList.watchlistNearTrigger')}
      </span>
      <div className="min-w-0 flex-1">
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
      onClick={() => onClick(item.ticker)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors border-l-2',
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
        <span className="text-xs text-muted truncate flex-1">
          {item.note}
        </span>
      )}
    </button>
  );
}
