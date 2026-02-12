import HelpTooltip from '@/components/common/HelpTooltip';
import { EducationMetricKey, getGlossaryEntry } from '@/content/educationGlossary';
import { cn } from '@/utils/cn';

interface MetricHelpLabelProps {
  metricKey: EducationMetricKey;
  labelOverride?: string;
  className?: string;
}

export default function MetricHelpLabel({ metricKey, labelOverride, className }: MetricHelpLabelProps) {
  const entry = getGlossaryEntry(metricKey);

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span>{labelOverride ?? entry.label}</span>
      <HelpTooltip
        short={entry.tooltip}
        title={entry.title}
        content={(
          <div className="space-y-3 text-sm">
            <p>{entry.explanation}</p>
            {entry.formula ? (
              <p className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1 font-mono text-xs">
                {entry.formula}
              </p>
            ) : null}
            <p>{entry.interpretation}</p>
          </div>
        )}
      />
    </span>
  );
}
