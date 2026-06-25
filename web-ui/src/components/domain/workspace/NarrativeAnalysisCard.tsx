import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Badge from '@/components/common/Badge';
import { formatDate } from '@/utils/formatters';
import type { SymbolIntelligence, DecisionAction, DecisionConviction, KeyNumber, PredictionBullet, PriceMoveDirection, GapDirection, GapMagnitude, PreOpenConfidence, ThesisDeltaStatus, PositionSignalAction, ThesisStatus, ProfitManagement, OpportunityCost, ExpectedHoldingPeriod } from '@/features/intelligence/types';
import type { DecisionCatalystLabel, DecisionSignalLabel, DecisionValuationLabel } from '@/features/screener/types';
import type { SymbolAnalysisCandidate } from '@/components/domain/workspace/types';
import { useIntelligenceHistoryQuery } from '@/features/intelligence/hooks';
import { t } from '@/i18n/t';

interface NarrativeAnalysisCardProps {
  intelligence: SymbolIntelligence;
  candidate?: SymbolAnalysisCandidate | null;
  /** True when analysing an open position (management view) vs a screened candidate.
   *  Defaults to deriving from the MANAGE_ONLY action when not provided. */
  isPosition?: boolean;
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

function sentimentDotClass(sentiment: KeyNumber['sentiment']): string {
  switch (sentiment) {
    case 'bullish': return 'bg-success';
    case 'bearish': return 'bg-danger';
    default: return 'bg-muted';
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

function toneClass(tone: 'positive' | 'negative' | 'neutral'): string {
  switch (tone) {
    case 'positive': return 'border-success/40 bg-success/10 text-success';
    case 'negative': return 'border-danger/40 bg-danger/10 text-danger';
    default: return 'border-border bg-foreground/5 text-muted';
  }
}

function moveDirectionClass(direction: PriceMoveDirection): string {
  return toneClass(direction === 'up' ? 'positive' : direction === 'down' ? 'negative' : 'neutral');
}

function gapDirectionClass(direction: GapDirection): string {
  return toneClass(direction === 'gap_up' ? 'positive' : direction === 'gap_down' ? 'negative' : 'neutral');
}

function gapDirectionLabel(direction: GapDirection): string {
  switch (direction) {
    case 'gap_up': return `↑ ${t('workspacePage.panels.analysis.intelligence.preOpen.gapUp')}`;
    case 'gap_down': return `↓ ${t('workspacePage.panels.analysis.intelligence.preOpen.gapDown')}`;
    default: return `→ ${t('workspacePage.panels.analysis.intelligence.preOpen.flat')}`;
  }
}

function gapMagnitudeLabel(magnitude: GapMagnitude): string {
  return t(`workspacePage.panels.analysis.intelligence.preOpen.magnitude.${magnitude}`);
}

function preOpenConfidenceLabel(confidence: PreOpenConfidence): string {
  return t(`workspacePage.panels.analysis.intelligence.preOpen.confidence.${confidence}`);
}

function thesisStatusLabel(status: ThesisDeltaStatus): string {
  return t(`workspacePage.panels.analysis.intelligence.thesisDelta.status.${status}`);
}

function thesisStatusVariant(status: ThesisDeltaStatus): 'default' | 'success' | 'primary' | 'warning' | 'error' {
  switch (status) {
    case 'confirmed': return 'success';
    case 'weakening': return 'warning';
    case 'invalidated': return 'error';
    default: return 'primary';
  }
}

function positionSignalLabel(action: PositionSignalAction): string {
  const map: Record<PositionSignalAction, string> = {
    HOLD: t('workspacePage.panels.analysis.intelligence.positionSignal.hold'),
    TRIM: t('workspacePage.panels.analysis.intelligence.positionSignal.trim'),
    EXIT: t('workspacePage.panels.analysis.intelligence.positionSignal.exit'),
  };
  return map[action];
}

function positionSignalVariant(action: PositionSignalAction): 'success' | 'warning' | 'error' {
  switch (action) {
    case 'TRIM': return 'warning';
    case 'EXIT': return 'error';
    default: return 'success';
  }
}

function outlookThesisLabel(status: ThesisStatus): string {
  return t(`workspacePage.panels.analysis.intelligence.positionOutlook.thesisStatusValue.${status}`);
}

function profitManagementLabel(value: ProfitManagement): string {
  return t(`workspacePage.panels.analysis.intelligence.positionOutlook.profitManagementValue.${value}`);
}

function opportunityCostLabel(value: OpportunityCost): string {
  return t(`workspacePage.panels.analysis.intelligence.positionOutlook.opportunityCostValue.${value}`);
}

function holdingPeriodLabel(value: ExpectedHoldingPeriod): string {
  return t(`workspacePage.panels.analysis.intelligence.positionOutlook.expectedHoldingPeriodValue.${value}`);
}

export default function NarrativeAnalysisCard({
  intelligence,
  candidate,
  isPosition,
}: NarrativeAnalysisCardProps) {
  const { action, conviction, summaryLine, narrative, symbol } = intelligence;
  const summary = candidate?.decisionSummary;
  const warnings = (summary?.explanation?.confidenceNotes ?? summary?.drivers.warnings ?? []).filter(Boolean);

  // Position vs screened drives the fixed panel skeleton. Prefer the explicit prop;
  // fall back to the MANAGE_ONLY action the analyzer forces for open positions.
  const positionMode = isPosition ?? action === 'MANAGE_ONLY';

  const keyNumbers = intelligence.keyNumbers ?? [];
  const predictionBullets = intelligence.predictionBullets ?? [];
  const upcomingEvents = intelligence.upcomingEvents ?? [];
  const riskFactors = intelligence.riskFactors ?? [];
  const news = intelligence.news ?? [];
  const positionSignal = intelligence.positionSignal ?? null;
  const positionOutlook = intelligence.positionOutlook ?? null;
  const hasPastTrades = Boolean(intelligence.pastTradesContext);
  const moveExplanation = intelligence.positionMoveExplanation ?? null;
  const preOpen = intelligence.preOpenOutlook ?? null;
  const thesisDelta = intelligence.thesisDelta ?? null;
  // Only fetch history once the timeline disclosure is opened — it lives in a
  // collapsed <details> the user may never expand.
  const [timelineOpen, setTimelineOpen] = useState(false);
  const historyQuery = useIntelligenceHistoryQuery(symbol, Boolean(symbol) && timelineOpen);
  const historyEntries = historyQuery.data ?? [];

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

        {/* Pre-open outlook — prominent when the US market has not opened yet */}
        {preOpen && (
          <div className={`rounded-md border p-3 ${gapDirectionClass(preOpen.gapDirection)}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide">
                {t('workspacePage.panels.analysis.intelligence.preOpen.title')}
              </span>
              <span className="text-sm font-semibold">
                {gapDirectionLabel(preOpen.gapDirection)} · {gapMagnitudeLabel(preOpen.magnitude)}
              </span>
            </div>
            <div className="mt-2 space-y-1.5 text-sm text-foreground">
              <p>
                <span className="font-medium">{t('workspacePage.panels.analysis.intelligence.preOpen.driver')}:</span>{' '}
                {preOpen.primaryDriver.sourceUrl ? (
                  <a href={preOpen.primaryDriver.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                    {preOpen.primaryDriver.summary}
                  </a>
                ) : (
                  preOpen.primaryDriver.summary
                )}
              </p>
              <p>
                <span className="font-medium">{t('workspacePage.panels.analysis.intelligence.preOpen.atOpen')}:</span>{' '}
                {preOpen.actionAtOpen}
              </p>
              <p>
                <span className="font-medium">{t('workspacePage.panels.analysis.intelligence.preOpen.stopGapPlan')}:</span>{' '}
                {preOpen.stopGapPlan}
              </p>
            </div>
            <div className="mt-2">
              <Badge variant="default">{preOpenConfidenceLabel(preOpen.confidence)}</Badge>
            </div>
          </div>
        )}

        {/* Decision focus */}
        <div className="rounded-md bg-surface border border-border p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t('workspacePage.panels.analysis.intelligence.decisionFocus')}
          </div>
          <p className="mt-2 text-base font-semibold text-foreground">{summaryLine}</p>
          {thesisDelta && (
            <div className="mt-2 rounded-md border border-border bg-foreground/5 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {t('workspacePage.panels.analysis.intelligence.thesisDelta.title')}
                </span>
                <Badge variant={thesisStatusVariant(thesisDelta.status)}>
                  {thesisStatusLabel(thesisDelta.status)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-foreground">{thesisDelta.summary}</p>
              {thesisDelta.whatPlayedOut.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm list-disc list-inside text-muted">
                  {thesisDelta.whatPlayedOut.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
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

        {/* POSITION SIGNAL — fixed (open positions) */}
        {positionMode && (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              {t('workspacePage.panels.analysis.intelligence.positionSignal.title')}
            </div>
            {positionSignal ? (
              <div className="flex items-start gap-2">
                <Badge variant={positionSignalVariant(positionSignal.action)}>
                  {positionSignalLabel(positionSignal.action)}
                </Badge>
                <p className="flex-1 text-sm text-foreground">{positionSignal.reason}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">{t('workspacePage.panels.analysis.intelligence.emptyPanel')}</p>
            )}
          </div>
        )}

        {/* Why it moved since entry (open positions) */}
        {positionMode && moveExplanation && (
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

        {/* OUTLOOK — fixed (open positions) */}
        {positionMode && (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              {t('workspacePage.panels.analysis.intelligence.positionOutlook.title')}
            </div>
            {positionOutlook ? (
              <div className="space-y-2 text-sm text-foreground">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="default">
                    {t('workspacePage.panels.analysis.intelligence.positionOutlook.thesisStatus')}: {outlookThesisLabel(positionOutlook.thesisStatus)}
                  </Badge>
                  <Badge variant="default">
                    {t('workspacePage.panels.analysis.intelligence.positionOutlook.expectedHoldingPeriod')}: {holdingPeriodLabel(positionOutlook.expectedHoldingPeriod)}
                  </Badge>
                  <Badge variant="default">
                    {t('workspacePage.panels.analysis.intelligence.positionOutlook.profitManagement')}: {profitManagementLabel(positionOutlook.profitManagement)}
                  </Badge>
                  <Badge variant="default">
                    {t('workspacePage.panels.analysis.intelligence.positionOutlook.opportunityCost')}: {opportunityCostLabel(positionOutlook.opportunityCost)}
                  </Badge>
                </div>
                <p>
                  <span className="font-medium">{t('workspacePage.panels.analysis.intelligence.positionOutlook.holdUntil')}:</span>{' '}
                  {positionOutlook.holdUntil}
                </p>
                <p>
                  <span className="font-medium">{t('workspacePage.panels.analysis.intelligence.positionOutlook.nextReviewTrigger')}:</span>{' '}
                  {positionOutlook.nextReviewTrigger}
                </p>
                {positionOutlook.invalidationSignals.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {t('workspacePage.panels.analysis.intelligence.positionOutlook.invalidationSignals')}
                    </div>
                    <ul className="mt-1 space-y-1 list-disc list-inside text-muted">
                      {positionOutlook.invalidationSignals.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">{t('workspacePage.panels.analysis.intelligence.positionOutlook.empty')}</p>
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

        {/* WHY NOW — fixed (screened) */}
        {!positionMode && (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
              {t('workspacePage.panels.analysis.intelligence.priceHook')}
            </div>
            {intelligence.priceHook ? (
              <p className="text-sm text-foreground">{intelligence.priceHook}</p>
            ) : (
              <p className="text-sm text-muted">{t('workspacePage.panels.analysis.intelligence.emptyPanel')}</p>
            )}
          </div>
        )}

        {/* KEY NUMBERS — fixed (both) */}
        <div className="rounded-md bg-surface border border-border p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            {t('workspacePage.panels.analysis.intelligence.keyNumbers')}
          </div>
          {keyNumbers.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {keyNumbers.map((kn, i) => (
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
          ) : (
            <p className="text-sm text-muted">{t('workspacePage.panels.analysis.intelligence.emptyPanel')}</p>
          )}
        </div>

        {/* WHAT TO EXPECT — fixed (both): predictions + upcoming events */}
        <div className="rounded-md bg-surface border border-border p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            {t('workspacePage.panels.analysis.intelligence.whatToExpect.title')}
          </div>
          {predictionBullets.length > 0 || upcomingEvents.length > 0 ? (
            <div className="space-y-2">
              {predictionBullets.length > 0 && (
                <ul className="space-y-2">
                  {predictionBullets.map((pb, i) => (
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
              )}
              {upcomingEvents.length > 0 && (
                <ul className="space-y-1 text-sm">
                  {upcomingEvents.map((ev, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={`font-bold text-base leading-tight shrink-0 ${directionClass(ev.direction)}`}>
                        {directionArrow(ev.direction)}
                      </span>
                      <span className="flex-1 text-foreground">{ev.summary}</span>
                      {ev.date && (
                        <span className="shrink-0 text-[11px] text-muted tabular-nums">{ev.date}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">{t('workspacePage.panels.analysis.intelligence.whatToExpect.empty')}</p>
          )}
        </div>

        {/* NEWS — fixed (both) */}
        <div className="rounded-md bg-surface border border-border p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            {t('workspacePage.panels.analysis.intelligence.news.title')}
          </div>
          {news.length > 0 ? (
            <ul className="space-y-2">
              {news.map((n, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${sentimentDotClass(n.sentiment)}`} />
                  <div className="flex-1">
                    {n.url ? (
                      <a href={n.url} target="_blank" rel="noreferrer" className="text-foreground underline">
                        {n.headline}
                      </a>
                    ) : (
                      <span className="text-foreground">{n.headline}</span>
                    )}
                    {n.date && <span className="ml-2 text-[11px] text-muted tabular-nums">{n.date}</span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t('workspacePage.panels.analysis.intelligence.news.empty')}</p>
          )}
        </div>

        {/* RISKS — fixed (screened); present-gated (position) */}
        {!positionMode ? (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              {t('workspacePage.panels.analysis.intelligence.riskFactors')}
            </div>
            {riskFactors.length > 0 ? (
              <ul className="space-y-1">
                {riskFactors.map((rf, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted">
                    <span className="text-muted shrink-0 mt-0.5">•</span>
                    <span>{rf}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t('workspacePage.panels.analysis.intelligence.emptyPanel')}</p>
            )}
          </div>
        ) : riskFactors.length > 0 ? (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
              {t('workspacePage.panels.analysis.intelligence.riskFactors')}
            </div>
            <ul className="space-y-1">
              {riskFactors.map((rf, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted">
                  <span className="text-muted shrink-0 mt-0.5">•</span>
                  <span>{rf}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* PAST TRADES */}
        {hasPastTrades && (
          <div className="rounded-md bg-surface border border-border p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">
              {t('workspacePage.panels.analysis.intelligence.pastTrades', { symbol })}
            </div>
            <p className="text-sm text-muted">{intelligence.pastTradesContext}</p>
          </div>
        )}

        {/* Full rationale — always collapsed; available on expand */}
        <details className="rounded-md bg-surface border border-border p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted select-none">
            {t('workspacePage.panels.analysis.intelligence.fullRationale')}
          </summary>
          <div className="prose prose-sm prose-invert mt-2 max-w-none">
            <ReactMarkdown>{narrative}</ReactMarkdown>
          </div>
        </details>

        {/* Data inputs */}
        {intelligence.inputsUsed && Object.keys(intelligence.inputsUsed).length > 0 && (
          <details className="rounded-md border border-border bg-surface p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted select-none">
              {t('workspacePage.panels.analysis.intelligence.dataInputs')}
            </summary>
            <div className="mt-3 space-y-2">
              {Object.entries(intelligence.inputsUsed).map(([group, fields]) => {
                const entries = fields as Record<string, unknown>;
                // The `sources` group carries provider-coverage telemetry as a list
                // (`attempted`) and a publisher→count map (`returned`), both object-typed,
                // so the generic scalar renderer below skips them and the group reads empty.
                // Render them explicitly: attempted sources stay visible even on a blackout
                // where nothing was returned.
                if (group === 'sources') {
                  const attempted = Array.isArray(entries.attempted) ? (entries.attempted as string[]) : [];
                  const returned =
                    entries.returned && typeof entries.returned === 'object'
                      ? (entries.returned as Record<string, number>)
                      : {};
                  return (
                    <div key={group}>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                        {group.replace(/_/g, ' ')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {attempted.map((src) => (
                          <span
                            key={`attempted-${src}`}
                            className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-xs text-muted"
                          >
                            <span className="font-medium text-muted">attempted:</span>
                            <span>{src}</span>
                          </span>
                        ))}
                        {Object.entries(returned).map(([publisher, count]) => (
                          <span
                            key={`returned-${publisher}`}
                            className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2.5 py-0.5 text-xs text-success"
                          >
                            <span className="font-medium">{publisher}:</span>
                            <span>{count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={group}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                      {group.replace(/_/g, ' ')}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(entries).filter(([, v]) => v != null && typeof v !== 'object').map(([key, value]) => (
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
                );
              })}
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

        {/* Analysis timeline — past analyses for this symbol */}
        <details
          className="rounded-md border border-border bg-surface p-3"
          onToggle={(e) => setTimelineOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-xs font-medium text-muted select-none">
            {t('workspacePage.panels.analysis.intelligence.timeline.title')}
          </summary>
          {historyQuery.isLoading ? (
            <p className="mt-2 text-sm text-muted">
              {t('workspacePage.panels.analysis.intelligence.timeline.loading')}
            </p>
          ) : historyQuery.isError ? (
            <p className="mt-2 text-sm text-danger">
              {t('workspacePage.panels.analysis.intelligence.timeline.error')}
            </p>
          ) : historyEntries.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {historyEntries.map((entry, index) => (
                <li
                  key={`${entry.generatedAt}-${index}`}
                  className="flex items-start gap-2 text-sm border-l-2 border-border pl-2"
                >
                  <span className="shrink-0 text-[11px] text-muted tabular-nums">
                    {formatDate(entry.generatedAt)}
                  </span>
                  <Badge variant={convictionVariant(entry.conviction)}>{actionLabel(entry.action)}</Badge>
                  <span className="flex-1 text-foreground">{entry.summaryLine}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {t('workspacePage.panels.analysis.intelligence.timeline.empty')}
            </p>
          )}
        </details>
      </div>
    </div>
  );
}
