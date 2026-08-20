import Badge from '@/components/common/Badge';
import type {
  DecisionCatalystLabel,
  DecisionConviction,
  FairValueMethod,
  DecisionSignalLabel,
  DecisionSummary,
  DecisionValuationLabel,
} from '@/features/screener/types';
import { t } from '@/i18n/t';
import type { Recommendation } from '@/types/recommendation';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters';
import {
  formatWorkflowNextStep,
  getWorkflowPresentation,
} from '@/components/domain/recommendation/workflowPresentation';

interface DecisionSummaryCardProps {
  summary: DecisionSummary;
  recommendation?: Pick<Recommendation, 'workflowStatus' | 'nextStep'>;
  currency?: string;
  onRefreshFundamentals?: () => void;
  isRefreshingFundamentals?: boolean;
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

function signalLabel(label: DecisionSignalLabel): string {
  switch (label) {
    case 'strong':
      return t('workspacePage.panels.analysis.decisionSummary.signal.strong');
    case 'neutral':
      return t('workspacePage.panels.analysis.decisionSummary.signal.neutral');
    case 'weak':
      return t('workspacePage.panels.analysis.decisionSummary.signal.weak');
  }
}

function valuationLabel(label: DecisionValuationLabel): string {
  switch (label) {
    case 'cheap':
      return t('workspacePage.panels.analysis.decisionSummary.valuation.cheap');
    case 'fair':
      return t('workspacePage.panels.analysis.decisionSummary.valuation.fair');
    case 'expensive':
      return t('workspacePage.panels.analysis.decisionSummary.valuation.expensive');
    case 'unknown':
      return t('workspacePage.panels.analysis.decisionSummary.valuation.unknown');
  }
}

function catalystLabel(label: DecisionCatalystLabel): string {
  switch (label) {
    case 'active':
      return t('workspacePage.panels.analysis.decisionSummary.catalyst.active');
    case 'neutral':
      return t('workspacePage.panels.analysis.decisionSummary.catalyst.neutral');
    case 'weak':
      return t('workspacePage.panels.analysis.decisionSummary.catalyst.weak');
    case 'unknown':
      return t('workspacePage.panels.analysis.decisionSummary.catalyst.unknown');
  }
}


function badgeVariantForConviction(
  conviction: DecisionConviction
): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (conviction) {
    case 'high':
      return 'success';
    case 'medium':
      return 'primary';
    case 'low':
      return 'warning';
  }
}

function badgeVariantForSignal(
  label: DecisionSignalLabel | DecisionValuationLabel | DecisionCatalystLabel
): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  if (label === 'strong' || label === 'cheap' || label === 'active') {
    return 'success';
  }
  if (label === 'expensive' || label === 'weak') {
    return 'error';
  }
  if (label === 'unknown') {
    return 'default';
  }
  return 'warning';
}

function fairValueMethodLabel(method: FairValueMethod): string {
  switch (method) {
    case 'earnings_multiple':
      return t('workspacePage.panels.analysis.decisionSummary.valuationContext.methods.earningsMultiple');
    case 'sales_multiple':
      return t('workspacePage.panels.analysis.decisionSummary.valuationContext.methods.salesMultiple');
    case 'book_multiple':
      return t('workspacePage.panels.analysis.decisionSummary.valuationContext.methods.bookMultiple');
    case 'not_available':
      return t('workspacePage.panels.analysis.decisionSummary.valuationContext.methods.notAvailable');
  }
}

export default function DecisionSummaryCard({
  summary,
  recommendation,
  currency = 'USD',
  onRefreshFundamentals,
  isRefreshingFundamentals = false,
}: DecisionSummaryCardProps) {
  const workflowPresentation = getWorkflowPresentation(recommendation);
  const warningItems = (summary.explanation?.confidenceNotes ?? summary.drivers.warnings).filter(Boolean);
  const tradeStateItems = (summary.drivers.tradeState ?? []).filter(Boolean);
  // Structured flag from the backend contract; fall back to prefix-matching the
  // warning prose only for payloads predating the flag.
  const hasStaleFundamentalsWarning =
    summary.drivers.staleFundamentals ??
    warningItems.some((warning) => warning.toLowerCase().startsWith('fundamentals stale:'));
  const hasFairValue =
    summary.valuationContext.fairValueLow != null &&
    summary.valuationContext.fairValueBase != null &&
    summary.valuationContext.fairValueHigh != null;
  const valuationMetrics = [
    {
      label: t('workspacePage.panels.analysis.decisionSummary.valuationContext.trailingPe'),
      value: summary.valuationContext.trailingPe,
      formatter: (value: number) => `${formatNumber(value, 1)}x`,
    },
    {
      label: t('workspacePage.panels.analysis.decisionSummary.valuationContext.priceToSales'),
      value: summary.valuationContext.priceToSales,
      formatter: (value: number) => `${formatNumber(value, 1)}x`,
    },
    {
      label: t('workspacePage.panels.analysis.decisionSummary.valuationContext.bookValuePerShare'),
      value: summary.valuationContext.bookValuePerShare,
      formatter: (value: number) => formatCurrency(value, currency),
    },
    {
      label: t('workspacePage.panels.analysis.decisionSummary.valuationContext.priceToBook'),
      value: summary.valuationContext.priceToBook,
      formatter: (value: number) => `${formatNumber(value, 1)}x`,
    },
    {
      label: t('workspacePage.panels.analysis.decisionSummary.valuationContext.bookToPrice'),
      value: summary.valuationContext.bookToPrice,
      formatter: (value: number) => `${formatNumber(value * 100, 1)}%`,
    },
  ].filter((item) => item.value != null);
  const fairValueMetrics = hasFairValue
    ? [
        {
          label: t('workspacePage.panels.analysis.decisionSummary.valuationContext.fairValueLow'),
          value: summary.valuationContext.fairValueLow,
          formatter: (value: number) => formatCurrency(value, currency),
        },
        {
          label: t('workspacePage.panels.analysis.decisionSummary.valuationContext.fairValueBase'),
          value: summary.valuationContext.fairValueBase,
          formatter: (value: number) => formatCurrency(value, currency),
        },
        {
          label: t('workspacePage.panels.analysis.decisionSummary.valuationContext.fairValueHigh'),
          value: summary.valuationContext.fairValueHigh,
          formatter: (value: number) => formatCurrency(value, currency),
        },
        {
          label: t('workspacePage.panels.analysis.decisionSummary.valuationContext.premiumDiscount'),
          value: summary.valuationContext.premiumDiscountPct,
          formatter: (value: number) => formatPercent(value, 1),
        },
      ]
    : [];

  const bannerClass = 'bg-foreground/10 text-foreground';

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className={`px-3 py-2 flex items-center justify-between gap-3 ${bannerClass}`}>
        <span className="font-semibold text-sm">
          {t('workspacePage.panels.analysis.decisionSummary.title', { ticker: summary.symbol })}
        </span>
        <Badge variant={badgeVariantForConviction(summary.conviction)}>
          {convictionLabel(summary.conviction)}
        </Badge>
      </div>

      <div className="bg-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p className="text-sm text-muted">
            {summary.explanation?.summaryLine || t('workspacePage.panels.analysis.decisionSummary.subtitle')}
          </p>
        </div>
      </div>

      {recommendation ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-foreground/5 px-3 py-2 text-sm font-medium text-foreground">
          <Badge variant={workflowPresentation.tone === 'success' ? 'success' : workflowPresentation.tone === 'danger' ? 'error' : workflowPresentation.tone === 'warning' ? 'warning' : 'default'}>
            {t(workflowPresentation.labelKey)}
          </Badge>
          <span>{formatWorkflowNextStep(recommendation.nextStep)}</span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Badge variant={badgeVariantForSignal(summary.technicalLabel)}>
          {t('workspacePage.panels.analysis.decisionSummary.labels.technical')}: {signalLabel(summary.technicalLabel)}
        </Badge>
        <Badge variant={badgeVariantForSignal(summary.fundamentalsLabel)}>
          {t('workspacePage.panels.analysis.decisionSummary.labels.fundamentals')}:{' '}
          {signalLabel(summary.fundamentalsLabel)}
        </Badge>
        <Badge variant={badgeVariantForSignal(summary.valuationLabel)}>
          {t('workspacePage.panels.analysis.decisionSummary.labels.valuation')}: {valuationLabel(summary.valuationLabel)}
        </Badge>
        <Badge variant={badgeVariantForSignal(summary.catalystLabel)}>
          {t('workspacePage.panels.analysis.decisionSummary.labels.catalyst')}: {catalystLabel(summary.catalystLabel)}
        </Badge>
      </div>

      {warningItems.length ? (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-warning">
              {t('workspacePage.panels.analysis.decisionSummary.warningsTitle')}
            </div>
            {hasStaleFundamentalsWarning && onRefreshFundamentals ? (
              <button
                type="button"
                className="rounded border border-warning/40 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/10 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onRefreshFundamentals}
                disabled={isRefreshingFundamentals}
              >
                {isRefreshingFundamentals
                  ? t('workspacePage.panels.analysis.decisionSummary.refreshingFundamentalsAction')
                  : t('workspacePage.panels.analysis.decisionSummary.refreshFundamentalsAction')}
              </button>
            ) : null}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-warning">
            {warningItems.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {tradeStateItems.length ? (
        <div className="mt-3 rounded-md border border-border bg-foreground/5 px-3 py-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted">
            {t('workspacePage.panels.analysis.decisionSummary.tradeStateTitle')}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {tradeStateItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {summary.explanation ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {summary.explanation.whyItQualified.length > 0 && (
            <div className="rounded-md bg-surface p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">
                {t('workspacePage.panels.analysis.decisionSummary.copy.whyItQualified')}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {summary.explanation.whyItQualified.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {summary.explanation.whyNow.length > 0 && (
            <div className="rounded-md bg-surface p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">
                {t('workspacePage.panels.analysis.decisionSummary.copy.whyNow')}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {summary.explanation.whyNow.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {summary.explanation.mainRisks.length > 0 && (
            <div className="rounded-md bg-surface p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">
                {t('workspacePage.panels.analysis.decisionSummary.copy.mainRisk')}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {summary.explanation.mainRisks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {summary.explanation.whatInvalidatesIt.length > 0 && (
            <div className="rounded-md bg-surface p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted">
                {t('workspacePage.panels.analysis.decisionSummary.copy.whatInvalidatesIt')}
              </div>
              <ul className="mt-2 space-y-1 text-sm text-foreground">
                {summary.explanation.whatInvalidatesIt.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-md bg-surface p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              {t('workspacePage.panels.analysis.decisionSummary.copy.whyNow')}
            </div>
            <p className="mt-2 text-sm text-foreground">{summary.whyNow}</p>
          </div>
          <div className="rounded-md bg-surface p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              {t('workspacePage.panels.analysis.decisionSummary.copy.whatToDo')}
            </div>
            <p className="mt-2 text-sm text-foreground">{summary.whatToDo}</p>
          </div>
          <div className="rounded-md bg-surface p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">
              {t('workspacePage.panels.analysis.decisionSummary.copy.mainRisk')}
            </div>
            <p className="mt-2 text-sm text-foreground">{summary.mainRisk}</p>
          </div>
        </div>
      )}

      {summary.valuationContext.summary || valuationMetrics.length ? (
        <details className="mt-3 rounded-md border border-border bg-surface p-3">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              {t('workspacePage.panels.analysis.decisionSummary.valuationContext.title')}
            </span>
            <span className="text-xs text-muted">
              {t('workspacePage.panels.analysis.decisionSummary.valuationContext.method', {
                method: fairValueMethodLabel(summary.valuationContext.method),
              })}
            </span>
          </summary>
          {summary.valuationContext.summary ? (
            <p className="mt-3 text-sm text-foreground">{summary.valuationContext.summary}</p>
          ) : null}
          {valuationMetrics.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {valuationMetrics.map((item) => (
                <div key={item.label} className="rounded-md border border-border bg-surface px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted">{item.label}</div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {item.formatter(item.value as number)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {fairValueMetrics.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {fairValueMetrics.map((item) => (
                <div key={item.label} className="rounded-md border border-success/40 bg-success/10 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-success">{item.label}</div>
                  <div className="mt-1 text-sm font-semibold text-success">
                    {item.formatter(item.value as number)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </details>
      ) : null}

      </div>
    </div>
  );
}
