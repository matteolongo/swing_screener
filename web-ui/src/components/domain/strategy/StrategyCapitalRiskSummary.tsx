import Card, { CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import type { Strategy } from '@/features/strategy/types';
import { cn } from '@/utils/cn';
import { formatCurrency, formatRatioAsPercent } from '@/utils/formatters';
import { t } from '@/i18n/t';

interface EquitySnapshot {
  effectiveAccountSize: number;
  realizedPnl: number;
}

interface StrategyCapitalRiskSummaryProps {
  strategy?: Strategy | null;
  equitySnapshot?: EquitySnapshot;
  variant?: 'card' | 'compact';
  className?: string;
}

function formatOrDash(value: number | null | undefined, formatter: (value: number) => string): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  return formatter(value);
}

function buildRiskSnapshot(strategy?: Strategy | null, equitySnapshot?: EquitySnapshot) {
  const risk = strategy?.risk;
  const baseAccountSize = risk?.accountSize ?? null;
  const accountSize = equitySnapshot?.effectiveAccountSize ?? baseAccountSize;
  const riskPct = risk?.riskPct ?? null;
  const maxPositionPct = risk?.maxPositionPct ?? null;
  const capitalAtRisk = accountSize != null && riskPct != null ? accountSize * riskPct : null;
  const maxPositionValue = accountSize != null && maxPositionPct != null ? accountSize * maxPositionPct : null;

  return {
    strategyName: strategy?.name ?? 'Strategy',
    accountSize,
    baseAccountSize,
    realizedPnl: equitySnapshot?.realizedPnl ?? null,
    isEquityMode: equitySnapshot != null,
    riskPct,
    maxPositionPct,
    capitalAtRisk,
    maxPositionValue,
  };
}

export default function StrategyCapitalRiskSummary({
  strategy,
  equitySnapshot,
  variant = 'card',
  className,
}: StrategyCapitalRiskSummaryProps) {
  const snapshot = buildRiskSnapshot(strategy, equitySnapshot);
  const accountSizeLabel = formatOrDash(snapshot.accountSize, (value) => formatCurrency(value));
  const baseAccountLabel = formatOrDash(snapshot.baseAccountSize, (value) => formatCurrency(value));
  const realizedPnlLabel = formatOrDash(snapshot.realizedPnl, (value) => `${value >= 0 ? '+' : ''}${formatCurrency(value)}`);
  const riskPctLabel = formatOrDash(snapshot.riskPct, (value) => formatRatioAsPercent(value));
  const capitalAtRiskLabel = formatOrDash(snapshot.capitalAtRisk, (value) => formatCurrency(value));
  const maxPositionLabel = formatOrDash(snapshot.maxPositionValue, (value) => formatCurrency(value));

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-lg border border-border bg-foreground/5 px-3 py-2 text-xs text-muted shadow-sm',
          className,
        )}
      >
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          <span className="text-muted">Risk</span>
          <span>{snapshot.strategyName}</span>
        </span>
        <span title={snapshot.isEquityMode ? t('portfolioHeader.equityModeHint') : undefined}>
          {snapshot.isEquityMode ? t('portfolioHeader.effectiveEquity') : 'Account'} {accountSizeLabel}
        </span>
        {snapshot.isEquityMode ? (
          <span>{t('portfolioHeader.realizedPnl')} {realizedPnlLabel}</span>
        ) : null}
        <span>Risk / trade {capitalAtRiskLabel} ({riskPctLabel})</span>
        <span>Max position {maxPositionLabel}</span>
      </div>
    );
  }

  return (
    <Card
      variant="bordered"
      className={cn(
        'border-primary/40 bg-gradient-to-br bg-primary/10 via-white bg-primary/10 shadow-sm',
        className,
      )}
    >
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-foreground">Capital Risk at a Glance</span>
          <span className="text-xs font-medium text-muted">
            {snapshot.strategyName}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">
          This strategy sizes positions from the active risk settings below. The education sections
          underneath still explain why each parameter matters.
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface/80 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              {snapshot.isEquityMode ? t('portfolioHeader.effectiveEquity') : 'Account Size'}
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {accountSizeLabel}
            </div>
            {snapshot.isEquityMode ? (
              <div className="mt-1 text-xs text-muted">
                {t('portfolioHeader.baseAccount')} {baseAccountLabel} · {t('portfolioHeader.realizedPnl')} {realizedPnlLabel}
              </div>
            ) : null}
          </div>
          <div className="rounded-lg border border-border bg-surface/80 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Capital at Risk / Trade
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {capitalAtRiskLabel}
            </div>
            <div className="mt-1 text-xs text-muted">
              {riskPctLabel} of the account
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface/80 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Max Position Value
            </div>
            <div className="mt-1 text-lg font-semibold text-foreground">
              {maxPositionLabel}
            </div>
            <div className="mt-1 text-xs text-muted">
              {formatOrDash(snapshot.maxPositionPct, (value) => formatRatioAsPercent(value))} cap
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
