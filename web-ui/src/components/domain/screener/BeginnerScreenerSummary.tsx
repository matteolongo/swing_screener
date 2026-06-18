import Button from '@/components/common/Button';
import {
  pickBestBeginnerCandidate,
  toBeginnerDecision,
  type BeginnerOrderReadiness,
} from '@/features/screener/beginnerDecision';
import type { DecisionAction, ScreenerCandidate } from '@/features/screener/types';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';

export interface BeginnerScreenerSummaryProps {
  candidates: ScreenerCandidate[];
  onReviewCandidate: (ticker: string) => void;
}

const READINESS_CHIP_CLASS: Record<BeginnerOrderReadiness, string> = {
  ready: 'bg-success/10 text-success border border-success/40',
  wait_for_price: 'bg-warning/10 text-warning border border-warning/40',
  watch_only: 'bg-primary/10 text-primary border border-primary/40',
  avoid: 'bg-danger/10 text-danger border border-danger/40',
  manage_existing: 'bg-foreground/5 text-muted border border-border',
  incomplete: 'bg-foreground/5 text-muted border border-border',
};

const READINESS_LABEL_KEY: Record<BeginnerOrderReadiness, MessageKey> = {
  ready: 'screener.beginnerSummary.readiness.ready',
  wait_for_price: 'screener.beginnerSummary.readiness.waitForPrice',
  watch_only: 'screener.beginnerSummary.readiness.watchOnly',
  avoid: 'screener.beginnerSummary.readiness.avoid',
  manage_existing: 'screener.beginnerSummary.readiness.manageExisting',
  incomplete: 'screener.beginnerSummary.readiness.incomplete',
};

const ACTION_LABEL_KEY: Record<DecisionAction, MessageKey> = {
  BUY_NOW: 'screener.guidedList.action.BUY_NOW',
  BUY_ON_PULLBACK: 'screener.guidedList.action.BUY_ON_PULLBACK',
  WAIT_FOR_BREAKOUT: 'screener.guidedList.action.WAIT_FOR_BREAKOUT',
  WATCH: 'screener.guidedList.action.WATCH',
  TACTICAL_ONLY: 'screener.guidedList.action.TACTICAL_ONLY',
  AVOID: 'screener.guidedList.action.AVOID',
  MANAGE_ONLY: 'screener.guidedList.action.MANAGE_ONLY',
};

const READINESS_BORDER_CLASS: Record<BeginnerOrderReadiness, string> = {
  ready: 'border-success/40',
  wait_for_price: 'border-warning/40',
  watch_only: 'border-primary/40',
  avoid: 'border-border',
  manage_existing: 'border-border',
  incomplete: 'border-border',
};

export default function BeginnerScreenerSummary({
  candidates,
  onReviewCandidate,
}: BeginnerScreenerSummaryProps) {
  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted">{t('screener.beginnerSummary.noCandidates')}</p>
      </div>
    );
  }

  const bestCandidate = pickBestBeginnerCandidate(candidates);

  if (!bestCandidate) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted">{t('screener.beginnerSummary.noCandidates')}</p>
      </div>
    );
  }

  const decision = toBeginnerDecision(bestCandidate);
  const borderClass = READINESS_BORDER_CLASS[decision.orderReadiness];

  return (
    <div className={`rounded-lg border bg-surface p-4 ${borderClass}`}>
      <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
        {t('screener.beginnerSummary.bestCandidate')}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-bold text-lg">{decision.ticker}</span>
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${READINESS_CHIP_CLASS[decision.orderReadiness]}`}
        >
          {t(READINESS_LABEL_KEY[decision.orderReadiness])}
        </span>
      </div>
      <p className="text-sm text-muted mt-1">
        {t(ACTION_LABEL_KEY[decision.suggestedAction])}
      </p>
      <p className="text-sm mt-2">{decision.plainReason}</p>
      {decision.mainRisk ? (
        <p className="text-sm text-warning mt-1">
          <span className="font-medium">{t('screener.beginnerSummary.mainRisk')}</span>{' '}
          {decision.mainRisk}
        </p>
      ) : null}
      <div className="mt-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => onReviewCandidate(decision.ticker)}
        >
          {t('screener.beginnerSummary.reviewCandidate')}
        </Button>
      </div>
    </div>
  );
}
