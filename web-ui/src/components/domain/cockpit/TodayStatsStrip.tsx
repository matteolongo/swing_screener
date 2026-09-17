import { useOrders, usePositions } from '@/features/portfolio/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { t } from '@/i18n/t';
import { formatDate } from '@/utils/formatters';
import { cn } from '@/utils/cn';

export default function TodayStatsStrip() {
  const ordersQuery = useOrders('pending');
  const positionsQuery = usePositions('all');
  const todayRunResult = useScreenerStore((s) => s.todayRun?.result);
  const lastResultFallback = useScreenerStore((s) => s.lastResult);
  const reviewSource = todayRunResult ?? lastResultFallback;
  const candidates = reviewSource?.candidates ?? [];
  const readyCount = candidates.filter((c) => c.recommendation?.workflowStatus === 'ready').length;
  const isFinal = (reviewSource?.dataFreshness ?? 'intraday') === 'final_close';

  const positionCount = positionsQuery.data?.length ?? 0;
  const pendingEntryCount = (ordersQuery.data ?? []).filter((o) => o.orderKind === 'entry').length;

  return (
    <div data-testid="today-stats-strip" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="text-2xl font-semibold text-foreground">{positionCount}</div>
        <div className="text-xs text-muted">{t('cockpit.strip.positions')}</div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="text-2xl font-semibold text-foreground">{pendingEntryCount}</div>
        <div className="text-xs text-muted">{t('cockpit.strip.pendingOrders')}</div>
      </div>
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="text-2xl font-semibold text-foreground">{readyCount}</div>
        <div className="text-xs text-muted">{t('cockpit.strip.ready')}</div>
      </div>
      <div
        className={cn(
          'rounded-xl border p-3',
          isFinal ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10',
        )}
      >
        <div className={cn('text-sm font-medium', isFinal ? 'text-success' : 'text-warning')}>
          {isFinal ? t('cockpit.strip.finalClose') : t('cockpit.strip.intradayPreview')}
        </div>
        {reviewSource ? (
          <div className="text-xs text-muted">{formatDate(reviewSource.asofDate)}</div>
        ) : null}
      </div>
    </div>
  );
}
