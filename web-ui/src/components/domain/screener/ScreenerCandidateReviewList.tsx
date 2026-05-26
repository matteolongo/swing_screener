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
  pass: 'bg-green-100 text-green-800 border border-green-300',
  caution: 'bg-amber-100 text-amber-800 border border-amber-300',
  fail: 'bg-red-100 text-red-800 border border-red-300',
  incomplete: 'bg-gray-100 text-gray-700 border border-gray-300',
};

const QUALITY_LABEL_KEY: Record<BeginnerSetupQuality, MessageKey> = {
  pass: 'screener.guidedList.quality.pass',
  caution: 'screener.guidedList.quality.caution',
  fail: 'screener.guidedList.quality.fail',
  incomplete: 'screener.guidedList.quality.incomplete',
};

const READINESS_CHIP_CLASS: Record<BeginnerOrderReadiness, string> = {
  ready: 'bg-green-100 text-green-800 border border-green-300',
  wait_for_price: 'bg-amber-100 text-amber-800 border border-amber-300',
  watch_only: 'bg-blue-100 text-blue-800 border border-blue-300',
  avoid: 'bg-red-100 text-red-800 border border-red-300',
  manage_existing: 'bg-gray-100 text-gray-700 border border-gray-300',
  incomplete: 'bg-gray-100 text-gray-700 border border-gray-300',
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
      <div className="flex-1 rounded-md border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-600">{t('screener.guidedList.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto rounded-md border border-gray-200 bg-white">
      {candidates.map((candidate, index) => {
        const decision = toBeginnerDecision(candidate);
        const quality = toSetupQuality(candidate);
        const isSelected =
          candidate.ticker.toLowerCase() === selectedTicker?.toLowerCase();

        return (
          <div
            key={candidate.ticker}
            className={`flex items-start gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}
          >
            <span className="text-xs text-gray-400 w-5 flex-shrink-0 pt-0.5">{index + 1}</span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  className="font-bold text-sm text-gray-900 hover:underline"
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
              <p className="text-xs text-gray-500 mt-0.5">
                {t(ACTION_LABEL_KEY[decision.suggestedAction])}
              </p>
              <p className="text-xs text-gray-600 mt-0.5 truncate">{decision.plainReason}</p>
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
