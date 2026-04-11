import Badge from '@/components/common/Badge';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type {
  DecisionAction,
  DecisionCatalystLabel,
  DecisionConviction,
  DecisionSignalLabel,
  DecisionValuationLabel,
} from '@/features/screener/types';
import { t } from '@/i18n/t';
import { formatCurrency, formatNumber } from '@/utils/formatters';

interface AnalysisDecisionStripProps {
  ticker: string;
  candidate?: SymbolAnalysisCandidate | null;
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

function setupTypeLabel(candidate?: SymbolAnalysisCandidate | null) {
  const explanation = candidate?.recommendation?.thesis?.explanation;
  return explanation?.setupType ?? candidate?.signal?.replace(/_/g, ' ') ?? 'Manual';
}

function compactValue(label: string, value: string) {
  return (
    <div className="min-w-[88px] rounded-md border border-slate-200 bg-white/90 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function AnalysisDecisionStrip({ ticker, candidate }: AnalysisDecisionStripProps) {
  const summary = candidate?.decisionSummary;
  const currency = candidate?.currency ?? 'USD';
  const entry = summary?.tradePlan.entry ?? candidate?.recommendation?.risk?.entry ?? candidate?.entry;
  const stop = summary?.tradePlan.stop ?? candidate?.recommendation?.risk?.stop ?? candidate?.stop;
  const target = summary?.tradePlan.target ?? candidate?.recommendation?.risk?.target;
  const rr = summary?.tradePlan.rr ?? candidate?.recommendation?.risk?.rr ?? candidate?.rr;
  const riskPct = candidate?.recommendation?.risk?.riskPct;
  const badges = summary
    ? [
        `Technical: ${signalLabel(summary.technicalLabel)}`,
        `Fundamentals: ${signalLabel(summary.fundamentalsLabel)}`,
        `Valuation: ${valuationLabel(summary.valuationLabel)}`,
        `Catalyst: ${catalystLabel(summary.catalystLabel)}`,
      ]
    : [];

  return (
    <div className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-slate-50/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-slate-50/85">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{ticker}</h2>
              {summary ? <Badge variant="primary">{actionLabel(summary.action)}</Badge> : null}
              {summary ? <Badge variant="default">{convictionLabel(summary.conviction)}</Badge> : null}
            </div>
            <p className="text-xs text-slate-600">
              {summary?.explanation?.summaryLine
                ?? summary?.whyNow
                ?? candidate?.recommendation?.reasonsShort?.[0]
                ?? 'Review the current setup, risk, and execution plan before acting.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {compactValue('Entry', entry != null ? formatCurrency(entry, currency) : '—')}
            {compactValue('Stop', stop != null ? formatCurrency(stop, currency) : '—')}
            {compactValue('Target', target != null ? formatCurrency(target, currency) : '—')}
            {compactValue('R/R', rr != null ? `${formatNumber(rr, 1)}x` : '—')}
            {compactValue('Risk %', riskPct != null ? `${formatNumber(riskPct * 100, 2)}%` : '—')}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700">
            Setup: {setupTypeLabel(candidate)}
          </span>
          {badges.map((label) => (
            <span
              key={label}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
