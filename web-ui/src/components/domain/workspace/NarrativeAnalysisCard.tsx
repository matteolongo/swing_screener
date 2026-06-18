import ReactMarkdown from 'react-markdown';
import Badge from '@/components/common/Badge';
import type { SymbolIntelligence, DecisionAction, DecisionConviction, KeyNumber, PredictionBullet, PriceMoveDirection } from '@/features/intelligence/types';
import type { DecisionCatalystLabel, DecisionSignalLabel, DecisionValuationLabel } from '@/features/screener/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { t } from '@/i18n/t';

interface NarrativeAnalysisCardProps {
  intelligence: SymbolIntelligence;
  candidate?: SymbolAnalysisCandidate | null;
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

function signalLabel(label: DecisionSignalLabel): string {
  switch (label) {
    case 'strong': return t('workspacePage.panels.analysis.decisionSummary.signal.strong');
    case 'neutral': return t('workspacePage.panels.analysis.decisionSummary.signal.neutral');
    case 'weak': return t('workspacePage.panels.analysis.decisionSummary.signal.weak');
  }
}

function valuationLabel(label: DecisionValuationLabel): string {
  switch (label) {
    case 'cheap': return t('workspacePage.panels.analysis.decisionSummary.valuation.cheap');
    case 'fair': return t('workspacePage.panels.analysis.decisionSummary.valuation.fair');
    case 'expensive': return t('workspacePage.panels.analysis.decisionSummary.valuation.expensive');
    case 'unknown': return t('workspacePage.panels.analysis.decisionSummary.valuation.unknown');
  }
}

function catalystLabel(label: DecisionCatalystLabel): string {
  switch (label) {
    case 'active': return t('workspacePage.panels.analysis.decisionSummary.catalyst.active');
    case 'neutral': return t('workspacePage.panels.analysis.decisionSummary.catalyst.neutral');
    case 'weak': return t('workspacePage.panels.analysis.decisionSummary.catalyst.weak');
  }
}

function convictionVariant(conviction: DecisionConviction): 'default' | 'success' | 'primary' | 'warning' {
  switch (conviction) {
    case 'high': return 'success';
    case 'medium': return 'primary';
    default: return 'warning';
  }
}

function sentimentChipClass(sentiment: KeyNumber['sentiment']): string {
  switch (sentiment) {
    case 'bullish': return 'bg-success/10 border-success/40 text-success';
    case 'bearish': return 'bg-danger/10 border-danger/40 text-danger';
    default: return 'bg-foreground/5 border-border text-muted';
  }
}

function directionArrow(direction: PredictionBullet['direction']): string {
  switch (direction) {
    case 'bullish': return '↑';
    case 'bearish': return '↓';
    default: return '→';
  }
}

function directionClass(direction: PredictionBullet['direction']): string {
  switch (direction) {
    case 'bullish': return 'text-success';
    case 'bearish': return 'text-danger';
    default: return 'text-muted';
  }
}

const MOVE_DIRECTION_ARROW: Record<PriceMoveDirection, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
};

function moveDirectionClass(direction: PriceMoveDirection): string {
  switch (direction) {
    case 'up': return 'border-success/40 bg-success/10 text-success';
    case 'down': return 'border-danger/40 bg-danger/10 text-danger';
    default: return 'border-border bg-foreground/5 text-muted';
  }
}

export default function NarrativeAnalysisCard({
  intelligence,
  candidate,
}: NarrativeAnalysisCardProps) {
  const { action, conviction, summaryLine, narrative, symbol } = intelligence;
  const summary = candidate?.decisionSummary;
  const warnings = (summary?.explanation?.confidenceNotes ?? summary?.drivers.warnings ?? []).filter(Boolean);

  const hasNewFields = Boolean(intelligence.priceHook);
  const hasKeyNumbers = (intelligence.keyNumbers?.length ?? 0) > 0;
  const hasPrediction = (intelligence.predictionBullets?.length ?? 0) > 0;
  const hasRisks = (intelligence.riskFactors?.length ?? 0) > 0;
  const hasPastTrades = Boolean(intelligence.pastTradesContext);
  const moveExplanation = intelligence.positionMoveExplanation ?? null;

  const decisionHighlights = [
    { label: t('workspacePage.panels.analysis.intelligence.whyNow'), value: summary?.whyNow },
    { label: t('workspacePage.panels.analysis.intelligence.whatToDo'), value: summary?.whatToDo },
    { label: t('workspacePage.panels.analysis.intelligence.watchFor'), value: summary?.mainRisk || warnings[0] },
  ].filter((item) => item.value);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Neutral AI header — verdict lives in the screener-owned decision header above */}
      <div className="px-3 py-2 flex items-center justify-between gap-3 bg-surface text-foreground">
        <span className="font-semibold text-sm">
          {symbol} — {t('workspacePage.panels.analysis.intelligence.aiAnalysisTitle')}
        </span>
        <Badge variant={convictionVariant(conviction)}>{convictionLabel(conviction)}</Badge>
      </div>

      <div className="bg-surface p-3 space-y-3">
        {candidate?.decisionSummary?.action && action !== candidate.decisionSummary.action && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            {t('workspacePage.panels.analysis.intelligence.secondOpinion', {
              aiAction: actionLabel(action),
              screenerAction: actionLabel(candidate.decisionSummary.action),
            })}
          </div>
        )}

        {/* Decision focus */}
        <div className="rounded-md bg-surface border border-border p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('workspacePage.panels.analysis.intelligence.decisionFocus')}
          </div>
          <p className="mt-2 text-base font-semibold text-foreground">{summaryLine}</p>
          {decisionHighlights.length > 0 && (
            <dl className="mt-3 grid gap-2">
              {decisionHighlights.map((item) => (
                <div key={item.label} className="rounded-md bg-surface px-3 py-2">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{item.label}</dt>
                  <dd className="mt-1 text-sm text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Why it moved since entry (open positions) */}
        {moveExplanation && (
          <div className={`rounded-md border p-3 ${moveDirectionClass(moveExplanation.direction)}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide">
                {t('workspacePage.panels.analysis.intelligence.positionMove.title')}
              </span>
              <span className="text-sm font-semibold">
                {MOVE_DIRECTION_ARROW[moveExplanation.direction]}{' '}
                {t(`workspacePage.panels.analysis.intelligence.positionMove.direction.${moveExplanation.direction}`)}
              </span>
            </div>
            <p className="mt-1 text-sm">{moveExplanation.summary}</p>
            {moveExplanation.drivers.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm list-disc list-inside">
                {moveExplanation.drivers.map((driver, index) => (
                  <li key={`${driver.label}-${index}`}>
                    <span className="font-medium">{driver.label}:</span> {driver.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
            <div className="text-xs font-medium uppercase tracking-wide text-warning">
              {t('workspacePage.panels.analysis.decisionSummary.warningsTitle')}
            </div>
            <ul className="mt-2 space-y-1 text-sm text-warning">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}

        {/* WHY NOW */}
        {hasNewFields && intelligence.priceHook && (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
              {t('workspacePage.panels.analysis.intelligence.priceHook')}
            </div>
            <p className="text-sm text-foreground">{intelligence.priceHook}</p>
          </div>
        )}

        {/* KEY NUMBERS */}
        {hasKeyNumbers && (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              {t('workspacePage.panels.analysis.intelligence.keyNumbers')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(intelligence.keyNumbers ?? []).map((kn, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${sentimentChipClass(kn.sentiment)}`}
                >
                  <span className="opacity-70">{kn.label}</span>
                  <span className="opacity-40">:</span>
                  <span>{kn.value}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* PREDICTION */}
        {hasPrediction && (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              {t('workspacePage.panels.analysis.intelligence.prediction')}
            </div>
            <ul className="space-y-2">
              {(intelligence.predictionBullets ?? []).map((pb, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`font-bold text-base leading-tight shrink-0 ${directionClass(pb.direction)}`}>
                    {directionArrow(pb.direction)}
                  </span>
                  <span className="flex-1 text-foreground">{pb.reason}</span>
                  <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted font-medium">
                    {pb.reference}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* RISKS */}
        {hasRisks && (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              {t('workspacePage.panels.analysis.intelligence.riskFactors')}
            </div>
            <ul className="space-y-1">
              {(intelligence.riskFactors ?? []).map((rf, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted">
                  <span className="text-muted shrink-0 mt-0.5">•</span>
                  <span>{rf}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* PAST TRADES */}
        {hasPastTrades && (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
              {t('workspacePage.panels.analysis.intelligence.pastTrades', { symbol })}
            </div>
            <p className="text-sm text-muted">{intelligence.pastTradesContext}</p>
          </div>
        )}

        {/* Full rationale — collapsible when new structured fields are present; always visible otherwise */}
        {hasNewFields ? (
          <details className="rounded-md bg-surface border border-border p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted select-none">
              {t('workspacePage.panels.analysis.intelligence.fullRationale')}
            </summary>
            <div className="prose prose-sm prose-invert mt-2 max-w-none">
              <ReactMarkdown>{narrative}</ReactMarkdown>
            </div>
          </details>
        ) : (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t('workspacePage.panels.analysis.intelligence.fullRationale')}
            </div>
            <div className="prose prose-sm prose-invert mt-2 max-w-none">
              <ReactMarkdown>{narrative}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Data inputs */}
        {intelligence.inputsUsed && Object.keys(intelligence.inputsUsed).length > 0 && (
          <details className="rounded-md border border-border bg-surface p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted select-none">
              {t('workspacePage.panels.analysis.intelligence.dataInputs')}
            </summary>
            <div className="mt-3 space-y-2">
              {Object.entries(intelligence.inputsUsed).map(([group, fields]) => (
                <div key={group}>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                    {group.replace(/_/g, ' ')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(fields as Record<string, unknown>).filter(([, v]) => v != null && typeof v !== 'object').map(([key, value]) => (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-xs text-muted"
                      >
                        <span className="font-medium text-muted">{key.replace(/_/g, ' ')}:</span>
                        <span>{typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(2)) : String(value)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Signals detail */}
        {summary && (
          <details className="rounded-md border border-border bg-surface p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted select-none">
              {t('workspacePage.panels.analysis.intelligence.signalsDetail')}
            </summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={summary.technicalLabel === 'strong' ? 'success' : summary.technicalLabel === 'weak' ? 'error' : 'warning'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.technical')}: {signalLabel(summary.technicalLabel)}
              </Badge>
              <Badge variant={summary.fundamentalsLabel === 'strong' ? 'success' : summary.fundamentalsLabel === 'weak' ? 'error' : 'warning'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.fundamentals')}: {signalLabel(summary.fundamentalsLabel)}
              </Badge>
              <Badge variant={summary.valuationLabel === 'cheap' ? 'success' : summary.valuationLabel === 'expensive' ? 'error' : 'warning'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.valuation')}: {valuationLabel(summary.valuationLabel)}
              </Badge>
              <Badge variant={summary.catalystLabel === 'active' ? 'success' : summary.catalystLabel === 'weak' ? 'error' : 'warning'}>
                {t('workspacePage.panels.analysis.decisionSummary.labels.catalyst')}: {catalystLabel(summary.catalystLabel)}
              </Badge>
            </div>
            {summary.valuationContext.summary && (
              <p className="mt-2 text-sm text-muted">{summary.valuationContext.summary}</p>
            )}
          </details>
        )}
      </div>
    </div>
  );
}
