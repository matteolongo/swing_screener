import HelpTooltip from '@/components/common/HelpTooltip';
import { EducationMetricKey, getGlossaryEntry } from '@/content/educationGlossary';
import { cn } from '@/utils/cn';
import { Link } from 'react-router-dom';
import { t } from '@/i18n/t';

interface MetricHelpLabelProps {
  metricKey: EducationMetricKey;
  labelOverride?: string;
  className?: string;
  showLearnLink?: boolean;
}

export default function MetricHelpLabel({
  metricKey,
  labelOverride,
  className,
  showLearnLink = false,
}: MetricHelpLabelProps) {
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
      {showLearnLink ? (
        <Link
          to={`/learn?q=${encodeURIComponent(entry.label)}`}
          className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
          aria-label={t('learnPage.openForMetricAria', { metric: entry.label })}
          title={t('learnPage.openForMetricTitle', { metric: entry.label })}
        >
          {t('common.actions.learn')}
        </Link>
      ) : null}
    </span>
  );
}
