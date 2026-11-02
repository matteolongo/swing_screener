import { Link } from 'react-router-dom';
import type { ScreenerResponse } from '@/features/screener/types';
import { getResultCandleDates, getResultMarketStatus, marketDate, summarizeResultQuality } from '@/features/screener/resultQuality';
import { t } from '@/i18n/t';
import { formatDateTime } from '@/utils/formatters';

export default function ResultQualitySummary({ result, completedAt, isRefreshing, error }: {
  result: ScreenerResponse | null;
  completedAt?: string;
  isRefreshing: boolean;
  error: Error | null;
}) {
  if (!result) return <p role="status" className="mt-3 text-sm text-muted">{t(isRefreshing ? 'screener.quality.initialLoading' : 'screener.quality.unavailable')}</p>;
  const marketStatus = getResultMarketStatus(result);
  const dates = getResultCandleDates(result);
  const warnings = result.warnings ?? [];
  const countsKnown = Number.isFinite(result.totalScreened) && Number.isFinite(result.totalWithMarketData);
  const quality = countsKnown ? summarizeResultQuality({ requested: result.totalScreened,
    evaluated: result.totalWithMarketData!, warnings, marketStatus }) : null;
  return (
    <section aria-label={t('screener.quality.title')} className="mt-3 space-y-2 rounded-lg border border-border bg-surface p-3 text-sm">
      {error ? <p role="status" className="text-warning">{t('screener.quality.cachedAfterFailure')}</p>
        : isRefreshing ? <p role="status" className="text-muted">{t('screener.quality.previousWhileRefreshing')}</p> : null}
      <p className="font-medium">{t(quality ? `screener.quality.${quality.coverage}` : 'screener.quality.coverageUnavailable')}</p>
      {countsKnown ? <p>{t('screener.quality.counts', { requested: result.totalScreened, evaluated: result.totalWithMarketData!, matched: result.totalReturnedCandidates ?? result.candidates.length })}</p> : null}
      <p className="text-xs text-muted">{t('screener.quality.countsHelp')}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>{t(`screener.quality.market.${marketStatus}`)}</span>
        <span>{t('screener.quality.sessionDate', { date: marketDate(result.asofDate) ?? t('screener.quality.unknownDate') })}</span>
        <span>{dates.length > 1
          ? t('screener.quality.candleDates', { first: dates[0], last: dates[dates.length - 1] })
          : t('screener.quality.candleDate', { date: dates[0] ?? t('screener.quality.unknownDate') })}</span>
        {completedAt ? <span>{t('screener.quality.requestCompleted', { time: formatDateTime(completedAt) })}</span> : null}
      </div>
      {warnings.length > 0 ? <div role="note" aria-label={t('screener.quality.warnings')}>
        <p className="font-medium text-warning">{t('screener.quality.warnings')}</p>
        <ul className="list-disc space-y-1 pl-5 text-xs break-words">{warnings.map((warning, index) => <li key={`${index}:${warning}`}>{warning}</li>)}</ul>
        <Link to="/datasources" className="text-primary underline">{t('screener.quality.providerDetails')}</Link>
      </div> : null}
    </section>
  );
}
