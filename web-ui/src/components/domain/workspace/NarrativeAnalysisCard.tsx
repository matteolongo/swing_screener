import ReactMarkdown from 'react-markdown';
import Badge from '@/components/common/Badge';
import type { SymbolIntelligence, DecisionAction, DecisionConviction } from '@/features/intelligence/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { t } from '@/i18n/t';
import { formatCurrency, formatNumber } from '@/utils/formatters';

interface NarrativeAnalysisCardProps {
  intelligence: SymbolIntelligence;
  candidate?: SymbolAnalysisCandidate | null;
  currency?: string;
}

function actionLabel(action: DecisionAction): string {
  const map: Record<DecisionAction, string> = {
    BUY_NOW: t('workspacePage.panels.analysis.decisionSummary.actions.buyNow'),
    BUY_ON_PULLBACK: t('workspacePage.panels.analysis.decisionSummary.actions.buyOnPullback'),
    WAIT_FOR_BREAKOUT: t('workspacePage.panels.analysis.decisionSummary.actions.waitForBreakout'),
    WATCH: t('workspacePage.panels.analysis.decisionSummary.actions.watch'),
    TACTICAL_ONLY: t('workspacePage.panels.analysis.decisionSummary.actions.tacticalOnly'),
    AVOID: t('workspacePage.panels.analysis.decisionSummary.actions.avoid'),
    MANAGE_ONLY: t('workspacePage.panels.analysis.decisionSummary.actions.manageOnly'),
  };
  return map[action];
}

function convictionLabel(conviction: DecisionConviction): string {
  const map: Record<DecisionConviction, string> = {
    high: t('workspacePage.panels.analysis.decisionSummary.conviction.high'),
    medium: t('workspacePage.panels.analysis.decisionSummary.conviction.medium'),
    low: t('workspacePage.panels.analysis.decisionSummary.conviction.low'),
  };
  return map[conviction];
}

function bannerClass(action: DecisionAction): string {
  switch (action) {
    case 'BUY_NOW': return 'bg-emerald-600 text-white';
    case 'BUY_ON_PULLBACK':
    case 'WAIT_FOR_BREAKOUT':
    case 'TACTICAL_ONLY': return 'bg-amber-400 text-amber-950';
    case 'AVOID': return 'bg-rose-600 text-white';
    default: return 'bg-gray-200 text-gray-800';
  }
}

function convictionVariant(conviction: DecisionConviction): 'default' | 'success' | 'primary' | 'warning' {
  switch (conviction) {
    case 'high': return 'success';
    case 'medium': return 'primary';
    default: return 'warning';
  }
}

export default function NarrativeAnalysisCard({
  intelligence,
  candidate,
  currency = 'USD',
}: NarrativeAnalysisCardProps) {
  const { action, conviction, summaryLine, narrative } = intelligence;
  const summary = candidate?.decisionSummary;
  const warnings = summary?.explanation?.confidenceNotes ?? summary?.drivers.warnings ?? [];

  const tradePlanItems = summary?.tradePlan
    ? [
        { label: t('workspacePage.panels.analysis.decisionSummary.tradePlan.entry'), value: summary.tradePlan.entry, fmt: (v: number) => formatCurrency(v, currency) },
        { label: t('workspacePage.panels.analysis.decisionSummary.tradePlan.stop'), value: summary.tradePlan.stop, fmt: (v: number) => formatCurrency(v, currency) },
        { label: t('workspacePage.panels.analysis.decisionSummary.tradePlan.target'), value: summary.tradePlan.target, fmt: (v: number) => formatCurrency(v, currency) },
        { label: t('workspacePage.panels.analysis.decisionSummary.tradePlan.rr'), value: summary.tradePlan.rr, fmt: (v: number) => `${formatNumber(v, 2)}x` },
      ].filter((item) => item.value != null)
    : [];

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* Action/conviction banner */}
      <div className={`px-3 py-2 flex items-center justify-between gap-3 ${bannerClass(action)}`}>
        <span className="font-semibold text-sm">
          {intelligence.symbol} — {actionLabel(action)}
        </span>
        <Badge variant={convictionVariant(conviction)}>{convictionLabel(conviction)}</Badge>
      </div>

      <div className="bg-slate-50 p-3 space-y-3">
        {/* Narrative */}
        <div className="rounded-md bg-white border border-slate-200 p-3">
          <p className="text-sm font-semibold text-slate-900 mb-2">{summaryLine}</p>
          <div className="prose prose-sm prose-slate max-w-none">
            <ReactMarkdown>{narrative}</ReactMarkdown>
          </div>
        </div>

        {/* Compact trade plan */}
        {tradePlanItems.length > 0 && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {tradePlanItems.map((item) => (
              <div key={item.label} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500">{item.label}</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{item.fmt(item.value as number)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Warnings — always visible, never collapsed */}
        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-xs font-medium uppercase tracking-wide text-amber-800">
              {t('workspacePage.panels.analysis.decisionSummary.warningsTitle')}
            </div>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}

        {/* Collapsed signals + valuation detail */}
        {summary && (
          <details className="rounded-md border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 select-none">
              {t('workspacePage.panels.analysis.intelligence.signalsDetail')}
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={summary.technicalLabel === 'strong' ? 'success' : summary.technicalLabel === 'weak' ? 'error' : 'warning'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.technical')}: {summary.technicalLabel}
              </Badge>
              <Badge variant={summary.fundamentalsLabel === 'strong' ? 'success' : summary.fundamentalsLabel === 'weak' ? 'error' : 'warning'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.fundamentals')}: {summary.fundamentalsLabel}
              </Badge>
              <Badge variant={summary.valuationLabel === 'cheap' ? 'success' : summary.valuationLabel === 'expensive' ? 'error' : 'default'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.valuation')}: {summary.valuationLabel}
              </Badge>
              <Badge variant={summary.catalystLabel === 'active' ? 'success' : summary.catalystLabel === 'weak' ? 'error' : 'warning'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.catalyst')}: {summary.catalystLabel}
              </Badge>
            </div>
            {summary.valuationContext.summary && (
              <p className="mt-2 text-sm text-slate-700">{summary.valuationContext.summary}</p>
            )}
          </details>
        )}
      </div>
    </div>
  );
}
