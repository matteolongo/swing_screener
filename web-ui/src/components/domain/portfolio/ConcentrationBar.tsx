import { AlertTriangle } from 'lucide-react';
import type { ConcentrationGroup } from '@/features/portfolio/api';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';
import { formatCurrency, formatNumber } from '@/utils/formatters';

interface ConcentrationBarProps {
  groups: ConcentrationGroup[];
}

export default function ConcentrationBar({ groups }: ConcentrationBarProps) {
  if (groups.length === 0) {
    return null;
  }

  const topGroup = groups[0];
  const pct = formatNumber(topGroup.riskPct, 0);
  const fillWidth = `${Math.min(Math.max(topGroup.riskPct, 0), 100)}%`;
  const labelKey = topGroup.warning ? 'concentrationBar.warningLabel' : 'concentrationBar.normalLabel';

  return (
    <section
      data-warning={topGroup.warning ? 'true' : 'false'}
      className={cn(
        'rounded-lg border bg-white px-4 py-3 dark:bg-gray-900',
        topGroup.warning
          ? 'border-amber-300 dark:border-amber-700'
          : 'border-gray-200 dark:border-gray-700',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {topGroup.warning ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('concentrationBar.title')}
            </p>
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t(labelKey, { country: topGroup.country, pct })}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
          {t('concentrationBar.detail', {
            count: topGroup.positionCount,
            amount: formatCurrency(topGroup.riskAmount, 'EUR'),
          })}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div
          className={cn(
            'h-full rounded-full',
            topGroup.warning ? 'bg-amber-500 dark:bg-amber-400' : 'bg-blue-500 dark:bg-blue-400',
          )}
          style={{ width: fillWidth }}
        />
      </div>
    </section>
  );
}
