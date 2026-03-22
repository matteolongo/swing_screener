import Badge from '@/components/common/Badge';
import type {
  DecisionAction,
  DecisionCatalystLabel,
  DecisionConviction,
  FairValueMethod,
  DecisionSignalLabel,
  DecisionSummary,
  DecisionValuationLabel,
} from '@/features/screener/types';
import { t } from '@/i18n/t';
import { formatCurrency, formatNumber, formatPercent } from '@/utils/formatters';

interface DecisionSummaryCardProps {
  summary: DecisionSummary;
  currency?: 'USD' | 'EUR';
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
  currency = 'USD',
}: DecisionSummaryCardProps) {
  const tradePlanItems = [
    {
      label: t('workspacePage.panels.analysis.decisionSummary.tradePlan.entry'),
      value: summary.tradePlan.entry,
      formatter: (value: number) => formatCurrency(value, currency),
    },
    {
      label: t('workspacePage.panels.analysis.decisionSummary.tradePlan.stop'),
      value: summary.tradePlan.stop,
      formatter: (value: number) => formatCurrency(value, currency),
    },
    {
      label: t('workspacePage.panels.analysis.decisionSummary.tradePlan.target'),
      value: summary.tradePlan.target,
      formatter: (value: number) => formatCurrency(value, currency),
    },
    {
      label: t('workspacePage.panels.analysis.decisionSummary.tradePlan.rr'),
      value: summary.tradePlan.rr,
      formatter: (value: number) => `${formatNumber(value, 2)}x`,
    },
  ].filter((item) => item.value != null);

  const warningItems = summary.drivers.warnings.filter(Boolean);
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

  const bannerClass = (() => {
    switch (summary.action) {
      case 'BUY_NOW':
        return 'bg-emerald-600 text-white';
      case 'BUY_ON_PULLBACK':
      case 'WAIT_FOR_BREAKOUT':
      case 'TACTICAL_ONLY':
        return 'bg-amber-400 text-amber-950';
      case 'AVOID':
        return 'bg-rose-600 text-white';
      case 'WATCH':
      case 'MANAGE_ONLY':
        return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  })();

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* Colored verdict banner */}
      <div className={`px-3 py-2 flex items-center justify-between gap-3 ${bannerClass}`}>
        <span className="font-semibold text-sm">
          {t('workspacePage.panels.analysis.decisionSummary.title', { ticker: summary.symbol })} — {actionLabel(summary.action)}
        </span>
        <Badge variant={badgeVariantForConviction(summary.conviction)}>
          {convictionLabel(summary.conviction)}
        </Badge>
      </div>

      <div className="bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-600">
            {t('workspacePage.panels.analysis.decisionSummary.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        </div>
      </div>

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

      {tradePlanItems.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {tradePlanItems.map((item) => (
            <div key={item.label} className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <div className="text-[11px] uppercase tracking-wide text-gray-500">{item.label}</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{item.formatter(item.value as number)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {summary.valuationContext.summary || valuationMetrics.length ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {t('workspacePage.panels.analysis.decisionSummary.valuationContext.title')}
            </div>
            {hasFairValue ? (
              <div className="text-xs text-gray-500">
                {t('workspacePage.panels.analysis.decisionSummary.valuationContext.method', {
                  method: fairValueMethodLabel(summary.valuationContext.method),
                })}
              </div>
            ) : null}
          </div>
          {summary.valuationContext.summary ? (
            <p className="mt-2 text-sm text-slate-800">{summary.valuationContext.summary}</p>
          ) : null}
          {valuationMetrics.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {valuationMetrics.map((item) => (
                <div key={item.label} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-gray-500">{item.label}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">
                    {item.formatter(item.value as number)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {fairValueMetrics.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {fairValueMetrics.map((item) => (
                <div key={item.label} className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wide text-emerald-800">{item.label}</div>
                  <div className="mt-1 text-sm font-semibold text-emerald-950">
                    {item.formatter(item.value as number)}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-md bg-white p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t('workspacePage.panels.analysis.decisionSummary.copy.whyNow')}
          </div>
          <p className="mt-2 text-sm text-slate-800">{summary.whyNow}</p>
        </div>
        <div className="rounded-md bg-white p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t('workspacePage.panels.analysis.decisionSummary.copy.whatToDo')}
          </div>
          <p className="mt-2 text-sm text-slate-800">{summary.whatToDo}</p>
        </div>
        <div className="rounded-md bg-white p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
            {t('workspacePage.panels.analysis.decisionSummary.copy.mainRisk')}
          </div>
          <p className="mt-2 text-sm text-slate-800">{summary.mainRisk}</p>
        </div>
      </div>

      {warningItems.length ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-800">
            {t('workspacePage.panels.analysis.decisionSummary.warningsTitle')}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {warningItems.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      </div>
    </div>
  );
}
