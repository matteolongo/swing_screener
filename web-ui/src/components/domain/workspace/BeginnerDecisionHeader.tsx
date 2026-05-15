import Button from '@/components/common/Button';
import type { BeginnerDecision, BeginnerOrderReadiness } from '@/features/screener/beginnerDecision';
import { toBeginnerDecision } from '@/features/screener/beginnerDecision';
import type { ScreenerCandidate } from '@/features/screener/types';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

interface BeginnerDecisionHeaderProps {
  candidate: ScreenerCandidate;
  onAction: (nextStepKind: BeginnerDecision['nextStepKind']) => void;
}

function borderColorForReadiness(readiness: BeginnerOrderReadiness): string {
  switch (readiness) {
    case 'ready':
      return 'border-green-200';
    case 'wait_for_price':
      return 'border-amber-200';
    case 'watch_only':
      return 'border-blue-200';
    case 'avoid':
      return 'border-red-200';
    default:
      return 'border-gray-200';
  }
}

function answerColorForReadiness(readiness: BeginnerOrderReadiness): string {
  switch (readiness) {
    case 'ready':
      return 'text-green-700';
    case 'wait_for_price':
    case 'watch_only':
      return 'text-amber-700';
    case 'avoid':
      return 'text-red-700';
    default:
      return 'text-gray-700';
  }
}

function answerTextForReadiness(readiness: BeginnerOrderReadiness): string {
  switch (readiness) {
    case 'ready':
      return t('analysis.beginnerHeader.answer.ready');
    case 'wait_for_price':
      return t('analysis.beginnerHeader.answer.waitForPrice');
    case 'watch_only':
      return t('analysis.beginnerHeader.answer.watchOnly');
    case 'avoid':
      return t('analysis.beginnerHeader.answer.avoid');
    case 'manage_existing':
      return t('analysis.beginnerHeader.answer.manageExisting');
    case 'incomplete':
      return t('analysis.beginnerHeader.answer.incomplete');
  }
}

function actionLabel(nextStepKind: BeginnerDecision['nextStepKind']): string {
  switch (nextStepKind) {
    case 'prepare_order':
      return t('analysis.beginnerHeader.action.prepare_order');
    case 'wait':
      return t('analysis.beginnerHeader.action.wait');
    case 'watch':
      return t('analysis.beginnerHeader.action.watch');
    case 'avoid':
      return t('analysis.beginnerHeader.action.avoid');
    case 'review_candidate':
      return t('analysis.beginnerHeader.action.review_candidate');
    case 'update_stop':
      return t('analysis.beginnerHeader.action.update_stop');
    case 'close_position':
      return t('analysis.beginnerHeader.action.close_position');
    case 'review_pending_order':
      return t('analysis.beginnerHeader.action.review_pending_order');
    case 'run_screener':
      return t('analysis.beginnerHeader.action.run_screener');
    case 'no_action':
      return t('analysis.beginnerHeader.action.no_action');
  }
}

export default function BeginnerDecisionHeader({ candidate, onAction }: BeginnerDecisionHeaderProps) {
  const decision = toBeginnerDecision(candidate);

  return (
    <div
      className={cn(
        'rounded-lg border p-4 mb-3',
        borderColorForReadiness(decision.orderReadiness)
      )}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
        {t('analysis.beginnerHeader.question')}
      </p>
      <p className={cn('text-base font-semibold mb-2', answerColorForReadiness(decision.orderReadiness))}>
        {answerTextForReadiness(decision.orderReadiness)}
      </p>
      <p className="text-sm text-gray-700 mb-2">{decision.plainReason}</p>
      {decision.mainRisk ? (
        <p className="text-sm text-amber-700 mb-1">
          <span className="font-medium">{t('analysis.beginnerHeader.mainRisk')}</span>{' '}
          {decision.mainRisk}
        </p>
      ) : null}
      {decision.invalidation ? (
        <p className="text-sm text-gray-500 mb-2">
          <span className="font-medium">{t('analysis.beginnerHeader.invalidation')}</span>{' '}
          {decision.invalidation}
        </p>
      ) : null}
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => onAction(decision.nextStepKind)}
      >
        {actionLabel(decision.nextStepKind)}
      </Button>
      <p className="mt-2 text-[11px] text-gray-400 leading-snug">
        {t('recommendation.setupQualityExplanation' as any)}
      </p>
    </div>
  );
}
