import { CandidateViewModel } from '@/features/screener/viewModel';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import { ExternalLink, Gauge } from 'lucide-react';
import { t } from '@/i18n/t';

interface ScreenerCandidateIdentityCellProps {
  candidate: CandidateViewModel;
  onSymbolClick?: (ticker: string) => void;
}

/**
 * Identity cell showing ticker, company, sector, verdict badge, and confidence
 */
export default function ScreenerCandidateIdentityCell({
  candidate,
  onSymbolClick,
}: ScreenerCandidateIdentityCellProps) {
  const yahooUrl = `https://finance.yahoo.com/quote/${candidate.ticker}`;
  const confidenceValue = Number.isFinite(candidate.confidence)
    ? Math.max(0, Math.min(100, candidate.confidence <= 1 ? candidate.confidence * 100 : candidate.confidence))
    : null;
  
  return (
    <div className="flex flex-col gap-1">
      {/* Ticker link and verdict badge */}
      <div className="flex items-center gap-2">
        {onSymbolClick ? (
          <button
            type="button"
            onClick={() => onSymbolClick(candidate.ticker)}
            className="font-semibold text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            title={t('workspacePage.symbolDetails.openTitle', { ticker: candidate.ticker })}
          >
            {candidate.ticker}
          </button>
        ) : (
          <a
            href={yahooUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            title={t('screener.table.yahooTickerTitle', { ticker: candidate.ticker })}
          >
            {candidate.ticker}
          </a>
        )}
        {onSymbolClick ? (
          <a
            href={yahooUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title={t('screener.table.yahooTickerTitle', { ticker: candidate.ticker })}
            aria-label={t('screener.table.yahooTickerTitle', { ticker: candidate.ticker })}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
        <RecommendationBadge verdict={candidate.verdict} />
      </div>
      <CachedSymbolPriceChart ticker={candidate.ticker} />

      {/* Confidence */}
      <div className="inline-flex w-fit items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
        <Gauge className="h-3 w-3" />
        {confidenceValue == null
          ? t('screener.identity.confidenceUnknown')
          : t('screener.identity.confidenceLabel', { value: confidenceValue.toFixed(1) })}
      </div>

      {/* Company and metadata */}
      <div className="text-xs text-gray-500 dark:text-gray-500">
        <div>{candidate.name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span>{candidate.sector}</span>
          <span className="text-gray-400">•</span>
          <span className={candidate.currency === 'USD' ? 'text-green-700' : 'text-blue-700'}>
            {candidate.currency}
          </span>
        </div>
      </div>
    </div>
  );
}
