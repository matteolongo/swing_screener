import type { Recommendation } from '@/types/recommendation';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import { t } from '@/i18n/t';

interface RecommendationSummaryProps {
  recommendation?: Recommendation;
}

export default function RecommendationSummary({ recommendation }: RecommendationSummaryProps) {
  const verdict = recommendation?.verdict ?? 'UNKNOWN';
  const reasons = recommendation?.reasonsShort ?? [];

  return (
    <div
      className={`p-4 rounded ${
        verdict === 'RECOMMENDED' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
      }`}
    >
      <div className="flex items-center gap-2">
        <RecommendationBadge verdict={verdict} />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {t('recommendation.summary')}
        </span>
      </div>
      {reasons.length ? (
        <ul className="list-disc ml-5 mt-2 space-y-1 text-sm">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
          {t('recommendation.noDetails')}
        </div>
      )}
    </div>
  );
}
