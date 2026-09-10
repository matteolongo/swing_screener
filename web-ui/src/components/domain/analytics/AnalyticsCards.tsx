import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/formatters';
import type { PortfolioAnalytics } from '@/features/portfolio/api';

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

const VERDICT_STYLES: Record<PortfolioAnalytics['insight']['verdict'], { border: string; bg: string; label: string; labelClass: string }> = {
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
  insight: PortfolioAnalytics['insight'];
  totalTrades: number;
  averageR: number | null;
  profitFactor: number | null;
  winRate: number | null;
}

function displayR(value: number | null): string {
  return value == null
    ? t('common.placeholders.emDash')
    : `${value >= 0 ? '+' : ''}${formatNumber(value, 2)}R`;
}

function insightMessage({ insight, totalTrades, averageR, profitFactor, winRate }: EdgeInsightCardProps): string {
  const formattedProfitFactor = profitFactor == null
    ? t('common.placeholders.emDash')
    : formatNumber(profitFactor, 2);
  switch (insight.reason) {
    case 'positive_edge':
      return t('analyticsPage.insight.message.positiveEdge', {
        averageR: displayR(averageR), profitFactor: formattedProfitFactor,
      });
    case 'positive_average_r':
      return t('analyticsPage.insight.message.positiveAverageR', {
        averageR: displayR(averageR), profitFactor: formattedProfitFactor,
      });
    case 'low_win_rate':
      return t('analyticsPage.insight.message.lowWinRate', {
        averageR: displayR(averageR),
        winRate: winRate == null ? t('common.placeholders.emDash') : `${formatNumber(winRate, 1)}%`,
      });
    case 'negative_average_r':
      return t('analyticsPage.insight.message.negativeAverageR', { averageR: displayR(averageR) });
    case 'insufficient_history':
      return t('analyticsPage.insight.message.insufficientHistory', { totalTrades });
  }
}

export function EdgeInsightCard(props: EdgeInsightCardProps) {
  const { insight } = props;
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
      <p className="text-sm text-muted">{insightMessage(props)}</p>
    </div>
  );
}

export function HowToReadBox() {
  return (
    <details open className="rounded-lg border border-border bg-foreground/5 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-muted select-none">
        {t('analyticsPage.howToRead.summary')}
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt className="font-semibold text-foreground">{t('analyticsPage.howToRead.r.term')}</dt>
          <dd className="mt-0.5 text-muted">{t('analyticsPage.howToRead.r.definition')}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">{t('analyticsPage.howToRead.avgR.term')}</dt>
          <dd className="mt-0.5 text-muted">{t('analyticsPage.howToRead.avgR.definition')}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">{t('analyticsPage.howToRead.profitFactor.term')}</dt>
          <dd className="mt-0.5 text-muted">{t('analyticsPage.howToRead.profitFactor.definition')}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">{t('analyticsPage.howToRead.maxR.term')}</dt>
          <dd className="mt-0.5 text-muted">{t('analyticsPage.howToRead.maxR.definition')}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">{t('analyticsPage.howToRead.equityCurve.term')}</dt>
          <dd className="mt-0.5 text-muted">{t('analyticsPage.howToRead.equityCurve.definition')}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">{t('analyticsPage.howToRead.rDistribution.term')}</dt>
          <dd className="mt-0.5 text-muted">{t('analyticsPage.howToRead.rDistribution.definition')}</dd>
        </div>
      </dl>
    </details>
  );
}
