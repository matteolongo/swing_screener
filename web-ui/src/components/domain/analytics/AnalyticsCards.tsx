import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { pickEdgeInsight, type EdgeVerdict } from '@/features/analytics/edgeInsight';

interface StatCardProps {
  label: string;
  value: string;
  colorClass?: string;
  hint?: string;
}

export function StatCard({ label, value, colorClass, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('mt-1 text-xl font-bold', colorClass ?? 'text-foreground')}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted leading-tight">{hint}</p> : null}
    </div>
  );
}

const VERDICT_STYLES: Record<EdgeVerdict, { border: string; bg: string; label: string; labelClass: string }> = {
  positive: {
    border: 'border-success/40',
    bg: 'bg-success/10',
    label: t('analyticsPage.insight.verdictLabel.positive'),
    labelClass: 'text-success',
  },
  developing: {
    border: 'border-warning/40',
    bg: 'bg-warning/10',
    label: t('analyticsPage.insight.verdictLabel.developing'),
    labelClass: 'text-warning',
  },
  negative: {
    border: 'border-danger/40',
    bg: 'bg-danger/10',
    label: t('analyticsPage.insight.verdictLabel.negative'),
    labelClass: 'text-danger',
  },
};

interface EdgeInsightCardProps {
  totalTrades: number;
  avgR: number | null;
  profitFactor: number | null;
  winRate: number | null;
}

export function EdgeInsightCard({ totalTrades, avgR, profitFactor, winRate }: EdgeInsightCardProps) {
  const insight = pickEdgeInsight({ totalTrades, avgR, profitFactor, winRate });
  const styles = VERDICT_STYLES[insight.verdict];
  return (
    <div className={cn('rounded-lg border px-4 py-3', styles.border, styles.bg)}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          {t('analyticsPage.insight.title')}
        </span>
        <span className={cn('text-xs font-bold uppercase tracking-wide', styles.labelClass)}>
          {styles.label}
        </span>
      </div>
      <p className="text-sm text-muted">{insight.message}</p>
    </div>
  );
}

export function HowToReadBox() {
  return (
    <details open className="rounded-lg border border-border bg-foreground/5 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-muted select-none">
        How to read this page
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt className="font-semibold text-foreground">R (Risk unit)</dt>
          <dd className="mt-0.5 text-muted">1R = your initial risk per trade (entry − stop × shares). Every result is expressed as a multiple: +2R means you made 2× your risk, −1R means you lost your full planned risk.</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">Avg R</dt>
          <dd className="mt-0.5 text-muted">Average R across all closed trades. Must stay above 0R over time to grow the account. Negative avg R means every trade costs you money on average.</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">Profit Factor</dt>
          <dd className="mt-0.5 text-muted">Total gains ÷ total losses (in R). 1.0 = break even, &gt; 1.0 = profitable. A value of 0.20 means for every 1R gained, 5R is lost in aggregate.</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">Max R</dt>
          <dd className="mt-0.5 text-muted">The best paper gain reached during the trade before exit (based on highest price). Useful to understand how much you left on the table vs. how much you captured.</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">Equity Curve</dt>
          <dd className="mt-0.5 text-muted">Cumulative R over time — each dot is one closed trade. Hover a dot to see the individual result. A flat or rising curve above 0 is the goal.</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">R Distribution</dt>
          <dd className="mt-0.5 text-muted">How many trades landed in each R outcome bucket. Red bars = losses, green = wins. Empty buckets appear as thin marks. Ideal shape: taller bars on the right than the left.</dd>
        </div>
      </dl>
    </details>
  );
}
