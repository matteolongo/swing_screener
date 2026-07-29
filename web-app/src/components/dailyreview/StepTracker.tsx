import clsx from 'clsx';
import type { StepStatus } from '@/types/api';
import { useI18n } from '@/i18n';

interface Props {
  steps: StepStatus[];
  isLoading: boolean;
}

const DEFAULT_STEP_KEYS = [
  'dailyReview.stepTracker.screen',
  'dailyReview.stepTracker.analyze',
  'dailyReview.stepTracker.size',
  'dailyReview.stepTracker.order',
  'dailyReview.stepTracker.review',
  'dailyReview.stepTracker.exit',
];

function statusIcon(status: 'done' | 'pending' | 'skipped'): string {
  if (status === 'done') return '✅';
  if (status === 'skipped') return '⬛';
  return '🔲';
}

function SkeletonStep() {
  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-col items-center gap-1">
        <div className="w-8 h-8 rounded-full bg-elevated animate-pulse" />
        <div className="w-10 h-3 bg-elevated animate-pulse rounded" />
      </div>
    </div>
  );
}

export default function StepTracker({ steps, isLoading }: Props) {
  const { t } = useI18n();
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonStep key={i} />
        ))}
      </div>
    );
  }

  const displaySteps = steps.length > 0 ? steps : DEFAULT_STEP_KEYS.map((k) => ({ name: t(k), status: 'pending' as const }));

  return (
    <div className="flex items-center justify-center gap-0 py-3">
      {displaySteps.map((step, i) => (
        <div key={step.name} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-base">{statusIcon(step.status)}</span>
            <span className="text-xs text-text-secondary">{step.name}</span>
          </div>
          {i < displaySteps.length - 1 && (
            <div
              className={clsx(
                'h-px w-8 mx-1 flex-shrink-0',
                step.status === 'done' && displaySteps[i + 1].status === 'done'
                  ? 'bg-success'
                  : 'bg-border',
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
