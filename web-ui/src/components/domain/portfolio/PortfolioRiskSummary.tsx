import type { PortfolioSummary } from '@/features/portfolio/api';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatCurrency, formatNumber, getSignColorClass } from '@/utils/formatters';

export default function PortfolioRiskSummary({ summary }: { summary?: PortfolioSummary }) {
  const heatColor = summary?.analyticsMetadata.heatStatus === 'danger'
    ? 'text-danger' : summary?.analyticsMetadata.heatStatus === 'warning' ? 'text-warning' : 'text-success';

  const chipBase =
    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium';

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface px-4 py-3">
      {/* Open positions count */}
      <span className={cn(chipBase, 'border-border text-muted')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('portfolioRisk.openPositions')}
        </span>
        <span className="font-bold text-foreground">{summary?.totalPositions ?? '—'}</span>
      </span>

      {/* Effective equity */}
      <span className={cn(chipBase, 'border-border text-muted')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('portfolioRisk.effectiveEquity')}
        </span>
        <span className="font-bold text-foreground">
          {summary ? formatCurrency(summary.effectiveAccountSize, 'EUR') : '—'}
        </span>

      <span className={cn(chipBase, 'border-border text-muted')}>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('portfolioRisk.realizedPnl')}
          </span>
          <span className={cn('font-bold', getSignColorClass(summary?.realizedPnl ?? 0))}>
            {summary ? `${summary.realizedPnl >= 0 ? '+' : ''}${formatCurrency(summary.realizedPnl, 'EUR')}` : '—'}
          </span>
        </span>
      </span>

      {/* Total risk */}
      <span className={cn(chipBase, 'border-border text-muted')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('portfolioRisk.totalRisk')}
        </span>
        <span className="font-bold text-foreground">{summary ? formatCurrency(summary.openRisk, 'EUR') : '—'}</span>
      </span>

      {/* Portfolio heat */}
      <span className={cn(chipBase, 'border-border')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('portfolioRisk.portfolioHeat')}
        </span>
        <span className={cn('font-bold', heatColor)}>
          {summary ? `${formatNumber(summary.openRiskPercent, 1)}%` : '—'}
        </span>
      </span>

      <span className={cn(chipBase, 'border-border')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('portfolioRisk.avgRNow')}
        </span>
        <span className={cn('font-bold', summary?.avgRNow == null ? 'text-muted' : getSignColorClass(summary.avgRNow))}>
          {summary?.avgRNow != null ? `${summary.avgRNow >= 0 ? '+' : ''}${formatNumber(summary.avgRNow, 2)}R` : '—'}
        </span>
      </span>
    </div>
  );
}
