import { CandidateViewModel } from '@/features/screener/viewModel';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import { t } from '@/i18n/t';

interface ScreenerCandidateIdentityCellProps {
  candidate: CandidateViewModel;
}

/**
 * Identity cell showing ticker, company, sector, verdict badge, and confidence
 */
export default function ScreenerCandidateIdentityCell({
  candidate,
}: ScreenerCandidateIdentityCellProps) {
  const yahooUrl = `https://finance.yahoo.com/quote/${candidate.ticker}`;
  
  return (
    <div className="flex flex-col gap-1">
      {/* Ticker link and verdict badge */}
      <div className="flex items-center gap-2">
        <a
          href={yahooUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold"
          title={t('screener.table.yahooTickerTitle', { ticker: candidate.ticker })}
        >
          {candidate.ticker}
        </a>
        <RecommendationBadge verdict={candidate.verdict} />
      </div>

      {/* Confidence */}
      <div className="text-xs text-gray-600 dark:text-gray-400">
        {(candidate.confidence * 100).toFixed(0)}% confidence
      </div>

      {/* Company and metadata */}
      <div className="text-xs text-gray-500 dark:text-gray-500">
        <div>{candidate.name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span>{candidate.sector}</span>
          <span className="text-gray-400">•</span>
          <span className={candidate.currency === 'USD' ? 'text-green-600' : 'text-blue-600'}>
            {candidate.currency}
          </span>
        </div>
      </div>
    </div>
  );
}
