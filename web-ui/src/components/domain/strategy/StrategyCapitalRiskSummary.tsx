import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import type { Strategy } from '@/features/strategy/types';
import { cn } from '@/utils/cn';
import { formatCurrency, formatRatioAsPercent } from '@/utils/formatters';

interface StrategyCapitalRiskSummaryProps {
  strategy?: Strategy | null;
  variant?: 'card' | 'compact';
  className?: string;
}

function formatOrDash(value: number | null | undefined, formatter: (value: number) => string): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  return formatter(value);
}

function buildRiskSnapshot(strategy?: Strategy | null) {
  const risk = strategy?.risk;
  const accountSize = risk?.accountSize ?? null;
  const riskPct = risk?.riskPct ?? null;
  const maxPositionPct = risk?.maxPositionPct ?? null;
  const capitalAtRisk = accountSize != null && riskPct != null ? accountSize * riskPct : null;
  const maxPositionValue = accountSize != null && maxPositionPct != null ? accountSize * maxPositionPct : null;

  return {
    strategyName: strategy?.name ?? 'Strategy',
    accountSize,
    riskPct,
    maxPositionPct,
    capitalAtRisk,
    maxPositionValue,
  };
}

export default function StrategyCapitalRiskSummary({
  strategy,
  variant = 'card',
  className,
}: StrategyCapitalRiskSummaryProps) {
  const snapshot = buildRiskSnapshot(strategy);
  const accountSizeLabel = formatOrDash(snapshot.accountSize, (value) => formatCurrency(value));
  const riskPctLabel = formatOrDash(snapshot.riskPct, (value) => formatRatioAsPercent(value));
  const capitalAtRiskLabel = formatOrDash(snapshot.capitalAtRisk, (value) => formatCurrency(value));
  const maxPositionLabel = formatOrDash(snapshot.maxPositionValue, (value) => formatCurrency(value));

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200',
          className,
        )}
      >
        <span className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100">
          <span className="text-slate-500 dark:text-slate-400">Risk</span>
          <span>{snapshot.strategyName}</span>
        </span>
        <span>Account {accountSizeLabel}</span>
        <span>Risk / trade {capitalAtRiskLabel} ({riskPctLabel})</span>
        <span>Max position {maxPositionLabel}</span>
      </div>
    );
  }

  return (
    <Card
      variant="bordered"
      className={cn(
        'border-sky-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50/70 shadow-sm dark:border-sky-900/60 dark:from-sky-950/30 dark:via-gray-800 dark:to-indigo-950/20',
        className,
      )}
    >
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-slate-900 dark:text-slate-50">Capital Risk at a Glance</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {snapshot.strategyName}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This strategy sizes positions from the active risk settings below. The education sections
          underneath still explain why each parameter matters.
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Account Size
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
              {accountSizeLabel}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Capital at Risk / Trade
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
              {capitalAtRiskLabel}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {riskPctLabel} of the account
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Max Position Value
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">
              {maxPositionLabel}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formatOrDash(snapshot.maxPositionPct, (value) => formatRatioAsPercent(value))} cap
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
