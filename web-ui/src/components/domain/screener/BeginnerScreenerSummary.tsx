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
  ready: 'bg-green-100 text-green-800 border border-green-300',
  wait_for_price: 'bg-amber-100 text-amber-800 border border-amber-300',
  watch_only: 'bg-blue-100 text-blue-800 border border-blue-300',
  avoid: 'bg-red-100 text-red-800 border border-red-300',
  manage_existing: 'bg-gray-100 text-gray-700 border border-gray-300',
  incomplete: 'bg-gray-100 text-gray-700 border border-gray-300',
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
  ready: 'border-green-200',
  wait_for_price: 'border-amber-200',
  watch_only: 'border-blue-200',
  avoid: 'border-gray-200',
  manage_existing: 'border-gray-200',
  incomplete: 'border-gray-200',
};

export default function BeginnerScreenerSummary({
  candidates,
  onReviewCandidate,
}: BeginnerScreenerSummaryProps) {
  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-600">{t('screener.beginnerSummary.noCandidates')}</p>
      </div>
    );
  }

  const bestCandidate = pickBestBeginnerCandidate(candidates);

  if (!bestCandidate) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-600">{t('screener.beginnerSummary.noCandidates')}</p>
      </div>
    );
  }

  const decision = toBeginnerDecision(bestCandidate);
  const borderClass = READINESS_BORDER_CLASS[decision.orderReadiness];

  return (
    <div className={`rounded-lg border bg-white p-4 ${borderClass}`}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
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
      <p className="text-sm text-gray-600 mt-1">
        {t(ACTION_LABEL_KEY[decision.suggestedAction])}
      </p>
      <p className="text-sm mt-2">{decision.plainReason}</p>
      {decision.mainRisk ? (
        <p className="text-sm text-amber-700 mt-1">
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
