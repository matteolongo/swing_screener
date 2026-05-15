import { RecommendationReason, RecommendationVerdict } from '@/types/recommendation';
import { cn } from '@/utils/cn';
import { t } from '@/i18n/t';
import type { MessageKey } from '@/i18n/types';

interface RecommendationBadgeProps {
  verdict?: RecommendationVerdict | 'UNKNOWN';
  reasonsDetailed?: RecommendationReason[];
  className?: string;
  showExplanation?: boolean;
}

// When the only blocking reasons are parameter-completeness issues (not signal/quality
// failures), show "Incomplete" rather than "Not Recommended" so the badge doesn't
// contradict a BUY_ON_PULLBACK or BUY_NOW action label in the candidate list.
const COMPLETENESS_CODES = new Set(['STOP_MISSING', 'NO_SIGNAL']);

function isIncomplete(
  verdict: string,
  reasons: RecommendationReason[] | undefined,
): boolean {
  if (verdict !== 'NOT_RECOMMENDED' || !reasons?.length) return false;
  const blockers = reasons.filter((r) => r.severity === 'block');
  return blockers.length > 0 && blockers.every((r) => COMPLETENESS_CODES.has(r.code));
}

const VERDICT_STYLES: Record<string, string> = {
  RECOMMENDED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  NOT_RECOMMENDED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  INCOMPLETE: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  UNKNOWN: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const VERDICT_LABEL_KEY: Record<string, MessageKey> = {
  RECOMMENDED: 'recommendation.verdict.RECOMMENDED',
  NOT_RECOMMENDED: 'recommendation.verdict.NOT_RECOMMENDED',
  INCOMPLETE: 'recommendation.verdict.INCOMPLETE',
  UNKNOWN: 'recommendation.verdict.UNKNOWN',
};

export default function RecommendationBadge({
  verdict = 'UNKNOWN',
  reasonsDetailed,
  className,
  showExplanation = false,
}: RecommendationBadgeProps) {
  const displayKey =
    isIncomplete(verdict, reasonsDetailed)
      ? 'INCOMPLETE'
      : verdict in VERDICT_STYLES
        ? verdict
        : 'UNKNOWN';

  return (
    <span className="inline-flex flex-col gap-1">
      <span
        className={cn(
          'text-xs px-2 py-1 rounded',
          VERDICT_STYLES[displayKey],
          className,
        )}
      >
        {t(VERDICT_LABEL_KEY[displayKey] ?? 'recommendation.verdict.INCOMPLETE')}
      </span>
      {showExplanation ? (
        <span className="text-[11px] text-gray-500 leading-snug">
          {t('recommendation.setupQualityExplanation')}
        </span>
      ) : null}
    </span>
  );
}
