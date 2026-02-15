import Badge from '@/components/common/Badge';
import { IntelligenceOpportunity } from '@/features/intelligence/types';
import { buildOpportunityEducation } from '@/features/intelligence/presentation';
import { t } from '@/i18n/t';

interface IntelligenceOpportunityCardProps {
  opportunity: IntelligenceOpportunity;
}

const STATE_BADGE_VARIANT: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  WATCH: 'warning',
  CATALYST_ACTIVE: 'primary',
  TRENDING: 'success',
  COOLING_OFF: 'default',
  QUIET: 'default',
};

export default function IntelligenceOpportunityCard({ opportunity }: IntelligenceOpportunityCardProps) {
  const education = buildOpportunityEducation(opportunity);
  const state = opportunity.state.trim().toUpperCase();
  const stateBadge = STATE_BADGE_VARIANT[state] ?? 'default';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="primary">{opportunity.symbol}</Badge>
          <Badge variant={stateBadge}>{education.stateLabel}</Badge>
        </div>
        <p className="text-sm font-semibold text-green-700 dark:text-green-400">{education.opportunityLabel}</p>
      </div>

      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{education.stateSummary}</p>

      <div className="mt-3 rounded-md bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('intelligenceEducation.sections.why')}
        </p>
        <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <li>{education.technicalLine}</li>
          <li>{education.catalystLine}</li>
          <li>{education.blendLine}</li>
        </ul>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-md border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            {t('intelligenceEducation.sections.next')}
          </p>
          <p className="mt-1 text-sm text-blue-900 dark:text-blue-100">{education.nextStep}</p>
        </div>
        <div className="rounded-md border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {t('intelligenceEducation.sections.risk')}
          </p>
          <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">{education.riskNote}</p>
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-gray-600 dark:text-gray-300">
          {t('intelligenceEducation.sections.evidence')}
        </summary>
        <ul className="mt-2 ml-5 list-disc space-y-1 text-sm text-gray-600 dark:text-gray-400">
          {education.evidence.map((line, idx) => (
            <li key={`${opportunity.symbol}-${idx}`}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

