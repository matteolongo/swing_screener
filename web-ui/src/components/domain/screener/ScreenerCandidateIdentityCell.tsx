import type { ReactNode } from 'react';
import { CandidateViewModel } from '@/features/screener/viewModel';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import CachedSymbolPriceChart from '@/components/domain/market/CachedSymbolPriceChart';
import { BarChart3, ExternalLink, Gauge } from 'lucide-react';
import { t } from '@/i18n/t';
import { formatConfidencePercent, formatScreenerScore } from '@/utils/formatters';

interface ScreenerCandidateIdentityCellProps {
  candidate: CandidateViewModel;
  onSymbolClick?: (ticker: string) => void;
  watchContent?: ReactNode;
}

/**
 * Identity cell showing ticker, company, sector, verdict badge, and confidence
 */
export default function ScreenerCandidateIdentityCell({
  candidate,
  onSymbolClick,
  watchContent,
}: ScreenerCandidateIdentityCellProps) {
  const yahooUrl = `https://finance.yahoo.com/quote/${candidate.ticker}`;
  const confidenceValue = Number.isFinite(candidate.confidence)
    ? formatConfidencePercent(candidate.confidence)
    : null;
  const scoreValue = Number.isFinite(candidate.score)
    ? formatScreenerScore(candidate.score)
    : null;
  const fundamentalsCoverage = candidate.fundamentalsCoverageStatus;
  const fundamentalsFreshness = candidate.fundamentalsFreshnessStatus;

  const fundamentalsBadgeClass =
    fundamentalsCoverage === 'supported'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : fundamentalsCoverage === 'partial'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
        : fundamentalsCoverage === 'unsupported'
          ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

  return (
    <div className="flex flex-col gap-1">
      {/* Ticker link and verdict badge */}
      <div className="flex items-center gap-2">
        {onSymbolClick ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSymbolClick(candidate.ticker);
            }}
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
        {candidate.sameSymbol?.mode === 'ADD_ON' ? (
          <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {t('screener.identity.addOnLabel')}
          </span>
        ) : null}
        {candidate.sameSymbol?.mode === 'MANAGE_ONLY' ? (
          <span className="rounded bg-violet-100 px-2 py-1 text-xs text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
            {t('screener.identity.inPositionLabel')}
          </span>
        ) : null}
      </div>
      {watchContent}
      <CachedSymbolPriceChart ticker={candidate.ticker} />

      <div className="flex flex-wrap items-center gap-2">
        {scoreValue != null ? (
          <div className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <BarChart3 className="h-3 w-3" />
            {t('screener.identity.scoreLabel', { value: scoreValue })}
          </div>
        ) : null}
        <div className="inline-flex w-fit items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
          <Gauge className="h-3 w-3" />
          {confidenceValue == null
            ? t('screener.identity.confidenceUnknown')
            : t('screener.identity.confidenceLabel', { value: confidenceValue })}
        </div>
        {fundamentalsCoverage ? (
          <div className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs ${fundamentalsBadgeClass}`}>
            <BarChart3 className="h-3 w-3" />
            <span>
              {fundamentalsFreshness
                ? t('screener.identity.fundamentalsLabelWithFreshness', { coverage: fundamentalsCoverage, freshness: fundamentalsFreshness })
                : t('screener.identity.fundamentalsLabel', { coverage: fundamentalsCoverage })}
            </span>
          </div>
        ) : null}
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
        {candidate.fundamentalsSummary ? (
          <div className="mt-1 text-gray-600 dark:text-gray-400">{candidate.fundamentalsSummary}</div>
        ) : null}
      </div>
    </div>
  );
}
