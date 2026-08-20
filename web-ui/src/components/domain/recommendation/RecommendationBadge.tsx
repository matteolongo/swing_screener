import type {
  Recommendation,
} from '@/types/recommendation';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import {
  getWorkflowPresentation,
  type WorkflowTone,
} from './workflowPresentation';

interface RecommendationBadgeProps {
  recommendation?: Pick<Recommendation, 'workflowStatus' | 'nextStep'>;
  className?: string;
  showExplanation?: boolean;
}

const WORKFLOW_STYLES: Record<WorkflowTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  neutral: 'bg-foreground/5 text-muted',
};

export default function RecommendationBadge({
  recommendation,
  className,
  showExplanation = false,
}: RecommendationBadgeProps) {
  const workflow = getWorkflowPresentation(recommendation);

  return (
    <span className="inline-flex flex-col gap-1">
      <span
        className={cn(
          'text-xs px-2 py-1 rounded whitespace-nowrap',
          WORKFLOW_STYLES[workflow.tone],
          className,
        )}
      >
        {t(workflow.labelKey)}
      </span>
      {showExplanation ? (
        <span className="text-[11px] text-muted leading-snug">
          {t('recommendation.setupQualityExplanation')}
        </span>
      ) : null}
    </span>
  );
}
