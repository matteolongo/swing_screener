import { ArrowUpRight, ClipboardList, Crosshair, Layers, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOrders, usePortfolioSummary, usePositions } from '@/features/portfolio/hooks';
import { useScreenerStore } from '@/stores/screenerStore';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/formatters';
import type { MessageKey } from '@/i18n/types';

function ReviewMetric({ icon: Icon, label, value, detail, to, tab, tone }: {
  icon: typeof Shield;
  label: MessageKey;
  value: number | string | undefined;
  detail: string;
  to: string;
  tab?: 'orders' | 'positions';
  tone?: 'normal' | 'warning' | 'danger';
}) {
  const className = 'group block min-w-0 rounded-xl border border-border bg-surface p-4 hover:border-primary/50 hover:bg-primary/5';
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted group-hover:text-primary" aria-hidden="true" />
      </span>
      <span className="mt-3 block text-sm font-medium text-muted">{t(label)}</span>
      <span className={cn('mt-1 block break-words font-semibold', typeof value === 'undefined' ? 'text-base' : 'text-2xl tabular-nums',
        tone === 'warning' && 'text-warning', tone === 'danger' && 'text-danger')}>
        {value ?? '—'}
      </span>
      <span className="mt-1 block text-xs text-muted">{detail}</span>
    </>
  );

  return tab
    ? <Link to={to} state={{ tab }} className={className}>{body}</Link>
    : <a href={to} className={className}>{body}</a>;
}

export default function TodayStatsStrip() {
  const ordersQuery = useOrders('pending');
  const positionsQuery = usePositions('open');
  const portfolioQuery = usePortfolioSummary();
  const todayRunResult = useScreenerStore((s) => s.todayRun?.result);
  const lastResultFallback = useScreenerStore((s) => s.lastResult);
  const reviewSource = todayRunResult ?? lastResultFallback;
  const readyCount = reviewSource?.candidates.filter((c) => c.recommendation?.workflowStatus === 'ready').length;
  const summary = portfolioQuery.data;
  const heat = summary?.analyticsMetadata?.heatStatus;

  const positionCount = positionsQuery.data?.length;
  const pendingEntryCount = ordersQuery.data?.filter((o) => o.orderKind === 'entry').length;
  const status = (query: { isError: boolean; isLoading: boolean; data: unknown }, hint: MessageKey) => {
    if (query.isError) return t(query.data == null ? 'cockpit.review.unavailableValue' : 'cockpit.review.updatingValue');
    return t(query.isLoading ? 'cockpit.review.pendingValue' : hint);
  };

  return (
    <div data-testid="today-stats-strip" className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <ReviewMetric icon={Shield} label="cockpit.review.portfolioRisk" to="/book" tab="positions"
        value={summary && Number.isFinite(summary.openRiskPercent) ? `${formatNumber(summary.openRiskPercent, 1)}%` : undefined}
        detail={portfolioQuery.isError || !heat ? status(portfolioQuery, 'cockpit.review.riskHint') : t(`cockpit.review.heat.${heat}`)}
        tone={heat} />
      <ReviewMetric icon={Layers} label="cockpit.strip.positions" value={positionCount} to="/book" tab="positions"
        detail={status(positionsQuery, 'cockpit.review.positionHint')} />
      <ReviewMetric icon={ClipboardList} label="cockpit.strip.pendingOrders" value={pendingEntryCount} to="/book" tab="orders"
        detail={status(ordersQuery, 'cockpit.review.orderHint')} />
      <ReviewMetric icon={Crosshair} label="cockpit.strip.ready" value={readyCount} to="#candidate-review"
        detail={t('cockpit.review.setupHint')} />
    </div>
  );
}
