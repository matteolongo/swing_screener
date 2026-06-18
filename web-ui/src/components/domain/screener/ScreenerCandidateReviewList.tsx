import Button from '@/components/common/Button';
import {
  toBeginnerDecision,
  toSetupQuality,
  type BeginnerOrderReadiness,
  type BeginnerSetupQuality,
} from '@/features/screener/beginnerDecision';
import type { DecisionAction, ScreenerCandidate } from '@/features/screener/types';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';

export interface ScreenerCandidateReviewListProps {
  candidates: ScreenerCandidate[];
  selectedTicker: string | null;
  onReview: (ticker: string) => void;
}

const QUALITY_BADGE_CLASS: Record<BeginnerSetupQuality, string> = {
  pass: 'bg-success/10 text-success border border-success/40',
  caution: 'bg-warning/10 text-warning border border-warning/40',
  fail: 'bg-danger/10 text-danger border border-danger/40',
  incomplete: 'bg-foreground/5 text-muted border border-border',
};

const QUALITY_LABEL_KEY: Record<BeginnerSetupQuality, MessageKey> = {
  pass: 'screener.guidedList.quality.pass',
  caution: 'screener.guidedList.quality.caution',
  fail: 'screener.guidedList.quality.fail',
  incomplete: 'screener.guidedList.quality.incomplete',
};

const READINESS_CHIP_CLASS: Record<BeginnerOrderReadiness, string> = {
  ready: 'bg-success/10 text-success border border-success/40',
  wait_for_price: 'bg-warning/10 text-warning border border-warning/40',
  watch_only: 'bg-primary/10 text-primary border border-primary/40',
  avoid: 'bg-danger/10 text-danger border border-danger/40',
  manage_existing: 'bg-foreground/5 text-muted border border-border',
  incomplete: 'bg-foreground/5 text-muted border border-border',
};

const READINESS_LABEL_KEY: Record<BeginnerOrderReadiness, MessageKey> = {
  ready: 'screener.guidedList.readiness.ready',
  wait_for_price: 'screener.guidedList.readiness.wait_for_price',
  watch_only: 'screener.guidedList.readiness.watch_only',
  avoid: 'screener.guidedList.readiness.avoid',
  manage_existing: 'screener.guidedList.readiness.manage_existing',
  incomplete: 'screener.guidedList.readiness.incomplete',
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

export default function ScreenerCandidateReviewList({
  candidates,
  selectedTicker,
  onReview,
}: ScreenerCandidateReviewListProps) {
  if (candidates.length === 0) {
    return (
      <div className="flex-1 rounded-md border border-border bg-surface p-4">
        <p className="text-sm text-muted">{t('screener.guidedList.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border bg-surface">
      {candidates.map((candidate, index) => {
        const decision = toBeginnerDecision(candidate);
        const quality = toSetupQuality(candidate);
        const isSelected =
          candidate.ticker.toLowerCase() === selectedTicker?.toLowerCase();

        return (
          <div
            key={candidate.ticker}
            className={`flex items-start gap-3 px-3 py-2.5 border-b border-border last:border-b-0 ${isSelected ? 'bg-primary/10' : 'bg-surface'}`}
          >
            <span className="text-xs text-muted w-5 flex-shrink-0 pt-0.5">{index + 1}</span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="font-bold text-sm text-foreground hover:underline"
                  onClick={() => onReview(candidate.ticker)}
                >
                  {candidate.ticker}
                </button>
                {!(quality === 'fail' && decision.orderReadiness === 'ready') && (
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${QUALITY_BADGE_CLASS[quality]}`}
                  >
                    {t(QUALITY_LABEL_KEY[quality])}
                  </span>
                )}
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${READINESS_CHIP_CLASS[decision.orderReadiness]}`}
                >
                  {t(READINESS_LABEL_KEY[decision.orderReadiness])}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {t(ACTION_LABEL_KEY[decision.suggestedAction])}
              </p>
              <p className="text-xs text-muted mt-0.5 truncate">{decision.plainReason}</p>
            </div>

            <div className="flex-shrink-0">
              <Button variant="secondary" size="sm" onClick={() => onReview(candidate.ticker)}>
                {t('screener.guidedList.review')}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
