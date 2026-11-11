import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import CollapsibleSection from '@/components/common/CollapsibleSection';
import type { ReactNode } from 'react';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type {
  DataSourceHealth,
  DecisionAction,
  DecisionConviction,
} from '@/features/screener/types';
import type { PositionWithMetrics } from '@/features/portfolio/api';
import { t } from '@/i18n/t';
import { isSupportedCurrency } from '@/types/currency';
import { formatCurrency, formatNumber } from '@/utils/formatters';
import { marketDate } from '@/features/screener/resultQuality';
import { formatWorkflowNextStep, getWorkflowPresentation } from '@/components/domain/recommendation/workflowPresentation';
import { getCanonicalOrderDraft } from '@/features/screener/types';
import type { WorkflowTone } from '@/components/domain/recommendation/workflowPresentation';

export interface CandidateRefreshControl {
  onRefresh: () => void;
  isPending: boolean;
  error: Error | null;
  asOf: string | null;
  freshness?: string;
}

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
  candidateRefresh?: CandidateRefreshControl;
  onSaveDraft?: () => void;
  disclosePlan?: boolean;
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
  candidateRefresh,
  onSaveDraft,
  disclosePlan = false,
}: AnalysisDecisionStripProps) {
  const summary = candidate?.decisionSummary;
  const candleDate = marketDate(candidate?.dataAsOf) ?? marketDate(candidate?.lastBar);
  const marketStatus = !candleDate ? 'unknown' : candidate?.dataStatus === 'current' ? 'final_close'
    : candidate?.dataStatus === 'stale' || candidate?.dataStatus === 'intraday' ? candidate.dataStatus : 'unknown';
  const heldMode = Boolean(position);
  const orderDraft = getCanonicalOrderDraft(candidate);
  const currency = heldMode ? candidate?.currency : orderDraft?.quoteCurrency ?? candidate?.currency;
  const formatPlanPrice = (value: number | null) => value != null && isSupportedCurrency(currency)
    ? formatCurrency(value, currency.trim().toUpperCase())
    : formatNumber(value);
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
  const explanation = !heldMode && !canPrepareOrder && candidate?.recommendation
    ? candidate.recommendation.reasonsShort?.[0] ?? t('workspacePage.overview.reviewFallback')
    : summary?.explanation?.summaryLine ?? summary?.whyNow ?? candidate?.recommendation?.reasonsShort?.[0];
  const closeEntry = heldMode
    ? position!.entryPrice
    : (orderDraft?.entry ?? summary?.tradePlan.entry ?? candidate?.recommendation?.risk?.entry ?? candidate?.entry ?? position?.entryPrice ?? null);
  const suggestedOrderEntry = isPositiveNumber(candidate?.suggestedOrderPrice) ? candidate.suggestedOrderPrice : null;
  const usesSuggestedEntry =
    !heldMode &&
    suggestedOrderEntry != null &&
    (!isPositiveNumber(closeEntry) || Math.abs(suggestedOrderEntry - closeEntry) >= 0.005);
  const entry = heldMode ? position!.entryPrice : orderDraft?.entry ?? (usesSuggestedEntry ? suggestedOrderEntry : closeEntry);
  const stop = heldMode
    ? position!.stopPrice
    : (orderDraft?.stop ?? summary?.tradePlan.stop ?? candidate?.recommendation?.risk?.stop ?? candidate?.stop ?? position?.stopPrice ?? null);
  const target = heldMode
    ? (position!.targetPrice ?? null)
    : (orderDraft?.target ?? summary?.tradePlan.target ?? candidate?.recommendation?.risk?.target ?? position?.targetPrice ?? null);
  const heldOneR = position?.perShareRisk ?? position?.initialRisk ?? null;
  const oneR = heldMode ? heldOneR : entry != null && stop != null ? entry - stop : null;
  const computedRr = target != null && entry != null && oneR != null && oneR > 0
    ? (target - entry) / oneR
    : null;
  const rr = heldMode ? computedRr : orderDraft?.rr ?? computedRr ?? summary?.tradePlan.rr ?? candidate?.recommendation?.risk?.rr ?? candidate?.rr ?? null;
  const pctToTarget = target != null && entry != null && entry > 0 ? (target - entry) / entry * 100 : null;
  const riskPct = heldMode
    ? (isPositiveNumber(heldOneR) && position != null && isPositiveNumber(position.entryPrice)
      ? heldOneR / position.entryPrice
      : undefined)
    : candidate?.recommendation?.risk?.riskPct;
  const entryLabel = heldMode
    ? t('workspacePage.panels.analysis.decisionSummary.tradePlan.entry')
    : usesSuggestedEntry
      ? t('workspacePage.panels.analysis.decisionSummary.tradePlan.plannedEntry')
      : t('workspacePage.panels.analysis.decisionSummary.tradePlan.entryClose');
  const closeSecondary = usesSuggestedEntry && isPositiveNumber(closeEntry)
    ? `${t('workspacePage.panels.analysis.decisionSummary.tradePlan.close')} ${formatPlanPrice(closeEntry)}`
    : undefined;
  const sourceItems = [
    [t('workspacePage.overview.sources.market'), candidate?.dataSourceSummary?.marketData],
    [t('workspacePage.overview.sources.fundamentals'), candidate?.dataSourceSummary?.fundamentals],
    [t('workspacePage.overview.sources.events'), candidate?.dataSourceSummary?.calendar],
  ] as const;
  const visibleSourceItems = sourceItems.filter(
    (item): item is readonly [typeof item[0], DataSourceHealth] => Boolean(item[1])
  );
  const plan = (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1" aria-label={t('workspacePage.overview.tradePlan')}>
        <tbody>
          {metricRow(entryLabel, formatPlanPrice(entry), closeSecondary)}
          {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.stop'), formatPlanPrice(stop))}
          {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.target'), formatPlanPrice(target))}
          {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.toTarget'), pctToTarget != null ? `${formatNumber(pctToTarget, 2)}%` : '—')}
          {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.rr'), rr != null ? `${formatNumber(rr, 1)}x` : '—')}
          {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.riskPercent'), riskPct != null && riskPct > 0 ? `${formatNumber(riskPct * 100, 2)}%` : '—')}
          {metricRow(t('workspacePage.panels.analysis.decisionSummary.tradePlan.oneR'), formatPlanPrice(oneR))}
          {metricRow(t('workspacePage.overview.invalidation'), summary?.explanation?.whatInvalidatesIt?.[0] ?? summary?.mainRisk ?? '—')}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl space-y-1">
            {!disclosePlan ? <div className="flex flex-wrap items-center gap-2">
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
            </div> : null}
            <p className="text-sm text-muted">
              {explanation ?? t('workspacePage.overview.reviewFallback')}
            </p>
            {operationalNextStep ? (
              <p className="text-sm font-medium text-foreground">
                <span className="text-muted">{t('workspacePage.overview.nextStep')}: </span>{operationalNextStep}
              </p>
            ) : null}
          </div>
          {(onWatch || onUnwatch) && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={isWatched ? onUnwatch : onWatch}
              disabled={isPendingWatch}
            >
              {isPendingWatch
                ? t('workspacePage.overview.watchPending')
                : isWatched
                  ? t('workspacePage.overview.unwatch')
                  : t('workspacePage.overview.watch')}
            </Button>
          )}
        </div>

        {decisionContext}
        {!heldMode && candidate && !canPrepareOrder ? (
          <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="font-medium text-warning">{t('manualOrderDraft.orderBlocked')}</p>
            {!disclosePlan && <p className="text-muted">{t('manualOrderDraft.reviewHelp')}</p>}
            {candidate.recommendation?.reasonsShort?.slice(disclosePlan ? 1 : 0).map((reason) => <p key={reason} className="text-muted">{reason}</p>)}
          </div>
        ) : null}

        {candidateRefresh ? (
          <div className="space-y-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={candidateRefresh.onRefresh}
              disabled={candidateRefresh.isPending}
            >
              {candidateRefresh.isPending
                ? t('workspacePage.panels.analysis.computeAnalysis.runningAction')
                : t('recommendation.workflow.nextStep.refresh_data')}
            </Button>
            {candidateRefresh.error ? <p role="alert" className="text-sm text-danger">{candidateRefresh.error.message}</p> : null}
            <div role="status" className="space-y-1 text-xs text-muted">
              <p>{t('screener.quality.candleDate', { date: candleDate ?? t('screener.quality.unknownDate') })}</p>
              <p>{t(`screener.quality.market.${marketStatus}`)}</p>
            </div>
          </div>
        ) : null}

        {disclosePlan ? (
          <CollapsibleSection title={t('workspacePage.overview.tradePlan')}>{plan}</CollapsibleSection>
        ) : plan}
        <div className="flex flex-wrap gap-2">
          {canPrepareOrder && onPrepareOrder ? <Button type="button" size="sm" onClick={onPrepareOrder}>{t('analysis.prepareOrder')}</Button> : null}
          {!heldMode && onSaveDraft ? <Button type="button" size="sm" variant="secondary" onClick={onSaveDraft}>{t('manualOrderDraft.save')}</Button> : null}
        </div>
      </div>
    </div>
  );
}
