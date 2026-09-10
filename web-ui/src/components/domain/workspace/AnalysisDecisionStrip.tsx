import Badge from '@/components/common/Badge';
import type { ReactNode } from 'react';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type {
  DataSourceHealth,
  DecisionAction,
  DecisionConviction,
} from '@/features/screener/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { t } from '@/i18n/t';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { formatWorkflowNextStep, getWorkflowPresentation } from '@/components/domain/recommendation/workflowPresentation';
import { getCanonicalOrderDraft } from '@/features/screener/types';
import type { WorkflowTone } from '@/components/domain/recommendation/workflowPresentation';

interface AnalysisDecisionStripProps {
  ticker: string;
  candidate?: SymbolAnalysisCandidate | null;
  position?: PositionWithMetrics | null;
  onPrepareOrder?: () => void;
  isWatched?: boolean;
  isPendingWatch?: boolean;
  onWatch?: () => void;
  onUnwatch?: () => void;
  decisionContext?: ReactNode;
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

function actionLabel(action: DecisionAction): string {
  const keys = {
    BUY_NOW: 'workspacePage.panels.analysis.decisionSummary.actions.buyNow',
    BUY_ON_PULLBACK: 'workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback',
    WAIT_FOR_BREAKOUT: 'workspacePage.panels.analysis.decisionSummary.actions.waitForBreakout',
    WATCH: 'workspacePage.panels.analysis.decisionSummary.actions.watch',
    TACTICAL_ONLY: 'workspacePage.panels.analysis.decisionSummary.actions.tacticalOnly',
    AVOID: 'workspacePage.panels.analysis.decisionSummary.actions.avoid',
    MANAGE_ONLY: 'workspacePage.panels.analysis.decisionSummary.actions.manageOnly',
  } as const;
  return t(keys[action]);
}

function isPositiveNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function metricRow(label: string, value: string, secondary?: string) {
  return (
    <tr>
      <th scope="row" className="rounded-l-md border border-r-0 border-border bg-surface/90 px-2.5 py-2 text-left text-[10px] font-normal uppercase tracking-wide text-muted">
        {label}
      </th>
      <td className="rounded-r-md border border-l-0 border-border bg-surface/90 px-2.5 py-2">
        <div className="text-sm font-semibold text-foreground">{value}</div>
        {secondary ? <div className="mt-0.5 text-[10px] text-muted">{secondary}</div> : null}
      </td>
    </tr>
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

function workflowBadgeVariant(tone: WorkflowTone): 'success' | 'warning' | 'error' | 'default' {
  switch (tone) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'error';
    case 'neutral':
      return 'default';
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
  decisionContext,
}: AnalysisDecisionStripProps) {
  const summary = candidate?.decisionSummary;
  const currency = candidate?.currency ?? 'USD';
  const heldMode = Boolean(position);
  const orderDraft = getCanonicalOrderDraft(candidate);
  const canPrepareOrder = Boolean(orderDraft);
  const showAnalysisAction = summary && (
    !candidate?.recommendation ||
    (
      canPrepareOrder &&
      (summary.action === 'BUY_NOW' || summary.action === 'BUY_ON_PULLBACK')
    )
  );
  const workflowPresentation = getWorkflowPresentation(candidate?.recommendation);
  const operationalNextStep = candidate?.recommendation
    ? formatWorkflowNextStep(candidate.recommendation.nextStep)
    : undefined;
  const closeEntry = heldMode
    ? position!.entryPrice
    : (orderDraft?.entry ?? summary?.tradePlan.entry ?? candidate?.recommendation?.risk?.entry ?? candidate?.entry ?? position?.entryPrice ?? null);
  const suggestedOrderEntry = isPositiveNumber(candidate?.suggestedOrderPrice) ? candidate.suggestedOrderPrice : null;
  const usesSuggestedEntry =
    !heldMode &&
    suggestedOrderEntry != null &&
    (!isPositiveNumber(closeEntry) || Math.abs(suggestedOrderEntry - closeEntry) >= 0.005);
  const entry = orderDraft?.entry ?? (usesSuggestedEntry ? suggestedOrderEntry : closeEntry);
  const stop = heldMode
    ? position!.stopPrice
    : (orderDraft?.stop ?? summary?.tradePlan.stop ?? candidate?.recommendation?.risk?.stop ?? candidate?.stop ?? position?.stopPrice ?? null);
  const target = heldMode
    ? (position!.targetPrice ?? null)
    : (orderDraft?.target ?? summary?.tradePlan.target ?? candidate?.recommendation?.risk?.target ?? position?.targetPrice ?? null);
  const computedRr = target != null && entry != null && stop != null && entry > stop
    ? (target - entry) / (entry - stop)
    : null;
  const rr = orderDraft?.rr ?? computedRr ?? summary?.tradePlan.rr ?? candidate?.recommendation?.risk?.rr ?? candidate?.rr ?? null;
  const oneR = entry != null && stop != null ? entry - stop : null;
  const pctToTarget = target != null && entry != null && entry > 0 ? (target - entry) / entry * 100 : null;
  const riskPct = candidate?.recommendation?.risk?.riskPct
    ?? (position != null && isPositiveNumber(position.perShareRisk) && isPositiveNumber(position.entryPrice)
      ? position.perShareRisk / position.entryPrice
      : undefined);
  const entryLabel = heldMode
    ? t('workspacePage.panels.analysis.decisionSummary.tradePlan.entry')
    : usesSuggestedEntry
      ? t('workspacePage.panels.analysis.decisionSummary.tradePlan.plannedEntry')
      : t('workspacePage.panels.analysis.decisionSummary.tradePlan.entryClose');
  const closeSecondary = usesSuggestedEntry && isPositiveNumber(closeEntry)
    ? `${t('workspacePage.panels.analysis.decisionSummary.tradePlan.close')} ${formatCurrency(closeEntry, currency)}`
    : undefined;
  const sourceItems = [
    [t('workspacePage.overview.sources.market'), candidate?.dataSourceSummary?.marketData],
    [t('workspacePage.overview.sources.fundamentals'), candidate?.dataSourceSummary?.fundamentals],
    [t('workspacePage.overview.sources.events'), candidate?.dataSourceSummary?.calendar],
  ] as const;
  const visibleSourceItems = sourceItems.filter(
    (item): item is readonly [typeof item[0], DataSourceHealth] => Boolean(item[1])
  );
  return (
    <div className="rounded-xl border border-border bg-surface/95 p-3 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">{ticker}</h2>
              {showAnalysisAction ? <Badge variant="primary">{actionLabel(summary.action)}</Badge> : null}
              {candidate?.recommendation ? (
                <Badge variant={workflowBadgeVariant(workflowPresentation.tone)}>
                  {t(workflowPresentation.labelKey)}
                </Badge>
              ) : null}
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
                ?? t('workspacePage.overview.reviewFallback')}
            </p>
            {operationalNextStep ? (
              <p className="text-sm font-medium text-foreground">
                <span className="text-muted">{t('workspacePage.overview.nextStep')}: </span>{operationalNextStep}
              </p>
            ) : null}
          </div>
          {(onWatch || onUnwatch) && (
            <button
              type="button"
              onClick={isWatched ? onUnwatch : onWatch}
              disabled={isPendingWatch}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface disabled:opacity-50"
            >
              {isPendingWatch
                ? t('workspacePage.overview.watchPending')
                : isWatched
                  ? t('workspacePage.overview.unwatch')
                  : t('workspacePage.overview.watch')}
            </button>
          )}
        </div>

        {decisionContext}

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1" aria-label={t('workspacePage.overview.tradePlan')}>
            <tbody>
              {metricRow(entryLabel, entry != null ? formatCurrency(entry, currency) : '—', closeSecondary)}
              {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.stop'), stop != null ? formatCurrency(stop, currency) : '—')}
              {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.target'), target != null ? formatCurrency(target, currency) : '—')}
              {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.toTarget'), pctToTarget != null ? `${formatNumber(pctToTarget, 2)}%` : '—')}
              {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.rr'), rr != null ? `${formatNumber(rr, 1)}x` : '—')}
              {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.riskPercent'), riskPct != null && riskPct > 0 ? `${formatNumber(riskPct * 100, 2)}%` : '—')}
              {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.oneR'), oneR != null ? formatCurrency(oneR, currency) : '—')}
              {metricRow(t('workspacePage.overview.invalidation'), summary?.explanation?.whatInvalidatesIt?.[0] ?? summary?.mainRisk ?? '—')}
            </tbody>
          </table>
        </div>

        {canPrepareOrder && onPrepareOrder && (
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
