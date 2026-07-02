import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import { formatNumber } from '@/utils/formatters';
import StatusDot, { type StatusTone } from '@/components/common/StatusDot';
import Badge, { type BadgeVariant } from '@/components/common/Badge';
import RChip from '@/components/common/RChip';
import { AiSignalBadge, ExhaustionBadge } from '@/components/domain/today/rowBadges';
import type { InboxItem, InboxItemKind } from '@/features/dailyReview/inbox';
import type { MessageKey } from '@/i18n/types';

export type InboxAction =
  | 'close'
  | 'applyStop'
  | 'updateStop'
  | 'cancelOrder'
  | 'planOrder'
  | 'analyze'
  | 'goToReview'
  | 'goToScreener';

export interface InboxRowProps {
  item: InboxItem;
  isFocused?: boolean;
  done?: boolean;
  /** Actions to render disabled for this row (e.g. applyStop while its mutation is in flight). */
  disabledActions?: InboxAction[];
  onSelectTicker: (ticker: string) => void;
  onAction: (action: InboxAction, item: InboxItem) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const KIND_TONE: Record<InboxItemKind, StatusTone> = {
  close: 'down',
  updateStop: 'warn',
  exitSignal: 'warn',
  staleOrder: 'warn',
  addOn: 'idle',
  newCandidate: 'idle',
  moreCandidates: 'idle',
  watch: 'idle',
  weeklyReview: 'idle',
};

const KIND_BADGE_VARIANT: Record<InboxItemKind, BadgeVariant> = {
  close: 'error',
  updateStop: 'warning',
  exitSignal: 'warning',
  staleOrder: 'warning',
  addOn: 'default',
  newCandidate: 'default',
  moreCandidates: 'default',
  watch: 'default',
  weeklyReview: 'default',
};

const KIND_LABEL_KEY: Record<InboxItemKind, MessageKey> = {
  close: 'todayPage.inbox.kinds.close',
  updateStop: 'todayPage.inbox.kinds.updateStop',
  exitSignal: 'todayPage.inbox.kinds.exitSignal',
  staleOrder: 'todayPage.inbox.kinds.staleOrder',
  addOn: 'todayPage.inbox.kinds.addOn',
  newCandidate: 'todayPage.inbox.kinds.newCandidate',
  moreCandidates: 'todayPage.inbox.kinds.moreCandidates',
  watch: 'todayPage.inbox.kinds.watch',
  weeklyReview: 'todayPage.inbox.kinds.weeklyReview',
};

interface ActionSpec {
  action: InboxAction;
  labelKey: MessageKey;
  primary?: boolean;
}

function actionsForKind(kind: InboxItemKind): ActionSpec[] {
  switch (kind) {
    case 'close':
      return [{ action: 'close', labelKey: 'todayPage.inbox.actions.close', primary: true }];
    case 'updateStop':
      return [
        { action: 'applyStop', labelKey: 'todayPage.inbox.actions.applyStop', primary: true },
        { action: 'updateStop', labelKey: 'todayPage.inbox.actions.updateStop' },
      ];
    case 'staleOrder':
      return [{ action: 'cancelOrder', labelKey: 'todayPage.inbox.actions.cancelOrder', primary: true }];
    case 'addOn':
    case 'newCandidate':
      return [{ action: 'planOrder', labelKey: 'todayPage.inbox.actions.planOrder', primary: true }];
    case 'watch':
      return [{ action: 'analyze', labelKey: 'todayPage.inbox.actions.analyze', primary: true }];
    case 'weeklyReview':
      return [{ action: 'goToReview', labelKey: 'todayPage.inbox.actions.goToReview', primary: true }];
    case 'moreCandidates':
      return [{ action: 'goToScreener', labelKey: 'todayPage.inbox.actions.goToScreener', primary: true }];
    case 'exitSignal':
    default:
      return [];
  }
}

export default function InboxRow({
  item,
  isFocused,
  done,
  disabledActions,
  onSelectTicker,
  onAction,
  expanded,
  onToggleExpand,
}: InboxRowProps) {
  const actions = actionsForKind(item.kind);
  const rowAnalyzes = item.kind === 'exitSignal';

  const handleRowClick = () => {
    if (rowAnalyzes) onAction('analyze', item);
  };

  return (
    <div className="flex flex-col">
      <div
        data-testid="inbox-row"
        role={rowAnalyzes ? 'button' : undefined}
        tabIndex={rowAnalyzes ? 0 : undefined}
        onClick={rowAnalyzes ? handleRowClick : undefined}
        onKeyDown={
          rowAnalyzes
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRowClick();
                }
              }
            : undefined
        }
        className={cn(
          'flex h-9 items-center gap-2 px-2 text-[13px]',
          isFocused && 'ring-1 ring-primary rounded',
          done && 'opacity-50 line-through',
          rowAnalyzes && 'cursor-pointer',
        )}
      >
        <StatusDot tone={KIND_TONE[item.kind]} />
        <Badge variant={KIND_BADGE_VARIANT[item.kind]} className="shrink-0">
          {t(KIND_LABEL_KEY[item.kind])}
        </Badge>
        {item.kind === 'moreCandidates' && item.count != null && (
          <Badge variant="default" className="shrink-0">
            {item.count}
          </Badge>
        )}
        {item.ticker && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onSelectTicker(item.ticker as string);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onSelectTicker(item.ticker as string);
              }
            }}
            className="shrink-0 font-semibold text-foreground hover:underline cursor-pointer"
          >
            {item.ticker}
          </span>
        )}
        {item.rNow != null && <RChip value={item.rNow} className="font-mono shrink-0" />}
        {item.kind === 'watch' && item.distanceToTriggerPct != null && (
          <span className="font-mono tabular-nums text-warning shrink-0">
            {t('watchlist.pipeline.distanceToBuyZone', {
              value: `${item.distanceToTriggerPct >= 0 ? '+' : ''}${formatNumber(item.distanceToTriggerPct, 1)}%`,
            })}
          </span>
        )}
        {item.kind === 'updateStop' && item.stopCurrent != null && item.stopSuggested != null && (
          <span className="font-mono tabular-nums text-muted shrink-0">
            {formatNumber(item.stopCurrent, 2)} → {formatNumber(item.stopSuggested, 2)}
          </span>
        )}
        {(item.kind === 'close' || item.kind === 'exitSignal') && (
          <AiSignalBadge action={item.positionSignal} />
        )}
        {item.kind === 'updateStop' && item.exhaustionLabel && (
          <ExhaustionBadge score={item.exhaustionScore ?? null} label={item.exhaustionLabel} />
        )}
        <span className="truncate flex-1 text-muted">
          {item.kind === 'moreCandidates'
            ? t('todayPage.inbox.moreCandidatesLabel', { count: item.count ?? 0 })
            : item.reason}
        </span>
        {actions.map(({ action, labelKey, primary }) => {
          const isDisabled = disabledActions?.includes(action) ?? false;
          return (
            <span
              key={action}
              role="button"
              aria-disabled={isDisabled || undefined}
              tabIndex={isDisabled ? -1 : 0}
              onClick={(e) => {
                e.stopPropagation();
                if (isDisabled) return;
                onAction(action, item);
              }}
              onKeyDown={(e) => {
                if (isDisabled) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onAction(action, item);
                }
              }}
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-xs font-medium',
                isDisabled
                  ? 'opacity-50 cursor-not-allowed pointer-events-none'
                  : 'cursor-pointer',
                primary ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-foreground/5 text-muted hover:bg-foreground/10',
              )}
            >
              {t(labelKey)}
            </span>
          );
        })}
        {onToggleExpand && item.kind !== 'moreCandidates' && (
          <span
            role="button"
            tabIndex={0}
            aria-label={t('todayPage.inbox.why')}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onToggleExpand();
              }
            }}
            className="shrink-0 cursor-pointer text-muted hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        )}
      </div>
      {expanded && (
        <div className="pl-8 pb-1.5 text-xs text-muted">{item.detail ?? item.reason}</div>
      )}
    </div>
  );
}
