import Badge from '@/components/common/Badge';
import { useScreenerStore } from '@/stores/screenerStore';
import { formatPercent } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface KeyMetricsProps {
  ticker: string;
}

export default function KeyMetrics({ ticker }: KeyMetricsProps) {
  const candidate = useScreenerStore((state) =>
    state.lastResult?.candidates.find((item) => item.ticker.toUpperCase() === ticker.toUpperCase())
  );

  if (!candidate) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('workspacePage.panels.analysis.noMetrics')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('workspacePage.panels.analysis.metricsTitle')}</h3>
      <div className="flex flex-wrap gap-2">
        <Badge variant="default">ATR: {candidate.atr.toFixed(2)}</Badge>
        <Badge variant="default">SMA20: {candidate.sma20.toFixed(2)}</Badge>
        <Badge variant="default">SMA50: {candidate.sma50.toFixed(2)}</Badge>
        <Badge variant="default">SMA200: {candidate.sma200.toFixed(2)}</Badge>
        <Badge variant="default">MOM6M: {formatPercent(candidate.momentum6m * 100)}</Badge>
        <Badge variant="default">MOM12M: {formatPercent(candidate.momentum12m * 100)}</Badge>
      </div>
    </div>
  );
}
