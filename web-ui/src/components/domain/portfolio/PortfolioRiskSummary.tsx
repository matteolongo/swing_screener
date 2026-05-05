import type { Position } from '@/types/position';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatCurrency, formatNumber } from '@/utils/formatters';

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
      ? 'text-gray-700 dark:text-gray-300'
      : portfolioHeat < 5
        ? 'text-green-600 dark:text-green-400'
        : portfolioHeat <= 15
          ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-red-600 dark:text-red-400';

  const rNowColor =
    avgRNow == null
      ? 'text-gray-700 dark:text-gray-300'
      : avgRNow >= 0
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400';

  const chipBase =
    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium';

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
      {/* Open positions count */}
      <span className={cn(chipBase, 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('portfolioRisk.openPositions')}
        </span>
        <span className="font-bold text-gray-900 dark:text-gray-100">{openPositionCount}</span>
      </span>

      {/* Effective equity */}
      <span className={cn(chipBase, 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('portfolioRisk.effectiveEquity')}
        </span>
        <span className="font-bold text-gray-900 dark:text-gray-100">
          {accountSize != null ? formatCurrency(accountSize, 'EUR') : '—'}
        </span>
      </span>

      {realizedPnl != null ? (
        <span className={cn(chipBase, 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300')}>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('portfolioRisk.realizedPnl')}
          </span>
          <span className={cn(
            'font-bold',
            realizedPnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
          )}>
            {realizedPnl >= 0 ? '+' : ''}{formatCurrency(realizedPnl, 'EUR')}
          </span>
        </span>
      ) : null}

      {/* Total risk */}
      <span className={cn(chipBase, 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('portfolioRisk.totalRisk')}
        </span>
        <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(totalOpenRisk, 'EUR')}</span>
      </span>

      {/* Portfolio heat */}
      <span className={cn(chipBase, 'border-gray-200 dark:border-gray-700')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('portfolioRisk.portfolioHeat')}
        </span>
        <span className={cn('font-bold', heatColor)}>
          {portfolioHeat != null ? `${formatNumber(portfolioHeat, 1)}%` : '—'}
        </span>
      </span>

      {/* Avg R now */}
      <span className={cn(chipBase, 'border-gray-200 dark:border-gray-700')}>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('portfolioRisk.avgRNow')}
        </span>
        <span className={cn('font-bold', rNowColor)}>
          {avgRNow != null ? `${avgRNow >= 0 ? '+' : ''}${formatNumber(avgRNow, 2)}R` : '—'}
        </span>
      </span>
    </div>
  );
}
