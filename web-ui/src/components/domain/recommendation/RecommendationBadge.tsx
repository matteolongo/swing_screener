import type {
  DecisionGateState,
  RecommendationReason,
  RecommendationVerdict,
} from '@/types/recommendation';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import {
  deriveExecutionReadiness,
  type ExecutionReadinessTone,
} from './readiness';

interface RecommendationBadgeProps {
  verdict?: RecommendationVerdict | 'UNKNOWN';
  reasonsDetailed?: RecommendationReason[];
  decisionGates?: DecisionGateState;
  className?: string;
  showExplanation?: boolean;
}

const READINESS_STYLES: Record<ExecutionReadinessTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  neutral: 'bg-foreground/5 text-muted',
};

export default function RecommendationBadge({
  verdict = 'UNKNOWN',
  decisionGates,
  className,
  showExplanation = false,
}: RecommendationBadgeProps) {
  const readiness = deriveExecutionReadiness(decisionGates, verdict);

  return (
    <span className="inline-flex flex-col gap-1">
      <span
        className={cn(
          'text-xs px-2 py-1 rounded whitespace-nowrap',
          READINESS_STYLES[readiness.tone],
          className,
        )}
      >
        {t(readiness.labelKey)}
      </span>
      {showExplanation ? (
        <span className="text-[11px] text-muted leading-snug">
          {t('recommendation.setupQualityExplanation')}
        </span>
      ) : null}
    </span>
  );
}
