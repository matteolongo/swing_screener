import { RecommendationVerdict } from '@/types/recommendation';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';

interface RecommendationBadgeProps {
  verdict?: RecommendationVerdict | 'UNKNOWN';
  className?: string;
}

const VERDICT_STYLES: Record<string, string> = {
  RECOMMENDED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  NOT_RECOMMENDED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  UNKNOWN: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const VERDICT_LABELS: Record<string, string> = {
  RECOMMENDED: t('recommendation.verdict.recommended'),
  NOT_RECOMMENDED: t('recommendation.verdict.notRecommended'),
  UNKNOWN: t('recommendation.verdict.unknown'),
};

export default function RecommendationBadge({
  verdict = 'UNKNOWN',
  className,
}: RecommendationBadgeProps) {
  const safeVerdict = verdict in VERDICT_STYLES ? verdict : 'UNKNOWN';

  return (
    <span
      className={cn(
        'text-xs px-2 py-1 rounded',
        VERDICT_STYLES[safeVerdict],
        className,
      )}
    >
      {VERDICT_LABELS[safeVerdict]}
    </span>
  );
}
