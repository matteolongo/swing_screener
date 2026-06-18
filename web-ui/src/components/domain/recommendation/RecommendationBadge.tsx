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
  RECOMMENDED: 'bg-success/10 text-success',
  NOT_RECOMMENDED: 'bg-danger/10 text-danger',
  INCOMPLETE: 'bg-warning/10 text-warning',
  UNKNOWN: 'bg-foreground/5 text-muted',
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
          'text-xs px-2 py-1 rounded whitespace-nowrap',
          VERDICT_STYLES[displayKey],
          className,
        )}
      >
        {t(VERDICT_LABEL_KEY[displayKey] ?? 'recommendation.verdict.INCOMPLETE')}
      </span>
      {showExplanation ? (
        <span className="text-[11px] text-muted leading-snug">
          {t('recommendation.setupQualityExplanation')}
        </span>
      ) : null}
    </span>
  );
}
