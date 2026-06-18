import { ExternalLink } from 'lucide-react';
import { CandidateViewModel } from '@/features/screener/viewModel';
import RecommendationBadge from '@/components/domain/recommendation/RecommendationBadge';
import { t } from '@/i18n/t';

interface ScreenerCandidateIdentityCellProps {
  candidate: CandidateViewModel;
  onSymbolClick?: (ticker: string) => void;
  streak?: number;
}

/**
 * Simplified identity cell: ticker, verdict badge, company/sector secondary line.
 * Currency is shown as text color (green=USD, blue=EUR).
 */
export default function ScreenerCandidateIdentityCell({
  candidate,
  onSymbolClick,
  streak,
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
            className={`font-bold text-sm hover:underline ${candidate.currency === 'USD' ? 'text-success' : 'text-primary'}`}
            title={t('workspacePage.symbolDetails.openTitle', { ticker: candidate.ticker })}
          >
            {candidate.ticker}
          </button>
        ) : (
          <a
            href={yahooUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`font-bold text-sm hover:underline ${candidate.currency === 'USD' ? 'text-success' : 'text-primary'}`}
            title={t('screener.table.yahooTickerTitle', { ticker: candidate.ticker })}
          >
            {candidate.ticker}
          </a>
        )}
        <a
          href={yahooUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-muted hover:text-muted"
          title={t('screener.table.yahooTickerTitle', { ticker: candidate.ticker })}
          aria-label={t('screener.table.yahooTickerTitle', { ticker: candidate.ticker })}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
        <RecommendationBadge verdict={candidate.verdict} />
        {streak != null && streak >= 2 ? (
          <span
            className="ml-1 whitespace-nowrap rounded bg-warning/10 px-1 py-0.5 text-[10px] font-bold text-warning"
            title={t('screener.identity.streakTitle', { count: streak })}
          >
            {streak}d
          </span>
        ) : null}
        {candidate.sameSymbol?.mode === 'ADD_ON' ? (
          <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning">
            {t('screener.identity.addOnLabel')}
          </span>
        ) : null}
        {candidate.sameSymbol?.mode === 'MANAGE_ONLY' ? (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
            {t('screener.identity.inPositionLabel')}
          </span>
        ) : null}
      </div>

      {/* Company name + sector */}
      <div className="text-[11px] text-muted leading-tight">
        <span>{candidate.name}</span>
        {candidate.sector ? (
          <>
            <span className="mx-1 text-muted">·</span>
            <span>{candidate.sector}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
