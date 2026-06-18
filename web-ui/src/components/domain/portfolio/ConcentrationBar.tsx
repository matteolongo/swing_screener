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
        'rounded-lg border bg-surface px-4 py-3',
        topGroup.warning
          ? 'border-warning/40'
          : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {topGroup.warning ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          ) : null}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t('concentrationBar.title')}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">
              {t(labelKey, { country: topGroup.country, pct })}
            </p>
          </div>
        </div>
        <p className="shrink-0 text-xs font-medium text-muted">
          {t('concentrationBar.detail', {
            count: topGroup.positionCount,
            amount: formatCurrency(topGroup.riskAmount, 'EUR'),
          })}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/5">
        <div
          className={cn(
            'h-full rounded-full',
            topGroup.warning ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: fillWidth }}
        />
      </div>
    </section>
  );
}
