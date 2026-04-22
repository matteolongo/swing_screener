import { ExternalLink } from 'lucide-react';
import { CandidateViewModel } from '@/features/screener/viewModel';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import { t } from '@/i18n/t';
import { cn } from '@/utils/cn';

interface ScreenerCandidateIdentityCellProps {
  candidate: CandidateViewModel;
  onSymbolClick?: (ticker: string) => void;
  streak?: number;
}

/**
 * Simplified identity cell: ticker, verdict badge, company/sector secondary line.
 * Currency is shown as text color (green=USD, blue=EUR).
 * Border-left color reflects same-symbol mode and re-entry context.
 */
export default function ScreenerCandidateIdentityCell({
  candidate,
  onSymbolClick,
  streak,
}: ScreenerCandidateIdentityCellProps) {
  const yahooUrl = `https://finance.yahoo.com/quote/${candidate.ticker}`;

  const sameSymbolMode = candidate.sameSymbol?.mode;
  const priorTrades = candidate.original.priorTrades;
  const hasReentry = Boolean(priorTrades) && !sameSymbolMode;

  const borderClass =
    sameSymbolMode === 'ADD_ON'
      ? 'border-l-2 border-amber-400'
      : sameSymbolMode === 'MANAGE_ONLY'
        ? 'border-l-2 border-gray-400'
        : hasReentry
          ? 'border-l-2 border-amber-300'
          : undefined;

  const currentPositionEntry = candidate.sameSymbol?.currentPositionEntry;

  return (
    <div className={cn('flex flex-col gap-0.5', borderClass, borderClass ? 'pl-1.5' : undefined)}>
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
        {streak != null && streak >= 2 ? (
          <span className="ml-1 text-[10px] font-bold px-1 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
            {streak}d
          </span>
        ) : null}
        {sameSymbolMode === 'ADD_ON' ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {currentPositionEntry != null
              ? t('screener.identity.addOnWithEntry', { entry: currentPositionEntry.toFixed(2) })
              : t('screener.identity.addOnLabel')}
          </span>
        ) : null}
        {sameSymbolMode === 'MANAGE_ONLY' ? (
          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700 dark:bg-red-900/40 dark:text-red-300 opacity-75">
            {t('screener.identity.manageOnlyLabel')}
          </span>
        ) : null}
        {hasReentry ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {t('screener.identity.reentryLabel')}
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
