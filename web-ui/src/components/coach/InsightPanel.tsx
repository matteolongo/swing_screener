import type { ReactNode } from 'react';
import { Section } from '@/components/ui/Section';
import { t } from '@/i18n/t';

interface InsightPanelProps {
  title: string;
  summary: string;
  details?: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
}

export function InsightPanel({
  title,
  summary,
  details,
  isExpanded,
  onToggle,
}: InsightPanelProps) {
  return (
    <Section title={title}>
      <div className="space-y-3">
        <p className="text-gray-600 dark:text-gray-300">{summary}</p>
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline dark:text-blue-300"
          onClick={onToggle}
        >
          {isExpanded ? t('dailyReview.insight.hideExplanation') : t('dailyReview.insight.showExplanation')}
        </button>
        {isExpanded ? (
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {details}
          </div>
        ) : null}
      </div>
    </Section>
  );
}
