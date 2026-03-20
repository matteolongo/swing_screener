import { ExternalLink } from 'lucide-react';
import { CandidateViewModel } from '@/features/screener/viewModel';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import { t } from '@/i18n/t';

interface ScreenerCandidateIdentityCellProps {
  candidate: CandidateViewModel;
  onSymbolClick?: (ticker: string) => void;
}

/**
 * Simplified identity cell: ticker, verdict badge, company/sector secondary line.
 * Currency is shown as text color (green=USD, blue=EUR).
 */
export default function ScreenerCandidateIdentityCell({
  candidate,
  onSymbolClick,
}: ScreenerCandidateIdentityCellProps) {
  const yahooUrl = `https://finance.yahoo.com/quote/${candidate.ticker}`;

  return (
    <div className="flex flex-col gap-0.5">
      {/* Ticker + verdict + external link */}
      <div className="flex items-center gap-1.5">
        {onSymbolClick ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSymbolClick(candidate.ticker);
            }}
            className={`font-bold text-sm hover:underline ${candidate.currency === 'USD' ? 'text-green-700 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}
            title={t('workspacePage.symbolDetails.openTitle', { ticker: candidate.ticker })}
          >
            {candidate.ticker}
          </button>
        ) : (
          <a
            href={yahooUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-bold text-sm hover:underline ${candidate.currency === 'USD' ? 'text-green-700 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}
            title={t('screener.table.yahooTickerTitle', { ticker: candidate.ticker })}
          >
            {candidate.ticker}
          </a>
        )}
        <a
          href={yahooUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          title={t('screener.table.yahooTickerTitle', { ticker: candidate.ticker })}
          aria-label={t('screener.table.yahooTickerTitle', { ticker: candidate.ticker })}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
        <RecommendationBadge verdict={candidate.verdict} />
        {candidate.sameSymbol?.mode === 'ADD_ON' ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {t('screener.identity.addOnLabel')}
          </span>
        ) : null}
        {candidate.sameSymbol?.mode === 'MANAGE_ONLY' ? (
          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
            {t('screener.identity.inPositionLabel')}
          </span>
        ) : null}
      </div>

      {/* Company name + sector */}
      <div className="text-[11px] text-gray-500 dark:text-gray-500 leading-tight">
        <span>{candidate.name}</span>
        {candidate.sector ? (
          <>
            <span className="mx-1 text-gray-400">·</span>
            <span>{candidate.sector}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
