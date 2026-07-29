import clsx from 'clsx';
import type { StepStatus } from '../../types/api';

interface Props {
  steps: StepStatus[];
  isLoading: boolean;
}

const DEFAULT_STEPS = [
  { name: 'Screen', status: 'pending' as const },
  { name: 'Analyze', status: 'pending' as const },
  { name: 'Size', status: 'pending' as const },
  { name: 'Order', status: 'pending' as const },
  { name: 'Review', status: 'pending' as const },
  { name: 'Exit', status: 'pending' as const },
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
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonStep key={i} />
        ))}
      </div>
    );
  }

  const displaySteps = steps.length > 0 ? steps : DEFAULT_STEPS;

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
