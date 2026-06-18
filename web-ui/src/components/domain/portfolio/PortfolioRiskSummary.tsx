import type { Position } from '@/types/position';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatCurrency, formatNumber, getSignColorClass } from '@/utils/formatters';

interface PortfolioRiskSummaryProps {
  openPositions: Position[];
  accountSize?: number;
  realizedPnl?: number;
}

export default function PortfolioRiskSummary({ openPositions, accountSize, realizedPnl }: PortfolioRiskSummaryProps) {
  const totalOpenRisk = openPositions.reduce((sum, p) => sum + (p.initialRisk ?? 0), 0);

  const portfolioHeat =
    accountSize && accountSize > 0 ? (totalOpenRisk / accountSize) * 100 : null;

  const openPositionCount = openPositions.length;

  const rNowValues = openPositions
    .filter((p) => p.currentPrice != null && p.initialRisk && p.initialRisk > 0)
    .map((p) => (p.currentPrice! - p.entryPrice) / p.initialRisk!);

  const avgRNow =
    rNowValues.length > 0
      ? rNowValues.reduce((a, b) => a + b, 0) / rNowValues.length
      : null;

  const heatColor =
    portfolioHeat == null
      ? 'text-muted'
      : portfolioHeat < 5
        ? 'text-success'
        : portfolioHeat <= 15
          ? 'text-warning'
          : 'text-danger';

  const rNowColor =
    avgRNow == null
      ? 'text-muted'
      : getSignColorClass(avgRNow);

  const chipBase =
    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium';

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-surface px-4 py-3">
      {/* Open positions count */}
      <span className={cn(chipBase, 'border-border text-muted')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('portfolioRisk.openPositions')}
        </span>
        <span className="font-bold text-foreground">{openPositionCount}</span>
      </span>

      {/* Effective equity */}
      <span className={cn(chipBase, 'border-border text-muted')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('portfolioRisk.effectiveEquity')}
        </span>
        <span className="font-bold text-foreground">
          {accountSize != null ? formatCurrency(accountSize, 'EUR') : '—'}
        </span>
      </span>

      {realizedPnl != null ? (
        <span className={cn(chipBase, 'border-border text-muted')}>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('portfolioRisk.realizedPnl')}
          </span>
          <span className={cn('font-bold', getSignColorClass(realizedPnl))}>
            {realizedPnl >= 0 ? '+' : ''}{formatCurrency(realizedPnl, 'EUR')}
          </span>
        </span>
      ) : null}

      {/* Total risk */}
      <span className={cn(chipBase, 'border-border text-muted')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('portfolioRisk.totalRisk')}
        </span>
        <span className="font-bold text-foreground">{formatCurrency(totalOpenRisk, 'EUR')}</span>
      </span>

      {/* Portfolio heat */}
      <span className={cn(chipBase, 'border-border')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('portfolioRisk.portfolioHeat')}
        </span>
        <span className={cn('font-bold', heatColor)}>
          {portfolioHeat != null ? `${formatNumber(portfolioHeat, 1)}%` : '—'}
        </span>
      </span>

      {/* Avg R now */}
      <span className={cn(chipBase, 'border-border')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('portfolioRisk.avgRNow')}
        </span>
        <span className={cn('font-bold', rNowColor)}>
          {avgRNow != null ? `${avgRNow >= 0 ? '+' : ''}${formatNumber(avgRNow, 2)}R` : '—'}
        </span>
      </span>
    </div>
  );
}
