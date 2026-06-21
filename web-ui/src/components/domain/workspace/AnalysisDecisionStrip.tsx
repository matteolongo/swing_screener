import Badge from '@/components/common/Badge';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type {
  DataSourceHealth,
  DecisionAction,
  DecisionConviction,
} from '@/features/screener/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { t } from '@/i18n/t';
import { formatCurrency, formatNumber } from '@/utils/formatters';

interface AnalysisDecisionStripProps {
  ticker: string;
  candidate?: SymbolAnalysisCandidate | null;
  position?: PositionWithMetrics | null;
  onPrepareOrder?: () => void;
  isWatched?: boolean;
  isPendingWatch?: boolean;
  onWatch?: () => void;
  onUnwatch?: () => void;
}

function actionLabel(action: DecisionAction): string {
  switch (action) {
    case 'BUY_NOW':
      return t('workspacePage.panels.analysis.decisionSummary.actions.buyNow');
    case 'BUY_ON_PULLBACK':
      return t('workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback');
    case 'WAIT_FOR_BREAKOUT':
      return t('workspacePage.panels.analysis.decisionSummary.actions.waitForBreakout');
    case 'WATCH':
      return t('workspacePage.panels.analysis.decisionSummary.actions.watch');
    case 'TACTICAL_ONLY':
      return t('workspacePage.panels.analysis.decisionSummary.actions.tacticalOnly');
    case 'AVOID':
      return t('workspacePage.panels.analysis.decisionSummary.actions.avoid');
    case 'MANAGE_ONLY':
      return t('workspacePage.panels.analysis.decisionSummary.actions.manageOnly');
  }
}

function convictionLabel(conviction: DecisionConviction): string {
  switch (conviction) {
    case 'high':
      return t('workspacePage.panels.analysis.decisionSummary.conviction.high');
    case 'medium':
      return t('workspacePage.panels.analysis.decisionSummary.conviction.medium');
    case 'low':
      return t('workspacePage.panels.analysis.decisionSummary.conviction.low');
  }
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function compactValue(label: string, value: string, secondary?: string) {
  return (
    <div className="min-w-[88px] rounded-md border border-border bg-surface/90 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
      {secondary ? <div className="mt-0.5 text-[10px] text-muted">{secondary}</div> : null}
    </div>
  );
}

function sourceBadgeVariant(source: DataSourceHealth): 'success' | 'warning' | 'error' | 'default' {
  switch (source.status) {
    case 'ok':
      return 'success';
    case 'failed':
      return 'error';
    case 'degraded':
    case 'unknown':
      return 'warning';
  }
}

export default function AnalysisDecisionStrip({
  ticker,
  candidate,
  position,
  onPrepareOrder,
  isWatched,
  isPendingWatch,
  onWatch,
  onUnwatch,
}: AnalysisDecisionStripProps) {
  const summary = candidate?.decisionSummary;
  const currency = candidate?.currency ?? 'USD';
  const closeEntry = summary?.tradePlan.entry ?? candidate?.recommendation?.risk?.entry ?? candidate?.entry ?? position?.entryPrice ?? null;
  const suggestedOrderEntry = isPositiveNumber(candidate?.suggestedOrderPrice) ? candidate.suggestedOrderPrice : null;
  const usesSuggestedEntry =
    suggestedOrderEntry != null &&
    (!isPositiveNumber(closeEntry) || Math.abs(suggestedOrderEntry - closeEntry) >= 0.005);
  const entry = usesSuggestedEntry ? suggestedOrderEntry : closeEntry;
  const stop = summary?.tradePlan.stop ?? candidate?.recommendation?.risk?.stop ?? candidate?.stop ?? position?.stopPrice ?? null;
  const target = summary?.tradePlan.target ?? candidate?.recommendation?.risk?.target ?? position?.targetPrice ?? null;
  const computedRr = target != null && entry != null && stop != null && entry > stop
    ? (target - entry) / (entry - stop)
    : null;
  const rr = computedRr ?? summary?.tradePlan.rr ?? candidate?.recommendation?.risk?.rr ?? candidate?.rr ?? null;
  const oneR = entry != null && stop != null ? entry - stop : null;
  const pctToTarget = target != null && entry != null && entry > 0 ? (target - entry) / entry * 100 : null;
  const riskPct = candidate?.recommendation?.risk?.riskPct
    ?? (position != null && isPositiveNumber(position.perShareRisk) && isPositiveNumber(position.entryPrice)
      ? position.perShareRisk / position.entryPrice
      : undefined);
  const entryLabel = usesSuggestedEntry
    ? t('workspacePage.panels.analysis.decisionSummary.tradePlan.plannedEntry')
    : t('workspacePage.panels.analysis.decisionSummary.tradePlan.entryClose');
  const closeSecondary = usesSuggestedEntry && isPositiveNumber(closeEntry)
    ? `${t('workspacePage.panels.analysis.decisionSummary.tradePlan.close')} ${formatCurrency(closeEntry, currency)}`
    : undefined;
  const sourceItems = [
    ['Market', candidate?.dataSourceSummary?.marketData],
    ['Fundamentals', candidate?.dataSourceSummary?.fundamentals],
    ['Events', candidate?.dataSourceSummary?.calendar],
  ] as const;
  const visibleSourceItems = sourceItems.filter(
    (item): item is readonly [typeof item[0], DataSourceHealth] => Boolean(item[1])
  );

  return (
    <div className="sticky top-0 z-10 rounded-xl border border-border bg-surface/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">{ticker}</h2>
              {summary ? <Badge variant="primary">{actionLabel(summary.action)}</Badge> : null}
              {summary ? <Badge variant="default">{convictionLabel(summary.conviction)}</Badge> : null}
              {visibleSourceItems.map(([label, source]) => (
                <Badge key={label} variant={sourceBadgeVariant(source)}>
                  {label}: {source.provider || 'unknown'} ({source.status})
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted">
              {summary?.explanation?.summaryLine
                ?? summary?.whyNow
                ?? candidate?.recommendation?.reasonsShort?.[0]
                ?? 'Review the current setup, risk, and execution plan before acting.'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {(onWatch || onUnwatch) && (
              <button
                type="button"
                onClick={isWatched ? onUnwatch : onWatch}
                disabled={isPendingWatch}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface disabled:opacity-50"
              >
                {isPendingWatch ? '…' : isWatched ? 'Unwatch' : 'Watch'}
              </button>
            )}
            <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
              {compactValue(entryLabel, entry != null ? formatCurrency(entry, currency) : '—', closeSecondary)}
              {compactValue('Stop', stop != null ? formatCurrency(stop, currency) : '—')}
              {compactValue('Target', target != null ? formatCurrency(target, currency) : '—')}
              {compactValue(t('workspacePage.panels.analysis.decisionSummary.tradePlan.toTarget'), pctToTarget != null ? `${formatNumber(pctToTarget, 2)}%` : '—')}
              {compactValue('R/R', rr != null ? `${formatNumber(rr, 1)}x` : '—')}
              {compactValue('Risk %', riskPct != null && riskPct > 0 ? `${formatNumber(riskPct * 100, 2)}%` : '—')}
              {compactValue(t('workspacePage.panels.analysis.decisionSummary.tradePlan.oneR'), oneR != null ? formatCurrency(oneR, currency) : '—')}
            </div>
          </div>
        </div>

        {summary?.action === 'BUY_NOW' && onPrepareOrder && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onPrepareOrder}
              className="rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-white hover:bg-success"
            >
              {t('analysis.prepareOrder')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
