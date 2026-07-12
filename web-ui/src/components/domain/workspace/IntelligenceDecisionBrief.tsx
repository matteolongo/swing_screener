import Badge from '@/components/common/Badge';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import type { DecisionAction, DecisionEntryCondition, DecisionSummary } from '@/features/screener/types';
import type { SymbolIntelligence } from '@/features/intelligence/types';
import { formatCurrency } from '@/utils/formatters';

interface IntelligenceDecisionBriefProps {
  candidate?: SymbolAnalysisCandidate | null;
  intelligence?: SymbolIntelligence | null;
}

function actionLabel(action: DecisionAction): string {
  return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function conditionCopy(summary: DecisionSummary, currency: string): string {
  const { entryCondition, triggerPrice, triggerNote } = summary.tradePlan;
  const price = triggerPrice == null ? null : formatCurrency(triggerPrice, currency);
  const copy: Record<DecisionEntryCondition, string> = {
    buy_now: price ? `Eligible now near ${price}.` : 'Eligible now within the current trade plan.',
    pullback_to_price: price ? `Wait for a pullback to ${price}.` : 'Wait for a pullback to the planned entry area.',
    breakout_above_price: price ? `Wait for a confirmed move above ${price}.` : 'Wait for a confirmed breakout.',
    wait_for_confirmation: 'Wait for a confirmed breakout before entering.',
    no_entry: 'No entry condition is active right now.',
    manage_position: 'Manage the existing position; do not open a new one.',
  };

  return triggerNote || copy[entryCondition ?? fallbackCondition(summary.action)];
}

function fallbackCondition(action: DecisionAction): DecisionEntryCondition {
  if (action === 'BUY_NOW') return 'buy_now';
  if (action === 'BUY_ON_PULLBACK') return 'pullback_to_price';
  if (action === 'WAIT_FOR_BREAKOUT') return 'wait_for_confirmation';
  if (action === 'MANAGE_ONLY') return 'manage_position';
  return 'no_entry';
}

function actionVariant(action: DecisionAction): 'success' | 'warning' | 'error' | 'default' {
  if (action === 'BUY_NOW') return 'success';
  if (action === 'AVOID') return 'error';
  if (action === 'WATCH' || action === 'MANAGE_ONLY') return 'default';
  return 'warning';
}

function convictionVariant(conviction: DecisionSummary['conviction']): 'success' | 'primary' | 'warning' {
  if (conviction === 'high') return 'success';
  if (conviction === 'medium') return 'primary';
  return 'warning';
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background/40 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function IntelligenceDecisionBrief({ candidate, intelligence }: IntelligenceDecisionBriefProps) {
  const summary = candidate?.decisionSummary;
  if (!summary) return null;

  const currency = candidate?.currency ?? 'USD';
  const warnings = summary.explanation?.confidenceNotes ?? summary.drivers.warnings;
  const staleFundamentals = candidate?.fundamentalsFreshnessStatus === 'stale'
    || summary.drivers.staleFundamentals
    || warnings.some((warning) => warning.toLowerCase().includes('stale'));
  const reasons = summary.explanation?.whyItQualified?.length
    ? summary.explanation.whyItQualified
    : summary.drivers.positives;
  const invalidation = summary.explanation?.whatInvalidatesIt?.[0]
    ?? (summary.tradePlan.stop != null
      ? `A close below ${formatCurrency(summary.tradePlan.stop, currency)} invalidates the plan.`
      : summary.mainRisk);
  const hasConflict = intelligence?.action && intelligence.action !== summary.action;

  return (
    <section aria-labelledby="intelligence-decision-title" className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p id="intelligence-decision-title" className="text-xs font-semibold uppercase tracking-wide text-muted">
            Decision for {summary.symbol}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={actionVariant(summary.action)}>{actionLabel(summary.action)}</Badge>
            <Badge variant={convictionVariant(summary.conviction)}>{summary.conviction} confidence</Badge>
          </div>
          <p className="mt-3 text-base font-semibold text-foreground">{conditionCopy(summary, currency)}</p>
          <p className="mt-1 text-sm text-muted">
            {summary.explanation?.summaryLine || summary.whatToDo}
          </p>
        </div>
        {intelligence?.generatedAt ? (
          <p className="text-xs text-muted">Analysis: {new Date(intelligence.generatedAt).toLocaleString()}</p>
        ) : null}
      </div>

      {staleFundamentals && (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          <span className="font-semibold">Data caveat: </span>
          {warnings.find((warning) => warning.toLowerCase().includes('stale'))
            ?? 'Fundamental data is stale, so the quality read may lag the business.'}
        </div>
      )}

      {hasConflict && (
        <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          The AI report uses a different action label. Follow the screener decision above and review the supporting evidence before acting.
        </div>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric label="Entry trigger" value={summary.tradePlan.triggerPrice != null
          ? formatCurrency(summary.tradePlan.triggerPrice, currency)
          : 'Confirmation required'} />
        <Metric label="Stop" value={summary.tradePlan.stop != null ? formatCurrency(summary.tradePlan.stop, currency) : '—'} />
        <Metric label="Target" value={summary.tradePlan.target != null ? formatCurrency(summary.tradePlan.target, currency) : '—'} />
      </div>

      <dl className="mt-4 grid gap-3 md:grid-cols-3">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Why now</dt>
          <dd className="mt-1 text-sm text-foreground">{reasons[0] || summary.whyNow}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">What to do</dt>
          <dd className="mt-1 text-sm text-foreground">{summary.explanation?.nextBestAction || summary.whatToDo}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">What invalidates it</dt>
          <dd className="mt-1 text-sm text-foreground">{invalidation}</dd>
        </div>
      </dl>
    </section>
  );
}
